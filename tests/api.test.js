import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../server/app.js';

function fakeServices() {
  return {
    config: { adzuna: { configured: false }, geocoder: { userAgent: '' } },
    pool: {},
    jobs: { list: async () => [], isEmpty: async () => true, create: async input => ({ id: 'job-1', ...input }) },
    queries: {
      list: async () => [],
      create: async input => ({ id: 'query-1', ...input }),
      update: async (id, input) => ({ id, ...input }),
      remove: async id => ({ id }),
    },
    listings: { listNew: async () => [], save: async id => ({ id }), dismiss: async id => ({ id }) },
    discoveryRepository: {
      search: async filters => ({ items: [], page: filters.page, pageSize: filters.pageSize, total: 0, totalPages: 0 }),
    },
    runs: { latest: async () => null, detail: async () => null },
    geocoder: null,
    insights: {
      get: async range => ({
        range,
        outcomes: {},
        funnel: [],
        weeklyActivity: [],
        recommendations: [],
        discovery: {},
      }),
    },
    discovery: null,
  };
}

test('returns centralized bootstrap state', async t => {
  const app = buildApp({ services: fakeServices(), serveStatic: false });
  t.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: '/api/bootstrap' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    jobs: [], queries: [], matches: [], latestRun: null, serverJobsEmpty: true,
    provider: { name: 'Adzuna', attributionUrl: 'https://www.adzuna.com/' },
    providerConfigured: false, locationResolutionConfigured: false,
  });
});

test('validates job request bodies with a consistent error shape', async t => {
  const app = buildApp({ services: fakeServices(), serveStatic: false });
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/jobs', payload: { role: 'Admin' } });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'VALIDATION_ERROR');
});

test('reports an unconfigured provider for manual runs', async t => {
  const app = buildApp({ services: fakeServices(), serveStatic: false });
  t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/scrape-runs' });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json().error, { code: 'PROVIDER_NOT_CONFIGURED', message: 'Adzuna credentials are not configured' });
});

test('returns Insights with a default or selected reporting range', async t => {
  const services = fakeServices();
  const requested = [];
  services.insights.get = async range => {
    requested.push(range);
    return { range };
  };
  const app = buildApp({ services, serveStatic: false });
  t.after(() => app.close());

  const defaultResponse = await app.inject({ method: 'GET', url: '/api/insights' });
  const selectedResponse = await app.inject({ method: 'GET', url: '/api/insights?range=30d' });
  const invalidResponse = await app.inject({ method: 'GET', url: '/api/insights?range=year' });

  assert.equal(defaultResponse.statusCode, 200);
  assert.equal(defaultResponse.json().range, '90d');
  assert.equal(selectedResponse.statusCode, 200);
  assert.equal(selectedResponse.json().range, '30d');
  assert.deepEqual(requested, ['90d', '30d']);
  assert.equal(invalidResponse.statusCode, 400);
  assert.equal(invalidResponse.json().error.code, 'VALIDATION_ERROR');
});

const auburnCriteria = {
  name: 'Auburn IT infrastructure',
  center: {
    displayName: 'Auburn, Cayuga County, New York, United States',
    latitude: 42.9317,
    longitude: -76.5661,
    provider: 'nominatim',
    placeId: '1234',
  },
  preferredRadiusMiles: 20,
  maximumRadiusMiles: 40,
  roleFamilies: ['systems-administration', 'it-support'],
  requiredTerms: [],
  optionalTerms: ['windows'],
  excludedTerms: ['sales'],
  maxAgeDays: 14,
  minimumSalary: null,
  enabled: true,
};

test('lists saved searches and accepts structured criteria', async t => {
  const services = fakeServices();
  const created = [];
  services.queries.list = async () => [{ id: 'query-1', name: 'Auburn IT infrastructure' }];
  services.queries.create = async input => { created.push(input); return { id: 'query-1', ...input }; };
  const app = buildApp({ services, serveStatic: false });
  t.after(() => app.close());

  const listed = await app.inject({ method: 'GET', url: '/api/queries' });
  assert.equal(listed.statusCode, 200);
  assert.deepEqual(listed.json().queries, [{ id: 'query-1', name: 'Auburn IT infrastructure' }]);

  const response = await app.inject({ method: 'POST', url: '/api/queries', payload: auburnCriteria });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(created, [auburnCriteria]);
});

