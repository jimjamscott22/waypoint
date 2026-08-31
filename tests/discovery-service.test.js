import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../server/errors.js';
import { createDiscoveryService } from '../server/discovery/service.js';
import { providerPhrases } from '../server/discovery/criteria.js';

// Stands in for a real client: same identity and plan shape, with the search function
// supplied per test. Defaults to Adzuna's decomposition (one request per family synonym)
// so a plain `search` stub exercises the same paths it always did.
function fakeProvider({ id = 'adzuna', search, planRoleFamily } = {}) {
  return {
    id,
    planRoleFamily: planRoleFamily ?? (({ roleFamily }) => providerPhrases(roleFamily).map(phrase => ({ phrase }))),
    search,
  };
}

const AT = new Date('2026-08-12T12:00:00.000Z');
const AUBURN = { latitude: 42.9317, longitude: -76.5661 };

function query(overrides = {}) {
  return {
    id: 'query-1',
    name: 'Auburn IT infrastructure',
    center: { displayName: 'Auburn, Cayuga County, New York, United States', ...AUBURN },
    preferredRadiusMiles: 20,
    maximumRadiusMiles: 40,
    roleFamilies: ['systems-administration'],
    requiredTerms: [],
    optionalTerms: [],
    excludedTerms: [],
    maxAgeDays: 14,
    minimumSalary: null,
    enabled: true,
    ...overrides,
  };
}

function listing(id, overrides = {}) {
  return {
    provider: 'adzuna',
    providerJobId: String(id),
    title: 'Systems Administrator',
    company: 'Northwind',
    location: 'Auburn, NY',
    salaryMin: null,
    salaryMax: null,
    currency: 'USD',
    description: 'Maintain Windows servers',
    url: `https://example.test/${id}`,
    publishedAt: AT.toISOString(),
    latitude: AUBURN.latitude,
    longitude: AUBURN.longitude,
    providerCategory: 'it-jobs',
    contractTime: 'full_time',
    contractType: 'permanent',
    ...overrides,
  };
}

function page(results, { providerCount = results.length, pageSize = 50, malformedCount = 0 } = {}) {
  return { providerCount, page: 1, pageSize, results, malformedCount };
}

function fullPage(startId, count = 50) {
  return page(
    Array.from({ length: count }, (_, index) => listing(startId + index)),
    { providerCount: 500, pageSize: count }
  );
}

// Records every statement the service issues so lock and transaction behavior is observable.
function fakePool() {
  const statements = [];
  const connection = {
    query: async sql => {
      statements.push(sql);
      if (sql.includes("GET_LOCK('waypoint:scrape'")) return [{ acquired: 1 }];
      return { affectedRows: 1 };
    },
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
  };
  return { pool: { getConnection: async () => connection }, statements };
}

function busyPool() {
  const connection = {
    query: async sql => (sql.includes("GET_LOCK('waypoint:scrape'") ? [{ acquired: 0 }] : { affectedRows: 1 }),
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
  };
  return { getConnection: async () => connection };
}

function harness({ pool, search, providers, queries = [query()], persist, discovery = {}, statuses = new Map() }) {
  const searches = [];
  const finishedQueries = [];
  let finishedRun;
  const persisted = [];

  const service = createDiscoveryService({
    pool,
    queryRepository: {
      list: async () => queries,
      get: async id => queries.find(item => item.id === id) ?? null,
    },
    listingRepository: { expire: async () => 0 },
    runRepository: {
      recentManual: async () => null,
      recoverStale: async () => {},
      create: async () => 'run-1',
      addSearchResult: async (_connection, result) => { searches.push(result); },
      finishQuery: async (_connection, result) => { finishedQueries.push(result); },
      finish: async (_connection, id, summary) => { finishedRun = summary; return { id, ...summary }; },
    },
    discoveryRepository: {
      statusesByProviderId: async (provider, ids) =>
        (typeof statuses === 'function' ? statuses(provider, ids) : statuses),
    },
    providers: providers ?? [fakeProvider({ search })],
    logger: { info: () => {}, error: () => {} },
    discovery,
    now: () => AT,
  });

  // persistMatch is module-level, so the transaction path is exercised through the pool;
  // tests that need outcome control provide their own recording connection instead.
  return { service, searches, finishedQueries, persisted, run: () => finishedRun, persist };
}

