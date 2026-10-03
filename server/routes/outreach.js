import { OUTREACH_CHANNELS } from '../lib/followUps.js';

const outreachProperties = {
  contactId: { anyOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'null' }] },
  occurredAt: { type: 'string', format: 'date-time' },
  channel: { type: 'string', enum: OUTREACH_CHANNELS },
  note: { type: 'string', maxLength: 10000 },
  nextFollowUpAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
};

const createSchema = {
  type: 'object',
  additionalProperties: false,
  properties: outreachProperties,
  required: ['occurredAt', 'channel'],
};

const updateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: outreachProperties,
  minProperties: 1,
};

const jobParams = {
  type: 'object',
  required: ['jobId'],
  properties: { jobId: { type: 'string' } },
};

const entryParams = {
  type: 'object',
  required: ['jobId', 'entryId'],
  properties: { jobId: { type: 'string' }, entryId: { type: 'string' } },
};

export async function outreachRoutes(app, { outreach }) {
  app.get('/api/jobs/:jobId/outreach', { schema: { params: jobParams } }, async request => ({
    outreach: await outreach.listForJob(request.params.jobId),
  }));

  app.post('/api/jobs/:jobId/outreach', {
    schema: { params: jobParams, body: createSchema },
  }, async (request, reply) => {
    const entry = await outreach.create(request.params.jobId, request.body);
    return reply.code(201).send({ entry });
  });

  app.patch('/api/jobs/:jobId/outreach/:entryId', {
    schema: { params: entryParams, body: updateSchema },
  }, async request => ({
    entry: await outreach.update(request.params.jobId, request.params.entryId, request.body),
  }));

  app.delete('/api/jobs/:jobId/outreach/:entryId', {
    schema: { params: entryParams },
  }, async request => ({
    entry: await outreach.remove(request.params.jobId, request.params.entryId),
  }));
}
