import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdzunaClient, normalizeAdzunaJob } from '../server/scraper/adzuna.js';

test('normalizes an Adzuna result into the provider-neutral listing shape', () => {
  const listing = normalizeAdzunaJob({
    id: 42,
    title: ' Systems Administrator ',
    company: { display_name: 'Northwind' },
    location: { display_name: 'Madison, WI' },
    salary_min: 70000,
    salary_max: 85000,
    description: 'Maintain Linux systems',
    redirect_url: 'https://example.test/job/42',
    created: '2026-07-16T10:00:00Z',
  });
  assert.deepEqual(listing, {
    provider: 'adzuna', providerJobId: '42', title: 'Systems Administrator', company: 'Northwind',
    location: 'Madison, WI', salaryMin: 70000, salaryMax: 85000, currency: 'USD',
    description: 'Maintain Linux systems', url: 'https://example.test/job/42',
    publishedAt: '2026-07-16T10:00:00.000Z',
  });
});

test('keeps missing Adzuna salary values null rather than coercing them to zero', () => {
  const listing = normalizeAdzunaJob({
    id: 43, title: 'IT Support', salary_min: null, salary_max: '',
    redirect_url: 'https://example.test/job/43', created: '2026-07-16T10:00:00Z',
  });
  assert.equal(listing.salaryMin, null);
  assert.equal(listing.salaryMax, null);
});

test('retries retryable responses and does not expose credentials in errors', async () => {
  let attempts = 0;
  const client = createAdzunaClient({
    appId: 'secret-id', appKey: 'secret-key', sleep: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) return { ok: false, status: 503, headers: { get: () => null } };
      return { ok: true, json: async () => ({ results: [] }) };
    },
  });
  assert.deepEqual(await client.search({ keywords: 'systems', location: '' }), []);
  assert.equal(attempts, 3);
});

test('times out stalled requests and stops after two retries', async () => {
  let attempts = 0;
  const client = createAdzunaClient({
    appId: 'test-id', appKey: 'test-key', timeoutMs: 5, sleep: async () => {},
    fetchImpl: async (_url, { signal }) => {
      attempts += 1;
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    },
  });
  await assert.rejects(client.search({ keywords: 'systems', location: '' }), /timed out/i);
  assert.equal(attempts, 3);
});