test('keeps the legacy saved-search request shape working', async t => {
  const services = fakeServices();
  const created = [];
  services.queries.create = async input => { created.push(input); return { id: 'query-1', ...input }; };
  const app = buildApp({ services, serveStatic: false });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/queries',
    payload: { name: 'Legacy', keywords: 'systems administrator', location: 'Auburn NY', maxAgeDays: 7 },
  });

  assert.equal(response.statusCode, 201);
  assert.deepEqual(created, [{ name: 'Legacy', keywords: 'systems administrator', location: 'Auburn NY', maxAgeDays: 7 }]);
});

test('rejects saved searches with unusable structured criteria', async t => {
  const app = buildApp({ services: fakeServices(), serveStatic: false });
  t.after(() => app.close());

  const cases = [
    ['no role families', { ...auburnCriteria, roleFamilies: [] }, 'VALIDATION_ERROR'],
    ['unknown role family', { ...auburnCriteria, roleFamilies: ['data-science'] }, 'VALIDATION_ERROR'],
    ['duplicate role families', { ...auburnCriteria, roleFamilies: ['it-support', 'it-support'] }, 'VALIDATION_ERROR'],
    ['out of range latitude', { ...auburnCriteria, center: { ...auburnCriteria.center, latitude: 120 } }, 'VALIDATION_ERROR'],
    ['out of range longitude', { ...auburnCriteria, center: { ...auburnCriteria.center, longitude: -200 } }, 'VALIDATION_ERROR'],
    ['zero radius', { ...auburnCriteria, preferredRadiusMiles: 0 }, 'VALIDATION_ERROR'],
    ['radius beyond the maximum', { ...auburnCriteria, maximumRadiusMiles: 60 }, 'VALIDATION_ERROR'],
    ['unsupported age', { ...auburnCriteria, maxAgeDays: 21 }, 'VALIDATION_ERROR'],
    ['negative salary', { ...auburnCriteria, minimumSalary: -1 }, 'VALIDATION_ERROR'],
    ['duplicate terms', { ...auburnCriteria, excludedTerms: ['sales', 'sales'] }, 'VALIDATION_ERROR'],
    ['inverted radii', { ...auburnCriteria, preferredRadiusMiles: 40, maximumRadiusMiles: 20 }, 'INVALID_RADIUS_RANGE'],
  ];

  for (const [label, payload, code] of cases) {
    const response = await app.inject({ method: 'POST', url: '/api/queries', payload });
    assert.equal(response.statusCode, 400, label);
    assert.equal(response.json().error.code, code, label);
  }
});

test('accepts a partial saved-search edit and rejects an empty one', async t => {
  const services = fakeServices();
  const updates = [];
  services.queries.update = async (id, input) => { updates.push([id, input]); return { id, ...input }; };
  const app = buildApp({ services, serveStatic: false });
  t.after(() => app.close());

  const patched = await app.inject({
    method: 'PATCH',
    url: '/api/queries/query-1',
    payload: { enabled: false, roleFamilies: ['cloud-support'] },
  });
  assert.equal(patched.statusCode, 200);
  assert.deepEqual(updates, [['query-1', { enabled: false, roleFamilies: ['cloud-support'] }]]);

  const empty = await app.inject({ method: 'PATCH', url: '/api/queries/query-1', payload: {} });
  assert.equal(empty.statusCode, 400);
  assert.equal(empty.json().error.code, 'VALIDATION_ERROR');
});

