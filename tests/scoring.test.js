import test from 'node:test';
import assert from 'node:assert/strict';
import { isWithinAgeLimit, keywordCoverage, normalizeTokens, scoreListing } from '../server/scraper/scoring.js';

test('normalizes diacritics, stop words, and simple plurals', () => {
  assert.deepEqual(normalizeTokens('The Systèms and Networks'), ['system', 'network']);
});

test('matches exact short terms and prefix-equivalent longer terms', () => {
  assert.equal(keywordCoverage('IT administrator', 'IT Administration Specialist'), 1);
  assert.equal(keywordCoverage('IT administrator', 'Information Technology Administrator'), 0.5);
});

test('scores title, description, and recency with the documented weights', () => {
  const now = new Date('2026-07-16T12:00:00.000Z');
  const score = scoreListing(
    { keywords: 'systems administrator remote', maxAgeDays: 7 },
    { title: 'System Administrator', description: 'Remote position', publishedAt: now.toISOString() },
    now
  );
  assert.equal(score, 63.33);
});

test('filters listings older than a query age limit', () => {
  const now = new Date('2026-07-16T12:00:00.000Z');
  assert.equal(isWithinAgeLimit({ publishedAt: '2026-07-10T12:00:00.000Z' }, { maxAgeDays: 7 }, now), true);
  assert.equal(isWithinAgeLimit({ publishedAt: '2026-07-08T12:00:00.000Z' }, { maxAgeDays: 7 }, now), false);
});
