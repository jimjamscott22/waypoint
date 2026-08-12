# Waypoint Discovery Reliability Implementation Plan

> **Execution:** Work inline and sequentially in the current workspace. Do not use subagents, Git worktrees, test-driven loops, or parallel subprocesses. Implement each task first, add focused tests afterward, run the task's verification commands, review the diff, and wait for the user's checkpoint approval before continuing when requested.

**Goal:** Complete Waypoint's broken or unfinished core behavior and deliver reliable, explainable Auburn-area job discovery with a dedicated Capture & queries workspace, stronger discovery and Pipeline filters, real activity summaries, and safe URL capture.

**Architecture:** MariaDB remains authoritative. Provider adapters translate structured criteria and normalize responses; a provider-neutral discovery service owns pagination, request budgets, evaluation, scoring, deduplication, and diagnostics; repositories own SQL and transactions. React continues to use `useJobsStore` as its only application-state owner and composes Pipeline, Capture & queries, and Insights as controlled top-level views.

**Tech Stack:** Node.js 24+, React 18, Vite 8, Fastify 5, MariaDB 10.6+, plain JavaScript, Node's built-in test runner, inline styles from `src/theme.js`, Adzuna, OpenStreetMap Nominatim, and Cheerio 1.2.0 for best-effort HTML metadata parsing.

**Design source:** `docs/superpowers/specs/2026-08-12-discovery-reliability-design.md`

## Global Constraints

- Search center defaults to Auburn, New York.
- Preferred radius is 20 miles inclusive; maximum radius is 40 miles inclusive.
- Search local onsite and hybrid opportunities only; do not add nationwide remote discovery.
- Support systems administration, IT support, network administration, cloud support, IT operations, desktop support, and junior systems engineering role families.
- Preserve existing jobs, saved searches, listing decisions, and historical attribution during forward migration.
- Do not edit migrations `001_initial.sql` or `002_insights.sql`; add `003_discovery_reliability.sql`.
- Keep MariaDB as the only persisted source of truth.
- Keep `useJobsStore` as the only frontend application-state owner.
- Do not add React Router, a state library, an ORM, a CSS framework, or a frontend test framework.
- Keep the existing 1280-pixel desktop minimum.
- Keep expected API errors in `{ error: { code, message } }` form.
- Sanitize every provider, geocoder, and capture error before logging or persistence.
- Preserve the global MariaDB scrape advisory lock and per-query failure isolation.
- Implement first and add regression tests afterward; do not use test-first iteration.
- Do not commit secrets, live provider payloads, database dumps, screenshots, or environment files.

---

## File Map

### Create

- `server/db/migrations/003_discovery_reliability.sql` — structured search, normalized match facts, coordinates, and diagnostic schema.
- `server/discovery/roleFamilies.js` — stable role-family identifiers, labels, and synonym catalog.
- `server/discovery/criteria.js` — structured-term normalization and Adzuna request planning.
- `server/discovery/distance.js` — miles/kilometres conversion and Haversine classification.
- `server/discovery/evaluateListing.js` — deterministic eligibility, explanations, and scoring.
- `server/discovery/service.js` — preview, one-query, and all-query orchestration.
- `server/geocoding/nominatim.js` — policy-compliant, cached-search-compatible location resolver adapter.
- `server/db/discoveryRepository.js` — filtered discovery result reads and match persistence helpers.
- `server/pipeline/buildPipelineSummary.js` — pure real-data Pipeline activity summary.
- `server/db/pipelineRepository.js` — bounded summary source queries.
- `server/pipeline/service.js` — builds the Pipeline bootstrap summary.
- `server/capture/urlPolicy.js` — URL, DNS, address, redirect, type, size, and timeout enforcement.
- `server/capture/extractJobMetadata.js` — JSON-LD, Open Graph, and document metadata extraction.
- `server/capture/service.js` — safe fetch and editable-draft response orchestration.
- `server/routes/capture.js` — `POST /api/capture`.
- `src/lib/discoveryFilters.js` — discovery filter serialization and default state.
- `src/lib/pipelineFilters.js` — pure composable job filtering.
- `src/components/CaptureQueriesView.jsx` — Capture & queries page composition and page states.
- `src/components/SearchBuilder.jsx` — structured saved-search editor and location resolution UI.
- `src/components/SavedSearchList.jsx` — saved-search summaries and actions.
- `src/components/SearchRunDetails.jsx` — persisted run-diagnostic disclosure.
- `src/components/DiscoveryFilters.jsx` — discovery filter and sort controls.
- `src/components/DiscoveryTable.jsx` — pageable result table and save/dismiss actions.
- `src/components/PipelineFilters.jsx` — Pipeline filter controls and active-filter count.
- `tests/discovery-criteria.test.js` — role, term, request, distance, evaluation, and score coverage.
- `tests/discovery-service.test.js` — pagination, budgets, partial runs, preview, and diagnostics.
- `tests/discovery-filters.test.js` — filter serialization and query-string coverage.
- `tests/pipeline-summary.test.js` — real Pipeline summary rules.
- `tests/pipeline-filters.test.js` — client Pipeline filter composition.
- `tests/capture.test.js` — SSRF controls and metadata extraction.

### Modify

- `package.json`, `package-lock.json` — add Cheerio and keep verification scripts explicit.
- `.env.example`, `deploy/waypoint.env.example` — document geocoder identity and discovery budgets.
- `server/config.js` — parse geocoder and discovery limit configuration.
- `server/services.js` — compose geocoder, discovery, Pipeline summary, and capture services.
- `server/app.js` — register routes, expose Pipeline summary, and accept an injectable static root for clean tests.
- `server/cli/scrape.js` — invoke the provider-neutral all-query discovery run.
- `server/db/rows.js` — map structured queries, diagnostics, coordinates, and match facts.
- `server/db/queryRepository.js` — transactional structured criteria and role-family persistence.
- `server/db/listingRepository.js` — preserve decisions and expose save/dismiss helpers to discovery results.
- `server/db/runRepository.js` — diagnostic counters, per-family rows, and detailed run reads.
- `server/routes/queries.js` — structured schemas, location resolution, preview, and one-query run.
- `server/routes/listings.js` — filtered/paginated reads plus existing decision actions.
- `server/routes/runs.js` — all-query execution and diagnostic detail.
- `server/scraper/adzuna.js` — parameter translation, pagination metadata, coordinates, and reliable timeout lifecycle.
- `server/scraper/scoring.js` — retain compatible token helpers and delegate the new score contract.
- `src/lib/apiClient.js` — query, resolution, preview, run, result, diagnostics, summary, and capture requests.
- `src/hooks/useJobsStore.js` — Capture & queries state/actions, discovery filters, Pipeline filters, summaries, and capture warnings.
- `src/App.jsx` — compose the new view, filtered Pipeline, and summary props.
- `src/components/Sidebar.jsx` — activate Capture & queries and render live follow-up content.
- `src/components/Header.jsx` — render real summary values and neutral empty copy.
- `src/components/CaptureBar.jsx` — focus on URL capture and link to query management.
- `src/components/PipelineTable.jsx` — render filtered counts without changing reorder semantics.
- `src/components/ReviewQueue.jsx` — display distance and diagnostic summary and link to full results.
- `src/components/MatchCard.jsx` — display distance band, role family, and match reasons.
- `src/theme.js` — add semantic distance and diagnostic status tokens only.
- `tests/adzuna.test.js` — request encoding, pagination metadata, coordinates, and timeout regression.
- `tests/api.test.js` — static-root, structured query, preview, discovery, diagnostics, summary, and capture contracts.
- `tests/api-client.test.js` — all new client request encodings.
- `tests/config.test.js` — geocoder and request-budget configuration.
- `tests/integration/mariadb.test.js` — migration, structured criteria, attribution, diagnostics, filters, and summaries.
- `README.md`, `docs/project-summary.md`, `docs/project-summary.html`, `docs/deployment-raspberry-pi.md` — verified feature and operations documentation.

