import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateTime, formatNextActionDue, formatSavedDate, fromLocalDateTimeInput, toLocalDateTimeInput } from '../src/lib/dateTime.js';

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

test('next-action due labels handle missing dates and overdue timestamps', () => {
  const now = new Date(2026, 9, 17, 12);
  assert.equal(formatNextActionDue(null, now), 'No due date');
  assert.equal(formatNextActionDue('invalid', now), 'No due date');
  const earlier = new Date(2026, 9, 17, 11).toISOString();
  assert.equal(formatNextActionDue(earlier, now), `Overdue · ${formatDateTime(earlier)}`);
});

test('next-action due labels use local calendar days across month and year boundaries', () => {
  const now = new Date(2026, 11, 31, 12);
  assert.equal(formatNextActionDue(new Date(2026, 11, 31, 14).toISOString(), now), 'Today · 2:00 PM');
  assert.equal(formatNextActionDue(new Date(2027, 0, 1, 9).toISOString(), now), 'Tomorrow · 9:00 AM');
  const later = new Date(2027, 0, 2, 9).toISOString();
  assert.equal(formatNextActionDue(later, now), formatDateTime(later));
});

test('next-action tomorrow label follows the calendar across daylight-saving changes', () => {
  const now = new Date(2026, 2, 7, 23, 30);
  assert.equal(formatNextActionDue(new Date(2026, 2, 8, 23, 45).toISOString(), now), 'Tomorrow · 11:45 PM');
});
