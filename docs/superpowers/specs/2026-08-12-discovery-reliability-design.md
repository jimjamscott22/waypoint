# Waypoint Discovery Reliability Design

## Summary

Waypoint will add a working Capture & queries workspace and make local job discovery reliable, explainable, and useful for a search centered on Auburn, New York. Listings within 20 miles are preferred, listings from 20 through 40 miles remain eligible as expanded-radius matches, and listings confirmed beyond 40 miles are excluded. Searches cover systems administration, IT support, network administration, cloud support, IT operations, desktop support, and junior systems engineering roles.

This release first repairs unfinished or broken core behavior, then replaces the current single-string query model with structured search criteria and diagnostics. MariaDB remains authoritative, Adzuna remains the initial provider, and the existing React, Fastify, repository, and centralized-store boundaries remain in place.

## Goals

- Complete or repair the highest-value unfinished behavior from the original application specification.
- Make Auburn-area discovery return useful local results when the provider has them.
- Explain zero-result and partial-result searches with persisted, actionable diagnostics.
- Provide substantially better filtering for discovery results and tracked jobs.
- Activate Capture & queries as a dedicated top-level workspace.
- Replace empty URL capture with safe best-effort metadata extraction and an editable fallback.
- Preserve saved, dismissed, and tracked-job decisions when search criteria change.
- Keep provider logic replaceable so another listing source can be added later.

## Non-Goals

- Nationwide remote-job discovery.
- Implementing the Contacts workspace in this release.
- Authentication, accounts, or public internet exposure.
- AI-generated matching or opaque recommendations.
- A CSS framework, ORM, router, or second client-side state source.
- Editing existing applied database migrations.
- Replacing Adzuna or aggregating multiple providers in this release.

## Current-State Findings

The repository already has a functioning Pipeline, persisted Adzuna review queue, daily and manual scrape runs, and an Insights workspace. The following gaps and defects are in scope:

- `src/lib/parseJobUrl.js` returns an empty draft and performs no extraction.
- Capture & queries and Contacts are disabled navigation items.
- Pipeline header statistics and greeting detail are hard-coded sample values.
- The clean unit-test command currently reports one failed SPA-fallback test when `dist/` has not been built and one cancelled Adzuna timeout test.
- The production build succeeds.
- The MariaDB integration suite is skipped when test database credentials are absent.
- Saved searches expose only name, one keyword string, location, maximum age, and enabled state.
- The Adzuna request sends only `what` and `where`. It does not send the provider's distance, posting-age, or date-ordering parameters.
- Only the first page of 50 results is requested. Local post-filtering can discard that page without trying another page.
- Work-arrangement words such as `remote` and `hybrid` are mixed into keyword strings rather than represented deliberately.
- Scrape summaries do not distinguish provider zero-results, locally rejected listings, duplicates, previously reviewed listings, malformed records, or rate-limit truncation.
- The compact review rail does not provide enough space for result filtering or query diagnosis.

## Product Decisions

- Search center: Auburn, New York.
- Preferred radius: 20 miles, inclusive.
- Maximum radius: 40 miles, inclusive.
- Scope: local onsite and hybrid jobs only for this release; no nationwide remote search.
- Results with an unknown exact distance remain reviewable when the provider places them in the bounded Auburn-area search.
- Preferred results sort before expanded-radius results, followed by unknown-distance results.
- The approved role families are first-class criteria, not incidental keyword matches.
- Provider requests are intentionally broad enough to reduce false negatives; deterministic local evaluation explains and ranks accepted results.
- Search runs may succeed with zero matches, but the interface must explain why.
- Capture & queries becomes a working navigation destination. Contacts remains visibly unavailable and is proposed for the next release.

## Search Criteria

Each saved search contains:

- Name
- Search-center label
- Preferred radius in miles
- Maximum radius in miles
- One or more role families
- Required terms
- Optional terms
- Excluded terms
- Maximum posting age
- Optional minimum salary
- Enabled state

