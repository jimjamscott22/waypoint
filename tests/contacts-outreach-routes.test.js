import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../server/app.js';

function engagementServices() {
  const contacts = [];
  const outreach = [];
  return {
    config: { adzuna: { configured: false }, geocoder: { userAgent: '' } },
    pool: {},
    jobs: { list: async () => [], isEmpty: async () => true },
    queries: { list: async () => [] },
    listings: { listNew: async () => [] },
    runs: { latest: async () => null },
    insights: { get: async range => ({ range, recommendations: [] }) },
    discovery: null,
    geocoder: null,
    jobUrlParser: { parse: async () => ({}) },
    contacts: {
      listForJob: async jobId => contacts.filter(contact => contact.jobId === jobId),
      create: async (jobId, input) => {
        const contact = { id: 'contact-1', jobId, ...input };
        contacts.push(contact);
        return contact;
      },
      update: async (jobId, contactId, input) => ({ id: contactId, jobId, ...input }),
      remove: async (jobId, contactId) => ({ id: contactId, jobId }),
    },
    outreach: {
      listForJob: async jobId => outreach.filter(entry => entry.jobId === jobId),
      create: async (jobId, input) => {
        const entry = { id: 'outreach-1', jobId, contactName: null, ...input };
        outreach.push(entry);
        return entry;
      },
      update: async (jobId, entryId, input) => ({ id: entryId, jobId, ...input }),
      remove: async (jobId, entryId) => ({ id: entryId, jobId }),
    },
    followUps: {
      listDue: async () => [{ id: 'job-next:job-1', kind: 'job-next-action', status: 'today', jobId: 'job-1', title: 'Ping', detail: 'Role', dueAt: '2026-07-29T10:00:00.000Z' }],
    },
  };
}

test('exposes contact and outreach CRUD under a job', async t => {
  const app = buildApp({ services: engagementServices(), serveStatic: false });
  t.after(() => app.close());

  const listed = await app.inject({ method: 'GET', url: '/api/jobs/job-1/contacts' });
  assert.equal(listed.statusCode, 200);
  assert.deepEqual(listed.json().contacts, []);

  const created = await app.inject({
    method: 'POST',
    url: '/api/jobs/job-1/contacts',
    payload: { name: 'Alex Rivers', title: 'Recruiter', email: 'alex@example.com', notes: '' },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().contact.name, 'Alex Rivers');

  const outreachCreated = await app.inject({
    method: 'POST',
    url: '/api/jobs/job-1/outreach',
    payload: {
      occurredAt: '2026-07-20T14:00:00.000Z',
      channel: 'linkedin',
      note: 'Sent connection request',
      nextFollowUpAt: '2026-07-29T09:00:00.000Z',
    },
  });
  assert.equal(outreachCreated.statusCode, 201);
  assert.equal(outreachCreated.json().entry.channel, 'linkedin');

  const followUps = await app.inject({ method: 'GET', url: '/api/follow-ups' });
  assert.equal(followUps.statusCode, 200);
  assert.equal(followUps.json().followUps.length, 1);
});

test('rejects invalid outreach payloads', async t => {
  const app = buildApp({ services: engagementServices(), serveStatic: false });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/jobs/job-1/outreach',
    payload: { occurredAt: '2026-07-20T14:00:00.000Z', channel: 'fax', note: '' },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'VALIDATION_ERROR');
});
