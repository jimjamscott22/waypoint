import { ROLE_FAMILY_IDS } from '../discovery/roleFamilies.js';
import { AppError } from '../errors.js';

const listingQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    q: { type: 'string', maxLength: 120 },
    queryId: { type: 'string', maxLength: 36 },
    roleFamily: { type: 'string', enum: [...ROLE_FAMILY_IDS] },
    distanceBand: { type: 'string', enum: ['preferred', 'expanded', 'unknown'] },
    maxAgeDays: { type: 'integer', minimum: 1, maximum: 365 },
    minScore: { type: 'number', minimum: 0, maximum: 100 },
    maxScore: { type: 'number', minimum: 0, maximum: 100 },
    salaryStatus: { type: 'string', enum: ['all', 'known', 'unknown'], default: 'all' },
    minSalary: { type: 'number', minimum: 0 },
    status: { type: 'string', enum: ['new', 'saved', 'dismissed', 'expired'], default: 'new' },
    sort: { type: 'string', enum: ['best', 'nearest', 'newest', 'salary'], default: 'best' },
    page: { type: 'integer', minimum: 1, default: 1 },
    pageSize: { type: 'integer', minimum: 10, maximum: 100, default: 25 },
  },
};

export async function listingRoutes(app, { listings, discoveryRepository }) {
  app.get('/api/listings', { schema: { querystring: listingQuery } }, async request => {
    const { minScore, maxScore } = request.query;
    if (minScore != null && maxScore != null && minScore > maxScore) {
      throw new AppError(400, 'INVALID_SCORE_RANGE', 'Minimum score cannot exceed maximum score');
    }
    return discoveryRepository.search(request.query);
  });

  app.post('/api/listings/:id/save', async request => listings.save(request.params.id));
  app.post('/api/listings/:id/dismiss', async request => listings.dismiss(request.params.id));
}
