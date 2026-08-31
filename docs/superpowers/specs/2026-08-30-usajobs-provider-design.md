# USAJOBS as a Second Discovery Provider

**Status:** Groundwork implemented 2026-08-31. No USAJOBS code, no key obtained.

The provider-agnostic seam described under "What actually blocks a second provider" is
built and tested; see **Implementation status** at the end. The USAJOBS client itself is
still unbuilt and still gated on the conditions in **Recommendation** — a key, and a real
count of Syracuse-area series-2210 postings.

**Why now:** The 2026-08-29 investigation showed Adzuna is not the constraint — a single
Syracuse `it-support` search returns 149 provider results and 201 records. The case for a
second provider is *coverage of a segment Adzuna indexes poorly*, not volume. Federal
postings are that segment, and Syracuse has real federal IT employment: the Syracuse VA
Medical Center, and defense contractors clustered around Hancock Field.

Read this before deciding to build. The recommendation at the end is deliberately
conditional.

## What was verified

Probed 2026-08-30 from the Pi, no credentials:

| Check | Result |
|---|---|
| `GET https://data.usajobs.gov/api/search` with no headers | `HTTP 403` |
| Same, with a `User-Agent` but no key | `HTTP 401 Unauthorized` (RFC 9110 problem+json) |
| `GET /api/codelist/occupationalseries` | `HTTP 403` |

So the API is live and reachable from this host, and it authenticates with a
`User-Agent` (a contact email) **plus** an `Authorization-Key` header. The key is free but
registration-gated at `developer.usajobs.gov`.

**Not verified, and must be confirmed with a key before building:** the exact request
parameter names and their semantics (keyword, location, radius, paging, date filters), the
response envelope shape, per-key rate limits, and how many Syracuse-area IT postings
actually exist on a given day. Every estimate below is unvalidated until someone runs a
real query. **Do not treat the parameter design in this document as settled.**

## What the codebase already supports

Better than expected. `listings` is provider-neutral at the schema level:

```sql
provider VARCHAR(40) NOT NULL,
UNIQUE KEY listings_provider_job_unique (provider, provider_job_id)
```

`normalizeAdzunaJob` (`server/scraper/adzuna.js`) already defines a provider-neutral
listing shape that the rest of the pipeline consumes. A USAJOBS normalizer producing that
same shape drops into `evaluateListing`, `persistMatch`, scoring, and the review queue
with no changes to any of them.

**No migration is required for the listings table.**

## What actually blocks a second provider

Four single-provider assumptions, all small, none structural:

1. **`server/services.js:31-34`** — `adzunaClient` is constructed once and injected as a
   single client. `createDiscoveryService` takes `adzunaClient`, not a list of providers.
2. **`server/discovery/service.js:103`** — `searchRoleFamily` calls
   `adzunaClient.search({ query, roleFamily, phrase, page })` directly. The phrase loop and
   the request budget are both written around one provider's paging model.
3. **`server/discovery/service.js:178`** — `statusesByProviderId('adzuna', ...)` is a
   hardcoded literal. Preview's duplicate/saved/dismissed counts would be wrong for a
   second provider's listings.
4. **`server/db/listingRepository.js:24` and `server/db/discoveryRepository.js:104`** —
   both hardcode `source: 'Adzuna'` on the way out to the UI. Federal listings would be
   mislabeled in the review queue.

Items 3 and 4 are literal-replacement bugs. Item 1 is a constructor change. Item 2 is the
only real design work.

## The one genuine design question

`searchRoleFamily` currently spends a per-family request budget across three provider
phrases. That model is Adzuna-shaped: `what_phrase` matches an exact phrase, so recall
requires several phrases.

USAJOBS is organized around **occupational series codes** — the 2210 series covers
Information Technology Management — which is a fundamentally different retrieval model. A
single series-code query likely subsumes all eight role families at once. Forcing it
through the per-family phrase loop would issue eight nearly identical requests and
deduplicate away the redundancy, wasting budget for no additional coverage.