test('preview returns ranked samples, writes nothing, and reports diagnostics', async () => {
  const { pool, statements } = fakePool();
  const { service } = harness({
    pool,
    search: async ({ page: requested }) => (requested === 1
      ? page([
        listing(1, { title: 'Systems Administrator', description: 'Systems administrator for servers' }),
        listing(2, { title: 'Warehouse Associate' }),
        listing(3, { title: 'Sysadmin', publishedAt: new Date(AT.getTime() - 40 * 86_400_000).toISOString() }),
      ])
      : page([])),
  });

  const result = await service.preview(query());

  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].title, 'Systems Administrator');
  assert.equal(result.diagnostics.recordsReceived, 9);
  assert.equal(result.diagnostics.rejectedTerms, 3);
  assert.equal(result.diagnostics.rejectedAge, 3);
  assert.equal(result.diagnostics.newMatches, 1);

  assert.equal(statements.some(sql => sql.includes('INSERT INTO listings')), false);
  assert.equal(statements.some(sql => sql.includes('INSERT INTO scrape_runs')), false);
  assert.ok(statements.some(sql => sql.includes("RELEASE_LOCK('waypoint:scrape')")));
});

test('preview caps its sample at ten accepted results', async () => {
  const { pool } = fakePool();
  const { service } = harness({
    pool,
    search: async () => fullPage(1, 50),
    discovery: { previewRequestBudget: 8, maxPagesPerFamily: 3 },
  });

  const result = await service.preview(query());
  assert.equal(result.results.length, 10);
  assert.equal(result.diagnostics.truncated, true);
});

test('preview counts existing listings by their stored decision', async () => {
  const { pool } = fakePool();
  const { service } = harness({
    pool,
    search: async ({ page: requested }) => (requested === 1
      ? page([listing(1), listing(2), listing(3)])
      : page([])),
    statuses: new Map([['1', 'new'], ['2', 'saved'], ['3', 'dismissed']]),
  });

  const result = await service.preview(query());
  assert.equal(result.diagnostics.duplicates, 1);
  assert.equal(result.diagnostics.previouslySaved, 1);
  assert.equal(result.diagnostics.previouslyDismissed, 1);
  assert.equal(result.diagnostics.newMatches, 0);
});

test('preview refuses to overlap a run already holding the scrape lock', async () => {
  const { service } = harness({ pool: busyPool(), search: async () => page([]) });
  await assert.rejects(service.preview(query()), error => error instanceof AppError && error.code === 'RUN_IN_PROGRESS');
});

test('preview requires a confirmed search location', async () => {
  const { pool } = fakePool();
  const { service } = harness({ pool, search: async () => page([]) });
  await assert.rejects(
    service.preview(query({ center: { displayName: 'Auburn NY', latitude: null, longitude: null } })),
    error => error.code === 'QUERY_LOCATION_UNRESOLVED'
  );
});

test('requests the next page after a full page and stops after a short one', async () => {
  const { pool } = fakePool();
  const requested = [];
  const { service } = harness({
    pool,
    search: async ({ page: requestedPage }) => {
      requested.push(requestedPage);
      return requestedPage === 1 ? fullPage(1, 50) : page([listing(100)], { pageSize: 50 });
    },
    discovery: { runRequestBudget: 20, maxPagesPerFamily: 3, persistedMatchTarget: 500 },
  });

  await service.runAll('scheduled');
  assert.deepEqual(requested, [1, 2, 1, 2, 1, 2]);
});

