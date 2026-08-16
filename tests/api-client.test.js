import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/lib/apiClient.js';

test('advertises JSON only for requests that include a JSON body', async t => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (path, options) => {
    requests.push({ path, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
    };
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await api.saveListing('listing-1');
  await api.createJob({ role: 'Admin', company: 'Acme', stage: 'Saved' });
  await api.insights('30d');

  assert.deepEqual(requests, [
    {
      path: '/api/listings/listing-1/save',
      options: { method: 'POST', headers: {} },
    },
    {
      path: '/api/jobs',
      options: {
        method: 'POST',
        body: '{"role":"Admin","company":"Acme","stage":"Saved"}',
        headers: { 'Content-Type': 'application/json' },
      },
    },
    {
      path: '/api/insights?range=30d',
      options: { headers: {} },
    },
  ]);
});

function captureRequests(t) {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (path, options) => {
    requests.push({ path, options });
    return { ok: true, status: 200, json: async () => ({}) };
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  return requests;
}

test('encodes every discovery request path and body', async t => {
  const requests = captureRequests(t);

  await api.listQueries();
  await api.resolveQueryLocation('Auburn NY');
  await api.previewQuery({ name: 'Auburn', roleFamilies: ['it-support'] });
  await api.runQuery('query-1');
  await api.runDetail('run-1');

  assert.deepEqual(requests.map(entry => entry.path), [
    '/api/queries',
    '/api/queries/resolve-location',
    '/api/queries/preview',
    '/api/queries/query-1/runs',
    '/api/scrape-runs/run-1',
  ]);
  assert.equal(requests[1].options.body, '{"query":"Auburn NY"}');
  assert.equal(requests[2].options.body, '{"name":"Auburn","roleFamilies":["it-support"]}');
  assert.equal(requests[3].options.method, 'POST');
  assert.equal(requests[4].options.method, undefined);
});

test('builds listing requests from filters and omits defaults', async t => {
  const requests = captureRequests(t);

  await api.listListings();
  await api.listListings({ status: 'new', sort: 'best', page: 1, pageSize: 25 });
  await api.listListings({ q: 'systems admin', roleFamily: 'it-support', sort: 'nearest', page: 2 });

  assert.deepEqual(requests.map(entry => entry.path), [
    '/api/listings',
    '/api/listings',
    '/api/listings?q=systems+admin&roleFamily=it-support&sort=nearest&page=2',
  ]);
});
