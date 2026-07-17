import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../server/app.js';

function fakeServices() {
  return {
    config: { adzuna: { configured: false } },
    pool: {},
    jobs: { list: async () => [], isEmpty: async () => true, create: async input => ({ id: 'job-1', ...input }) },
    queries: { list: async () => [] },
    listings: { listNew: async () => [] },
    runs: { latest: async () => null },
    scraper: null,
  };
}

test('returns centralized bootstrap state', async t => {
  const app = buildApp({ services: fakeServices(), serveStatic: false });
  t.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: '/api/bootstrap' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    jobs: [], queries: [], matches: [], latestRun: null, serverJobsEmpty: true,
    provider: { name: 'Adzuna', attributionUrl: 'https://www.adzuna.com/' }, providerConfigured: false,
  });
});

test('validates job request bodies with a consistent error shape', async t => {
  const app = buildApp({ services: fakeServices(), serveStatic: false });
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/jobs', payload: { role: 'Admin' } });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'VALIDATION_ERROR');
});

test('reports an unconfigured provider for manual runs', async t => {
  const app = buildApp({ services: fakeServices(), serveStatic: false });
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/scrape-runs' });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json().error, { code: 'PROVIDER_NOT_CONFIGURED', message: 'Adzuna credentials are not configured' });
});

test('serves the built SPA while keeping unknown API routes JSON-only', async t => {
  const app = buildApp({ services: fakeServices() });
  t.after(() => app.close());

  const page = await app.inject({ method: 'GET', url: '/jobs/saved' });
  assert.equal(page.statusCode, 200);
  assert.match(page.headers['content-type'], /^text\/html/);
  assert.match(page.body, /<div id="root"><\/div>/);

  const assetPath = page.body.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert.ok(assetPath);
  const asset = await app.inject({ method: 'GET', url: assetPath });
  assert.equal(asset.statusCode, 200);
  assert.match(asset.headers['content-type'], /javascript/);

  const missingApi = await app.inject({ method: 'GET', url: '/api/not-real' });
  assert.equal(missingApi.statusCode, 404);
  assert.deepEqual(missingApi.json().error, { code: 'NOT_FOUND', message: 'API endpoint not found' });
});
