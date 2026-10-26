import assert from 'node:assert/strict';
import test from 'node:test';
import {
  JOB_HUNTING_TIPS,
  TIP_INDEX_STORAGE_KEY,
  advanceStoredTip,
  nextTipIndex,
  normalizeTipIndex,
} from '../src/lib/jobHuntingTips.js';

function memoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  };
}

test('pool contains 20 distinct, non-empty job hunting tips', () => {
  assert.equal(JOB_HUNTING_TIPS.length, 20);
  const titles = new Set();
  const bodies = new Set();
  for (const tip of JOB_HUNTING_TIPS) {
    assert.equal(typeof tip.category, 'string');
    assert.ok(tip.category.trim().length > 0);
    assert.equal(typeof tip.title, 'string');
    assert.ok(tip.title.trim().length > 0);
    assert.equal(typeof tip.body, 'string');
    assert.ok(tip.body.trim().length > 0);
    titles.add(tip.title);
    bodies.add(tip.body);
  }
  assert.equal(titles.size, 20);
  assert.equal(bodies.size, 20);
});

test('normalizeTipIndex and nextTipIndex wrap cleanly around the pool', () => {
  assert.equal(normalizeTipIndex(null, 20), 0);
  assert.equal(normalizeTipIndex('invalid', 20), 0);
  assert.equal(normalizeTipIndex(-4, 20), 0);
  assert.equal(normalizeTipIndex('7', 20), 7);
  assert.equal(normalizeTipIndex(25, 20), 5);
  assert.equal(nextTipIndex(0, 20), 1);
  assert.equal(nextTipIndex(19, 20), 0);
});

test('advanceStoredTip rotates through all 20 tips across consecutive app starts and wraps around', () => {
  const storage = memoryStorage();
  const seenIndices = [];

  for (let i = 0; i < JOB_HUNTING_TIPS.length; i++) {
    const result = advanceStoredTip(storage);
    seenIndices.push(result.index);
    assert.equal(result.total, 20);
    assert.deepEqual(result.tip, JOB_HUNTING_TIPS[i]);
  }

  assert.deepEqual(seenIndices, Array.from({ length: 20 }, (_, i) => i));
  assert.equal(storage.getItem(TIP_INDEX_STORAGE_KEY), '0');

  const wrapped = advanceStoredTip(storage);
  assert.equal(wrapped.index, 0);
  assert.deepEqual(wrapped.tip, JOB_HUNTING_TIPS[0]);
  assert.equal(storage.getItem(TIP_INDEX_STORAGE_KEY), '1');
});

test('advanceStoredTip falls back to the first tip when storage is unavailable or corrupted', () => {
  const corrupted = memoryStorage({ [TIP_INDEX_STORAGE_KEY]: 'not-a-number' });
  const first = advanceStoredTip(corrupted);
  assert.equal(first.index, 0);
  assert.deepEqual(first.tip, JOB_HUNTING_TIPS[0]);
  assert.equal(corrupted.getItem(TIP_INDEX_STORAGE_KEY), '1');

  const throwingStorage = {
    getItem() {
      throw new Error('storage blocked');
    },
    setItem() {
      throw new Error('storage blocked');
    },
  };
  const fallback = advanceStoredTip(throwingStorage);
  assert.equal(fallback.index, 0);
  assert.deepEqual(fallback.tip, JOB_HUNTING_TIPS[0]);
});
