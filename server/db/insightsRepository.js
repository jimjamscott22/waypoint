import { withConnection } from './pool.js';
import { toIso } from './rows.js';

export function createInsightsRepository(pool) {
  return {
    snapshot() {
      return withConnection(pool, async connection => {
        const jobs = await connection.query(
          `SELECT id, role, company, stage, next_action_at, created_at, deleted_at
           FROM jobs`
        );
        const events = await connection.query(
          `SELECT job_id, from_stage, to_stage, occurred_at
           FROM job_stage_events
           ORDER BY occurred_at, id`
        );
        const listingMatches = await connection.query(
          `SELECT l.id AS listing_id, l.status, lq.query_id, lq.score, lq.first_matched_at
           FROM listings l
           JOIN listing_queries lq ON lq.listing_id = l.id`
        );
        const queries = await connection.query(
          'SELECT id, name, enabled FROM saved_queries ORDER BY created_at, name'
        );
        const coverage = await connection.query(
          'SELECT MIN(occurred_at) AS history_coverage_starts_at FROM job_stage_events'
        );

        return {
          jobs: jobs.map(row => ({
            id: row.id,
            role: row.role,
            company: row.company,
            stage: row.stage,
            nextActionAt: toIso(row.next_action_at),
            createdAt: toIso(row.created_at),
            deletedAt: toIso(row.deleted_at),
          })),
          events: events.map(row => ({
            jobId: row.job_id,
            fromStage: row.from_stage,
            toStage: row.to_stage,
            occurredAt: toIso(row.occurred_at),
          })),
          listingMatches: listingMatches.map(row => ({
            listingId: row.listing_id,
            status: row.status,
            queryId: row.query_id,
            score: Number(row.score),
            firstMatchedAt: toIso(row.first_matched_at),
          })),
          queries: queries.map(row => ({
            id: row.id,
            name: row.name,
            enabled: Boolean(row.enabled),
          })),
          historyCoverageStartsAt: toIso(coverage[0]?.history_coverage_starts_at),
        };
      });
    },
  };
}
