import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../server/app.js';
import { sanitizeError } from '../server/errors.js';
import { createAssistantService } from '../server/assistant/service.js';
import { createAssistantToolkit } from '../server/assistant/toolkit.js';

test('sanitizeError redacts bearer tokens and assistant API keys', () => {
  const message = sanitizeError(new Error('Auth failed Bearer sk-live-abc123 and ASSISTANT_API_KEY=supersecret'));
  assert.match(message, /Bearer \[REDACTED\]/);
  assert.equal(message.includes('supersecret'), false);
  assert.equal(message.includes('sk-live-abc123'), false);
});

test('assistant toolkit dispatches read-only job lookups', async () => {
  const toolkit = createAssistantToolkit({
    jobs: { list: async () => [{ id: 'job-1', role: 'Admin', company: 'Acme', stage: 'Applied', next: 'Follow up', nextActionAt: null, urgent: false, location: '', contact: '', url: null, createdAt: '2026-01-01T00:00:00.000Z' }] },
    followUps: { listDue: async () => [], listUpcoming: async () => [] },
    contacts: { listForJob: async () => [] },
    outreach: { listForJob: async () => [], listPendingFollowUps: async () => [] },
    insightsRepository: {
      snapshot: async () => ({
        jobs: [], events: [], listingMatches: [], queries: [], outreachFollowUps: [], historyCoverageStartsAt: null,
      }),
    },
  });

  const result = await toolkit.execute('list_jobs_by_stage', { stage: 'Applied' });
  assert.equal(result.total, 1);
  assert.equal(result.jobs[0].company, 'Acme');
});

test('assistant service stops after the tool iteration cap', async () => {
  const toolkit = {
    definitions: [{ type: 'function', function: { name: 'noop', parameters: { type: 'object', properties: {} } } }],
    execute: async () => ({ ok: true }),
  };
  let calls = 0;
  const client = {
    async complete() {
      calls += 1;
      return {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: `call-${calls}`, type: 'function', function: { name: 'noop', arguments: '{}' } }],
      };
    },
  };
  const service = createAssistantService({ client, toolkit, maxIterations: 2 });
  await assert.rejects(
    service.chat({ messages: [{ role: 'user', content: 'help' }] }),
    error => error.code === 'ASSISTANT_TOOL_LIMIT'
  );
  assert.equal(calls, 2);
});

test('assistant service returns the final assistant message after tools', async () => {
  const toolkit = {
    definitions: [{ type: 'function', function: { name: 'noop', parameters: { type: 'object', properties: {} } } }],
    execute: async () => ({ jobs: [] }),
  };
  let step = 0;
  const client = {
    async complete() {
      step += 1;
      if (step === 1) {
        return {
          role: 'assistant',
          tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'noop', arguments: '{}' } }],
        };
      }
      return { role: 'assistant', content: 'Focus on Acme first.' };
    },
  };
  const service = createAssistantService({ client, toolkit, maxIterations: 4 });
  const result = await service.chat({ messages: [{ role: 'user', content: 'What next?' }] });
  assert.equal(result.message.content, 'Focus on Acme first.');
  assert.deepEqual(result.toolsUsed, [{ name: 'noop', args: {} }]);
});

function assistantFakeServices({ configured = false } = {}) {
  return {
    config: {
      adzuna: { configured: false },
      geocoder: { userAgent: '' },
      assistant: { configured },
    },
    pool: {},
    jobs: { list: async () => [], isEmpty: async () => true },
    queries: { list: async () => [] },
    listings: { listNew: async () => [] },
    runs: { latest: async () => null },
    insights: { get: async range => ({ range, recommendations: [] }) },
    contacts: { listForJob: async () => [] },
    outreach: { listForJob: async () => [] },
    followUps: { listDue: async () => [] },
    assistant: configured ? { chat: async () => ({ message: { role: 'assistant', content: 'Hi' }, toolsUsed: [], iterations: 1 }) } : null,
    discovery: null,
    geocoder: null,
    jobUrlParser: { parse: async () => ({}) },
  };
}

test('assistant chat route reports unconfigured state', async t => {
  const app = buildApp({ services: assistantFakeServices({ configured: false }), serveStatic: false });
  t.after(() => app.close());
  const response = await app.inject({
    method: 'POST',
    url: '/api/assistant/chat',
    payload: { messages: [{ role: 'user', content: 'Hello' }] },
  });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, 'ASSISTANT_NOT_CONFIGURED');
});

test('assistant chat route proxies configured requests', async t => {
  const app = buildApp({ services: assistantFakeServices({ configured: true }), serveStatic: false });
  t.after(() => app.close());
  const response = await app.inject({
    method: 'POST',
    url: '/api/assistant/chat',
    payload: { messages: [{ role: 'user', content: 'Hello' }] },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().message.content, 'Hi');
});
