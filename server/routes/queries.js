import { AppError } from '../errors.js';
import { ROLE_FAMILY_IDS } from '../discovery/roleFamilies.js';

const MAX_AGE_DAYS = [1, 3, 7, 14, 30];
const MAX_RADIUS_MILES = 40;

const termArray = {
  type: 'array',
  maxItems: 20,
  uniqueItems: true,
  items: { type: 'string', minLength: 1, maxLength: 60 },
};

const center = {
  type: 'object',
  additionalProperties: false,
  required: ['displayName'],
  properties: {
    displayName: { type: 'string', minLength: 1, maxLength: 255 },
    latitude: { type: ['number', 'null'], minimum: -90, maximum: 90 },
    longitude: { type: ['number', 'null'], minimum: -180, maximum: 180 },
    provider: { type: ['string', 'null'], maxLength: 40 },
    placeId: { type: ['string', 'null'], maxLength: 120 },
  },
};

const legacyProperties = {
  name: { type: 'string', minLength: 1, maxLength: 80 },
  keywords: { type: 'string', minLength: 1, maxLength: 120 },
  location: { type: 'string', maxLength: 120 },
  maxAgeDays: { type: 'integer', enum: MAX_AGE_DAYS },
  enabled: { type: 'boolean' },
};

const structuredProperties = {
  name: { type: 'string', minLength: 1, maxLength: 80 },
  center,
  preferredRadiusMiles: { type: 'integer', minimum: 1, maximum: MAX_RADIUS_MILES },
  maximumRadiusMiles: { type: 'integer', minimum: 1, maximum: MAX_RADIUS_MILES },
  roleFamilies: {
    type: 'array',
    minItems: 1,
    maxItems: ROLE_FAMILY_IDS.length,
    uniqueItems: true,
    items: { type: 'string', enum: [...ROLE_FAMILY_IDS] },
  },
  requiredTerms: termArray,
  optionalTerms: termArray,
  excludedTerms: termArray,
  maxAgeDays: { type: 'integer', enum: MAX_AGE_DAYS },
  minimumSalary: { type: ['number', 'null'], minimum: 0 },
  enabled: { type: 'boolean' },
};

// Legacy and structured fields share one property set on purpose: Fastify's ajv runs
// `removeAdditional`, so branching with per-branch `additionalProperties: false` would
// silently strip the other shape's fields before validation.
const allProperties = { ...legacyProperties, ...structuredProperties };

const createBody = {
  type: 'object',
  additionalProperties: false,
  properties: allProperties,
  anyOf: [
    { required: ['name', 'keywords', 'maxAgeDays'] },
    { required: ['name', 'center', 'roleFamilies', 'preferredRadiusMiles', 'maximumRadiusMiles', 'maxAgeDays'] },
  ],
};

const updateBody = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: allProperties,
};

// Cross-field comparisons are not expressible in the request schema, so they run here.
function assertRadiusRange(payload) {
  const { preferredRadiusMiles, maximumRadiusMiles } = payload ?? {};
  if (preferredRadiusMiles == null || maximumRadiusMiles == null) return;
  if (preferredRadiusMiles > maximumRadiusMiles) {
    throw new AppError(400, 'INVALID_RADIUS_RANGE', 'Preferred radius cannot exceed maximum radius');
  }
}

export async function queryRoutes(app, { queries, geocoder }) {
  app.get('/api/queries', async () => ({ queries: await queries.list() }));

  app.post('/api/queries', { schema: { body: createBody } }, async (request, reply) => {
    assertRadiusRange(request.body);
    return reply.code(201).send({ query: await queries.create(request.body) });
  });

  app.patch('/api/queries/:id', { schema: { body: updateBody } }, async request => {
    assertRadiusRange(request.body);
    return { query: await queries.update(request.params.id, request.body) };
  });

  app.delete('/api/queries/:id', async request => ({ query: await queries.remove(request.params.id) }));

  app.post('/api/queries/resolve-location', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['query'],
        properties: { query: { type: 'string', minLength: 1, maxLength: 200 } },
      },
    },
  }, async request => {
    if (!geocoder) {
      throw new AppError(503, 'GEOCODER_NOT_CONFIGURED', 'Location lookup is not configured');
    }
    return { candidates: await geocoder.resolve(request.body.query) };
  });
}
