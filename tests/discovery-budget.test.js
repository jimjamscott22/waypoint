import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestBudget } from '../server/discovery/budget.js';
import { providerLabel, providerIds } from '../server/providers.js';

const adzuna = { id: 'adzuna' };
const usajobs = { id: 'usajobs' };
const greenhouse = { id: 'greenhouse' };

test('gives a lone provider the whole configured total', () => {
  const budget = createRequestBudget(20, [adzuna]);
  assert.equal(budget.remainingFor('adzuna'), 20);
  assert.equal(budget.exhausted(), false);
});

test('splits the total across providers and hands remainders to the earliest', () => {
  const budget = createRequestBudget(20, [adzuna, usajobs]);
  assert.equal(budget.remainingFor('adzuna'), 10);
  assert.equal(budget.remainingFor('usajobs'), 10);

  // 20 across three is 6 each with 2 left over, so the first two get one more.
  const uneven = createRequestBudget(20, [adzuna, usajobs, greenhouse]);
  assert.equal(uneven.remainingFor('adzuna'), 7);
  assert.equal(uneven.remainingFor('usajobs'), 7);
  assert.equal(uneven.remainingFor('greenhouse'), 6);

  const total = ['adzuna', 'usajobs', 'greenhouse'].reduce((sum, id) => sum + uneven.remainingFor(id), 0);
  assert.equal(total, 20, 'the split must not change the overall request ceiling');
});

test('one provider cannot consume another provider budget', () => {
  const budget = createRequestBudget(4, [adzuna, usajobs]);

  assert.equal(budget.take('adzuna'), true);
  assert.equal(budget.take('adzuna'), true);
  // Adzuna is spent, but that must not touch what USAJOBS has left.
  assert.equal(budget.take('adzuna'), false);
  assert.equal(budget.remainingFor('adzuna'), 0);
  assert.equal(budget.remainingFor('usajobs'), 2);
  assert.equal(budget.exhausted(), false, 'a spent provider does not exhaust the run');

  assert.equal(budget.take('usajobs'), true);
  assert.equal(budget.take('usajobs'), true);
  assert.equal(budget.take('usajobs'), false);
  assert.equal(budget.exhausted(), true);
});

test('a spent provider never drives its counter negative', () => {
  const budget = createRequestBudget(1, [adzuna]);
  assert.equal(budget.take('adzuna'), true);
  assert.equal(budget.take('adzuna'), false);
  assert.equal(budget.take('adzuna'), false);
  assert.equal(budget.remainingFor('adzuna'), 0);
});

test('a total smaller than the provider count leaves later providers with nothing', () => {
  const budget = createRequestBudget(1, [adzuna, usajobs]);
  assert.equal(budget.remainingFor('adzuna'), 1);
  assert.equal(budget.remainingFor('usajobs'), 0);
  assert.equal(budget.take('usajobs'), false);
});

test('claiming budget for an unallocated provider is a programming error, not a silent skip', () => {
  const budget = createRequestBudget(10, [adzuna]);
  assert.throws(() => budget.take('usajobs'), /usajobs/);
});

test('a run with no configured providers is exhausted from the start', () => {
  const budget = createRequestBudget(20, []);
  assert.equal(budget.exhausted(), true);
});

test('labels stored provider ids and falls back to the raw id for retired providers', () => {
  assert.equal(providerLabel('adzuna'), 'Adzuna');
  assert.deepEqual(providerIds(), ['adzuna']);
  // Listings outlive the registry; the id stays visible rather than becoming 'Unknown'.
  assert.equal(providerLabel('usajobs'), 'usajobs');
  assert.equal(providerLabel(null), '');
});
