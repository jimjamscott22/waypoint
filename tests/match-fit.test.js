import test from 'node:test';
import assert from 'node:assert/strict';
import { FIT_FILTERS, countByFit, filterByFit, withFit } from '../src/lib/matchFit.js';

const queue = withFit([
  { id: 'a', role: 'Junior IT Support Technician', description: '' },
  { id: 'b', title: 'Senior Systems Administrator', role: 'Senior Systems Administrator', description: '' },
  { id: 'c', role: 'Help Desk Analyst II', description: '' },
  { id: 'd', role: 'IT Technician', description: null },
]);

test('annotates each match with a fit verdict without dropping fields', () => {
  assert.deepEqual(queue.map(match => match.fit.fit), ['entry', 'senior', 'stretch', 'unknown']);
  assert.equal(queue[1].title, 'Senior Systems Administrator');
});

test('filters by fit, keeping stretch and unknown when only hiding senior roles', () => {
  assert.deepEqual(filterByFit(queue, 'all').map(match => match.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(filterByFit(queue, 'hide-senior').map(match => match.id), ['a', 'c', 'd']);
  assert.deepEqual(filterByFit(queue, 'entry').map(match => match.id), ['a']);
  assert.deepEqual(filterByFit(queue, 'bogus').map(match => match.id), ['a', 'b', 'c', 'd']);
});

test('counts every filter option', () => {
  assert.deepEqual(countByFit(queue), { all: 4, 'hide-senior': 3, entry: 1 });
  assert.deepEqual(countByFit([]), { all: 0, 'hide-senior': 0, entry: 0 });
  assert.deepEqual(Object.keys(countByFit(queue)), FIT_FILTERS.map(option => option.id));
});
