import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DISCOVERY_FILTERS,
  countActiveDiscoveryFilters,
  resetDiscoveryPage,
  toDiscoverySearchParams,
} from '../src/lib/discoveryFilters.js';

test('serializes nothing when every filter is left at its default', () => {
  assert.equal(toDiscoverySearchParams(DEFAULT_DISCOVERY_FILTERS).toString(), '');
  assert.equal(toDiscoverySearchParams({}).toString(), '');
});

test('omits blank values and keeps a stable key order', () => {
  const search = toDiscoverySearchParams({
    ...DEFAULT_DISCOVERY_FILTERS,
    pageSize: 50,
    sort: 'nearest',
    q: 'systems',
    roleFamily: 'it-support',
    minScore: 60,
    distanceBand: 'preferred',
    page: 3,
  });

  // Order follows the declared key order, not the order of the object literal.
  assert.equal(
    search.toString(),
    'q=systems&roleFamily=it-support&distanceBand=preferred&minScore=60&sort=nearest&page=3&pageSize=50'
  );
});

test('encodes free text safely and serializes booleans as words', () => {
  const search = toDiscoverySearchParams({ q: 'systems & 100% admin', status: 'saved' });
  assert.equal(search.get('q'), 'systems & 100% admin');
  assert.equal(search.toString(), 'q=systems+%26+100%25+admin&status=saved');

  assert.equal(toDiscoverySearchParams({ q: true }).get('q'), 'true');
  assert.equal(toDiscoverySearchParams({ q: false }).get('q'), 'false');
});

test('counts only active filters, ignoring sort and pagination', () => {
  assert.equal(countActiveDiscoveryFilters(DEFAULT_DISCOVERY_FILTERS), 0);
  assert.equal(countActiveDiscoveryFilters({ ...DEFAULT_DISCOVERY_FILTERS, sort: 'newest', page: 4, pageSize: 100 }), 0);
  assert.equal(
    countActiveDiscoveryFilters({ ...DEFAULT_DISCOVERY_FILTERS, q: 'admin', status: 'saved', minScore: 70 }),
    3
  );
});

test('returns to the first page when filters change', () => {
  assert.deepEqual(
    resetDiscoveryPage({ ...DEFAULT_DISCOVERY_FILTERS, page: 7, q: 'admin' }),
    { ...DEFAULT_DISCOVERY_FILTERS, page: 1, q: 'admin' }
  );
});
