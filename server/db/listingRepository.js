import { AppError } from '../errors.js';
import { withConnection, withTransaction } from './pool.js';
import { insertJob } from './jobRepository.js';
import { persistMatch } from './discoveryRepository.js';
import { formatSalary, mapJob, toIso } from './rows.js';
import { providerLabel } from '../providers.js';

export { formatSalary };

function mapMatch(row, matchedQueries = []) {
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
    score: matchedQueries.length ? Math.max(...matchedQueries.map(item => item.score)) : 0,
    matchedQueries,
  };
}

const REOPENING_OUTCOMES = new Set(['new', 'expired-reopened']);

// Score-only compatibility wrapper over the shared persistence path.
export async function upsertListingMatch(connection, listing, queryId, score, seenAt) {
  const { id, outcome } = await persistMatch(connection, {
    listing,
    queryId,
    evaluation: { score, distanceMiles: null, distanceBand: null, matchFacts: null, matchedRoleFamilies: [] },
    seenAt,
  });
  return { id, isNew: REOPENING_OUTCOMES.has(outcome) };
}

export function createListingRepository(pool) {
  return {
    listNew() {
      return withConnection(pool, async connection => {
        const listings = await connection.query("SELECT * FROM listings WHERE status = 'new' ORDER BY published_at DESC");
        if (!listings.length) return [];
        const ids = listings.map(row => row.id);
        const placeholders = ids.map(() => '?').join(',');
        const matches = await connection.query(
          `SELECT lq.listing_id, lq.score, q.id, q.name FROM listing_queries lq
           JOIN saved_queries q ON q.id = lq.query_id WHERE lq.listing_id IN (${placeholders})`,
          ids
        );
        const grouped = new Map();
        for (const match of matches) {
          const list = grouped.get(match.listing_id) ?? [];
          list.push({ id: match.id, name: match.name, score: Number(match.score) });
          grouped.set(match.listing_id, list);
        }
        return listings
          .map(row => mapMatch(row, grouped.get(row.id) ?? []))
          .sort((left, right) => right.score - left.score || right.publishedAt.localeCompare(left.publishedAt));
      });
    },

    dismiss(id) {
      return withConnection(pool, async connection => {
        const result = await connection.query(
          "UPDATE listings SET status = 'dismissed', updated_at = UTC_TIMESTAMP(3) WHERE id = ? AND status = 'new'",
          [id]
        );
        if (!result.affectedRows) throw new AppError(409, 'LISTING_NOT_NEW', 'Listing is no longer available for review');
        return { id, status: 'dismissed' };
      });
    },

    save(id) {
      return withTransaction(pool, async connection => {
        const rows = await connection.query('SELECT * FROM listings WHERE id = ? FOR UPDATE', [id]);
        const listing = rows[0];
        if (!listing) throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found');
        const existingJob = await connection.query('SELECT * FROM jobs WHERE source_listing_id = ? AND deleted_at IS NULL', [id]);
        if (listing.status !== 'new') {
          if (listing.status === 'saved' && existingJob.length) return { job: mapJob(existingJob[0]), listingStatus: 'saved' };
          throw new AppError(409, 'LISTING_NOT_NEW', 'Listing is no longer available for review');
        }
        if (existingJob.length) {
          await connection.query("UPDATE listings SET status = 'saved', updated_at = UTC_TIMESTAMP(3) WHERE id = ?", [id]);
          return { job: mapJob(existingJob[0]), listingStatus: 'saved' };
        }
        const job = await insertJob(connection, {
          role: listing.title,
          company: listing.company,
          stage: 'Saved',
          location: listing.location,
          salary: formatSalary(listing),
          contact: '—',
          next: 'Tailor resume & apply',
          urgent: false,
          url: listing.url,
        }, { sourceListingId: id });
        await connection.query("UPDATE listings SET status = 'saved', updated_at = UTC_TIMESTAMP(3) WHERE id = ?", [id]);
        return { job, listingStatus: 'saved' };
      });
    },

    async expire(connection, cutoff) {
      const result = await connection.query(
        "UPDATE listings SET status = 'expired', updated_at = UTC_TIMESTAMP(3) WHERE status = 'new' AND last_seen_at < ?",
        [cutoff]
      );
      return Number(result.affectedRows);
    },
  };
}
