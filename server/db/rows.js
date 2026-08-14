export function toIso(value) {
  if (!value) return null;
  const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value.toISOString();
  return normalized.endsWith('Z') ? normalized : `${normalized}Z`;
}

export function mapJob(row) {
  return {
    id: row.id,
    role: row.role,
    company: row.company,
    stage: row.stage,
    location: row.location,
    salary: row.salary,
    contact: row.contact,
    next: row.next_action,
    nextActionAt: toIso(row.next_action_at),
    notes: row.notes,
    urgent: Boolean(row.urgent),
    isDraft: Boolean(row.is_draft),
    url: row.url,
    sortOrder: Number(row.sort_order),
    sourceListingId: row.source_listing_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function parseTerms(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function mapQuery(row, roleFamilies = []) {
  const optionalTerms = parseTerms(row.optional_terms);
  const center = {
    displayName: row.center_display_name ?? null,
    latitude: row.center_latitude == null ? null : Number(row.center_latitude),
    longitude: row.center_longitude == null ? null : Number(row.center_longitude),
    provider: row.geocoder_provider ?? null,
    placeId: row.geocoder_place_id ?? null,
  };
  return {
    id: row.id,
    name: row.name,
    center,
    preferredRadiusMiles: row.preferred_radius_miles == null ? null : Number(row.preferred_radius_miles),
    maximumRadiusMiles: row.maximum_radius_miles == null ? null : Number(row.maximum_radius_miles),
    roleFamilies,
    requiredTerms: parseTerms(row.required_terms),
    optionalTerms,
    excludedTerms: parseTerms(row.excluded_terms),
    maxAgeDays: Number(row.max_age_days),
    minimumSalary: row.minimum_salary == null ? null : Number(row.minimum_salary),
    enabled: Boolean(row.enabled),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    keywords: optionalTerms.join(' '),
    location: center.displayName,
  };
}

export function mapRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    trigger: row.trigger_type,
    status: row.status,
    startedAt: toIso(row.started_at),
    finishedAt: toIso(row.finished_at),
    queriesTotal: Number(row.queries_total),
    queriesSucceeded: Number(row.queries_succeeded),
    listingsFetched: Number(row.listings_fetched),
    newMatches: Number(row.new_matches),
    errorSummary: row.error_summary,
  };
}
