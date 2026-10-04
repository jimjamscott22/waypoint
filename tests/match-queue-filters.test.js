import test from 'node:test';
import assert from 'node:assert/strict';
import { SORT_OPTIONS, sortMatches } from '../src/lib/matchQueueFilters.js';

const queue = [
  { id: 'a', score: 60, publishedAt: '2026-01-01T00:00:00Z' },
  { id: 'b', score: 90, publishedAt: '2026-01-03T00:00:00Z' },
  { id: 'c', score: 90, publishedAt: '2026-01-02T00:00:00Z' },
];

test('sorts by score descending, breaking ties by original order', () => {
  assert.deepEqual(sortMatches(queue, 'score').map(match => match.id), ['b', 'c', 'a']);
});

test('sorts by publish date descending', () => {
  assert.deepEqual(sortMatches(queue, 'date').map(match => match.id), ['b', 'c', 'a']);
});

test('returns the input unchanged for an unknown sort id', () => {
  assert.deepEqual(sortMatches(queue, 'bogus').map(match => match.id), ['a', 'b', 'c']);
});

test('exposes the sort option ids the UI renders, in display order', () => {
  assert.deepEqual(SORT_OPTIONS.map(option => option.id), ['score', 'date']);
});
