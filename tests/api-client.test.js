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
