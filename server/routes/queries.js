const maxAgeDays = [1, 3, 7, 14, 30];
const properties = {
  name: { type: 'string', minLength: 1, maxLength: 80 },
  keywords: { type: 'string', minLength: 1, maxLength: 120 },
  location: { type: 'string', maxLength: 120 },
  maxAgeDays: { type: 'integer', enum: maxAgeDays },
  enabled: { type: 'boolean' },
};

export async function queryRoutes(app, { queries }) {
  app.post('/api/queries', {
    schema: { body: { type: 'object', additionalProperties: false, properties, required: ['name', 'keywords', 'maxAgeDays'] } },
  }, async (request, reply) => reply.code(201).send({ query: await queries.create(request.body) }));

  app.patch('/api/queries/:id', {
    schema: { body: { type: 'object', additionalProperties: false, properties, minProperties: 1 } },
  }, async request => ({ query: await queries.update(request.params.id, request.body) }));

  app.delete('/api/queries/:id', async request => ({ query: await queries.remove(request.params.id) }));
}