test('stops at the per-family page cap and reports truncation', async () => {
  const { pool } = fakePool();
  const requested = [];
  const { service, searches } = harness({
    pool,
    search: async ({ page: requestedPage }) => { requested.push(requestedPage); return fullPage(requestedPage * 100, 50); },
    discovery: { runRequestBudget: 20, maxPagesPerFamily: 3, persistedMatchTarget: 5000 },
  });

  await service.runAll('scheduled');
  assert.deepEqual(requested, [1, 2, 3, 1, 2, 3, 1, 2, 3]);
  assert.equal(searches[0].truncated, true);
  assert.equal(searches[0].status, 'partial');
});

test('shares one request budget across role families and records unsearched work', async () => {
  const { pool } = fakePool();
  const requested = [];
  const { service, finishedQueries } = harness({
    pool,
    queries: [query({ roleFamilies: ['systems-administration', 'it-support', 'cloud-support'] })],
    search: async ({ roleFamily, page: requestedPage }) => {
      requested.push(`${roleFamily}:${requestedPage}`);
      return fullPage(requested.length * 100, 50);
    },
    discovery: { runRequestBudget: 2, maxPagesPerFamily: 3, persistedMatchTarget: 5000 },
  });

  await service.runAll('scheduled');

  assert.equal(requested.length, 2);
  assert.equal(finishedQueries[0].truncated, true);
  assert.ok(finishedQueries[0].unsearchedRequests >= 1);
});

test('persists a cross-family duplicate once while recording every family as evidence', async () => {
  const { pool, statements } = fakePool();
  const shared = listing(1, { title: 'Systems Administrator and IT Support Specialist' });
  const { service, finishedQueries } = harness({
    pool,
    queries: [query({ roleFamilies: ['systems-administration', 'it-support'] })],
    search: async () => page([shared]),
  });

  await service.runAll('scheduled');

  const listingInserts = statements.filter(sql => sql.includes('INSERT INTO listings'));
  const familyInserts = statements.filter(sql => sql.includes('INSERT IGNORE INTO listing_query_role_families'));
  // Both families matched the same posting: it is counted once as new. Each family now
  // searches 3 phrases, so the same short-page listing is re-encountered 6 times total,
  // and the 5 later encounters are all recorded as duplicates.
  assert.equal(finishedQueries[0].newMatches, 1);
  assert.equal(finishedQueries[0].duplicates, 5);
  // Only the first of the 6 encounters is new and reaches the database; the other 5 are
  // recognized as duplicates before any write is attempted.
  assert.equal(listingInserts.length, 1);
  // That single persisted pass records both matched families as evidence.
  assert.equal(familyInserts.length, 2);
});

test('persists a listing matched by multiple phrases in one family only once, still counting every repeat as a duplicate', async () => {
  const { pool, statements } = fakePool();
  const { service, finishedQueries } = harness({
    pool,
    queries: [query({ roleFamilies: ['systems-administration'] })],
    search: async () => page([listing(1)]),
  });

  await service.runAll('scheduled');

  const listingInserts = statements.filter(sql => sql.includes('INSERT INTO listings'));
  const familyInserts = statements.filter(sql => sql.includes('INSERT IGNORE INTO listing_query_role_families'));
  // The single family searches 3 phrases and every phrase returns the same short page,
  // so the listing is accepted 3 times. Only the first encounter is new; the other 2 are
  // in-run duplicates and must be skipped before any database write is attempted.
  assert.equal(finishedQueries[0].newMatches, 1);
  assert.equal(finishedQueries[0].duplicates, 2);
  assert.equal(listingInserts.length, 1);
  assert.equal(familyInserts.length, 1);
});