The initial migration preserves every existing saved search. Its current `keywords` value becomes optional terms, its current location becomes the search-center label, and existing enabled and age values are retained. New Auburn defaults apply only where a legacy search lacks a location or radius setting.

The server owns a small, explicit role-family catalog:

| Role family | Initial title synonyms |
|---|---|
| Systems administration | systems administrator, system administrator, sysadmin |
| IT support | IT support, help desk, service desk, technical support |
| Network administration | network administrator, network engineer, network support |
| Cloud support | cloud support, cloud operations |
| IT operations | IT operations, infrastructure operations |
| Desktop support | desktop support, deskside support, endpoint support |
| Junior systems engineering | junior systems engineer, systems engineer I, associate systems engineer |

The catalog is code-owned and versioned so synonym changes are reviewable. Saved searches store stable role-family identifiers rather than duplicating synonym text.

## Provider Execution

For each enabled saved search, the discovery service will:

1. Build focused Adzuna requests for the selected role families.
2. Send the search-center label using `where`.
3. Convert the 40-mile maximum to an integer kilometre distance for the provider request.
4. Send the saved maximum age through `max_days_old`.
5. Request date ordering with `sort_by=date` and descending direction.
6. Request additional pages while a page is full, accepted-result needs remain unmet, and the run's request budget permits it.
7. Normalize provider results without discarding usable coordinate or classification data.
8. Deduplicate listings across role-family requests and pages.
9. Apply required, optional, and excluded-term evaluation.
10. Classify role family, distance, distance band, age, and salary eligibility.
11. Score accepted matches deterministically.
12. Persist accepted matches and all diagnostic counters without reviving saved or dismissed listings.

The Adzuna client will return provider result metadata as well as normalized records. It will not own pagination, scoring, or database behavior. The discovery service owns request budgeting so provider limits are respected and any unsearched family or page is reported explicitly.

## Distance Classification

The preferred and maximum distances are evaluated in miles:

- `preferred`: distance is known and no greater than 20 miles.
- `expanded`: distance is known, greater than 20 miles, and no greater than 40 miles.
- `unknown`: the provider returned the listing for the bounded Auburn search but did not supply sufficient coordinates for an exact distance.
- `rejected`: distance is known and greater than 40 miles.

Waypoint will retain listing latitude and longitude when supplied. The search center will retain resolved coordinates so the provider-neutral discovery service can compute a Haversine distance.

Location resolution will use a focused OpenStreetMap Nominatim adapter. It will perform only user-initiated saved-search resolution, serialize requests to no more than one per second, send an application-identifying user agent, cache the selected result permanently with the saved search, and show OpenStreetMap attribution in the query editor. The endpoint remains configurable so a self-hosted or replacement geocoder can be used without changing search logic.

The query editor shows returned candidates and requires the user to select one when resolution is ambiguous. A failed or unconfirmed resolution prevents saving or running the search rather than silently searching a different place. The seeded Auburn search stores its confirmed display name and coordinates during migration, so normal daily runs do not call the geocoder.

Unknown-distance listings remain visible with a clear warning because silently discarding them would recreate the false-negative problem this release is intended to solve.

## Match Evaluation and Ranking

Evaluation produces explicit facts instead of one unexplained score:

- Matched role family
- Matched title synonyms
- Required terms satisfied or missing
- Optional terms matched
- Excluded terms found
- Posting age
- Distance and distance band
- Salary eligibility and whether salary is unknown

A listing is rejected when it is confirmed beyond the maximum radius, exceeds the maximum age, contains an excluded term, misses a required term, or has a known salary below the configured minimum. A missing salary does not cause rejection in this release.

Accepted listings receive a deterministic score based on title relevance, description relevance, distance band, and recency. Preferred-distance results receive a ranking advantage, but strong expanded-radius matches remain visible. The review UI displays the contributing match facts; the numeric score is supplemental rather than the only explanation.

## Run Diagnostics

Diagnostics are persisted for every saved search and provider request. They include:

- Provider-reported result count
- Role families requested and completed
- Pages requested
- Records received
- Accepted new matches
- Existing duplicate listings
- Previously saved listings
- Previously dismissed listings
- Rejected by posting age
- Rejected by distance
- Rejected by required or excluded terms
- Rejected by known salary
- Malformed provider records
- Unsearched pages or families due to request budget
- Provider errors, timeouts, and rate-limit truncation

The top-level run remains `success`, `partial`, or `failed`. Zero accepted matches can be a successful result. The UI translates counters into a concise explanation such as: `Adzuna returned 18 listings; 12 were outside the radius, 4 matched exclusions, and 2 were already dismissed.`

One failing role-family request does not roll back successful family results. Diagnostics record the failure and the run becomes partial unless every request failed.

## Capture & Queries Workspace

Capture & queries becomes the third working top-level view alongside Pipeline and Insights.

### Search Builder

The builder exposes search location, preferred and maximum radii, role-family selection, required/optional/excluded terms, posting age, optional minimum salary, and enabled state. Its actions are:

- `Preview results`: use the live provider without persisting listings or changing the review queue.
- `Save search`: validate and persist criteria without running it.
- `Save and run`: persist the criteria and run only that search.

A preview displays sample matches, the exact effective criteria, diagnostic counts, and any provider limitation. Preview errors retain all form input.

### Saved Search Management

Each saved-search summary shows its criteria, enabled state, latest run, accepted-result count, and most significant rejection reason. Available actions are Edit, Preview, Run now, Duplicate, Enable or Disable, and Delete. The page also provides `Run all enabled searches`.

Editing criteria removes only stale associations to listings whose status is still `new`. Historical associations to saved, dismissed, or expired listings remain available for diagnostics and Insights. Deleting a search removes its query associations through the foreign key but never changes listing or Pipeline-job status.

### Discovery Results

The existing Pipeline review rail remains a compact list for fast save/dismiss actions. The full workspace contains a pageable result table with filters for:

- Preferred, expanded, or unknown distance
- Role family
- Posting age
- Match-score range
- Salary known and minimum salary
- Saved search
- New, saved, or dismissed state
- Title and company text

Supported sort modes are Best match, Nearest, Newest, and Highest salary. Every row shows role family, distance band, posting age, salary, matched terms, source search, and uncertainty. Saving or dismissing updates MariaDB immediately and refreshes both the workspace and compact review rail.

Filter and sort parameters are sent to the server. The server returns total count and page metadata so filtering remains correct when the result set exceeds one page.

## Pipeline Completion and Filtering

The Pipeline keeps its stage tabs and adds combinable filters for:

- Role or company text
- Location text
- Urgent only
- Follow-up due
- Has contact or missing contact
- Saved-date or last-activity range

The interface shows an active-filter count and one Clear all action. Manual reordering continues to permute only visible job positions, preserving the current load-bearing list behavior.

Pipeline header values and sidebar follow-up messaging come from real stored data. The release removes hard-coded counts and sample claims. Empty states use neutral copy rather than reporting activity that did not happen.

## URL Capture

Pasting a job URL calls a server endpoint that attempts best-effort extraction of title, company, location, salary, and descriptive metadata. It always returns the original URL and field-level confidence or warnings. The client always creates an editable draft, including when extraction fails.

The server accepts only public HTTP and HTTPS destinations. It resolves DNS and blocks loopback, link-local, private, and otherwise non-public addresses before the initial request and after every redirect. Requests have strict connection and total timeouts, a bounded redirect count, an allow-listed content type, and a response-size limit. Errors are sanitized and do not expose response bodies or internal network information.

Capture extraction is provider-neutral and does not alter the scheduled Adzuna ingestion path.

## Data Model

A new numbered migration will:

