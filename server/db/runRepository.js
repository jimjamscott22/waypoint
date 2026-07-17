import { randomUUID } from 'node:crypto';
import { withConnection } from './pool.js';
import { mapRun } from './rows.js';

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

    async addQueryResult(connection, result) {
      await connection.query(
        `INSERT INTO scrape_run_queries
          (id, run_id, query_id, query_name, status, listings_fetched, new_matches, error_message, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), result.runId, result.queryId, result.queryName, result.status, result.listingsFetched,
          result.newMatches, result.errorMessage, result.startedAt, result.finishedAt]
      );
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