test('isolates one role family failure and keeps later families running', async () => {
  const { pool } = fakePool();
  const { service, searches, finishedQueries, run } = harness({
    pool,
    queries: [query({ roleFamilies: ['systems-administration', 'it-support'] })],
    search: async ({ roleFamily }) => {
      if (roleFamily === 'systems-administration') throw new Error('app_key=secret upstream failure');
      return page([listing(1, { title: 'IT Support Specialist' })]);
    },
  });

  const summary = await service.runAll('scheduled');

  assert.equal(searches[0].status, 'failed');
  assert.doesNotMatch(searches[0].errorMessage, /secret/);
  assert.match(searches[0].errorMessage, /\[REDACTED\]/);
  assert.equal(searches[1].status, 'success');
  assert.equal(finishedQueries[0].status, 'partial');
  assert.equal(summary.status, 'success');
  assert.equal(run().queriesSucceeded, 1);
});

test('reports a partial search with real counters when a later phrase fails after earlier phrases succeeded', async () => {
  const { pool } = fakePool();
  const { service, searches } = harness({
    pool,
    queries: [query({ roleFamilies: ['systems-administration'] })],
    search: async ({ phrase }) => {
      if (phrase === 'system administrator') throw new Error('upstream hiccup');
      return page([listing(1)]);
    },
  });

  await service.runAll('scheduled');

  // The first phrase ('systems administrator') succeeded and fetched a page before the
  // second phrase ('system administrator') threw; the recorded result must reflect that
  // real work instead of being erased to a zeroed-out 'failed' row.
  assert.equal(searches[0].status, 'partial');
  assert.ok(searches[0].pagesRequested > 0, `expected pagesRequested > 0, got ${searches[0].pagesRequested}`);
  assert.ok(searches[0].recordsReceived > 0, `expected recordsReceived > 0, got ${searches[0].recordsReceived}`);
  assert.match(searches[0].errorMessage, /upstream hiccup/);
});

test('marks a query failed when every role family fails', async () => {
  const { pool } = fakePool();
  const { service, finishedQueries } = harness({
    pool,
    queries: [query({ roleFamilies: ['systems-administration', 'it-support'] })],
    search: async () => { throw new Error('upstream down'); },
  });

  const summary = await service.runAll('scheduled');
  assert.equal(finishedQueries[0].status, 'failed');
  assert.equal(summary.status, 'failed');
});

test('records an unresolved enabled search as failed and continues with the rest', async () => {
  const { pool } = fakePool();
  const { service, finishedQueries } = harness({
    pool,
    queries: [
      query({ id: 'unresolved', name: 'Unresolved', center: { displayName: 'Somewhere', latitude: null, longitude: null } }),
      query({ id: 'query-2', name: 'Resolved' }),
    ],
    search: async () => page([listing(1)]),
  });

  const summary = await service.runAll('scheduled');

  assert.equal(finishedQueries[0].status, 'failed');
  assert.match(finishedQueries[0].errorMessage, /location is not confirmed/i);
  assert.equal(finishedQueries[1].status, 'success');
  assert.equal(summary.status, 'partial');
});

test('rejects a single-query run for missing, disabled, or unresolved searches', async () => {
  const { pool } = fakePool();
  const { service } = harness({
    pool,
    queries: [
      query({ id: 'disabled', enabled: false }),
      query({ id: 'unresolved', center: { displayName: 'Somewhere', latitude: null, longitude: null } }),
    ],
    search: async () => page([]),
  });

  await assert.rejects(service.runQuery('missing'), error => error.code === 'QUERY_NOT_FOUND');
  await assert.rejects(service.runQuery('disabled'), error => error.code === 'QUERY_DISABLED');
  await assert.rejects(service.runQuery('unresolved'), error => error.code === 'QUERY_LOCATION_UNRESOLVED');
});

test('runs a single enabled search under the per-query budget', async () => {
  const { pool } = fakePool();
  const requested = [];
  const { service } = harness({
    pool,
    queries: [query({ roleFamilies: ['systems-administration', 'it-support', 'cloud-support'] })],
    search: async ({ roleFamily }) => { requested.push(roleFamily); return fullPage(requested.length * 100, 50); },
    discovery: { queryRequestBudget: 1, runRequestBudget: 20, maxPagesPerFamily: 3, persistedMatchTarget: 5000 },
  });

  await service.runQuery('query-1');
  assert.equal(requested.length, 1);
});

