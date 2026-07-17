import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';
import { withConnection, withTransaction } from './pool.js';
import { mapQuery } from './rows.js';

async function find(connection, id) {
  const rows = await connection.query('SELECT * FROM saved_queries WHERE id = ?', [id]);
  return rows[0] ?? null;
}

async function clearPendingMatches(connection, queryId) {
  await connection.query('DELETE FROM listing_queries WHERE query_id = ?', [queryId]);
  await connection.query(
    `UPDATE listings l LEFT JOIN listing_queries lq ON lq.listing_id = l.id
     SET l.status = 'expired', l.updated_at = UTC_TIMESTAMP(3)
     WHERE l.status = 'new' AND lq.listing_id IS NULL`
  );
}

export function createQueryRepository(pool) {
  return {
    list({ enabledOnly = false } = {}) {
      return withConnection(pool, async connection => {
        const rows = await connection.query(
          `SELECT * FROM saved_queries ${enabledOnly ? 'WHERE enabled = 1' : ''} ORDER BY created_at, name`
        );
        return rows.map(mapQuery);
      });
    },

    create(input) {
      return withTransaction(pool, async connection => {
        const id = randomUUID();
        await connection.query(
          'INSERT INTO saved_queries (id, name, keywords, location, max_age_days, enabled) VALUES (?, ?, ?, ?, ?, ?)',
          [id, input.name, input.keywords, input.location ?? '', input.maxAgeDays, input.enabled === false ? 0 : 1]
        );
        return mapQuery(await find(connection, id));
      });
    },

    update(id, input) {
      return withTransaction(pool, async connection => {
        const lock = await connection.query("SELECT GET_LOCK('waypoint:scrape', 0) AS acquired");
        if (Number(lock[0].acquired) !== 1) throw new AppError(409, 'RUN_IN_PROGRESS', 'Saved queries cannot change during a scrape run');
        try {
          const current = await find(connection, id);
          if (!current) throw new AppError(404, 'QUERY_NOT_FOUND', 'Saved query not found');
          const merged = {
            name: input.name ?? current.name,
            keywords: input.keywords ?? current.keywords,
            location: input.location ?? current.location,
            maxAgeDays: input.maxAgeDays ?? current.max_age_days,
            enabled: input.enabled ?? Boolean(current.enabled),
          };
          const criteriaChanged =
            (input.keywords !== undefined && input.keywords !== current.keywords) ||
            (input.location !== undefined && input.location !== current.location) ||
            (input.maxAgeDays !== undefined && input.maxAgeDays !== Number(current.max_age_days));
          await connection.query(
            `UPDATE saved_queries SET name = ?, keywords = ?, location = ?, max_age_days = ?, enabled = ?,
             updated_at = UTC_TIMESTAMP(3) WHERE id = ?`,
            [merged.name, merged.keywords, merged.location, merged.maxAgeDays, merged.enabled ? 1 : 0, id]
          );
          if (criteriaChanged) await clearPendingMatches(connection, id);
          return mapQuery(await find(connection, id));
        } finally {
          await connection.query("SELECT RELEASE_LOCK('waypoint:scrape')");
        }
      });
    },

    remove(id) {
      return withTransaction(pool, async connection => {
        const lock = await connection.query("SELECT GET_LOCK('waypoint:scrape', 0) AS acquired");
        if (Number(lock[0].acquired) !== 1) throw new AppError(409, 'RUN_IN_PROGRESS', 'Saved queries cannot change during a scrape run');
        try {
          const current = await find(connection, id);
          if (!current) throw new AppError(404, 'QUERY_NOT_FOUND', 'Saved query not found');
          await connection.query('DELETE FROM saved_queries WHERE id = ?', [id]);
          await clearPendingMatches(connection, id);
          return mapQuery(current);
        } finally {
          await connection.query("SELECT RELEASE_LOCK('waypoint:scrape')");
        }
      });
    },
  };
}