- Extend `saved_queries` with `center_display_name`, `center_latitude`, `center_longitude`, `geocoder_provider`, `geocoder_place_id`, `preferred_radius_miles`, `maximum_radius_miles`, `required_terms`, `optional_terms`, `excluded_terms`, and `minimum_salary`. Existing `keywords` remains during this release for backward-compatible reads and migration evidence but is no longer written by the structured API.
- Create `saved_query_role_families` with a constrained role-family identifier and a foreign key to `saved_queries`.
- Extend `listings` with provider latitude, provider longitude, provider category, contract time, and contract type.
- Extend `listing_queries` with computed distance, a constrained distance band, and a JSON match-facts document containing matched synonyms and terms.
- Create `listing_query_role_families` so one listing-query association can record multiple matched role families without duplicating the association.
- Extend `scrape_run_queries` with aggregate provider, acceptance, rejection, duplicate, prior-decision, malformed-record, and truncation counters.
- Create `scrape_run_searches` with one row per run, saved query, and requested role family. It stores the provider result count, pages requested, records received, accepted count, truncation state, status, and sanitized error.

Exact numeric precision, text limits, constraints, and indexes will be specified in the implementation plan. Indexed server filters must include listing status, publication time, salary, query association, role family, and distance band. Free-text title/company filtering uses bounded `LIKE` predicates because this is a single-user dataset; full-text indexing is not required for this release.

## Application Architecture

- `useJobsStore` remains the sole client-side application state owner.
- New Capture & queries components remain presentational and receive data and callbacks from the store.
- API routes validate all query, preview, filter, pagination, and capture inputs.
- Repositories own SQL and transactions but not provider rules.
- A provider-neutral discovery service owns request planning, pagination, request budgets, deduplication, filtering, scoring, and diagnostics.
- The Adzuna adapter owns request encoding, retries, response metadata, and normalization only.
- Role-family and scoring helpers remain pure and independently testable.
- MariaDB remains the source of truth for searches, runs, listings, decisions, and jobs.

No router or additional state library is required. The current controlled active-view approach will add `Capture & queries` as another view value.

## API Shape

The existing endpoints remain compatible. The release will extend or add focused endpoints for:

- `GET /api/queries` plus the existing `POST`, `PATCH`, and `DELETE` routes for structured saved-search management.
- `POST /api/queries/resolve-location` for an uncached, user-initiated location lookup.
- `POST /api/queries/preview` for a non-persisting search preview.
- `POST /api/queries/:id/runs` to run one saved search.
- The existing `POST /api/scrape-runs` to run all enabled saved searches.
- `GET /api/listings` for paginated, filtered, and sorted discovery results, including reviewed history.
- `GET /api/scrape-runs/:id` for aggregate and per-role-family diagnostics.
- `POST /api/capture` for safe best-effort URL extraction.

Pipeline filters remain client-side because bootstrap already returns the complete, bounded single-user job list. Bootstrap gains real Pipeline summary metrics and the job timestamps required by the approved filters.

All failures retain the existing `{ error: { code, message } }` response contract. Preview and run responses include explicit provider and diagnostic metadata rather than overloading an empty result list.

## Loading, Empty, and Error States

- A never-run search says that it has not run, not that it found zero jobs.
- A provider zero-result response is distinguished from locally rejected results.
- A partial run keeps successful results visible and identifies incomplete families or pages.
- Rate limiting reports the completed work and the remaining skipped work.
- An unavailable provider disables run and preview actions while preserving query editing.
- Query resolution errors identify the submitted location and require correction.
- Filtered empty states distinguish `no stored results` from `no results match these filters`.
- Failed writes re-sync from MariaDB through the existing store failure path.
- URL extraction failure creates an editable draft with the original URL and warning.

## Accessibility and Interaction

- Working navigation items, query actions, filters, result actions, and pagination use semantic controls.
- Filter state has visible labels and is not communicated by color alone.
- Distance bands include text labels in addition to color.
- Form errors connect to their fields and survive a failed preview.
- Results remain usable with keyboard navigation.
- Focus moves to the Capture & queries heading after top-level navigation.
- Motion respects reduced-motion preferences.
- The existing 1280-pixel desktop minimum remains the required release viewport.

## Verification Strategy

Tests are added after each implementation slice rather than before it.

### Unit Coverage

