import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';
import { withConnection, withTransaction } from './pool.js';
import { mapQuery } from './rows.js';
import { ROLE_FAMILY_IDS, normalizeTerms, normalizeRoleFamilies } from '../discovery/roleFamilies.js';

const LEGACY_LOCATION_LIMIT = 120;
const DEFAULT_PREFERRED_RADIUS_MILES = 20;
const DEFAULT_MAXIMUM_RADIUS_MILES = 40;

async function find(connection, id) {
  const rows = await connection.query('SELECT * FROM saved_queries WHERE id = ?', [id]);
  return rows[0] ?? null;
}

async function loadRoleFamilies(connection, queryIds) {
  const families = new Map(queryIds.map(id => [id, []]));
  if (queryIds.length === 0) return families;
  const placeholders = queryIds.map(() => '?').join(', ');
  const rows = await connection.query(
    `SELECT query_id, role_family FROM saved_query_role_families
     WHERE query_id IN (${placeholders}) ORDER BY query_id, role_family`,
    queryIds
  );
  for (const row of rows) families.get(row.query_id)?.push(row.role_family);
  return families;
}

async function replaceRoleFamilies(connection, queryId, roleFamilies) {
  await connection.query('DELETE FROM saved_query_role_families WHERE query_id = ?', [queryId]);
  for (const roleFamily of roleFamilies) {
    await connection.query(
      'INSERT INTO saved_query_role_families (query_id, role_family) VALUES (?, ?)',
      [queryId, roleFamily]
    );
  }
}

async function readQuery(connection, id) {
  const row = await find(connection, id);
  if (!row) return null;
  const families = await loadRoleFamilies(connection, [id]);
  return mapQuery(row, families.get(id) ?? []);
}

async function expireOrphanedListings(connection) {
  await connection.query(
    `UPDATE listings l LEFT JOIN listing_queries lq ON lq.listing_id = l.id
     SET l.status = 'expired', l.updated_at = UTC_TIMESTAMP(3)
     WHERE l.status = 'new' AND lq.listing_id IS NULL`
  );
}

// Criteria changes invalidate only undecided matches; saved, dismissed, and expired
// associations stay so historical attribution survives an edit.
async function clearPendingMatches(connection, queryId) {
  await connection.query(
    `DELETE lq FROM listing_queries lq
     JOIN listings l ON l.id = lq.listing_id
     WHERE lq.query_id = ? AND l.status = 'new'`,
    [queryId]
  );
  await expireOrphanedListings(connection);
}

function isLegacyInput(input) {
  return Object.hasOwn(input, 'keywords') || Object.hasOwn(input, 'location');
}

function normalizeCenter(center) {
  const displayName = center?.displayName == null ? null : String(center.displayName).trim() || null;
  const latitude = center?.latitude == null ? null : Number(center.latitude);
  const longitude = center?.longitude == null ? null : Number(center.longitude);
  if ((latitude == null) !== (longitude == null)) {
    throw new AppError(400, 'INVALID_SEARCH_CENTER', 'A search center needs both a latitude and a longitude');
  }
  return {
    displayName,
    latitude,
    longitude,
    provider: center?.provider == null ? null : String(center.provider),
    placeId: center?.placeId == null ? null : String(center.placeId),
  };
}

function centerFromRow(row) {
  return {
    displayName: row.center_display_name ?? null,
    latitude: row.center_latitude == null ? null : Number(row.center_latitude),
    longitude: row.center_longitude == null ? null : Number(row.center_longitude),
    provider: row.geocoder_provider ?? null,
    placeId: row.geocoder_place_id ?? null,
  };
}

function pick(input, key, fallback) {
  return Object.hasOwn(input, key) && input[key] !== undefined ? input[key] : fallback;
}