### Remove after replacement

- `server/scraper/service.js` — replaced by `server/discovery/service.js` after all imports and tests move.
- `src/lib/parseJobUrl.js` — replaced by the API-backed capture flow.
- `tests/scrape-service.test.js` — replaced by `tests/discovery-service.test.js` after equivalent lock/failure coverage exists.

---

### Task 1: Restore a Clean, Order-Independent Verification Baseline

**Files:**
- Modify: `server/app.js`
- Modify: `server/scraper/adzuna.js`
- Modify: `tests/api.test.js`
- Modify: `tests/adzuna.test.js`

**Interfaces:**
- Consumes: existing `buildApp({ services, logger, serveStatic })` and `createAdzunaClient({ appId, appKey, fetchImpl, sleep, timeoutMs })`.
- Produces: `buildApp({ services, logger, serveStatic, staticRoot })` and a fetch timeout that owns and clears a referenced timer.

- [ ] **Step 1: Make the static root injectable**

Change the application factory to resolve availability from an optional path:

```js
export function buildApp({
  services,
  logger = false,
  serveStatic = true,
  staticRoot = defaultDist,
}) {
  const staticAvailable = serveStatic && existsSync(staticRoot);
  if (staticAvailable) app.register(fastifyStatic, { root: staticRoot, wildcard: false });
}
```

Keep production behavior unchanged by using the current `dist` path as `defaultDist`.

- [ ] **Step 2: Give each Adzuna attempt an owned timeout lifecycle**

Replace the unreferenced `AbortSignal.timeout` dependency with an `AbortController` and ordinary timer that is cleared in `finally`:

```js
async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Adzuna request timed out')), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
```

Keep the existing three-attempt retry behavior and sanitized terminal error.

- [ ] **Step 3: Add regression coverage after implementation**

In `tests/api.test.js`, create a temporary directory containing a minimal `index.html` and `assets/app.js`, inject it as `staticRoot`, and remove it in `t.after`. Assert the SPA fallback and asset response without relying on `npm run build` having run first.

In `tests/adzuna.test.js`, keep the stalled mocked request and assert:

```js
await assert.rejects(client.search({ keywords: 'systems', location: '' }), /timed out/i);
assert.equal(attempts, 3);
```

- [ ] **Step 4: Verify the baseline from a clean tree state**

Run:

```powershell
npm test
npm run build
git diff --check
```

Expected: all unit/API tests pass without a pre-existing `dist`; the Vite build succeeds; whitespace check is clean.

- [ ] **Step 5: Commit the isolated repair**

```powershell
git add server/app.js server/scraper/adzuna.js tests/api.test.js tests/adzuna.test.js
git commit -m "fix: restore clean verification baseline"
```

---

### Task 2: Add the Structured Discovery Schema and Auburn Defaults

**Files:**
- Create: `server/db/migrations/003_discovery_reliability.sql`
- Modify: `server/db/rows.js`
- Modify: `tests/integration/mariadb.test.js`

**Interfaces:**
- Consumes: migrations `001_initial.sql` and `002_insights.sql`, existing seeded query UUIDs, `mapQuery`, and `mapRun`.
- Produces: structured search columns, role-family joins, listing geography, persisted match facts, and per-family run diagnostics.

- [ ] **Step 1: Add the forward-only migration**

Add nullable backward-compatible fields to `saved_queries`:

```sql
center_display_name VARCHAR(255) NULL,
center_latitude DECIMAL(9,6) NULL,
center_longitude DECIMAL(9,6) NULL,
geocoder_provider VARCHAR(40) NULL,
geocoder_place_id VARCHAR(120) NULL,
preferred_radius_miles SMALLINT UNSIGNED NULL,
maximum_radius_miles SMALLINT UNSIGNED NULL,
required_terms JSON NULL,
optional_terms JSON NULL,
excluded_terms JSON NULL,
minimum_salary DECIMAL(12,2) NULL
```

Add constraints enforcing latitude -90 through 90, longitude -180 through 180, positive radii, preferred radius not exceeding maximum radius, and non-negative minimum salary. Copy every legacy `keywords` value into `optional_terms` as a one-element JSON array and copy nonblank legacy `location` into `center_display_name`; leave coordinates null until the user confirms a geocoder candidate.

Create `saved_query_role_families(query_id, role_family)` with a composite primary key, cascading query foreign key, and a `CHECK` over these identifiers:

```text
systems-administration
it-support
network-administration
cloud-support
it-operations
desktop-support
junior-systems-engineering
```

Map the three original fixed seed IDs to systems administration, IT support, and network administration respectively. Give every other pre-migration query all seven role-family rows so it remains editable and can be resolved without losing its criteria; an unresolved center prevents execution until confirmed.

- [ ] **Step 2: Add listing and match evidence fields**

Extend `listings` with `latitude DECIMAL(9,6) NULL`, `longitude DECIMAL(9,6) NULL`, `provider_category VARCHAR(80) NULL`, `contract_time VARCHAR(30) NULL`, and `contract_type VARCHAR(30) NULL`. Constrain coordinates, `contract_time` to null/full_time/part_time, and `contract_type` to null/permanent/contract. Extend `listing_queries` with `distance_miles DECIMAL(7,2) NULL`, `distance_band VARCHAR(20) NULL` constrained to preferred/expanded/unknown, and `match_facts JSON NULL`.

Create:

```sql
listing_query_role_families (
  listing_id CHAR(36) NOT NULL,
  query_id CHAR(36) NOT NULL,
  role_family VARCHAR(50) NOT NULL,
  PRIMARY KEY (listing_id, query_id, role_family),
  FOREIGN KEY (listing_id, query_id)
    REFERENCES listing_queries(listing_id, query_id) ON DELETE CASCADE
)
```

Use the same role-family constraint as `saved_query_role_families`.

- [ ] **Step 3: Add diagnostic persistence**

Extend `scrape_run_queries` with `INT NOT NULL DEFAULT 0` counters for provider results, pages requested, records received, duplicates, previously saved, previously dismissed, rejected age, rejected distance, rejected terms, rejected salary, `rejected_remote_only`, malformed records, and unsearched requests. Add `truncated TINYINT(1) NOT NULL DEFAULT 0`.

Create `scrape_run_searches` with:

```text
id, run_id, query_id, role_family, status,
provider_result_count, pages_requested, records_received,
accepted_matches, truncated, error_message, started_at, finished_at
```

