import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInsights, parseInsightsRange } from '../server/insights/buildInsights.js';

const NOW = new Date('2026-07-29T12:00:00.000Z');

function snapshot(overrides = {}) {
  return {
    jobs: [],
    events: [],
    listingMatches: [],
    queries: [],
    historyCoverageStartsAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function build(input, range = '90d') {
  return buildInsights(input, { ...parseInsightsRange(range, NOW), now: NOW });
}

test('parses supported Insights ranges and rejects invalid ranges', () => {
  assert.equal(parseInsightsRange('30d', NOW).startsAt.toISOString(), '2026-06-29T12:00:00.000Z');
  assert.equal(parseInsightsRange('90d', NOW).startsAt.toISOString(), '2026-04-30T12:00:00.000Z');
  assert.equal(parseInsightsRange('all', NOW).startsAt, null);
  assert.throws(() => parseInsightsRange('year', NOW), error => error.code === 'INVALID_INSIGHTS_RANGE');
});

test('builds a monotonic cohort funnel while excluding baseline and repeated applications', () => {
  const result = build(snapshot({
    jobs: [
      { id: 'job-1', stage: 'Offer', createdAt: '2026-05-01T00:00:00.000Z', deletedAt: null },
      { id: 'job-2', stage: 'Applied', createdAt: '2026-05-02T00:00:00.000Z', deletedAt: null },
      { id: 'job-3', stage: 'Applied', createdAt: '2026-05-03T00:00:00.000Z', deletedAt: null },
    ],
    events: [
      { jobId: 'job-1', fromStage: null, toStage: 'Saved', occurredAt: '2026-05-01T00:00:00.000Z' },
      { jobId: 'job-1', fromStage: 'Saved', toStage: 'Applied', occurredAt: '2026-05-05T00:00:00.000Z' },
      { jobId: 'job-1', fromStage: 'Applied', toStage: 'Interviewing', occurredAt: '2026-05-12T00:00:00.000Z' },
      { jobId: 'job-1', fromStage: 'Interviewing', toStage: 'Applied', occurredAt: '2026-05-19T00:00:00.000Z' },
      { jobId: 'job-1', fromStage: 'Applied', toStage: 'Offer', occurredAt: '2026-05-26T00:00:00.000Z' },
      { jobId: 'job-2', fromStage: 'Saved', toStage: 'Applied', occurredAt: '2026-06-02T00:00:00.000Z' },
      { jobId: 'job-3', fromStage: null, toStage: 'Applied', occurredAt: '2026-06-03T00:00:00.000Z' },
    ],
  }));

  assert.deepEqual(result.outcomes, {
    applicationsSent: 2,
    interviewsReached: 1,
    interviewRate: 50,
    activeOpportunities: 3,
  });
  assert.deepEqual(result.funnel, [
    { stage: 'Applied', count: 2 },
    { stage: 'Interviewing', count: 1 },
    { stage: 'Offer', count: 1 },
  ]);
  assert.equal(result.weeklyActivity.reduce((sum, week) => sum + week.applied, 0), 3);
  assert.ok(result.weeklyActivity.some(week => week.weekStart === '2026-04-27'));
});

test('returns a null interview rate for an empty cohort', () => {
  assert.equal(build(snapshot()).outcomes.interviewRate, null);
});

test('buckets Sunday activity into the preceding UTC Monday', () => {
  const result = build(snapshot({
    events: [
      { jobId: 'job-1', fromStage: 'Saved', toStage: 'Applied', occurredAt: '2026-06-07T23:30:00.000Z' },
    ],
  }), 'all');
  const week = result.weeklyActivity.find(item => item.weekStart === '2026-06-01');
  assert.equal(week.applied, 1);
});

test('deduplicates overall discovery while attributing matches to every query', () => {
  const result = build(snapshot({
    queries: [
      { id: 'query-1', name: 'Systems', enabled: true },
      { id: 'query-2', name: 'Support', enabled: true },
    ],
    listingMatches: [
      { listingId: 'listing-1', status: 'saved', queryId: 'query-1', score: 90, firstMatchedAt: '2026-06-10T00:00:00.000Z' },
      { listingId: 'listing-1', status: 'saved', queryId: 'query-2', score: 80, firstMatchedAt: '2026-06-10T00:00:00.000Z' },
      { listingId: 'listing-2', status: 'dismissed', queryId: 'query-1', score: 70, firstMatchedAt: '2026-06-11T00:00:00.000Z' },
      { listingId: 'listing-3', status: 'new', queryId: 'query-1', score: 60, firstMatchedAt: '2026-06-12T00:00:00.000Z' },
      { listingId: 'listing-4', status: 'expired', queryId: 'query-1', score: 50, firstMatchedAt: '2026-06-13T00:00:00.000Z' },
    ],
  }));

  assert.deepEqual(
    {
      matchesFound: result.discovery.matchesFound,
      reviewedResults: result.discovery.reviewedResults,
      savedListings: result.discovery.savedListings,
      saveRate: result.discovery.saveRate,
      dismissedListings: result.discovery.dismissedListings,
    },
    { matchesFound: 4, reviewedResults: 2, savedListings: 1, saveRate: 50, dismissedListings: 1 }
  );
  const systems = result.discovery.queries.find(query => query.id === 'query-1');
  const support = result.discovery.queries.find(query => query.id === 'query-2');
  assert.deepEqual(
    { matches: systems.matchesFound, reviewed: systems.reviewedResults, saved: systems.savedListings, average: systems.averageScore },
    { matches: 4, reviewed: 2, saved: 1, average: 67.5 }
  );
  assert.equal(support.matchesFound, 1);
});

test('uses recommendation thresholds, priority order, and future-action suppression', () => {
  const listingMatches = Array.from({ length: 20 }, (_, index) => ({
    listingId: `listing-${index}`,
    status: index === 10 ? 'saved' : 'dismissed',
    queryId: index < 10 ? 'query-low' : 'query-boundary',
    score: 70,
    firstMatchedAt: '2026-06-15T00:00:00.000Z',
  }));
  const result = build(snapshot({
    jobs: [
      { id: 'due', role: 'Admin', company: 'Due Co', stage: 'Applied', nextActionAt: '2026-07-20T00:00:00.000Z', createdAt: '2026-06-01T00:00:00.000Z', deletedAt: null },
      { id: 'stalled', role: 'Engineer', company: 'Stall Co', stage: 'Applied', nextActionAt: null, createdAt: '2026-06-01T00:00:00.000Z', deletedAt: null },
      { id: 'future', role: 'Analyst', company: 'Future Co', stage: 'Applied', nextActionAt: '2026-08-02T00:00:00.000Z', createdAt: '2026-06-01T00:00:00.000Z', deletedAt: null },
      { id: 'saved', role: 'Support', company: 'Saved Co', stage: 'Saved', nextActionAt: null, createdAt: '2026-07-01T00:00:00.000Z', deletedAt: null },
    ],
    events: [
      { jobId: 'due', fromStage: 'Saved', toStage: 'Applied', occurredAt: '2026-07-01T00:00:00.000Z' },
      { jobId: 'stalled', fromStage: 'Saved', toStage: 'Applied', occurredAt: '2026-07-01T00:00:00.000Z' },
      { jobId: 'future', fromStage: 'Saved', toStage: 'Applied', occurredAt: '2026-07-01T00:00:00.000Z' },
      { jobId: 'saved', fromStage: null, toStage: 'Saved', occurredAt: '2026-07-01T00:00:00.000Z' },
    ],
    queries: [
      { id: 'query-low', name: 'Low', enabled: true },
      { id: 'query-boundary', name: 'Boundary', enabled: true },
    ],
    listingMatches,
  }));

  assert.deepEqual(result.recommendations.map(item => item.type), [
    'follow-up-due',
    'stalled-applied',
    'stale-saved',
    'low-performing-query',
  ]);
  assert.equal(result.recommendations.some(item => item.id.includes('future')), false);
  assert.equal(result.recommendations.some(item => item.queryId === 'query-boundary'), false);
});

test('reports finite-range coverage only when tracking began before the range', () => {
  assert.equal(build(snapshot({ historyCoverageStartsAt: '2026-04-01T00:00:00.000Z' })).historyCompleteForRange, true);
  assert.equal(build(snapshot({ historyCoverageStartsAt: '2026-06-01T00:00:00.000Z' })).historyCompleteForRange, false);
  assert.equal(build(snapshot({ historyCoverageStartsAt: '2026-04-01T00:00:00.000Z' }), 'all').historyCompleteForRange, false);
});
