const contactProperties = {
  name: { type: 'string', minLength: 1, maxLength: 255 },
  title: { type: 'string', maxLength: 255 },
  email: { type: 'string', maxLength: 255 },
  profileUrl: { anyOf: [{ type: 'string', maxLength: 4000 }, { type: 'null' }] },
  notes: { type: 'string', maxLength: 10000 },
};

const createSchema = {
  type: 'object',
  additionalProperties: false,
  properties: contactProperties,
  required: ['name'],
};

const updateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: contactProperties,
  minProperties: 1,
};

const jobParams = {
  type: 'object',
  required: ['jobId'],
  properties: { jobId: { type: 'string' } },
};

const contactParams = {
  type: 'object',
  required: ['jobId', 'contactId'],
  properties: { jobId: { type: 'string' }, contactId: { type: 'string' } },
};

export async function contactRoutes(app, { contacts }) {
  app.get('/api/jobs/:jobId/contacts', { schema: { params: jobParams } }, async request => ({
    contacts: await contacts.listForJob(request.params.jobId),
  }));

  app.post('/api/jobs/:jobId/contacts', {
    schema: { params: jobParams, body: createSchema },
  }, async (request, reply) => {
    const contact = await contacts.create(request.params.jobId, request.body);
    return reply.code(201).send({ contact });
  });

  app.patch('/api/jobs/:jobId/contacts/:contactId', {
    schema: { params: contactParams, body: updateSchema },
  }, async request => ({
    contact: await contacts.update(request.params.jobId, request.params.contactId, request.body),
  }));

  app.delete('/api/jobs/:jobId/contacts/:contactId', {
    schema: { params: contactParams },
  }, async request => ({
    contact: await contacts.remove(request.params.jobId, request.params.contactId),
  }));
}