// Produces the full persisted shape from either a structured or legacy request body,
// merged over the current row when updating.
function resolveRecord(input, current, currentFamilies) {
  const legacy = isLegacyInput(input);
  const row = current ?? {};

  const center = legacy
    ? (Object.hasOwn(input, 'location')
      ? { displayName: String(input.location ?? '').trim() || null, latitude: null, longitude: null, provider: null, placeId: null }
      : (current ? centerFromRow(row) : normalizeCenter(null)))
    : normalizeCenter(pick(input, 'center', current ? centerFromRow(row) : null));

  const roleFamilies = legacy
    ? (current ? currentFamilies : [...ROLE_FAMILY_IDS])
    : normalizeRoleFamilies(pick(input, 'roleFamilies', currentFamilies));

  if (roleFamilies.length === 0) {
    throw new AppError(400, 'ROLE_FAMILY_REQUIRED', 'Select at least one role family');
  }

  const preferredRadiusMiles = Number(pick(input, 'preferredRadiusMiles',
    row.preferred_radius_miles ?? DEFAULT_PREFERRED_RADIUS_MILES));
  const maximumRadiusMiles = Number(pick(input, 'maximumRadiusMiles',
    row.maximum_radius_miles ?? DEFAULT_MAXIMUM_RADIUS_MILES));

  if (!Number.isFinite(preferredRadiusMiles) || preferredRadiusMiles <= 0
    || !Number.isFinite(maximumRadiusMiles) || maximumRadiusMiles <= 0) {
    throw new AppError(400, 'INVALID_RADIUS_RANGE', 'Radius values must be positive');
  }
  if (preferredRadiusMiles > maximumRadiusMiles) {
    throw new AppError(400, 'INVALID_RADIUS_RANGE', 'Preferred radius cannot exceed maximum radius');
  }

  const optionalTerms = legacy
    ? (Object.hasOwn(input, 'keywords') ? normalizeTerms([input.keywords]) : parseStoredTerms(row.optional_terms))
    : normalizeTerms(pick(input, 'optionalTerms', parseStoredTerms(row.optional_terms)));

  const minimumSalary = pick(input, 'minimumSalary', row.minimum_salary == null ? null : Number(row.minimum_salary));
  if (minimumSalary != null && (!Number.isFinite(Number(minimumSalary)) || Number(minimumSalary) < 0)) {
    throw new AppError(400, 'INVALID_MINIMUM_SALARY', 'Minimum salary cannot be negative');
  }

  return {
    legacy,
    name: String(pick(input, 'name', row.name)),
    center,
    preferredRadiusMiles,
    maximumRadiusMiles,
    roleFamilies,
    requiredTerms: legacy
      ? parseStoredTerms(row.required_terms)
      : normalizeTerms(pick(input, 'requiredTerms', parseStoredTerms(row.required_terms))),
    optionalTerms,
    excludedTerms: legacy
      ? parseStoredTerms(row.excluded_terms)
      : normalizeTerms(pick(input, 'excludedTerms', parseStoredTerms(row.excluded_terms))),
    maxAgeDays: Number(pick(input, 'maxAgeDays', row.max_age_days)),
    minimumSalary: minimumSalary == null ? null : Number(minimumSalary),
    enabled: Boolean(pick(input, 'enabled', current ? Boolean(row.enabled) : true)),
    // Only the legacy compatibility path still writes the legacy keywords column.
    keywords: legacy && Object.hasOwn(input, 'keywords')
      ? String(input.keywords)
      : (row.keywords ?? ''),
  };
}

