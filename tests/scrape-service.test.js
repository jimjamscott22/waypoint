import test from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../server/errors.js';
import { createScrapeService } from '../server/scraper/service.js';

const queries = [
  { id: 'query-1', name: 'First', keywords: 'systems administrator', location: '', maxAgeDays: 7 },
  { id: 'query-2', name: 'Second', keywords: 'IT support', location: '', maxAgeDays: 7 },
];
const listing = {
  provider: 'adzuna', providerJobId: 'job-1', title: 'Systems Administrator', company: 'Example',
  location: 'Remote', salaryMin: null, salaryMax: null, currency: 'USD', description: 'systems support',
  url: 'https://example.test/job', publishedAt: '2026-07-16T10:00:00.000Z',
};

function fakePool() {
  const connection = {
    query: async sql => {
      if (sql.includes("GET_LOCK('waypoint:scrape'")) return [{ acquired: 1 }];
      if (sql.startsWith('SELECT id, status FROM listings')) return [];
      return { affectedRows: 1 };
    },
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
  };
  return { getConnection: async () => connection };
}

test('continues after a query failure and records a partial run', async () => {
  let finished;
  const runRepository = {
    recentManual: async () => null, recoverStale: async () => {},
    create: async () => 'run-1', addQueryResult: async () => {},
    finish: async (_connection, _id, summary) => { finished = summary; return { id: 'run-1', ...summary }; },
  };
  const service = createScrapeService({
    pool: fakePool(),
    queryRepository: { list: async () => queries },
    listingRepository: { expire: async () => 0 },
    runRepository,
    adzunaClient: { search: async query => query.id === 'query-1' ? [listing] : Promise.reject(new Error('app_key=secret network failure')) },
    logger: { info: () => {}, error: () => {} },
    now: () => new Date('2026-07-16T12:00:00.000Z'),
  });

  const result = await service.run('scheduled');
  assert.equal(result.status, 'partial');
  assert.equal(result.newMatches, 1);
  assert.equal(finished.queriesSucceeded, 1);
  assert.doesNotMatch(finished.errorSummary, /secret/);
});

test('rejects a manual run during the cooldown before taking the scrape lock', async () => {
  const service = createScrapeService({
    pool: { getConnection: async () => { throw new Error('lock should not be attempted'); } },
    queryRepository: {}, listingRepository: {},
    runRepository: { recentManual: async () => ({ id: 'recent' }) },
    adzunaClient: {}, logger: {}, now: () => new Date('2026-07-16T12:00:00.000Z'),
  });
  await assert.rejects(service.run('manual'), error => error instanceof AppError && error.code === 'RUN_COOLDOWN');
});

test('retains committed counters when a fatal bookkeeping error ends a run', async () => {
  let failureSummary;
  const runRepository = {
    recoverStale: async () => {}, create: async () => 'run-fatal', addQueryResult: async () => {},
    finish: async (_connection, _id, summary) => {
      failureSummary = summary;
      if (summary.status === 'success') throw new Error('finish failed');
      return summary;
    },
  };
  const service = createScrapeService({
    pool: fakePool(), queryRepository: { list: async () => [queries[0]] },
    listingRepository: { expire: async () => 0 }, runRepository,
    adzunaClient: { search: async () => [listing] }, logger: { info: () => {}, error: () => {} },
    now: () => new Date('2026-07-16T12:00:00.000Z'),
  });
  await assert.rejects(service.run('scheduled'), /finish failed/);
  assert.equal(failureSummary.status, 'partial');
  assert.equal(failureSummary.queriesSucceeded, 1);
  assert.equal(failureSummary.listingsFetched, 1);
  assert.equal(failureSummary.newMatches, 1);
});
