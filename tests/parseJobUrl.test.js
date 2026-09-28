import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildApp } from '../server/app.js';
import {
  assertPublicHttpUrl,
  createJobUrlParser,
  extractJobDraftFromHtml,
  isPrivateIp,
} from '../server/jobs/parseJobUrl.js';
import { emptyJobDraft, parseJobUrlWithFallback } from '../src/lib/parseJobUrl.js';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const jobPostingHtml = readFileSync(join(fixtureDir, 'fixtures', 'job-posting.html'), 'utf8');

test('extracts JSON-LD job fields and leaves contact blank', () => {
  const draft = extractJobDraftFromHtml(jobPostingHtml, 'https://jobs.example.test/widget-engineer');
  assert.deepEqual(draft, {
    role: 'Widget Engineer',
    company: 'Acme Corp',
    location: 'Auburn, NY, US',
    salary: '80000-95000 YEAR',
    contact: '',
    url: 'https://jobs.example.test/widget-engineer',
  });
});

test('falls back to Open Graph and title metadata when JSON-LD is absent', () => {
  const html = `
    <html><head>
      <meta property="og:title" content="Support Specialist" />
      <meta property="og:site_name" content="Globex" />
      <title>Support Specialist | Globex</title>
    </head><body></body></html>
  `;
  const draft = extractJobDraftFromHtml(html, 'https://careers.example.test/jobs/1');
  assert.equal(draft.role, 'Support Specialist');
  assert.equal(draft.company, 'Globex');
  assert.equal(draft.location, '');
  assert.equal(draft.salary, '');
  assert.equal(draft.contact, '');
});

test('rejects private and localhost targets before fetching', async () => {
  await assert.rejects(
    () => assertPublicHttpUrl('http://127.0.0.1/jobs/1'),
    error => error.code === 'BLOCKED_JOB_URL',
  );
  await assert.rejects(
    () => assertPublicHttpUrl('http://localhost/jobs/1'),
    error => error.code === 'BLOCKED_JOB_URL',
  );
  await assert.rejects(
    () => assertPublicHttpUrl('ftp://jobs.example.test/jobs/1'),
    error => error.code === 'INVALID_JOB_URL',
  );
});

test('rejects hosts that resolve to private addresses', async () => {
  await assert.rejects(
    () => assertPublicHttpUrl('https://jobs.example.test/jobs/1', async () => ({ address: '10.0.0.4', family: 4 })),
    error => error.code === 'BLOCKED_JOB_URL',
  );
});

test('parser surfaces fetch timeouts as client-safe failures', async () => {
  const parser = createJobUrlParser({
    lookup: async () => ({ address: '93.184.216.34', family: 4 }),
    fetchImpl: async () => {
      throw new Error('The operation was aborted due to timeout');
    },
  });

  await assert.rejects(
    () => parser.parse('https://jobs.example.test/jobs/timeout'),
    error => error.code === 'JOB_URL_FETCH_FAILED' && /timeout/i.test(error.message),
  );
});

test('parse-url route returns extracted draft using injected parser', async t => {
  const services = {
    config: { adzuna: { configured: false }, geocoder: { userAgent: '' } },
    pool: {},
    jobs: { list: async () => [], isEmpty: async () => true, create: async input => ({ id: 'job-1', ...input }) },
    queries: { list: async () => [] },
    listings: { listNew: async () => [] },
    runs: { latest: async () => null },
    geocoder: null,
    insights: { get: async () => ({}) },
    discovery: null,
    jobUrlParser: {
      parse: async url => extractJobDraftFromHtml(jobPostingHtml, url),
    },
  };
  const app = buildApp({ services, serveStatic: false });
  await app.ready();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/jobs/parse-url',
    payload: { url: 'https://jobs.example.test/widget-engineer' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().draft.role, 'Widget Engineer');
});

test('parseJobUrlWithFallback keeps capture alive when parsing fails', async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 502,
    json: async () => ({
      error: { code: 'JOB_URL_FETCH_FAILED', message: 'Job posting request failed with HTTP 404' },
    }),
  });
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await parseJobUrlWithFallback('https://jobs.example.test/broken');
  assert.equal(result.error?.message, 'Job posting request failed with HTTP 404');
  assert.deepEqual(result.draft, emptyJobDraft('https://jobs.example.test/broken'));
});

test('isPrivateIp covers common RFC1918 and loopback ranges', () => {
  assert.equal(isPrivateIp('127.0.0.1'), true);
  assert.equal(isPrivateIp('10.1.2.3'), true);
  assert.equal(isPrivateIp('192.168.0.4'), true);
  assert.equal(isPrivateIp('93.184.216.34'), false);
});