test('resolves a search location only when the geocoder is configured', async t => {
  const unconfigured = buildApp({ services: fakeServices(), serveStatic: false });
  t.after(() => unconfigured.close());
  const disabled = await unconfigured.inject({
    method: 'POST', url: '/api/queries/resolve-location', payload: { query: 'Auburn NY' },
  });
  assert.equal(disabled.statusCode, 503);
  assert.equal(disabled.json().error.code, 'GEOCODER_NOT_CONFIGURED');

  const services = fakeServices();
  const asked = [];
  services.geocoder = {
    resolve: async query => {
      asked.push(query);
      return [{ displayName: 'Auburn, New York', latitude: 42.9, longitude: -76.5, provider: 'nominatim', placeId: '1' }];
    },
  };
  const app = buildApp({ services, serveStatic: false });
  t.after(() => app.close());

  const resolved = await app.inject({
    method: 'POST', url: '/api/queries/resolve-location', payload: { query: 'Auburn NY' },
  });
  assert.equal(resolved.statusCode, 200);
  assert.equal(resolved.json().candidates.length, 1);
  assert.deepEqual(asked, ['Auburn NY']);

  const blank = await app.inject({ method: 'POST', url: '/api/queries/resolve-location', payload: { query: '' } });
  assert.equal(blank.statusCode, 400);
  assert.equal(blank.json().error.code, 'VALIDATION_ERROR');
});

test('previews and runs a saved search only when the provider is configured', async t => {
  const unconfigured = buildApp({ services: fakeServices(), serveStatic: false });
  t.after(() => unconfigured.close());

  const previewDisabled = await unconfigured.inject({
    method: 'POST', url: '/api/queries/preview', payload: auburnCriteria,
  });
  assert.equal(previewDisabled.statusCode, 503);
  assert.equal(previewDisabled.json().error.code, 'PROVIDER_NOT_CONFIGURED');

  const runDisabled = await unconfigured.inject({ method: 'POST', url: '/api/queries/query-1/runs' });
  assert.equal(runDisabled.statusCode, 503);
  assert.equal(runDisabled.json().error.code, 'PROVIDER_NOT_CONFIGURED');

  const services = fakeServices();
  const previewed = [];
  const ran = [];
  services.discovery = {
    preview: async criteria => { previewed.push(criteria); return { results: [], diagnostics: { newMatches: 0 } }; },
    runQuery: async (id, trigger) => { ran.push([id, trigger]); return { id: 'run-1', status: 'success' }; },
    runAll: async () => ({ id: 'run-1', status: 'success' }),
  };
  const app = buildApp({ services, serveStatic: false });
  t.after(() => app.close());

  const preview = await app.inject({ method: 'POST', url: '/api/queries/preview', payload: auburnCriteria });
  assert.equal(preview.statusCode, 200);
  assert.deepEqual(preview.json(), { results: [], diagnostics: { newMatches: 0 } });
  assert.equal(previewed.length, 1);

  const run = await app.inject({ method: 'POST', url: '/api/queries/query-1/runs' });
  assert.equal(run.statusCode, 200);
  assert.deepEqual(run.json(), { run: { id: 'run-1', status: 'success' } });
  assert.deepEqual(ran, [['query-1', 'manual']]);

  const invalidPreview = await app.inject({
    method: 'POST', url: '/api/queries/preview', payload: { ...auburnCriteria, roleFamilies: [] },
  });
  assert.equal(invalidPreview.statusCode, 400);
});

