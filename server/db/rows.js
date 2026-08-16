export function toIso(value) {
  if (!value) return null;
  const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value.toISOString();
  return normalized.endsWith('Z') ? normalized : `${normalized}Z`;
}

export function formatSalary(row) {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: row.currency || 'USD', maximumFractionDigits: 0 });
  if (row.salary_min != null && row.salary_max != null) return `${formatter.format(row.salary_min)}–${formatter.format(row.salary_max)}`;
  if (row.salary_min != null) return `From ${formatter.format(row.salary_min)}`;
  if (row.salary_max != null) return `Up to ${formatter.format(row.salary_max)}`;
  return '';
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

export function mapRunQuery(row) {
  return {
    id: row.id,
    runId: row.run_id,
    queryId: row.query_id,
    queryName: row.query_name,
    status: row.status,
    listingsFetched: Number(row.listings_fetched),
    newMatches: Number(row.new_matches),
    providerResultCount: Number(row.provider_result_count),
    pagesRequested: Number(row.pages_requested),
    recordsReceived: Number(row.records_received),
    duplicates: Number(row.duplicates),
    previouslySaved: Number(row.previously_saved),
    previouslyDismissed: Number(row.previously_dismissed),
    rejectedAge: Number(row.rejected_age),
    rejectedDistance: Number(row.rejected_distance),
    rejectedTerms: Number(row.rejected_terms),
    rejectedSalary: Number(row.rejected_salary),
    rejectedRemoteOnly: Number(row.rejected_remote_only),
    malformedRecords: Number(row.malformed_records),
    unsearchedRequests: Number(row.unsearched_requests),
    truncated: Boolean(row.truncated),
    errorMessage: row.error_message,
    startedAt: toIso(row.started_at),
    finishedAt: toIso(row.finished_at),
  };
}

export function mapRunSearch(row) {
  return {
    id: row.id,
    runId: row.run_id,
    queryId: row.query_id,
    roleFamily: row.role_family,
    status: row.status,
    providerResultCount: Number(row.provider_result_count),
    pagesRequested: Number(row.pages_requested),
    recordsReceived: Number(row.records_received),
    acceptedMatches: Number(row.accepted_matches),
    truncated: Boolean(row.truncated),
    errorMessage: row.error_message,
    startedAt: toIso(row.started_at),
    finishedAt: toIso(row.finished_at),
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
