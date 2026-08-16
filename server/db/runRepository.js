import { randomUUID } from 'node:crypto';
import { withConnection } from './pool.js';
import { mapRun, mapRunQuery, mapRunSearch } from './rows.js';

export function createRunRepository(pool) {
  return {
    latest() {
      return withConnection(pool, async connection => {
        const rows = await connection.query('SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 1');
        return mapRun(rows[0]);
      });
    },

    recentManual(since) {
      return withConnection(pool, async connection => {
        const rows = await connection.query(
          "SELECT * FROM scrape_runs WHERE trigger_type = 'manual' AND started_at >= ? ORDER BY started_at DESC LIMIT 1",
          [since]
        );
        return mapRun(rows[0]);
      });
    },

    async create(connection, trigger, queriesTotal, startedAt) {
      const id = randomUUID();
      await connection.query(
        `INSERT INTO scrape_runs (id, trigger_type, status, started_at, queries_total)
         VALUES (?, ?, 'running', ?, ?)`,
        [id, trigger, startedAt, queriesTotal]
      );
      return id;
    },

    // One row per role family searched, written as each family finishes.
    async addSearchResult(connection, result) {
      await connection.query(
        `INSERT INTO scrape_run_searches
          (id, run_id, query_id, role_family, status, provider_result_count, pages_requested,
           records_received, accepted_matches, truncated, error_message, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), result.runId, result.queryId, result.roleFamily, result.status,
          result.providerResultCount, result.pagesRequested, result.recordsReceived,
          result.acceptedMatches, result.truncated ? 1 : 0, result.errorMessage,
          result.startedAt, result.finishedAt]
      );
    },

    // One aggregate row per saved search, written after all of its families finish.
    async finishQuery(connection, result) {
      await connection.query(
        `INSERT INTO scrape_run_queries
          (id, run_id, query_id, query_name, status, listings_fetched, new_matches, error_message,
           started_at, finished_at, provider_result_count, pages_requested, records_received,
           duplicates, previously_saved, previously_dismissed, rejected_age, rejected_distance,
           rejected_terms, rejected_salary, rejected_remote_only, malformed_records,
           unsearched_requests, truncated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), result.runId, result.queryId, result.queryName, result.status,
          result.listingsFetched, result.newMatches, result.errorMessage,
          result.startedAt, result.finishedAt,
          result.providerResultCount, result.pagesRequested, result.recordsReceived,
          result.duplicates, result.previouslySaved, result.previouslyDismissed,
          result.rejectedAge, result.rejectedDistance, result.rejectedTerms, result.rejectedSalary,
          result.rejectedRemoteOnly, result.malformedRecords, result.unsearchedRequests,
          result.truncated ? 1 : 0]
      );
    },

    detail(runId) {
      return withConnection(pool, async connection => {
        const runs = await connection.query('SELECT * FROM scrape_runs WHERE id = ?', [runId]);
        if (!runs.length) return null;
        const queries = await connection.query(
          'SELECT * FROM scrape_run_queries WHERE run_id = ? ORDER BY started_at, query_name', [runId]
        );
        const searches = await connection.query(
          'SELECT * FROM scrape_run_searches WHERE run_id = ? ORDER BY started_at, role_family', [runId]
        );
        return {
          run: mapRun(runs[0]),
          queries: queries.map(mapRunQuery),
          searches: searches.map(mapRunSearch),
        };
      });
    },

    async finish(connection, id, summary) {
      await connection.query(
        `UPDATE scrape_runs SET status = ?, finished_at = ?, queries_succeeded = ?, listings_fetched = ?,
         new_matches = ?, error_summary = ? WHERE id = ?`,
        [summary.status, summary.finishedAt, summary.queriesSucceeded, summary.listingsFetched,
          summary.newMatches, summary.errorSummary, id]
      );
      const rows = await connection.query('SELECT * FROM scrape_runs WHERE id = ?', [id]);
      return mapRun(rows[0]);
    },

    recoverStale(cutoff) {
      return withConnection(pool, connection => connection.query(
        `UPDATE scrape_runs SET status = 'failed', finished_at = UTC_TIMESTAMP(3),
         error_summary = 'Run was interrupted before completion' WHERE status = 'running' AND started_at < ?`,
        [cutoff]
      ));
    },
  };
}