- Structured criteria to Adzuna parameter translation
- Role-family synonym matching
- Required, optional, and excluded terms
- Radius conversion and Haversine distance bands
- Unknown-distance handling
- Salary and age eligibility
- Pagination and request-budget boundaries
- Deduplication across families and pages
- Deterministic scoring and explanations
- Diagnostic-counter classification
- URL validation and extraction helpers
- Pipeline filter composition

### API Coverage

- Structured query validation and backward compatibility
- Ambiguous or unresolved locations
- Preview persistence isolation
- Per-query and all-query run behavior
- Discovery filter, sort, and pagination contracts
- Diagnostic response shapes
- Safe URL capture validation and failure responses
- Real Pipeline summary metrics

### MariaDB Integration Coverage

- Forward migration of existing saved searches
- Role-family relation constraints
- Search-center and diagnostic persistence
- Deduplication across pages and role families
- Saved and dismissed states surviving query edits and subsequent ingestion
- Per-family partial-run bookkeeping
- Server-side discovery filters and pagination
- Transaction rollback on failed writes

### Browser Verification

- Capture & queries navigation and focus behavior
- Creating the seeded Auburn search
- Previewing without changing persisted results
- Running one query and all enabled queries
- Reading zero-result and partial-run explanations
- Combining and clearing discovery filters
- Saving and dismissing results across both result surfaces
- Combining and clearing Pipeline filters
- Preserving visible-only reorder behavior while filtered
- Capturing a supported URL and handling an extraction fallback
- Keyboard access and minimum-width visual integrity

### Release Checks

- The clean unit-test command passes without requiring a pre-existing `dist/` directory.
- The production build passes.
- The MariaDB integration suite passes against an isolated test database.
- A live Adzuna Auburn-area smoke run verifies request encoding, distance behavior, diagnostics, and persisted results when credentials are available.
- No provider credentials or private environment data appear in logs, artifacts, commits, or test output.

The release will not be reported as fully verified if the integration suite or live provider smoke run is skipped. Any unavailable external verification will be stated explicitly.

## Delivery Order

1. Repair the clean test command and remove hard-coded Pipeline activity claims.
2. Add the structured-search migration and backward-compatible API model.
3. Correct Adzuna parameter translation and provider result metadata.
4. Add provider-neutral discovery planning, filtering, scoring, pagination, and diagnostics.
5. Add search preview, per-query execution, and result filtering APIs.
6. Activate and build the Capture & queries workspace.
7. Add the Pipeline filters and real summary metrics.
8. Replace the URL-capture stub with the safe server-side extraction flow.
9. Run unit, API, integration, build, browser, and live-provider verification.
10. Synchronize repository and deployment documentation.

## Acceptance Criteria

- A saved search can target Auburn, NY with a preferred 20-mile radius and a maximum 40-mile radius.
- The search can include all seven approved role families without requiring every role term to occur in one listing.
- Adzuna requests include provider-side maximum age, maximum distance, and date ordering.
- Bounded pagination retrieves more than the first page when needed and reports request-budget truncation.
- Preferred, expanded, unknown, and rejected distance outcomes behave as specified.
- A successful zero-result run provides actionable diagnostic counts.
- Search preview does not persist listings or alter review decisions.
- Capture & queries supports creating, editing, previewing, running, duplicating, disabling, and deleting searches.
- Discovery results support all specified filters and sort modes with correct server-side totals.
- Pipeline filters compose correctly and preserve visible-only reorder semantics.
- Pipeline summary text contains no hard-coded sample activity.
- URL capture extracts available metadata safely and always falls back to an editable draft containing the original URL.
- Previously saved or dismissed listings retain their state after search edits and future runs.
- Clean unit tests, production build, MariaDB integration tests, browser checks, and a credentialed Auburn provider smoke run pass before the release is called complete.

## Follow-Up Direction

After discovery reliability is proven in real use, the next recommended release is Contacts and outreach: contact records linked to jobs, interaction history, follow-up reminders, referral tracking, and reusable outreach notes. Resume/application-document tracking and a second listing provider should be evaluated after the new discovery diagnostics reveal the remaining practical gaps.