function parseStoredTerms(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeColumns(record) {
  return [
    record.name,
    record.keywords,
    // saved_queries.location is still NOT NULL, so the confirmed display name is mirrored into it.
    (record.center.displayName ?? '').slice(0, LEGACY_LOCATION_LIMIT),
    record.center.displayName,
    record.center.latitude,
    record.center.longitude,
    record.center.provider,
    record.center.placeId,
    record.preferredRadiusMiles,
    record.maximumRadiusMiles,
    JSON.stringify(record.requiredTerms),
    JSON.stringify(record.optionalTerms),
    JSON.stringify(record.excludedTerms),
    record.maxAgeDays,
    record.minimumSalary,
    record.enabled ? 1 : 0,
  ];
}

function criteriaChanged(record, current, currentFamilies) {
  const currentCenter = centerFromRow(current);
  const sameTerms = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
  return currentCenter.displayName !== record.center.displayName
    || currentCenter.latitude !== record.center.latitude
    || currentCenter.longitude !== record.center.longitude
    || Number(current.preferred_radius_miles ?? DEFAULT_PREFERRED_RADIUS_MILES) !== record.preferredRadiusMiles
    || Number(current.maximum_radius_miles ?? DEFAULT_MAXIMUM_RADIUS_MILES) !== record.maximumRadiusMiles
    || !sameTerms([...currentFamilies].sort(), [...record.roleFamilies].sort())
    || !sameTerms(parseStoredTerms(current.required_terms), record.requiredTerms)
    || !sameTerms(parseStoredTerms(current.optional_terms), record.optionalTerms)
    || !sameTerms(parseStoredTerms(current.excluded_terms), record.excludedTerms)
    || Number(current.max_age_days) !== record.maxAgeDays
    || (current.minimum_salary == null ? null : Number(current.minimum_salary)) !== record.minimumSalary;
}

export function createQueryRepository(pool) {
  return {
    list({ enabledOnly = false } = {}) {
      return withConnection(pool, async connection => {
        const rows = await connection.query(
          `SELECT * FROM saved_queries ${enabledOnly ? 'WHERE enabled = 1' : ''} ORDER BY created_at, name`
        );
        const families = await loadRoleFamilies(connection, rows.map(row => row.id));
        return rows.map(row => mapQuery(row, families.get(row.id) ?? []));
      });
    },

    get(id) {
      return withConnection(pool, connection => readQuery(connection, id));
    },

    create(input) {
      return withTransaction(pool, async connection => {
        const record = resolveRecord(input, null, []);
        const id = randomUUID();
        await connection.query(
          `INSERT INTO saved_queries (
             id, name, keywords, location, center_display_name, center_latitude, center_longitude,
             geocoder_provider, geocoder_place_id, preferred_radius_miles, maximum_radius_miles,
             required_terms, optional_terms, excluded_terms, max_age_days, minimum_salary, enabled
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, ...writeColumns(record)]
        );
        await replaceRoleFamilies(connection, id, record.roleFamilies);
        return readQuery(connection, id);
      });
    },

    update(id, input) {
      return withTransaction(pool, async connection => {
        const lock = await connection.query("SELECT GET_LOCK('waypoint:scrape', 0) AS acquired");
        if (Number(lock[0].acquired) !== 1) throw new AppError(409, 'RUN_IN_PROGRESS', 'Saved queries cannot change during a scrape run');
        try {
          const current = await find(connection, id);
          if (!current) throw new AppError(404, 'QUERY_NOT_FOUND', 'Saved query not found');
          const currentFamilies = (await loadRoleFamilies(connection, [id])).get(id) ?? [];
          const record = resolveRecord(input, current, currentFamilies);

          await connection.query(
            `UPDATE saved_queries SET
               name = ?, keywords = ?, location = ?, center_display_name = ?, center_latitude = ?,
               center_longitude = ?, geocoder_provider = ?, geocoder_place_id = ?,
               preferred_radius_miles = ?, maximum_radius_miles = ?, required_terms = ?,
               optional_terms = ?, excluded_terms = ?, max_age_days = ?, minimum_salary = ?, enabled = ?,
               updated_at = UTC_TIMESTAMP(3)
             WHERE id = ?`,
            [...writeColumns(record), id]
          );
          await replaceRoleFamilies(connection, id, record.roleFamilies);
          if (criteriaChanged(record, current, currentFamilies)) await clearPendingMatches(connection, id);
          return readQuery(connection, id);
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
          const removed = await readQuery(connection, id);
          if (!removed) throw new AppError(404, 'QUERY_NOT_FOUND', 'Saved query not found');
          await connection.query('DELETE FROM saved_queries WHERE id = ?', [id]);
          await expireOrphanedListings(connection);
          return removed;
        } finally {
          await connection.query("SELECT RELEASE_LOCK('waypoint:scrape')");
        }
      });
    },
  };
}