So the provider interface should not be "give me results for this phrase." It should be
closer to "give me results for this query," letting each provider decide how to decompose
it. That is a real refactor of `searchRoleFamily`, and it is the reason this is a scope
document rather than a task list.

## Budget interaction

`DISCOVERY_RUN_REQUEST_BUDGET` is a single greedy counter shared across all queries in
list order (see the Syracuse design doc's Operator Follow-Up). Adding a provider inside the
same counter means a broad Adzuna phrase can starve USAJOBS entirely, silently, on every
run — the same starvation failure already documented there, with a new way to trigger it.

**Per-provider budgets are a prerequisite, not a follow-up.**

## Recommendation

Conditional, in this order:

1. **First, let the fixed Adzuna pipeline run for a few days.** The `where` bug was fixed
   on 2026-08-30 and the feed has not yet been observed working. Adding a provider to
   compensate for a pipeline that was misconfigured rather than under-supplied would be
   solving the wrong problem. The funnel already shows `rejectedTerms: 171` out of 201
   records for one family — tuning the title filter may surface more local jobs than a
   second provider would, at zero integration cost.
2. **If federal roles are specifically wanted**, get a key and run one manual query for
   series 2210 within 40 miles of Syracuse. That single number — how many postings exist —
   decides whether any of this is worth building. If it is under roughly a dozen, a
   bookmark beats an integration.
3. **Only then** do the refactor, in this order: per-provider budgets, provider-agnostic
   client interface, USAJOBS normalizer, then the four hardcoded-literal fixes.

## Alternatives considered

- **Greenhouse public board API** (`boards-api.greenhouse.io`) returned `HTTP 200` with no
  key. Per-company rather than per-region, so it needs a curated employer list — but that
  is arguably a better fit for a local search than any aggregator, and it has no auth,
  no key, and no rate-limit negotiation. Worth scoping alongside USAJOBS.
- **Lever** (`api.lever.co/v0/postings/:company`) is the same shape; the probe returned
  404 only because the sampled company is not a Lever customer.
- **Indeed** no longer offers a public search API for this use case.
- **Arbeitnow** and **Remotive** both answered `HTTP 200` without a key but are
  remote-focused, which is the opposite of this app's Syracuse-local goal.

## Implementation status (2026-08-31)

Done — the four blockers above, plus a bug the multi-provider path exposed:

- **Per-provider budgets** (`server/discovery/budget.js`). The configured total is *split*
  across configured providers rather than granted to each, so the run's overall request
  ceiling is unchanged and a single-provider run behaves exactly as before. Verified by
  reverting to the shared counter: Adzuna consumed all four requests of a two-provider
  budget and the second provider was searched zero times — the documented starvation,
  reproduced, and now caught by a test.
- **Provider-agnostic interface.** A provider is `{ id, planRoleFamily, search }`.
  `planRoleFamily` is where a provider decomposes a role family into requests: Adzuna
  returns one request per synonym because `what_phrase` matches a single exact phrase;
  a series-code provider would return one. `searchRoleFamily` iterates providers and
  spreads each request descriptor into `search`, so a descriptor's fields stay the
  provider's own vocabulary rather than becoming a shared schema.
- **The hardcoded literals.** `source` now comes from `providerLabel(row.provider)` via a
  registry at `server/providers.js`; preview's duplicate lookup is scoped per provider.
- **Composite listing identity.** `provider_job_id` is unique only *within* a provider, so
  the accepted-match sets in both `preview` and `runOneQuery` keyed on it would have
  collapsed two providers' unrelated postings into one. They now key on
  `provider:provider_job_id`.

Not done, and deliberately so:

- **No USAJOBS client, normalizer, or key.** Unchanged from the recommendation above.
- **The per-query decomposition question is still open.** `planRoleFamily` is scoped to one
  role family, so a provider whose single query subsumes all eight families would still be
  asked eight times and deduplicate the redundancy away — correct results, wasted budget.
  Whether to hoist the seam to the query level depends on what a real USAJOBS response
  looks like, and building that abstraction now, against no second provider, would be
  guessing. Resolve it when the first real response is in hand.