Use `CHAR(36)` IDs, `VARCHAR(50)` role family, `VARCHAR(20)` status, `INT NOT NULL DEFAULT 0` counters, `TINYINT(1) NOT NULL DEFAULT 0` truncation, `VARCHAR(500)` sanitized error, and `DATETIME(3)` timestamps. Constrain role family and status, index `(run_id, query_id)`, cascade on run deletion, and use `ON DELETE SET NULL` for its nullable query foreign key so historical run diagnostics survive saved-search deletion.

Add indexes `listings(status, published_at)`, `listings(status, salary_max, salary_min)`, `listing_queries(query_id, distance_band, score)`, `listing_query_role_families(role_family, query_id)`, and `scrape_run_searches(run_id, query_id)`.

- [ ] **Step 4: Seed the approved Auburn search without destroying user data**

Insert fixed ID `10000000-0000-4000-8000-000000000004` as one search named `Auburn IT infrastructure` with:

```text
center_display_name = Auburn, Cayuga County, New York, United States
center_latitude = 42.931700
center_longitude = -76.566100
geocoder_provider = seeded
preferred_radius_miles = 20
maximum_radius_miles = 40
max_age_days = 14
enabled = true
all seven role families selected
```

Keep every existing saved-search row. Disable the three original Madison/remote seed UUIDs only when their `updated_at` still equals `created_at`, which identifies untouched seed records. Do not disable user-edited rows.

- [ ] **Step 5: Extend row mappers**

Make `mapQuery(row, roleFamilies = [])` return:

```js
{
  id, name,
  center: { displayName, latitude, longitude, provider, placeId },
  preferredRadiusMiles,
  maximumRadiusMiles,
  roleFamilies,
  requiredTerms,
  optionalTerms,
  excludedTerms,
  maxAgeDays,
  minimumSalary,
  enabled,
  createdAt,
  updatedAt,
}
```

Also return read-only compatibility aliases `keywords: optionalTerms.join(' ')` and `location: center.displayName` so the existing Pipeline query chips continue rendering before Task 7 and older clients do not crash. Parse JSON columns defensively from either strings or driver-decoded arrays and return empty arrays for null legacy values.

- [ ] **Step 6: Add integration assertions after implementation**

Extend the MariaDB suite to assert:

- Migration 003 applies twice without drift.
- The Auburn search and seven role-family rows exist.
- A synthetic legacy query retains its data and receives optional terms.
- An untouched original seed is disabled while an edited one remains unchanged.
- Radius, family, distance-band, and status constraints reject invalid values.
- Existing jobs, listings, listing decisions, and stage events remain intact.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
npm test
npm run test:integration
git diff --check
```

Expected: unit tests pass; integration tests pass with configured test credentials or clearly report skipped until the final credentialed gate.

Commit:

```powershell
git add server/db/migrations/003_discovery_reliability.sql server/db/rows.js tests/integration/mariadb.test.js
git commit -m "feat: add structured discovery schema"
```

---

### Task 3: Persist Structured Queries and Resolve Search Locations

**Files:**
- Create: `server/discovery/roleFamilies.js`
- Create: `server/geocoding/nominatim.js`
- Modify: `server/config.js`
- Modify: `.env.example`
- Modify: `deploy/waypoint.env.example`
- Modify: `server/db/queryRepository.js`
- Modify: `server/routes/queries.js`
- Modify: `server/services.js`
- Modify: `tests/config.test.js`
- Modify: `tests/api.test.js`
- Modify: `tests/integration/mariadb.test.js`

**Interfaces:**
- Consumes: Task 2 schema and `mapQuery(row, roleFamilies)`.
- Produces: `ROLE_FAMILIES`, `normalizeTerms`, `createNominatimClient`, structured query CRUD, and `POST /api/queries/resolve-location`.

- [ ] **Step 1: Define the stable role-family catalog**

Export:

```js
export const ROLE_FAMILIES = Object.freeze({
  'systems-administration': { label: 'Systems administration', synonyms: ['systems administrator', 'system administrator', 'sysadmin'] },
  'it-support': { label: 'IT support', synonyms: ['IT support', 'help desk', 'service desk', 'technical support'] },
  'network-administration': { label: 'Network administration', synonyms: ['network administrator', 'network engineer', 'network support'] },
  'cloud-support': { label: 'Cloud support', synonyms: ['cloud support', 'cloud operations'] },
  'it-operations': { label: 'IT operations', synonyms: ['IT operations', 'infrastructure operations'] },
  'desktop-support': { label: 'Desktop support', synonyms: ['desktop support', 'deskside support', 'endpoint support'] },
  'junior-systems-engineering': { label: 'Junior systems engineering', synonyms: ['junior systems engineer', 'systems engineer I', 'associate systems engineer'] },
});
export const ROLE_FAMILY_IDS = Object.freeze(Object.keys(ROLE_FAMILIES));

