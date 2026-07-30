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

export function mapQuery(row) {
  return {
    id: row.id,
    name: row.name,
    keywords: row.keywords,
    location: row.location,
    maxAgeDays: Number(row.max_age_days),
    enabled: Boolean(row.enabled),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
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
