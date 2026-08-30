import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdzunaClient, normalizeAdzunaJob } from '../server/scraper/adzuna.js';

const auburnQuery = {
  center: {
    displayName: 'Auburn, Cayuga County, New York, United States',
    latitude: 42.9317,
    longitude: -76.5661,
  },
  preferredRadiusMiles: 20,
  maximumRadiusMiles: 40,
  roleFamilies: ['systems-administration'],
  requiredTerms: [],
  optionalTerms: [],
  excludedTerms: [],
  maxAgeDays: 14,
  minimumSalary: null,
};

function capturingClient(payload = { count: 0, results: [] }, overrides = {}) {
  const calls = [];
  const client = createAdzunaClient({
    appId: 'secret-id',
    appKey: 'secret-key',
    sleep: async () => {},
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => payload };
    },
    ...overrides,
  });
  return { client, calls };
}

test('normalizes an Adzuna result into the provider-neutral listing shape', () => {
  const listing = normalizeAdzunaJob({
    id: 42,
    title: ' Systems Administrator ',
    company: { display_name: 'Northwind' },
    location: { display_name: 'Auburn, NY' },
    salary_min: 70000,
    salary_max: 85000,
    description: 'Maintain Linux systems',
    redirect_url: 'https://example.test/job/42',
    created: '2026-07-16T10:00:00Z',
    latitude: 42.9317,
    longitude: -76.5661,
    category: { tag: 'it-jobs', label: 'IT Jobs' },
    contract_time: 'full_time',
    contract_type: 'permanent',
  });
  assert.deepEqual(listing, {
    provider: 'adzuna', providerJobId: '42', title: 'Systems Administrator', company: 'Northwind',
    location: 'Auburn, NY', salaryMin: 70000, salaryMax: 85000, currency: 'USD',
    description: 'Maintain Linux systems', url: 'https://example.test/job/42',
    publishedAt: '2026-07-16T10:00:00.000Z',
    latitude: 42.9317, longitude: -76.5661, providerCategory: 'it-jobs',
    contractTime: 'full_time', contractType: 'permanent',
  });
});

test('keeps missing Adzuna salary values null rather than coercing them to zero', () => {
  const listing = normalizeAdzunaJob({
    id: 43, title: 'IT Support', salary_min: null, salary_max: '',
    redirect_url: 'https://example.test/job/43', created: '2026-07-16T10:00:00Z',
  });
  assert.equal(listing.salaryMin, null);
  assert.equal(listing.salaryMax, null);
});

test('drops unusable coordinates and unsupported contract metadata', () => {
  const listing = normalizeAdzunaJob({
    id: 44, title: 'IT Support', redirect_url: 'https://example.test/job/44', created: '2026-07-16T10:00:00Z',
    latitude: 'north', longitude: 400, contract_time: 'seasonal', contract_type: 'internship',
    category: {},
  });
  assert.equal(listing.latitude, null);
  assert.equal(listing.longitude, null);
  assert.equal(listing.contractTime, null);
  assert.equal(listing.contractType, null);
  assert.equal(listing.providerCategory, null);
});

test('encodes the Auburn 40-mile request with date sorting and no empty parameters', async () => {
  const { client, calls } = capturingClient();
  await client.search({ query: auburnQuery, roleFamily: 'systems-administration' });

  const url = calls[0].url;
  assert.equal(url.pathname, '/v1/api/jobs/us/search/1');
  assert.equal(url.searchParams.get('what_phrase'), 'systems administrator');
  assert.equal(url.searchParams.has('what_or'), false);
  // Adzuna geocodes `where` itself and returns HTTP 200 with count 0 — never an error —
  // for a string it cannot resolve, so the full Nominatim display name must not reach it.
  assert.equal(url.searchParams.get('where'), 'Auburn, NY');
  // 40 miles inclusive rounds up to 65 km at the provider.
  assert.equal(url.searchParams.get('distance'), '65');
  assert.equal(url.searchParams.get('max_days_old'), '14');
  assert.equal(url.searchParams.get('sort_by'), 'date');
  // The live Adzuna US endpoint rejects sort_dir with HTTP 400 even though its
  // published schema lists the parameter. sort_by=date already returns newest first.
  assert.equal(url.searchParams.has('sort_dir'), false);
  assert.equal(url.searchParams.get('results_per_page'), '50');
  assert.equal(url.searchParams.has('what_exclude'), false);
  assert.equal(url.searchParams.has('salary_min'), false);
  assert.equal(url.searchParams.has('salary_include_unknown'), false);
});

test('encodes exclusions and salary floors when the search defines them', async () => {
  const { client, calls } = capturingClient();
  await client.search({
    query: { ...auburnQuery, excludedTerms: ['sales', 'intern'], minimumSalary: 55000 },
    roleFamily: 'it-support',
  });

  const url = calls[0].url;
  assert.equal(url.searchParams.get('what_exclude'), 'sales intern');
  assert.equal(url.searchParams.get('what_phrase'), 'IT support');
  assert.equal(url.searchParams.has('what_or'), false);
  assert.equal(url.searchParams.get('salary_min'), '55000');
  assert.equal(url.searchParams.get('salary_include_unknown'), '1');
});

test('requests a later page through the search path and reports pagination metadata', async () => {
  const { client, calls } = capturingClient({
    count: 137,
    results: [{
      id: 7, title: 'Systems Administrator', redirect_url: 'https://example.test/7',
      created: '2026-07-16T10:00:00Z', latitude: 42.9, longitude: -76.5,
    }, { id: 8, title: 'Broken' }],
  });

  const page = await client.search({ query: auburnQuery, roleFamily: 'systems-administration', page: 3 });

  assert.equal(calls[0].url.pathname, '/v1/api/jobs/us/search/3');
  assert.equal(page.providerCount, 137);
  assert.equal(page.page, 3);
  assert.equal(page.pageSize, 50);
  assert.equal(page.results.length, 1);
  assert.equal(page.results[0].latitude, 42.9);
  assert.equal(page.malformedCount, 1);
});

test('retries retryable responses and does not expose credentials in errors', async () => {
  let attempts = 0;
  const client = createAdzunaClient({
    appId: 'secret-id', appKey: 'secret-key', sleep: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) return { ok: false, status: 503, headers: { get: () => null } };
      return { ok: true, json: async () => ({ count: 0, results: [] }) };
    },
  });
  const page = await client.search({ query: auburnQuery, roleFamily: 'systems-administration' });
  assert.deepEqual(page.results, []);
  assert.equal(attempts, 3);
});

test('times out stalled requests and stops after two retries', async () => {
  let attempts = 0;
  const client = createAdzunaClient({
    appId: 'test-id', appKey: 'test-key', timeoutMs: 5, sleep: async () => {},
    fetchImpl: async (_url, { signal }) => {
      attempts += 1;
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
    },
  });
  await assert.rejects(
    client.search({ query: auburnQuery, roleFamily: 'systems-administration' }),
    /timed out/i
  );
  assert.equal(attempts, 3);
});

test('sends the requested provider phrase rather than the family default', async () => {
  const { client, calls } = capturingClient();
  await client.search({ query: auburnQuery, roleFamily: 'it-support', phrase: 'help desk' });

  assert.equal(calls[0].url.searchParams.get('what_phrase'), 'help desk');
  assert.equal(calls[0].url.searchParams.has('what_or'), false);
});