export function normalizeTerms(values = []) {
  const seen = new Set();
  return values.flatMap(value => {
    const term = String(value).trim().replace(/\s+/g, ' ');
    const key = term.toLocaleLowerCase('en-US');
    if (!term || seen.has(key)) return [];
    seen.add(key);
    return [term];
  });
}
```

- [ ] **Step 2: Add geocoder configuration**

Add:

```text
GEOCODER_BASE_URL=https://nominatim.openstreetmap.org
GEOCODER_USER_AGENT=Waypoint/0.1 (contact: replace-with-email@example.com)
DISCOVERY_RUN_REQUEST_BUDGET=20
DISCOVERY_QUERY_REQUEST_BUDGET=12
DISCOVERY_PREVIEW_REQUEST_BUDGET=8
DISCOVERY_MAX_PAGES_PER_FAMILY=3
DISCOVERY_PERSISTED_MATCH_TARGET=50
```

Treat the example geocoder identity as a placeholder that the deployer must replace. Parse each positive integer through the existing `integer` helper. Expose `config.geocoder` and `config.discovery` without including the user-agent value in `publicConfig`; expose only `locationResolutionConfigured: Boolean(config.geocoder.userAgent)`. Compose the geocoder only when configured and return `503 GEOCODER_NOT_CONFIGURED` from the resolution route otherwise.

- [ ] **Step 3: Implement the Nominatim adapter**

Export:

```js
export function createNominatimClient({
  baseUrl,
  userAgent,
  fetchImpl = fetch,
  timeoutMs = 8_000,
  now = () => Date.now(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  let nextAllowedAt = 0;
  let queue = Promise.resolve();
  const resolveOne = async query => {
    const delayMs = Math.max(0, nextAllowedAt - now());
    if (delayMs) await sleep(delayMs);
    nextAllowedAt = now() + 1_000;
    const url = new URL('/search', baseUrl);
    url.search = new URLSearchParams({ format: 'jsonv2', limit: '5', countrycodes: 'us', q: query });
    const response = await fetchWithTimeout(fetchImpl, url, {
      headers: { Accept: 'application/json', 'User-Agent': userAgent },
    }, timeoutMs);
    if (!response.ok) throw new Error(`Nominatim request failed with HTTP ${response.status}`);
    return (await response.json()).slice(0, 5).map(item => ({
      displayName: String(item.display_name),
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      provider: 'nominatim',
      placeId: String(item.osm_id ?? item.place_id),
    }));
  };
  return {
    resolve(query) {
      const operation = queue.then(() => resolveOne(query));
      queue = operation.catch(() => {});
      return operation;
    },
  };
}
```

Implement an adapter-local `fetchWithTimeout` using the owned `AbortController`/cleared-timer pattern from Task 1. Reject blank input, send `Accept: application/json` and the configured `User-Agent`, validate finite coordinates, cap results at five, serialize calls to at most one request per second, and sanitize failures. The route invokes this only on explicit user action; saved coordinates prevent daily geocoder requests.

- [ ] **Step 4: Replace legacy query writes with transactional structured writes**

Add helpers in `queryRepository.js` to load role families for all rows in one query and replace one query's role-family rows inside the same transaction as its base-row write.

Structured create/update input is:

```js
{
  name,
  center: { displayName, latitude, longitude, provider, placeId },
  preferredRadiusMiles,
  maximumRadiusMiles,
  roleFamilies,
  requiredTerms,
  optionalTerms,
  excludedTerms,
  maxAgeDays,
  minimumSalary,
  enabled,
}
```

Normalize term arrays by trimming, collapsing whitespace, removing case-insensitive duplicates, and dropping blanks. Require at least one role family. Reject preferred radius greater than maximum radius before SQL. Continue taking the scrape lock for update/delete. Structured writes leave the legacy `keywords` column unchanged and mirror the confirmed display name into legacy `location` only because that column is currently non-null.

Keep legacy request compatibility for `{ name, keywords, location, maxAgeDays, enabled }`. Translate `keywords` to one optional term, `location` to an unresolved center display name, retain existing roles on update, and assign all seven roles on legacy create. Update legacy `keywords` only for this compatibility path. An unresolved legacy search can be saved and edited but returns `QUERY_LOCATION_UNRESOLVED` if run before the user confirms a location.

When criteria change, delete only `listing_queries` rows for that query whose joined listing status is `new`. Preserve saved, dismissed, and expired historical associations.

- [ ] **Step 5: Extend query routes**

Add `GET /api/queries`, keep POST/PATCH compatible with both legacy and structured request schemas, keep DELETE, and add:

```js
app.post('/api/queries/resolve-location', async request => ({
  candidates: await geocoder.resolve(request.body.query),
}));
```

Fastify schemas must enforce array uniqueness, role-family enums, coordinate ranges, positive radii, allowed age values, and non-negative salary. Perform the cross-field radius check in the handler and throw `new AppError(400, 'INVALID_RADIUS_RANGE', 'Preferred radius cannot exceed maximum radius')`.

- [ ] **Step 6: Add tests after implementation**

Cover:

- Config defaults and invalid budgets.
- Nominatim URL, headers, one-request-per-second serialization, five-result cap, malformed coordinate rejection, timeout, and sanitized error.
- Query route rejection of missing roles, invalid coordinates, and inverted radii; term normalization removes blank and case-insensitive duplicate entries.
- Repository round-trip of arrays, center, radii, roles, salary, and enabled state.
- Query edits preserve saved/dismissed attribution but clear new pending attribution.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
node --test tests/config.test.js tests/api.test.js
npm test
npm run test:integration
git diff --check
```

Commit:

```powershell
git add server/discovery/roleFamilies.js server/geocoding/nominatim.js server/config.js .env.example deploy/waypoint.env.example server/db/queryRepository.js server/routes/queries.js server/services.js tests/config.test.js tests/api.test.js tests/integration/mariadb.test.js
git commit -m "feat: manage structured local searches"
```

---

### Task 4: Translate Provider Requests and Evaluate Listings Deterministically

**Files:**
- Create: `server/discovery/criteria.js`
- Create: `server/discovery/distance.js`
- Create: `server/discovery/evaluateListing.js`
- Modify: `server/scraper/adzuna.js`
- Modify: `server/scraper/scoring.js`
- Create: `tests/discovery-criteria.test.js`
- Modify: `tests/adzuna.test.js`
- Modify: `tests/scoring.test.js`

**Interfaces:**
- Consumes: structured query objects and `ROLE_FAMILIES` from Task 3.
- Produces: request plans, normalized provider pages, distance bands, eligibility decisions, scores, and match facts.

- [ ] **Step 1: Implement criteria and provider-request planning**

Export:

```js
export function buildRoleFamilyPlan(query) {
  return query.roleFamilies.map(roleFamily => ({
    roleFamily,
    synonyms: ROLE_FAMILIES[roleFamily].synonyms,
  }));
}

export function adzunaParameters(query, roleFamily, page) {
  return {
    page,
    resultsPerPage: 50,
    whatOr: ROLE_FAMILIES[roleFamily].synonyms.join(' '),
    whatExclude: query.excludedTerms.join(' '),
    where: query.center.displayName,
    distanceKm: Math.ceil(query.maximumRadiusMiles * 1.609344),
    maxDaysOld: query.maxAgeDays,
    sortBy: 'date',
    sortDirection: 'down',
    salaryMin: query.minimumSalary,
    includeUnknownSalary: Boolean(query.minimumSalary),
  };
}
```

Do not send empty optional parameters.

- [ ] **Step 2: Upgrade the Adzuna adapter**

Change its interface to:

```js
async search({ query, roleFamily, page = 1 }) => ({
  providerCount,
  page,
  pageSize: 50,
  results,
})
```

Use `/search/{page}` and encode `what_or`, `what_exclude`, `where`, `distance`, `max_days_old`, `sort_by`, `sort_dir`, `salary_min`, and `salary_include_unknown` as supplied. Preserve title, company, location, salary, description, redirect URL, publication date, latitude, longitude, category tag, contract time, and contract type.

- [ ] **Step 3: Implement distance helpers**

Export:

```js
export function milesToKilometres(miles) {
  return miles * 1.609344;
}
export function haversineMiles(origin, destination) {
  const earthRadiusMiles = 3958.7613;
  const toRadians = degrees => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(origin.latitude)) * Math.cos(toRadians(destination.latitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function classifyDistance(distanceMiles, preferredRadiusMiles, maximumRadiusMiles) {
  if (distanceMiles == null) return 'unknown';
  if (distanceMiles <= preferredRadiusMiles) return 'preferred';
  if (distanceMiles <= maximumRadiusMiles) return 'expanded';
  return 'rejected';
}
```

Round stored distance to two decimals only after calculation.

- [ ] **Step 4: Implement explicit listing evaluation**

Export:

```js
export function evaluateListing({ query, listing, roleFamily, now }) {
  return {
    accepted,
    rejectReason: null | 'age' | 'distance' | 'terms' | 'salary' | 'remote-only' | 'malformed',
    distanceMiles,
    distanceBand,
    matchedRoleFamilies,
    matchFacts: { matchedSynonyms, requiredTerms, optionalTerms, excludedTerms },
    score,
  };
}
```

Require a synonym match in the title for the planned role family. Required terms may match title or description; excluded terms reject from either; optional terms improve scoring but never gate. A known salary maximum below `minimumSalary` rejects; unknown salary remains eligible. Reject a listing as `remote-only` only when its title, normalized location, or description explicitly says fully remote, remote anywhere, nationwide remote, or work from anywhere. Do not reject hybrid or ambiguous flexible-work language.

Use this 100-point score:

```text
50 title-family relevance
15 description relevance
15 distance: preferred 15, expanded 7, unknown 3
10 recency
10 optional-term coverage
```

Clamp to 0–100 and round to two decimals. Keep the existing token normalization behavior for accents, stop words, plurals, and administrator/admin prefix equivalence.

- [ ] **Step 5: Add tests after implementation**

Cover exact Adzuna query parameters for Auburn/40 miles, page-path encoding, omitted empty values, provider count, coordinates, and contract metadata. Cover 20.00/20.01/40.00/40.01-mile boundaries, unknown coordinates, age boundary, title-family gate, required/excluded/optional terms, known and unknown salary, explicit remote-only rejection, hybrid acceptance, ambiguous-work acceptance, and every score component.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
node --test tests/adzuna.test.js tests/scoring.test.js tests/discovery-criteria.test.js
npm test
git diff --check
```

Commit:

```powershell
git add server/discovery/criteria.js server/discovery/distance.js server/discovery/evaluateListing.js server/scraper/adzuna.js server/scraper/scoring.js tests/discovery-criteria.test.js tests/adzuna.test.js tests/scoring.test.js
git commit -m "feat: evaluate local discovery results"
```

---

### Task 5: Orchestrate Preview and Persisted Discovery with Full Diagnostics

**Files:**
- Create: `server/discovery/service.js`
- Create: `server/db/discoveryRepository.js`
- Modify: `server/db/listingRepository.js`
- Modify: `server/db/runRepository.js`
- Modify: `server/services.js`
- Modify: `server/cli/scrape.js`
- Remove: `server/scraper/service.js`
- Create: `tests/discovery-service.test.js`
- Remove: `tests/scrape-service.test.js`
- Modify: `tests/integration/mariadb.test.js`

**Interfaces:**
- Consumes: Tasks 2–4 schema, repositories, request plans, Adzuna page responses, and listing evaluations.
- Produces: `discovery.preview(criteria)`, `discovery.runQuery(queryId, trigger)`, and `discovery.runAll(trigger)`.

- [ ] **Step 1: Implement diagnostic accumulator and request budgeting**

Represent one query's counters as:

```js
{
  providerResultCount: 0,
  pagesRequested: 0,
  recordsReceived: 0,
  newMatches: 0,
  duplicates: 0,
  previouslySaved: 0,
  previouslyDismissed: 0,
  rejectedAge: 0,
  rejectedDistance: 0,
  rejectedTerms: 0,
  rejectedSalary: 0,
  rejectedRemoteOnly: 0,
  malformedRecords: 0,
  unsearchedRequests: 0,
  truncated: false,
}
```

Implement one shared page loop. Preview stops when it has ten unique accepted samples. A persisted query stops when it has `DISCOVERY_PERSISTED_MATCH_TARGET` unique accepted matches. Either mode also stops when the page is short, the family reaches `DISCOVERY_MAX_PAGES_PER_FAMILY`, or the operation exhausts its request budget. Record unsearched family/page work and set `truncated` instead of silently stopping.

- [ ] **Step 2: Implement preview with no listing persistence**

`preview(criteria)` acquires `GET_LOCK('waypoint:scrape', 0)`, uses the preview budget, returns at most ten best accepted results plus full in-memory diagnostics, and releases the lock in `finally`. It performs read-only provider-ID lookups against existing listings so duplicates, saved, and dismissed preview counters are accurate. It does not create scrape-run rows, listing rows, query associations, or decision changes.

- [ ] **Step 3: Implement persisted one-query and all-query runs**

Expose:

```js
createDiscoveryService(dependencies) => ({
  preview,
  runQuery: (queryId, trigger = 'manual') => run({ trigger, queryIds: [queryId] }),
  runAll: (trigger = 'scheduled') => run({ trigger, queryIds: null }),
})
```

Both persisted operations retain the advisory lock, stale-run recovery, manual cooldown, per-query failure isolation, and final `success`/`partial`/`failed` status. `runQuery` rejects disabled, missing, or unresolved-center queries with explicit `QUERY_DISABLED`, `QUERY_NOT_FOUND`, or `QUERY_LOCATION_UNRESOLVED` errors. `runAll` records an unresolved enabled query as failed and continues with later queries.

- [ ] **Step 4: Preserve listing decisions and historical attribution**

Make match persistence return one of:

```text
new, duplicate-new, previously-saved, previously-dismissed, expired-reopened
```

Update normalized listing fields and match evidence on rediscovery, but never change `saved` or `dismissed` status. An expired listing can reopen as `new`. Upsert every matched role family into `listing_query_role_families`.

- [ ] **Step 5: Persist aggregate and per-family diagnostics**

Extend `runRepository` with:

```js
addSearchResult(connection, result)
finishQuery(connection, result)
detail(runId)
```

Write one `scrape_run_searches` row after each role family and one aggregate `scrape_run_queries` row after its query. Fatal bookkeeping retains committed counters as the current service does.

- [ ] **Step 6: Rewire composition and the scheduled CLI**

Return `discovery` instead of `scraper` from `createServices`. Update the CLI to call `services.discovery.runAll('scheduled')`. Remove `server/scraper/service.js` only after no imports remain.

- [ ] **Step 7: Add tests after implementation**

Cover:

- Preview persists nothing and returns ten or fewer ranked results.
- Preview cannot overlap a scheduled run.
- One full page requests the next page; a short page stops.
- Each operation obeys its request budget and reports truncation.
- Cross-family duplicates persist once and retain multiple family evidence rows.
- Saved and dismissed listings retain status and increment the correct diagnostic.
- One family failure produces a partial query/run while later families continue.
- All family failures produce a failed query/run.
- Manual cooldown occurs before lock acquisition.
- Fatal bookkeeping retains committed counters.
- Scheduled CLI closes its pool on success and failure.

- [ ] **Step 8: Verify and commit**

Run:

```powershell
node --test tests/discovery-service.test.js tests/database-lifecycle.test.js
npm test
npm run test:integration
git diff --check
```

Commit:

```powershell
git add server/discovery/service.js server/db/discoveryRepository.js server/db/listingRepository.js server/db/runRepository.js server/services.js server/cli/scrape.js server/scraper/service.js tests/discovery-service.test.js tests/scrape-service.test.js tests/integration/mariadb.test.js
git commit -m "feat: orchestrate explainable discovery runs"
```

---

### Task 6: Expose Preview, Per-Query Runs, Filtered Results, and Diagnostics

**Files:**
- Modify: `server/routes/queries.js`
- Modify: `server/routes/listings.js`
- Modify: `server/routes/runs.js`
- Modify: `server/app.js`
- Modify: `server/db/discoveryRepository.js`
- Modify: `src/lib/apiClient.js`
- Create: `src/lib/discoveryFilters.js`
- Modify: `tests/api.test.js`
- Modify: `tests/api-client.test.js`
- Create: `tests/discovery-filters.test.js`
- Modify: `tests/integration/mariadb.test.js`

**Interfaces:**
- Consumes: Task 5 discovery service and persistence.
- Produces: complete HTTP and client contracts for query preview/run, discovery browsing, and run details.

- [ ] **Step 1: Add preview and per-query execution routes**

Register:

```text
POST /api/queries/preview
POST /api/queries/:id/runs
```

Preview accepts the same structured criteria as query creation. One-query execution accepts no body and returns `{ run }`. Both return `503 PROVIDER_NOT_CONFIGURED` when discovery is unavailable.

- [ ] **Step 2: Add filtered discovery reads**

Register `GET /api/listings` with:

```text
q, queryId, roleFamily, distanceBand, maxAgeDays,
minScore, maxScore, salaryStatus, minSalary, status,
sort, page, pageSize
```

Constrain `distanceBand` to preferred/expanded/unknown, `salaryStatus` to all/known/unknown with default all, `status` to new/saved/dismissed/expired, `sort` to best/nearest/newest/salary, scores to 0–100 with `minScore <= maxScore`, `page >= 1`, and `pageSize` to 10–100 with default 25.

Return:

```js
{
  items,
  page,
  pageSize,
  total,
  totalPages,
}
```

Use parameterized SQL for all values. Escape `\`, `%`, and `_` in the free-text value and use `LIKE ? ESCAPE '\\'` so user text cannot turn into uncontrolled wildcard patterns. Best sorts score descending then publication date; nearest sorts known distance ascending with unknown last; newest sorts publication date descending; salary sorts known maximum then minimum descending with unknown last. Select/group by listing ID before pagination so multi-query and multi-family joins do not duplicate result rows or inflate totals.

- [ ] **Step 3: Add run detail**

Register `GET /api/scrape-runs/:id` and return the run, per-query aggregate rows, and per-family search rows. Return `404 RUN_NOT_FOUND` for an unknown ID.

- [ ] **Step 4: Add client methods and deterministic filter serialization**

Expose:

```js
api.listQueries()
api.resolveQueryLocation(query)
api.previewQuery(criteria)
api.runQuery(id)
api.listListings(filters)
api.runDetail(id)
```

In `discoveryFilters.js`, export `DEFAULT_DISCOVERY_FILTERS` and `toDiscoverySearchParams(filters)`. Omit blank/default values, serialize booleans as `true`/`false`, and produce stable key ordering for cacheability and tests.

- [ ] **Step 5: Add tests after implementation**

Cover supported and invalid route values, provider-disabled behavior, preview non-persistence, result totals across role/query joins, every sort order, unknown distance/salary placement, pagination boundaries, unknown run ID, and exact API-client URLs/bodies.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
node --test tests/api.test.js tests/api-client.test.js tests/discovery-filters.test.js
npm test
npm run test:integration
git diff --check
```

Commit:

```powershell
git add server/routes/queries.js server/routes/listings.js server/routes/runs.js server/app.js server/db/discoveryRepository.js src/lib/apiClient.js src/lib/discoveryFilters.js tests/api.test.js tests/api-client.test.js tests/discovery-filters.test.js tests/integration/mariadb.test.js
git commit -m "feat: expose discovery controls and results"
```

---

### Task 7: Activate the Capture & Queries Workspace

**Files:**
- Create: `src/components/CaptureQueriesView.jsx`
- Create: `src/components/SearchBuilder.jsx`
- Create: `src/components/SavedSearchList.jsx`
- Create: `src/components/SearchRunDetails.jsx`
- Create: `src/components/DiscoveryFilters.jsx`
- Create: `src/components/DiscoveryTable.jsx`
- Modify: `src/hooks/useJobsStore.js`
- Modify: `src/App.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/components/CaptureBar.jsx`
- Modify: `src/components/ReviewQueue.jsx`
- Modify: `src/components/MatchCard.jsx`
- Modify: `src/theme.js`
- Modify: `tests/api-client.test.js`

**Interfaces:**
- Consumes: Task 6 HTTP/client contracts.
- Produces: working Capture & queries navigation, search builder, preview, management, diagnostics, and filtered results.

- [ ] **Step 1: Extend centralized store state**

Add:

```js
captureQueries: {
  selectedQueryId,
  editorMode,
  locationCandidates,
  preview,
  previewLoading,
  results,
  resultFilters,
  resultsLoading,
  selectedRun,
  runDetail,
}
```

Reuse the store's existing single `queries` array; do not create a second query-data copy inside `captureQueries`. Implement store actions for location resolution, preview, create, update, duplicate, delete, enable/disable, run one, run all, open run detail, change filters/page/sort, refresh results, save listing, and dismiss listing. Route every failure through the existing `fail(error)` re-sync behavior.

Keep successful preview data when a later preview fails and show the new error separately. Refresh both full results and the compact queue after save/dismiss/run.

- [ ] **Step 2: Activate navigation and page composition**

Change `Capture & queries` from disabled to `{ view: 'CaptureQueries' }`. `App.jsx` renders `CaptureQueriesView` in the main area without the Pipeline review rail. Focus the page heading on navigation, matching Insights behavior.

- [ ] **Step 3: Build the structured search editor**

`SearchBuilder` must provide:

- Name
- Search-center text and `Resolve location`
- Candidate selection with OpenStreetMap attribution
- Preferred and maximum radius numeric inputs
- Seven role-family checkboxes
- Required, optional, and excluded term chip inputs
- Maximum-age select
- Optional minimum salary
- Enabled checkbox
- Preview, Save, and Save and run actions

Preserve all entered values after validation or preview failure. Disable save/run until a location candidate is confirmed and at least one role family is selected.

- [ ] **Step 4: Build saved-search management and diagnostics**

`SavedSearchList` renders criteria summary, enabled status, last-run state, accepted count, and primary rejection reason. Provide Edit, Preview, Run now, Duplicate, Enable/Disable, and Delete buttons.

`SearchRunDetails` renders every aggregate counter plus per-family status, provider count, page count, record count, accepted count, truncation, and sanitized error. Never render credentials or raw provider URLs.

- [ ] **Step 5: Build filtered discovery results**

`DiscoveryFilters` exposes every approved filter and sort plus Clear all. `DiscoveryTable` renders role, company, role-family labels, distance band/value, age, salary, matched terms, source searches, score, status, and View/Save/Dismiss actions with pagination.

Use semantic table markup. Unknown distance and salary use `Unknown`, not zero. Distance tokens are text plus color:

```text
Preferred, Expanded radius, Unknown distance
```

- [ ] **Step 6: Upgrade compact Pipeline discovery cards**

Show distance band, best matched role family, and two highest-value match facts in `MatchCard`. `ReviewQueue` links to the full results view and displays the latest run's primary diagnostic when it produced zero new matches.

`CaptureBar` retains URL input and replaces inline saved-query editing with a compact count plus `Manage searches` action that opens Capture & queries.

- [ ] **Step 7: Verify after implementation**

Run:

```powershell
npm test
npm run build
git diff --check
```

Then run a browser check with injected/fake API data for loading, empty, provider-disabled, validation-error, successful preview, partial-run, zero-result diagnostics, multiple result pages, save/dismiss, and keyboard focus. Do not claim live-provider success in this task.

- [ ] **Step 8: Commit**

```powershell
git add src/components/CaptureQueriesView.jsx src/components/SearchBuilder.jsx src/components/SavedSearchList.jsx src/components/SearchRunDetails.jsx src/components/DiscoveryFilters.jsx src/components/DiscoveryTable.jsx src/hooks/useJobsStore.js src/App.jsx src/components/Sidebar.jsx src/components/CaptureBar.jsx src/components/ReviewQueue.jsx src/components/MatchCard.jsx src/theme.js tests/api-client.test.js
git commit -m "feat: activate Capture and queries workspace"
```

---

### Task 8: Add Real Pipeline Summaries and Composable Filters

**Files:**
- Create: `server/pipeline/buildPipelineSummary.js`
- Create: `server/db/pipelineRepository.js`
- Create: `server/pipeline/service.js`
- Create: `src/lib/pipelineFilters.js`
- Create: `src/components/PipelineFilters.jsx`
- Create: `tests/pipeline-summary.test.js`
- Create: `tests/pipeline-filters.test.js`
- Modify: `server/services.js`
- Modify: `server/app.js`
- Modify: `src/hooks/useJobsStore.js`
- Modify: `src/App.jsx`
- Modify: `src/components/Header.jsx`
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/components/PipelineTable.jsx`
- Modify: `tests/api.test.js`
- Modify: `tests/integration/mariadb.test.js`

**Interfaces:**
- Consumes: jobs and stage events already present in MariaDB.
- Produces: bootstrap `pipelineSummary` and pure client-side `filterJobs(allJobs, filters, now)`.

- [ ] **Step 1: Define real summary metrics**

`buildPipelineSummary(snapshot, now)` returns:

```js
{
  appliedThisWeek,
  activeInterviews,
  responseRate,
  overdueFollowUps,
  oldestOverdue: null | { jobId, role, company, nextActionAt },
}
```

Rules:

- `appliedThisWeek`: distinct jobs with a non-baseline transition into Applied since Monday 00:00 UTC.
- `activeInterviews`: current non-deleted jobs in Interviewing.
- `responseRate`: percentage of all reliably tracked application-cohort jobs that later reached Interviewing or Offer; null with no applications.
- `overdueFollowUps`: active non-Closed jobs with `nextActionAt < now`.
- `oldestOverdue`: earliest overdue action.

- [ ] **Step 2: Add repository/service and bootstrap data**

Read active jobs plus ordered stage events through `pipelineRepository.snapshot()`. Compose `pipelineSummary.get()` in `services.js` and include its result in `/api/bootstrap`.

- [ ] **Step 3: Implement Pipeline filter composition**

Export:

```js
export const DEFAULT_PIPELINE_FILTERS = {
  text: '',
  location: '',
  urgentOnly: false,
  followUp: 'all',
  contact: 'all',
  dateField: 'updatedAt',
  activityFrom: '',
  activityTo: '',
};

export function filterJobs(jobs, stageFilter, filters, now = new Date()) {
  return jobs.filter(job => job.isDraft || (
    (stageFilter === 'All' || job.stage === stageFilter) &&
    matchesText(job, filters.text) &&
    matchesLocation(job, filters.location) &&
    (!filters.urgentOnly || job.urgent) &&
    matchesFollowUp(job, filters.followUp, now) &&
    matchesContact(job, filters.contact) &&
    isWithinLocalDateRange(job[filters.dateField], filters.activityFrom, filters.activityTo)
  ));
}
export function countActivePipelineFilters(filters) {
  return Object.entries(filters).filter(([key, value]) =>
    key !== 'dateField' && value !== DEFAULT_PIPELINE_FILTERS[key]
  ).length;
}
```

Define the referenced helpers in the same file. `matchesText` searches role and company case-insensitively; `matchesLocation` searches location. `matchesFollowUp` supports all/due/scheduled/none. `matchesContact` supports all/has/missing and treats blank or `—` as missing. `dateField` lets the user choose `createdAt` (saved date) or `updatedAt` (last activity); `isWithinLocalDateRange` compares that timestamp inclusively in the user's local date. Drafts remain visible through every filter so an unfinished capture cannot disappear.

- [ ] **Step 4: Render filters and live summary copy**

Place `PipelineFilters` between CaptureBar and PipelineTable. Add Clear all and an active-filter count. Feed the filtered list into the existing table, but call `reorderVisibleJobs` against the unfiltered global array exactly as the store currently does.

`Header` renders real values and uses `—` for null response rate. Its subline uses neutral data-driven copy. `Sidebar` shows the real overdue count and oldest company, or `No follow-ups overdue` when empty.

- [ ] **Step 5: Add tests after implementation**

Cover Monday UTC boundary, baseline exclusion, later interview conversion, null rate, deleted/Closed exclusion, oldest overdue, every filter independently, combined filters, inclusive dates, missing-contact normalization, clear-all count, and visible-only reorder under combined filters.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
node --test tests/pipeline-summary.test.js tests/pipeline-filters.test.js tests/jobListOperations.test.js tests/api.test.js
npm test
npm run test:integration
npm run build
git diff --check
```

Commit:

```powershell
git add server/pipeline/buildPipelineSummary.js server/db/pipelineRepository.js server/pipeline/service.js src/lib/pipelineFilters.js src/components/PipelineFilters.jsx tests/pipeline-summary.test.js tests/pipeline-filters.test.js server/services.js server/app.js src/hooks/useJobsStore.js src/App.jsx src/components/Header.jsx src/components/Sidebar.jsx src/components/PipelineTable.jsx tests/api.test.js tests/integration/mariadb.test.js
git commit -m "feat: add real Pipeline summaries and filters"
```

---

### Task 9: Replace the URL Capture Stub with a Safe Editable Extraction Flow

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `server/capture/urlPolicy.js`
- Create: `server/capture/extractJobMetadata.js`
- Create: `server/capture/service.js`
- Create: `server/routes/capture.js`
- Modify: `server/services.js`
- Modify: `server/app.js`
- Modify: `src/lib/apiClient.js`
- Modify: `src/hooks/useJobsStore.js`
- Modify: `src/components/CaptureBar.jsx`
- Remove: `src/lib/parseJobUrl.js`
- Create: `tests/capture.test.js`
- Modify: `tests/api.test.js`
- Modify: `tests/api-client.test.js`

**Interfaces:**
- Consumes: public job-posting URL.
- Produces: `capture.extract(url) => { draft, warnings, extractedFields }` and `POST /api/capture`.

- [ ] **Step 1: Add the one parsing dependency**

Run `npm install cheerio@1.2.0 --save-exact` and commit the lockfile. Its declared Node floor is `>=20.18.1`, which is compatible with this repository's Node 24 floor. Use it only for parsing already bounded HTML; do not use its network helpers.

- [ ] **Step 2: Implement SSRF-safe URL and address policy**

Export:

```js
export function validatePublicUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new AppError(400, 'INVALID_CAPTURE_URL', 'Enter a public HTTP or HTTPS job URL');
  }
  return url;
}
export function isPublicAddress(address) {
  return !isBlockedAddress(address);
}
export async function resolvePublicTarget(hostname, lookup = dns.lookup) {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  const selected = addresses.find(result => isPublicAddress(result.address));
  if (!selected) throw new AppError(400, 'INVALID_CAPTURE_URL', 'The URL does not resolve to a public address');
  return selected;
}
export async function fetchPublicHtml(url, {
  lookup = dns.lookup,
  maxRedirects = 3,
  timeoutMs = 10_000,
  maxBytes = 2 * 1024 * 1024,
} = {}) {
  return fetchPinnedHtml(validatePublicUrl(url), { lookup, maxRedirects, timeoutMs, maxBytes });
}
```

Implement `isBlockedAddress` with `node:net` parsing and explicit CIDR checks. Block IPv4 `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, and `240.0.0.0/4`. Block IPv6 `::/128`, `::1/128`, `::/96`, `64:ff9b::/96`, `100::/64`, `2001:db8::/32`, `fc00::/7`, `fe80::/10`, and `ff00::/8`; unwrap IPv4-mapped addresses under `::ffff:0:0/96` and apply the IPv4 rules. Allow only `http:` and `https:` and reject embedded credentials and localhost names.

Use `node:http`/`node:https` with a custom `lookup` that returns only the validated address, preventing DNS rebinding between validation and connection. Re-resolve and revalidate every redirect. Limit to three redirects, 10 seconds total, 2 MiB, and `text/html` or `application/xhtml+xml`.

- [ ] **Step 3: Implement best-effort metadata extraction**

Parse JobPosting JSON-LD first, then Open Graph/meta fields, then document title. Return:

```js
{
  draft: { role, company, location, salary, contact: '', url },
  extractedFields: ['role', 'company', 'location', 'salary'],
  warnings: ['Salary was not found. Review the draft before saving.'],
}
```

Support JSON-LD arrays and `@graph`. Format `baseSalary` when currency/value/minValue/maxValue are present. Strip markup, decode entities through Cheerio, collapse whitespace, and cap every field to the existing job API limits.

- [ ] **Step 4: Add service and route**

`createCaptureService({ fetchHtml = fetchPublicHtml })` catches extraction/network failures and returns an empty editable draft with the original URL and a safe warning. Invalid or blocked URLs remain hard `400 INVALID_CAPTURE_URL` errors and do not trigger a fetch.

Register:

```text
POST /api/capture
body: { url }
response: { draft, warnings, extractedFields }
```

- [ ] **Step 5: Wire the client draft flow**

Add `api.captureUrl(url)`. Replace `parseJobUrl` in the store with the API call, create the draft through the existing job endpoint, and show a success toast when fields were extracted or a warning toast when manual completion is needed. Clear the CaptureBar input only after the capture request returns.

- [ ] **Step 6: Add tests after implementation**

Cover HTTP/HTTPS acceptance, scheme and credential rejection, every private-address family, DNS rebinding prevention through the pinned lookup, redirect revalidation, redirect/size/type/time limits, JSON-LD array and graph extraction, metadata fallback, malformed JSON-LD, missing fields, sanitized fallback, route schema, and API-client request.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
node --test tests/capture.test.js tests/api.test.js tests/api-client.test.js
npm test
npm run build
git diff --check
```

Commit:

```powershell
git add package.json package-lock.json server/capture/urlPolicy.js server/capture/extractJobMetadata.js server/capture/service.js server/routes/capture.js server/services.js server/app.js src/lib/apiClient.js src/hooks/useJobsStore.js src/components/CaptureBar.jsx src/lib/parseJobUrl.js tests/capture.test.js tests/api.test.js tests/api-client.test.js
git commit -m "feat: capture job details from public URLs"
```

---

### Task 10: Perform Full Verification and Synchronize Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/project-summary.md`
- Modify: `docs/project-summary.html`
- Modify: `docs/deployment-raspberry-pi.md`

**Interfaces:**
- Consumes: all completed tasks and the approved design acceptance criteria.
- Produces: evidence-backed release status and accurate operating documentation.

- [ ] **Step 1: Run the complete automated suite**

Run from a clean working directory state:

```powershell
npm test
npm run test:integration
npm run build
git diff --check
```

Required outcome: unit/API tests pass, MariaDB integration tests pass rather than skip, build succeeds, and whitespace check is clean. If integration credentials are unavailable, report the release as not fully verified and stop before the final completion claim.

- [ ] **Step 2: Run browser verification at the supported viewport**

Start the API and Vite app with hidden background processes and verify at 1280 pixels or wider:

1. Pipeline opens with real, non-sample summary values.
2. Pipeline filters combine, clear, and preserve visible-only reorder behavior.
3. Capture & queries navigation works and receives focus.
4. Auburn defaults show 20 preferred and 40 maximum miles.
5. All seven role families are selected in the seeded search.
6. Location resolution candidates require explicit confirmation.
7. Preview returns real or fixture-backed diagnostics without changing stored results.
8. One-query and all-query runs expose complete/partial/zero-result explanations.
9. Discovery filters, sorts, totals, and pagination agree with displayed rows.
10. Saving and dismissing update both the full page and compact queue.
11. URL capture extracts a supported fixture and falls back safely for an unsupported fixture.
12. Keyboard focus reaches navigation, editor, filters, results, pagination, diagnostics, and actions.
13. No content clips at the 1280-pixel minimum.

Use local fixtures for deterministic capture/browser checks. Remove temporary screenshots and fixtures after inspection unless the user asks to keep them.

- [ ] **Step 3: Run the credentialed Auburn Adzuna smoke check**

With the user's actual environment loaded, run one enabled Auburn query. Verify from sanitized output and database records:

- Request center is Auburn.
- Provider distance is 65 km for the 40-mile maximum.
- `max_days_old`, date sort, and descending direction are present.
- The request budget is respected.
- Preferred/expanded/unknown distance labels match stored distances.
- Zero results, if they occur, have diagnostic counters explaining the outcome.
- No credential appears in console output, logs, or stored errors.

Do not include raw provider responses in the repository.

- [ ] **Step 4: Update documentation to match verified behavior**

Update README features, commands, data model, and provider notes. Replace the project-summary known gaps for URL capture, Capture & queries, hard-coded header values, and test count. Document Nominatim identification/caching, the new environment variables, the 20/40-mile semantics, request budgets, the live-smoke procedure, and the fact that Contacts remains future work.

Regenerate or manually synchronize `docs/project-summary.html` from the updated Markdown without changing unrelated diagrams.

- [ ] **Step 5: Re-run final checks and commit documentation**

Run:

```powershell
npm test
npm run test:integration
npm run build
git diff --check
git status --short
```

Review the status output and stage only the intended documentation and any deliberately retained verification fixes.

Commit:

```powershell
git add README.md docs/project-summary.md docs/project-summary.html docs/deployment-raspberry-pi.md
git commit -m "docs: document reliable local discovery"
```

- [ ] **Step 6: Final acceptance audit**

Check every acceptance criterion in `docs/superpowers/specs/2026-08-12-discovery-reliability-design.md` against a test, browser observation, database assertion, or live-smoke record. Report any unmet item explicitly; do not describe partial or skipped verification as complete.

---

## Execution Checkpoints

The recommended review gates are:

1. After Task 1: clean baseline is restored.
2. After Task 3: schema, structured query CRUD, and location resolution are reviewable before provider behavior changes.
3. After Task 6: backend discovery is complete and testable before the large UI slice.
4. After Task 8: the application experience is feature-complete except URL capture.
5. After Task 10: all verification and documentation evidence is available.

Implementation remains sequential. Do not start the next checkpoint group without the user's approval when they request checkpoint-by-checkpoint control.
