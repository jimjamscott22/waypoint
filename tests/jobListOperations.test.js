import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteJob,
  duplicateJob,
  moveVisibleJob,
  parseStoredJobs,
  reorderVisibleJobs,
  restoreJob,
  updateJob,
} from '../src/lib/jobListOperations.js';

const jobs = [
  { id: 'a', role: 'Alpha', stage: 'Saved' },
  { id: 'hidden-1', role: 'Hidden one', stage: 'Applied' },
  { id: 'b', role: 'Beta', stage: 'Saved' },
  { id: 'hidden-2', role: 'Hidden two', stage: 'Closed' },
  { id: 'c', role: 'Gamma', stage: 'Saved' },
];

test('reorders visible jobs without moving hidden jobs from their slots', () => {
  const result = reorderVisibleJobs(jobs, ['c', 'a', 'b']);
  assert.deepEqual(result.map(job => job.id), ['c', 'hidden-1', 'a', 'hidden-2', 'b']);
  assert.deepEqual(jobs.map(job => job.id), ['a', 'hidden-1', 'b', 'hidden-2', 'c']);
});

test('moves visible jobs by one position and leaves boundary moves unchanged', () => {
  assert.deepEqual(moveVisibleJob(jobs, ['a', 'b', 'c'], 'b', -1).map(job => job.id), ['b', 'hidden-1', 'a', 'hidden-2', 'c']);
  assert.strictEqual(moveVisibleJob(jobs, ['a', 'b', 'c'], 'a', -1), jobs);
});

test('updates a job immutably without allowing its id to change', () => {
  const result = updateJob(jobs, 'b', { role: 'Better Beta', id: 'wrong' });
  assert.equal(result[2].role, 'Better Beta');
  assert.equal(result[2].id, 'b');
  assert.equal(jobs[2].role, 'Beta');
});

test('duplicates directly after the source with a copy label and stable new id', () => {
  const result = duplicateJob(jobs, 'b', 'copy-b');
  assert.equal(result.duplicate.id, 'copy-b');
  assert.equal(result.duplicate.role, 'Beta (Copy)');
  assert.deepEqual(result.jobs.map(job => job.id), ['a', 'hidden-1', 'b', 'copy-b', 'hidden-2', 'c']);
});

test('deletes and restores a job at its exact global index', () => {
  const removed = deleteJob(jobs, 'b');
  assert.deepEqual(removed.jobs.map(job => job.id), ['a', 'hidden-1', 'hidden-2', 'c']);
  assert.equal(removed.snapshot.index, 2);
  assert.deepEqual(restoreJob(removed.jobs, removed.snapshot), jobs);
});

test('accepts an empty persisted list and recovers from corrupt data', () => {
  const fallback = [{ id: 'seed' }];
  assert.deepEqual(parseStoredJobs('[]', fallback), { jobs: [], notice: null });
  const recovered = parseStoredJobs('{broken', fallback);
  assert.strictEqual(recovered.jobs, fallback);
  assert.match(recovered.notice, /invalid/);
});
