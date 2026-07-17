import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLegacyJobs } from '../src/lib/legacyImport.js';

test('validates and sanitizes legacy jobs without preserving non-UUID browser IDs', () => {
  const result = parseLegacyJobs(JSON.stringify([{
    id: `draft-${crypto.randomUUID()}`, role: 'Systems Administrator', company: 'Example', stage: 'Saved',
    location: 'Remote', urgent: true, extraBrowserField: 'ignored',
  }]));
  assert.equal(result.error, null);
  assert.deepEqual(result.jobs, [{
    role: 'Systems Administrator', company: 'Example', stage: 'Saved', location: 'Remote',
    url: null, urgent: true, isDraft: false,
  }]);
});

test('rejects invalid records and imports larger than 500 jobs', () => {
  assert.match(parseLegacyJobs(JSON.stringify([{ role: 'Missing stage', company: 'Example' }])).error, /required fields/);
  assert.match(parseLegacyJobs(JSON.stringify(Array.from({ length: 501 }, () => ({})))).error, /500-job/);
});
