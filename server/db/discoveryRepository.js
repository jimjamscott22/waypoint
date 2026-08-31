import { randomUUID } from 'node:crypto';
import { withConnection } from './pool.js';
import { formatSalary, toIso } from './rows.js';
import { providerLabel } from '../providers.js';

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

const DISTANCE_BAND_BY_RANK = Object.freeze({ 1: 'preferred', 2: 'expanded', 3: 'unknown' });

// User text must never become an uncontrolled LIKE pattern.
function escapeLike(value) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}

function parseJsonColumn(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapDiscoveryItem(row, matchedQueries, roleFamilies) {
  return {
    id: row.id,
    title: row.title,
    role: row.title,
    company: row.company,
    location: row.location,
    salaryMin: row.salary_min == null ? null : Number(row.salary_min),
    salaryMax: row.salary_max == null ? null : Number(row.salary_max),
    salary: formatSalary(row),
    currency: row.currency,
    description: row.description,
    url: row.url,
    publishedAt: toIso(row.published_at),
    status: row.status,
    source: providerLabel(row.provider),
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    providerCategory: row.provider_category,
    contractTime: row.contract_time,
    contractType: row.contract_type,
    score: row.score == null ? 0 : Number(row.score),
    distanceMiles: row.distance_miles == null ? null : Number(row.distance_miles),
    distanceBand: DISTANCE_BAND_BY_RANK[Number(row.distance_rank)] ?? 'unknown',
    roleFamilies,
    matchedQueries,
  };
}

const SORT_CLAUSES = Object.freeze({
  best: 'score DESC, l.published_at DESC',
  newest: 'l.published_at DESC, score DESC',
  // Unknown distances and salaries sort last rather than reading as zero.
  nearest: 'distance_is_unknown ASC, distance_miles ASC, score DESC',
  salary: 'salary_is_unknown ASC, l.salary_max DESC, l.salary_min DESC, score DESC',
});

function buildConditions(filters) {
  const where = [];
  const having = [];
  const params = [];

  if (filters.status) {
    where.push('l.status = ?');
    params.push(filters.status);
  }
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    where.push("(l.title LIKE ? ESCAPE '\\\\' OR l.company LIKE ? ESCAPE '\\\\')");
    params.push(pattern, pattern);
  }
  if (filters.queryId) {
    where.push('EXISTS (SELECT 1 FROM listing_queries f WHERE f.listing_id = l.id AND f.query_id = ?)');
    params.push(filters.queryId);
  }
  if (filters.roleFamily) {
    where.push('EXISTS (SELECT 1 FROM listing_query_role_families f WHERE f.listing_id = l.id AND f.role_family = ?)');
    params.push(filters.roleFamily);
  }
  if (filters.distanceBand) {
    where.push('EXISTS (SELECT 1 FROM listing_queries f WHERE f.listing_id = l.id AND f.distance_band = ?)');
    params.push(filters.distanceBand);
  }
  if (filters.maxAgeDays != null) {
    where.push('l.published_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)');
    params.push(filters.maxAgeDays);
  }
  if (filters.salaryStatus === 'known') {
    where.push('(l.salary_min IS NOT NULL OR l.salary_max IS NOT NULL)');
  } else if (filters.salaryStatus === 'unknown') {
    where.push('(l.salary_min IS NULL AND l.salary_max IS NULL)');
  }
  if (filters.minSalary != null) {
    where.push('COALESCE(l.salary_max, l.salary_min) >= ?');
    params.push(filters.minSalary);
  }
  if (filters.minScore != null) {
    having.push('score >= ?');
  }
  if (filters.maxScore != null) {
    having.push('score <= ?');
  }

  return { where, having, params };
}

export function createDiscoveryRepository(pool) {
  return {
    // Grouping by listing id before pagination keeps multi-query and multi-family
    // joins from duplicating rows or inflating the total.
    //
    // The join is LEFT so a listing outlives its query associations. Deleting a saved
    // query cascades its listing_queries rows, and under an inner join that hid the
    // listing at every status filter — a saved or dismissed decision would vanish from
    // the review queue even though the listings row was untouched. Filters that need an
    // association (queryId, roleFamily, distanceBand) use EXISTS and still exclude these
    // rows; a minScore or maxScore bound drops them too, because their aggregate score is
    // NULL rather than zero.
    search(filters = {}) {
      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 25;
      const { where, having, params } = buildConditions(filters);
      const havingParams = [filters.minScore, filters.maxScore].filter(value => value != null);
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const havingSql = having.length ? `HAVING ${having.join(' AND ')}` : '';
      const orderSql = SORT_CLAUSES[filters.sort] ?? SORT_CLAUSES.best;

      const groupedSql = `
        FROM listings l
        LEFT JOIN listing_queries lq ON lq.listing_id = l.id
        ${whereSql}
        GROUP BY l.id
        ${havingSql}`;

      return withConnection(pool, async connection => {
        const totals = await connection.query(
          `SELECT COUNT(*) AS total FROM (
             SELECT l.id, MAX(lq.score) AS score ${groupedSql}
           ) AS grouped`,
          [...params, ...havingParams]
        );
        const total = Number(totals[0].total);
        const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;

        const rows = await connection.query(
          `SELECT l.*,
                  MAX(lq.score) AS score,
                  MIN(lq.distance_miles) AS distance_miles,
                  MIN(CASE lq.distance_band WHEN 'preferred' THEN 1 WHEN 'expanded' THEN 2 ELSE 3 END) AS distance_rank,
                  (MIN(lq.distance_miles) IS NULL) AS distance_is_unknown,
                  (l.salary_min IS NULL AND l.salary_max IS NULL) AS salary_is_unknown
           ${groupedSql}
           ORDER BY ${orderSql}
           LIMIT ? OFFSET ?`,
          [...params, ...havingParams, pageSize, (page - 1) * pageSize]
        );

        if (rows.length === 0) return { items: [], page, pageSize, total, totalPages };

        const ids = rows.map(row => row.id);
        const placeholders = ids.map(() => '?').join(', ');
        const [matches, families] = await Promise.all([
          connection.query(
            `SELECT lq.listing_id, lq.score, lq.distance_miles, lq.distance_band, lq.match_facts,
                    q.id AS query_id, q.name AS query_name
             FROM listing_queries lq
             JOIN saved_queries q ON q.id = lq.query_id
             WHERE lq.listing_id IN (${placeholders})`,
            ids
          ),
          connection.query(
            `SELECT listing_id, role_family FROM listing_query_role_families
             WHERE listing_id IN (${placeholders}) ORDER BY role_family`,
            ids
          ),
        ]);

        const matchesByListing = new Map();
        for (const match of matches) {
          const list = matchesByListing.get(match.listing_id) ?? [];
          list.push({
            id: match.query_id,
            name: match.query_name,
            score: Number(match.score),
            distanceMiles: match.distance_miles == null ? null : Number(match.distance_miles),
            distanceBand: match.distance_band,
            matchFacts: parseJsonColumn(match.match_facts),
          });
          matchesByListing.set(match.listing_id, list);
        }

        const familiesByListing = new Map();
        for (const row of families) {
          const list = familiesByListing.get(row.listing_id) ?? [];
          if (!list.includes(row.role_family)) list.push(row.role_family);
          familiesByListing.set(row.listing_id, list);
        }

        const items = rows.map(row => mapDiscoveryItem(
          row,
          matchesByListing.get(row.id) ?? [],
          familiesByListing.get(row.id) ?? []
        ));
        return { items, page, pageSize, total, totalPages };
      });
    },

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
