import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateTime, formatSavedDate, fromLocalDateTimeInput, toLocalDateTimeInput } from '../src/lib/dateTime.js';

test('round-trips a local date-time input through an ISO timestamp', () => {
  const local = '2026-07-29T10:30';
  const iso = fromLocalDateTimeInput(local);
  assert.match(iso, /^2026-07-29T\d{2}:30:00\.000Z$/);
  assert.equal(toLocalDateTimeInput(iso), local);
});

test('normalizes empty and invalid date-time values', () => {
  assert.equal(fromLocalDateTimeInput(''), null);
  assert.equal(fromLocalDateTimeInput('not-a-date'), null);
  assert.equal(toLocalDateTimeInput(null), '');
  assert.equal(toLocalDateTimeInput('not-a-date'), '');
  assert.equal(formatDateTime(null), '—');
  assert.equal(formatDateTime('not-a-date'), '—');
});

test('formats a valid date for reading', () => {
  assert.notEqual(formatDateTime('2026-07-29T14:30:00.000Z'), '—');
});

test('formats the saved date as compact local calendar metadata', () => {
  assert.equal(formatSavedDate('2026-08-24T18:30:00.000Z'), 'Aug 24, 2026');
});

test('uses a dash when the saved date is absent or invalid', () => {
  assert.equal(formatSavedDate(null), '—');
  assert.equal(formatSavedDate('not-a-date'), '—');
});
