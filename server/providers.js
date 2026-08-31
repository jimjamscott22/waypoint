// Provider identity in one place. `id` is exactly what the `listings.provider` column
// stores; `label` is what the review queue shows as a listing's source. Both the
// repositories (mapping stored rows back out) and the discovery service (splitting
// budgets, scoping duplicate lookups) read from here, so it lives above both.
//
// Adding a provider means adding an entry here plus a client that reports the same `id`.
const PROVIDERS = Object.freeze({
  adzuna: Object.freeze({ id: 'adzuna', label: 'Adzuna' }),
});

export function providerIds() {
  return Object.keys(PROVIDERS);
}

// Rows outlive the registry: a provider that is retired still has listings stored under
// its id. Falling back to the raw id keeps those rows identifiable instead of collapsing
// every one of them into a single meaningless label.
export function providerLabel(id) {
  return PROVIDERS[id]?.label ?? String(id ?? '');
}
