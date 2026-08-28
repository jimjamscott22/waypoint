# Syracuse Discovery Queries Design

## Summary

Waypoint's discovery feed currently returns mostly out-of-area jobs and very few local
ones. The pipeline itself is healthy; the saved-query configuration is wrong and the feed
still holds residue from long-disabled seed queries.

This change does three things: it clears the stale listings left behind by dead queries,
re-centers the live queries on Syracuse, New York instead of Auburn, and widens the terms
sent to Adzuna so genuinely relevant local postings become visible to the search at all.

MariaDB stays authoritative, Adzuna stays the only provider, and the existing repository,
route, and discovery-service boundaries stay in place.

## Goals

- Remove the out-of-area listings that dominate the review queue.
- Center discovery on Syracuse, the region's actual job market, rather than Auburn.
- Increase local recall by searching more than one provider phrase per role family.
- Keep saved and dismissed decisions intact throughout.

## Non-Goals

- Changing the scoring weights or the distance-band model.
- Relaxing the rule that a role-family synonym must appear in the listing title.
- Adding a second provider, or nationwide/remote discovery.
- Schema changes. No new migration is part of this work.
- Editing `/etc/waypoint/waypoint.env`, which is outside this session's permissions.

## Current-State Findings

Measured against the running instance on 2026-08-27 via `GET /api/listings` and
`POST /api/queries/preview`.

**The review queue is 231 listings, and 221 of them are orphans of dead queries.**
Attribution by matched query:

| Matched query | Listings | Enabled | Distance band |
|---|---|---|---|
| All | 132 | no | unknown |
| IT support · Madison · <14 days | 50 | no | unknown |
| Sysadmin · remote · <7 days | 39 | no | unknown |
| Auburn Infrastructure | 5 | yes | expanded |
| Auburn Help Desk & Desktop Support | 3 | yes | expanded |
| Auburn Internet & Fiber Installation | 2 | yes | expanded |

Every one of the 221 has `distanceBand: "unknown"`. Adzuna returned no coordinates for
them, and `classifyDistance` treats an unknown distance as eligible rather than rejected,
so the radius filter never applied. Disabling those three queries stopped further intake
but left the existing rows at `status = 'new'`. The visible result is a feed of Madison,
Anchorage, Phoenix, and San Antonio postings.

**The Auburn center costs more than it gives.** All ten listings from the enabled Auburn
queries are already Syracuse, Ithaca, or Fulton, and all ten fall in the `expanded` band at
21-36 miles. None reached `preferred`, because Syracuse sits about 26 miles from Auburn and
the preferred radius is 20. Auburn has almost no listing density of its own.

**A Syracuse center works immediately.** A preview centered on Syracuse
(25 preferred / 40 maximum, `it-support`, 30 days) returned 6 matches from 30 provider
records: Syracuse at 0.01 and 1.03 miles, East Syracuse at 3.68 and 5.03, DeWitt at 3.79,
Stanwix at 38.94.

**Two hypotheses were tested and rejected.**

- The verbose center display name is not breaking Adzuna's geocoding. Previewing with
  `"City of Auburn, Cayuga County, New York, 13021, United States"` resolved correctly and
  returned 48 records.
- The high `rejectedTerms` count is not primarily waste. Adzuna's `what_phrase` matches the
  description as well as the title, so postings whose body merely mentions the phrase come
  back and then correctly fail the title gate in `evaluateListing`. Loosening that gate
  would admit noise, not signal.

**Request budget is not the binding constraint.** `searchRoleFamily` breaks out of its page
loop when a page comes back shorter than `pageSize`, so a family whose whole market is 30
jobs costs one request, not three. The Syracuse preview reported
`providerResultCount: 30, pagesRequested: 1, truncated: false`. There is headroom to spend
requests on additional phrases instead of additional pages.

**The real recall limit is phrase coverage.** `adzunaParameters` sends
`ROLE_FAMILIES[roleFamily].synonyms[0]` and nothing else. Adzuna only returns postings
matching that single phrase, so a "Field Service Technician" opening is invisible to
Waypoint regardless of how scoring or synonyms are configured locally.

## Design

### 1. Clear the stale feed

No new code. `queryRepository.remove()` already performs the needed cleanup: deleting a
saved query cascades `listing_queries` through the `ON DELETE CASCADE` foreign key, and the
call to `expireOrphanedListings()` then flips any listing left with no query association and
`status = 'new'` to `status = 'expired'`.

Delete these five queries through `DELETE /api/queries/:id`:

- `All` (`cc3c4775-ac31-4117-a7d8-84d09b4bec05`)
- `IT support · Madison · <14 days` (`10000000-0000-4000-8000-000000000002`)
- `Network admin · hybrid · <14 days` (`10000000-0000-4000-8000-000000000003`)
- `Sysadmin · remote · <7 days` (`10000000-0000-4000-8000-000000000001`)
- `Auburn IT Support` (`10000000-0000-4000-8000-000000000004`) — disabled, and redundant
  with the new help-desk query

`expireOrphanedListings` only touches rows at `status = 'new'`, so saved and dismissed
decisions survive. Migration 003 seeds three of these ids with `INSERT IGNORE`, but
migrations are numbered and already applied, so deletion is not undone.

### 2. Re-center on Syracuse