test('rejects a manual run during the cooldown before taking the scrape lock', async () => {
  const service = createDiscoveryService({
    pool: { getConnection: async () => { throw new Error('lock should not be attempted'); } },
    queryRepository: {},
    listingRepository: {},
    runRepository: { recentManual: async () => ({ id: 'recent' }) },
    discoveryRepository: {},
    providers: [fakeProvider({ search: async () => { throw new Error('search should not be attempted'); } })],
    logger: { info: () => {}, error: () => {} },
    now: () => AT,
  });
  await assert.rejects(service.runAll('manual'), error => error instanceof AppError && error.code === 'RUN_COOLDOWN');
});

test('retains committed counters when a fatal bookkeeping error ends a run', async () => {
  const { pool } = fakePool();
  let failureSummary;
  const service = createDiscoveryService({
    pool,
    queryRepository: { list: async () => [query()], get: async () => query() },
    listingRepository: { expire: async () => 0 },
    runRepository: {
      recentManual: async () => null,
      recoverStale: async () => {},
      create: async () => 'run-fatal',
      addSearchResult: async () => {},
      finishQuery: async () => {},
      finish: async (_connection, _id, summary) => {
        failureSummary = summary;
        if (summary.status === 'success') throw new Error('finish failed');
        return summary;
      },
    },
    discoveryRepository: { statusesByProviderId: async () => new Map() },
    providers: [fakeProvider({ search: async () => page([listing(1)]) })],
    logger: { info: () => {}, error: () => {} },
    now: () => AT,
  });

  await assert.rejects(service.runAll('scheduled'), /finish failed/);
  assert.equal(failureSummary.status, 'partial');
  assert.equal(failureSummary.queriesSucceeded, 1);
  // The single family now searches 3 phrases, each returning the same short page,
  // so recordsReceived (and therefore listingsFetched) triples even though only one
  // listing is ever persisted as new.
  assert.equal(failureSummary.listingsFetched, 3);
});

test('releases the scrape lock after a failed run', async () => {
  const { pool, statements } = fakePool();
  const { service } = harness({
    pool,
    search: async () => { throw new Error('upstream down'); },
  });

  await service.runAll('scheduled');
  assert.ok(statements.some(sql => sql.includes("RELEASE_LOCK('waypoint:scrape')")));
});

test('searches every provider phrase for a role family and deduplicates across them', async () => {
  const { pool } = fakePool();
  const requested = [];
  const { service } = harness({
    pool,
    search: async ({ phrase, page: requestedPage }) => {
      requested.push(`${phrase}:${requestedPage}`);
      return page([listing(1)]);
    },
    discovery: { runRequestBudget: 20, maxPagesPerFamily: 3, persistedMatchTarget: 500 },
  });

  await service.runAll('scheduled');

  assert.deepEqual(requested, [
    'systems administrator:1',
    'system administrator:1',
    'IT administrator:1',
  ]);
});

test('stops searching later phrases once the request budget runs out', async () => {
  const { pool } = fakePool();
  const requested = [];
  const { service, finishedQueries } = harness({
    pool,
    search: async ({ phrase }) => { requested.push(phrase); return page([]); },
    discovery: { runRequestBudget: 2, maxPagesPerFamily: 3, persistedMatchTarget: 500 },
  });

  await service.runAll('scheduled');

  assert.deepEqual(requested, ['systems administrator', 'system administrator']);
  assert.equal(finishedQueries[0].truncated, true);
  assert.ok(finishedQueries[0].unsearchedRequests >= 1);
});

