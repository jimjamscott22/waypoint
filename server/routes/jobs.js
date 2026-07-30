const stages = ['Saved', 'Applied', 'Interviewing', 'Offer', 'Closed'];
const jobProperties = {
  id: { type: 'string', minLength: 1, maxLength: 100 },
  role: { type: 'string', maxLength: 255 },
  company: { type: 'string', maxLength: 255 },
  stage: { type: 'string', enum: stages },
  location: { type: 'string', maxLength: 255 },
  salary: { type: 'string', maxLength: 120 },
  contact: { type: 'string', maxLength: 255 },
  next: { type: 'string', maxLength: 255 },
  nextActionAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
  notes: { type: 'string', maxLength: 10000 },
  urgent: { type: 'boolean' },
  isDraft: { type: 'boolean' },
  url: { anyOf: [{ type: 'string', maxLength: 4000 }, { type: 'null' }] },
};

const createSchema = {
  type: 'object',
  additionalProperties: false,
  properties: jobProperties,
  required: ['role', 'company', 'stage'],
};

const updateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(Object.entries(jobProperties).filter(([key]) => key !== 'id')),
  minProperties: 1,
};

export async function jobRoutes(app, { jobs }) {
  app.post('/api/jobs', { schema: { body: createSchema } }, async (request, reply) => {
    const job = await jobs.create(request.body);
    return reply.code(201).send({ job });
  });

  app.patch('/api/jobs/:id', {
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: updateSchema,
    },
  }, async request => ({ job: await jobs.update(request.params.id, request.body) }));

  app.delete('/api/jobs/:id', async request => ({ job: await jobs.remove(request.params.id) }));
  app.post('/api/jobs/:id/restore', async request => ({ job: await jobs.restore(request.params.id) }));

  app.post('/api/jobs/reorder', {
    schema: { body: {
      type: 'object', additionalProperties: false, required: ['orderedIds'],
      properties: { orderedIds: { type: 'array', maxItems: 500, uniqueItems: true, items: { type: 'string' } } },
    } },
  }, async request => ({ jobs: await jobs.reorder(request.body.orderedIds) }));

  app.post('/api/jobs/import', {
    schema: { body: {
      type: 'object', additionalProperties: false, required: ['jobs'],
      properties: { jobs: { type: 'array', maxItems: 500, items: createSchema } },
    } },
  }, async request => ({ jobs: await jobs.importAll(request.body.jobs) }));
}