Center resolved through the application's own geocoder endpoint rather than hardcoded:

```
displayName: "City of Syracuse, Onondaga County, New York, United States"
latitude:    43.0481221
longitude:   -76.1474244
provider:    "nominatim"
placeId:     "174916"
```

Radii are 25 preferred and 40 maximum. 40 is the `MAX_RADIUS_MILES` ceiling enforced in
`server/routes/queries.js`, and a 40-mile circle on Syracuse covers Auburn at about 26
miles, plus Fulton, Oswego, Cortland, DeWitt, Liverpool, and Baldwinsville. Ithaca falls
outside at roughly 50 miles.

The four enabled Auburn queries are updated in place with `PATCH /api/queries/:id` rather
than deleted and recreated, so their ids stay stable and their `scrape_run_queries` history
survives. Together they cover all eight role families:

| Existing query id | New name | Role families | Max age | Optional terms | Excluded terms |
|---|---|---|---|---|---|
| `f5e90f3e` (Auburn Help Desk & Desktop Support) | Syracuse Help Desk & Desktop Support | `it-support`, `desktop-support` | 14 | help desk, service desk, tier 1, entry level | — |
| `9ff96465` (Auburn Infrastructure) | Syracuse Systems & Network Infrastructure | `systems-administration`, `network-administration` | 30 | Windows Server, VMware, Cisco, Azure, Active Directory | — |
| `d454db9d` (Auburn Entry-Level IT & Systems) | Syracuse Entry-Level IT, Cloud & Ops | `it-operations`, `junior-systems-engineering`, `cloud-support` | 30 | entry level, junior, associate, trainee | — |
| `21ab3614` (Auburn Internet & Fiber Installation) | Syracuse Internet & Fiber Installation | `internet-service-installation` | 30 | broadband, fiber, internet, cable, entry level | HVAC, solar, appliance |

Each row is a one-to-one update of an existing query; `cloud-support` is added to
`d454db9d` because no other enabled query covered it once `Auburn IT Support` is deleted.

Editing a query's criteria triggers `clearPendingMatches`, which drops undecided
`listing_queries` rows for that query and expires any resulting orphans. The ten existing
Auburn-attributed listings will therefore expire and be rediscovered against the new center
on the next run. That is the intended behavior, not a side effect to work around.

### 3. Widen the terms

Two coordinated code changes.

**`server/discovery/roleFamilies.js`** gains synonyms reflecting the titles this market
actually posts — for example `IT technician`, `support technician`, `computer technician`,
`client support`, `desktop technician`, `field service technician`, `network technician`,
`network analyst`, `data center technician`, `NOC technician`, `cloud engineer`,
`installation technician`, and `line technician`. These widen what passes the local title
gate. `keywordCoverage` normalizes tokens with stop-word removal, plural stripping, and
prefix matching, so synonyms need not be exact title matches.

**`server/discovery/criteria.js`** replaces the single `whatPhrase` with a
`providerPhrases(roleFamily)` helper returning the family's first three synonyms, and
`adzunaParameters` takes a phrase rather than deriving one. **`server/discovery/service.js`**
loops those phrases inside `searchRoleFamily`, with all phrases for a family sharing that
family's page budget and the existing short-page break still applying per phrase. Accepted
listings continue to deduplicate on `providerJobId`, so a posting matching two phrases is
recorded once.

This is the change that surfaces jobs the current configuration cannot see at all.

## Error Handling

- Deletions and updates run through the existing `waypoint:scrape` advisory lock, so a
  concurrent scrape run yields `409 RUN_IN_PROGRESS` rather than corrupting state. The
  operator retries once the run finishes.
- `assertRadiusRange` rejects a preferred radius above the maximum with
  `400 INVALID_RADIUS_RANGE`.
- Per-phrase provider failures stay contained by the existing retry and per-family error
  capture in `searchRoleFamily`; one failed phrase marks the search partial rather than
  failing the run.
- If the request budget is exhausted mid-run, existing behavior applies: the run records
  `unsearchedRequests` and `truncated: true`.

## Testing

- `tests/discovery-criteria.test.js` — update the `what_phrase` assertions and cover
  `providerPhrases`: three phrases per family, fewer when the family has fewer synonyms,
  and stability of the first phrase for families that already worked.
- `tests/adzuna.test.js` — update the two `what_phrase` assertions to the phrase-parameter
  shape.
- `tests/discovery-service.test.js` — cover the phrase loop: multiple phrases requested per
  family, budget shared correctly across phrases, and a listing matched by two phrases
  persisted once.
- `npm test` must pass in full before the query data changes are applied.
- Verification after applying data changes: `GET /api/listings` shows the feed cleared of
  unknown-band out-of-area rows, and a preview of each new query returns Syracuse-area
  results in the `preferred` band.

## Operator Follow-Up

Widening from one phrase to three raises a full run from roughly 8 provider requests to
roughly 24. `DISCOVERY_RUN_REQUEST_BUDGET` is 20 and `DISCOVERY_QUERY_REQUEST_BUDGET` is 12,
and both live in `/etc/waypoint/waypoint.env`, which this session cannot read or write.

The operator must raise them — 48 and 16 are the suggested values — or runs will report
`truncated: true` and silently skip role families. Resulting daily volume is about 25-30
Adzuna calls, well inside the free tier.
