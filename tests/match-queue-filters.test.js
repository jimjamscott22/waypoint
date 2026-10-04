import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTANCE_FILTERS, SORT_OPTIONS, WORK_TYPE_FILTERS, countByDistance, countByWorkType, filterByDistance, filterByWorkType, sortMatches } from '../src/lib/matchQueueFilters.js';

const queue = [
  { id: 'a', score: 60, publishedAt: '2026-01-05T00:00:00Z', contractTime: 'full_time', contractType: 'permanent', matchedQueries: [{ distanceBand: 'preferred', distanceMiles: 5 }] },
  { id: 'b', score: 90, publishedAt: '2026-01-03T00:00:00Z', contractTime: 'part_time', contractType: 'contract', matchedQueries: [{ distanceBand: 'expanded', distanceMiles: 20 }] },
  { id: 'c', score: 90, publishedAt: '2026-01-02T00:00:00Z', contractTime: null, contractType: null, matchedQueries: [] },
];

test('sorts by score descending, breaking ties by original order', () => {
  assert.deepEqual(sortMatches(queue, 'score').map(match => match.id), ['b', 'c', 'a']);
});

test('sorts by publish date descending', () => {
  assert.deepEqual(sortMatches(queue, 'date').map(match => match.id), ['a', 'b', 'c']);
});

test('returns the input unchanged for an unknown sort id', () => {
  assert.deepEqual(sortMatches(queue, 'bogus').map(match => match.id), ['a', 'b', 'c']);
});

test('exposes the sort option ids the UI renders, in display order', () => {
  assert.deepEqual(SORT_OPTIONS.map(option => option.id), ['score', 'date']);
});

test('filters by work type', () => {
  assert.deepEqual(filterByWorkType(queue, 'all').map(match => match.id), ['a', 'b', 'c']);
  assert.deepEqual(filterByWorkType(queue, 'full-time').map(match => match.id), ['a']);
  assert.deepEqual(filterByWorkType(queue, 'part-time').map(match => match.id), ['b']);
  assert.deepEqual(filterByWorkType(queue, 'contract').map(match => match.id), ['b']);
  assert.deepEqual(filterByWorkType(queue, 'bogus').map(match => match.id), ['a', 'b', 'c']);
});

test('counts every work type option', () => {
  assert.deepEqual(countByWorkType(queue), { all: 3, 'full-time': 1, 'part-time': 1, contract: 1 });
  assert.deepEqual(countByWorkType([]), { all: 0, 'full-time': 0, 'part-time': 0, contract: 0 });
  assert.deepEqual(Object.keys(countByWorkType(queue)), WORK_TYPE_FILTERS.map(option => option.id));
});

test('filters by distance band', () => {
  assert.deepEqual(filterByDistance(queue, 'all').map(match => match.id), ['a', 'b', 'c']);
  assert.deepEqual(filterByDistance(queue, 'preferred').map(match => match.id), ['a']);
  assert.deepEqual(filterByDistance(queue, 'expanded').map(match => match.id), ['b']);
  assert.deepEqual(filterByDistance(queue, 'bogus').map(match => match.id), ['a', 'b', 'c']);
});

test('counts every distance option, excluding matches with no distance data from either band', () => {
  assert.deepEqual(countByDistance(queue), { all: 3, preferred: 1, expanded: 1 });
  assert.deepEqual(countByDistance([]), { all: 0, preferred: 0, expanded: 0 });
  assert.deepEqual(Object.keys(countByDistance(queue)), DISTANCE_FILTERS.map(option => option.id));
});
