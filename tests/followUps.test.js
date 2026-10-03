import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFollowUpItems, classifyDueDate } from '../server/lib/followUps.js';

const NOW = new Date('2026-07-29T15:00:00.000Z');

test('classifies overdue and today follow-up dates in UTC', () => {
  assert.equal(classifyDueDate('2026-07-28T12:00:00.000Z', NOW), 'overdue');
  assert.equal(classifyDueDate('2026-07-29T23:59:00.000Z', NOW), 'today');
  assert.equal(classifyDueDate('2026-07-30T00:00:00.000Z', NOW), null);
});

test('merges job next actions and outreach reminders for active jobs only', () => {
  const items = buildFollowUpItems({
    now: NOW,
    jobs: [
      { id: 'job-1', role: 'Admin', company: 'Due Co', stage: 'Applied', next: 'Ping recruiter', nextActionAt: '2026-07-29T10:00:00.000Z', deletedAt: null },
      { id: 'job-2', role: 'Closed', company: 'Done Co', stage: 'Closed', next: 'N/A', nextActionAt: '2026-07-28T10:00:00.000Z', deletedAt: null },
    ],
    outreachEntries: [
      { id: 'entry-1', jobId: 'job-1', contactId: 'contact-1', contactName: 'Alex', channel: 'email', note: 'Sent intro', nextFollowUpAt: '2026-07-27T09:00:00.000Z' },
      { id: 'entry-2', jobId: 'job-2', contactId: null, contactName: null, channel: 'phone', note: 'Voicemail', nextFollowUpAt: '2026-07-28T09:00:00.000Z' },
    ],
  });

  assert.equal(items.length, 2);
  assert.deepEqual(items.map(item => item.id), ['outreach:entry-1', 'job-next:job-1']);
  assert.equal(items[0].status, 'overdue');
  assert.equal(items[1].kind, 'job-next-action');
});