test('applies discovery defaults and rejects unsupported filter values', async t => {
  const services = fakeServices();
  const received = [];
  services.discoveryRepository.search = async filters => {
    received.push(filters);
    return { items: [], page: filters.page, pageSize: filters.pageSize, total: 0, totalPages: 0 };
  };
  const app = buildApp({ services, serveStatic: false });
  t.after(() => app.close());

  const defaults = await app.inject({ method: 'GET', url: '/api/listings' });
  assert.equal(defaults.statusCode, 200);
  assert.deepEqual(defaults.json(), { items: [], page: 1, pageSize: 25, total: 0, totalPages: 0 });
  assert.equal(received[0].status, 'new');
  assert.equal(received[0].sort, 'best');
  assert.equal(received[0].salaryStatus, 'all');

  const filtered = await app.inject({
    method: 'GET',
    url: '/api/listings?q=admin&roleFamily=it-support&distanceBand=expanded&sort=nearest&minScore=10&maxScore=90&pageSize=100&page=2&status=saved&salaryStatus=known&minSalary=50000&queryId=query-1&maxAgeDays=7',
  });
  assert.equal(filtered.statusCode, 200);
  assert.equal(received[1].q, 'admin');
  assert.equal(received[1].roleFamily, 'it-support');
  assert.equal(received[1].distanceBand, 'expanded');
  assert.equal(received[1].sort, 'nearest');
  assert.equal(received[1].minScore, 10);
  assert.equal(received[1].pageSize, 100);
  assert.equal(received[1].page, 2);

  const rejected = [
    ['unknown sort', 'sort=cheapest', 'VALIDATION_ERROR'],
    ['unknown role family', 'roleFamily=data-science', 'VALIDATION_ERROR'],
    ['unknown distance band', 'distanceBand=nearby', 'VALIDATION_ERROR'],
    ['unknown status', 'status=archived', 'VALIDATION_ERROR'],
    ['score above 100', 'minScore=101', 'VALIDATION_ERROR'],
    ['page below one', 'page=0', 'VALIDATION_ERROR'],
    ['page size below the floor', 'pageSize=5', 'VALIDATION_ERROR'],
    ['page size above the ceiling', 'pageSize=500', 'VALIDATION_ERROR'],
    ['negative salary', 'minSalary=-1', 'VALIDATION_ERROR'],
    ['inverted score range', 'minScore=90&maxScore=10', 'INVALID_SCORE_RANGE'],
  ];
  for (const [label, search, code] of rejected) {
    const response = await app.inject({ method: 'GET', url: `/api/listings?${search}` });
    assert.equal(response.statusCode, 400, label);
    assert.equal(response.json().error.code, code, label);
  }

  // Fastify strips unrecognized parameters, so they never reach the repository.
  const ignored = await app.inject({ method: 'GET', url: '/api/listings?orderBy=title' });
  assert.equal(ignored.statusCode, 200);
  assert.equal(Object.hasOwn(received.at(-1), 'orderBy'), false);
});

test('returns run diagnostics and reports an unknown run id', async t => {
  const services = fakeServices();
  const detail = {
    run: { id: 'run-1', status: 'partial' },
    queries: [{ id: 'srq-1', queryName: 'Auburn', rejectedDistance: 4 }],
    searches: [{ id: 'srs-1', roleFamily: 'it-support', status: 'success' }],
  };
  services.runs.detail = async id => (id === 'run-1' ? detail : null);
  const app = buildApp({ services, serveStatic: false });
  t.after(() => app.close());

  const found = await app.inject({ method: 'GET', url: '/api/scrape-runs/run-1' });
  assert.equal(found.statusCode, 200);
  assert.deepEqual(found.json(), detail);

  const missing = await app.inject({ method: 'GET', url: '/api/scrape-runs/nope' });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, 'RUN_NOT_FOUND');
});

test('serves the built SPA while keeping unknown API routes JSON-only', async t => {
  const staticRoot = mkdtempSync(join(tmpdir(), 'waypoint-dist-'));
  mkdirSync(join(staticRoot, 'assets'));
  writeFileSync(join(staticRoot, 'index.html'), '<div id="root"></div><script src="/assets/app.js"></script>');
  writeFileSync(join(staticRoot, 'assets', 'app.js'), 'console.log("built");');
  t.after(() => rmSync(staticRoot, { recursive: true, force: true }));

  const app = buildApp({ services: fakeServices(), staticRoot });
  t.after(() => app.close());

  const page = await app.inject({ method: 'GET', url: '/jobs/saved' });
  assert.equal(page.statusCode, 200);
  assert.match(page.headers['content-type'], /^text\/html/);
  assert.match(page.body, /<div id="root"><\/div>/);

  const assetPath = page.body.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert.ok(assetPath);
  const asset = await app.inject({ method: 'GET', url: assetPath });
  assert.equal(asset.statusCode, 200);
  assert.match(asset.headers['content-type'], /javascript/);

  const missingApi = await app.inject({ method: 'GET', url: '/api/not-real' });
  assert.equal(missingApi.statusCode, 404);
  assert.deepEqual(missingApi.json().error, { code: 'NOT_FOUND', message: 'API endpoint not found' });
});