test('gives each provider its own budget so a broad provider cannot starve another', async () => {
  const { pool } = fakePool();
  const requested = [];
  const { service } = harness({
    pool,
    providers: [
      // Three phrases and every page full: against one shared counter this provider
      // would page until the whole run budget was gone, which is the starvation the
      // per-provider split exists to prevent.
      fakeProvider({
        id: 'adzuna',
        search: async () => { requested.push('adzuna'); return fullPage(requested.length * 100, 50); },
      }),
      fakeProvider({
        id: 'usajobs',
        planRoleFamily: () => [{ series: '2210' }],
        search: async () => { requested.push('usajobs'); return page([]); },
      }),
    ],
    discovery: { runRequestBudget: 4, maxPagesPerFamily: 3, persistedMatchTarget: 5000 },
  });

  await service.runAll('scheduled');

  assert.deepEqual(requested, ['adzuna', 'adzuna', 'usajobs']);
});

test('lets each provider decompose a role family its own way', async () => {
  const { pool } = fakePool();
  const adzunaRequests = [];
  const usajobsRequests = [];
  const { service } = harness({
    pool,
    providers: [
      fakeProvider({
        id: 'adzuna',
        search: async ({ phrase }) => { adzunaRequests.push(phrase); return page([]); },
      }),
      // A series-code provider covers the family in a single request instead of being
      // driven through a phrase loop that suits neither its retrieval model nor its budget.
      fakeProvider({
        id: 'usajobs',
        planRoleFamily: () => [{ series: '2210' }],
        search: async ({ series }) => { usajobsRequests.push(series); return page([]); },
      }),
    ],
    discovery: { runRequestBudget: 20, maxPagesPerFamily: 3, persistedMatchTarget: 500 },
  });

  await service.runAll('scheduled');

  assert.deepEqual(adzunaRequests, ['systems administrator', 'system administrator', 'IT administrator']);
  assert.deepEqual(usajobsRequests, ['2210']);
});

test('keeps listings from different providers apart when they share a provider job id', async () => {
  const { pool } = fakePool();
  const { service, finishedQueries } = harness({
    pool,
    providers: [
      fakeProvider({
        id: 'adzuna',
        planRoleFamily: () => [{ phrase: 'systems administrator' }],
        search: async () => page([listing(1)]),
      }),
      // The same provider_job_id from a different provider is a different posting:
      // the id is unique only within a provider, so these must not collapse into one.
      fakeProvider({
        id: 'usajobs',
        planRoleFamily: () => [{ series: '2210' }],
        search: async () => page([listing(1, { provider: 'usajobs', company: 'Syracuse VA Medical Center' })]),
      }),
    ],
    discovery: { runRequestBudget: 20, maxPagesPerFamily: 1, persistedMatchTarget: 500 },
  });

  await service.runAll('scheduled');

  assert.equal(finishedQueries[0].duplicates, 0, 'a shared id across providers is not a duplicate');
  assert.equal(finishedQueries[0].newMatches, 2);
});

test('scopes preview duplicate lookups to each provider', async () => {
  const { pool } = fakePool();
  const lookups = [];
  const { service } = harness({
    pool,
    providers: [
      fakeProvider({
        id: 'adzuna',
        planRoleFamily: () => [{ phrase: 'systems administrator' }],
        search: async () => page([listing(1)]),
      }),
      fakeProvider({
        id: 'usajobs',
        planRoleFamily: () => [{ series: '2210' }],
        search: async () => page([listing(1, { provider: 'usajobs' })]),
      }),
    ],
    // Only the federal copy is already stored. Asking Adzuna for id '1' must not match it.
    statuses: (provider, ids) => {
      lookups.push({ provider, ids: [...ids] });
      return provider === 'usajobs' ? new Map([['1', 'saved']]) : new Map();
    },
    discovery: { previewRequestBudget: 20, maxPagesPerFamily: 1 },
  });

  const result = await service.preview(query());

  assert.deepEqual(lookups, [
    { provider: 'adzuna', ids: ['1'] },
    { provider: 'usajobs', ids: ['1'] },
  ]);
  assert.equal(result.diagnostics.previouslySaved, 1);
  assert.equal(result.diagnostics.newMatches, 1);
  assert.equal(result.results.find(item => item.company === 'Northwind').status, null);
});
