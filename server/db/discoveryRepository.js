import { randomUUID } from 'node:crypto';
import { withConnection } from './pool.js';

// How a rediscovered listing relates to what is already stored. Saved and dismissed
// decisions are never overwritten; an expired listing may reopen as new.
const OUTCOME_BY_PREVIOUS_STATUS = Object.freeze({
  new: 'duplicate-new',
  saved: 'previously-saved',
  dismissed: 'previously-dismissed',
  expired: 'expired-reopened',
});

function databaseTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Listing timestamp is invalid');
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

export async function persistMatch(connection, { listing, queryId, evaluation, seenAt }) {
  const existing = await connection.query(
    'SELECT id, status FROM listings WHERE provider = ? AND provider_job_id = ?',
    [listing.provider, listing.providerJobId]
  );
  const id = existing[0]?.id ?? randomUUID();
  const previousStatus = existing[0]?.status ?? null;
  const outcome = previousStatus == null ? 'new' : OUTCOME_BY_PREVIOUS_STATUS[previousStatus] ?? 'duplicate-new';

  await connection.query(
    `INSERT INTO listings
      (id, provider, provider_job_id, title, company, location, salary_min, salary_max, currency,
       description, url, published_at, first_seen_at, last_seen_at, status,
       latitude, longitude, provider_category, contract_time, contract_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), company = VALUES(company), location = VALUES(location),
       salary_min = VALUES(salary_min), salary_max = VALUES(salary_max), currency = VALUES(currency),
       description = VALUES(description), url = VALUES(url), published_at = VALUES(published_at),
       last_seen_at = VALUES(last_seen_at), status = IF(status = 'expired', 'new', status),
       latitude = VALUES(latitude), longitude = VALUES(longitude),
       provider_category = VALUES(provider_category), contract_time = VALUES(contract_time),
       contract_type = VALUES(contract_type), updated_at = UTC_TIMESTAMP(3)`,
    [id, listing.provider, listing.providerJobId, listing.title, listing.company, listing.location,
      listing.salaryMin, listing.salaryMax, listing.currency, listing.description, listing.url,
      databaseTimestamp(listing.publishedAt), seenAt, seenAt,
      listing.latitude ?? null, listing.longitude ?? null, listing.providerCategory ?? null,
      listing.contractTime ?? null, listing.contractType ?? null]
  );

  await connection.query(
    `INSERT INTO listing_queries
       (listing_id, query_id, score, first_matched_at, last_matched_at, distance_miles, distance_band, match_facts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE score = VALUES(score), last_matched_at = VALUES(last_matched_at),
       distance_miles = VALUES(distance_miles), distance_band = VALUES(distance_band),
       match_facts = VALUES(match_facts)`,
    [id, queryId, evaluation.score, seenAt, seenAt,
      evaluation.distanceMiles ?? null, evaluation.distanceBand ?? null,
      evaluation.matchFacts == null ? null : JSON.stringify(evaluation.matchFacts)]
  );

  // Evidence accumulates across role families, so an existing row is left in place.
  for (const roleFamily of evaluation.matchedRoleFamilies ?? []) {
    await connection.query(
      `INSERT IGNORE INTO listing_query_role_families (listing_id, query_id, role_family) VALUES (?, ?, ?)`,
      [id, queryId, roleFamily]
    );
  }

  return { id, outcome, previousStatus };
}

export function createDiscoveryRepository(pool) {
  return {
    // Read-only status lookup so preview can report duplicate, saved, and dismissed
    // counts without writing anything.
    statusesByProviderId(provider, providerJobIds) {
      if (providerJobIds.length === 0) return Promise.resolve(new Map());
      return withConnection(pool, async connection => {
        const placeholders = providerJobIds.map(() => '?').join(', ');
        const rows = await connection.query(
          `SELECT provider_job_id, status FROM listings
           WHERE provider = ? AND provider_job_id IN (${placeholders})`,
          [provider, ...providerJobIds]
        );
        return new Map(rows.map(row => [row.provider_job_id, row.status]));
      });
    },
  };
}
