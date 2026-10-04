# Review queue sort & filter

## Problem

The Discovery Review queue (`ReviewQueue.jsx` — the "New matches" list, shown on the right side in wide desktop layout) currently has only one filter dimension (entry-level fit: All / Hide senior / Entry-level) and no sorting at all. Queue order is whatever the discovery API returns. Users want more ways to sort and filter these match listings.

## Scope

In scope: `ReviewQueue.jsx` and the match queue it renders (`MatchCard.jsx` items), plus the store state and lib logic that feeds it.

Out of scope: the main pipeline job table (`PipelineTable.jsx`), which has its own stage-tab filtering and is not part of this change.

## Design

### New lib file: `src/lib/matchQueueFilters.js`

Sibling to `src/lib/matchFit.js`, which already establishes the pattern (frozen option list + id/label, a pure filter function, a pure count function) for one dimension (fit). This file adds three more dimensions using the same shape, so it stays consistent and independently testable. `matchFit.js` itself is untouched — its name and scope stay focused on entry-level fit.

**Sort**

```js
export const SORT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'score', label: 'Best match' }),
  Object.freeze({ id: 'date', label: 'Newest' }),
]);

export function sortMatches(matches, sortId) { ... }
```

- `score`: descending by `match.score` (default — preserves the behavior users already expect from the current implicit order).
- `date`: descending by `match.publishedAt`.
- Stable sort (ties keep their relative order).
- Unknown/missing `sortId` returns the input array unchanged (same defensive-no-op convention as `filterByFit`).

**Work type filter**

```js
export const WORK_TYPE_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'full-time', label: 'Full-time' },
  { id: 'part-time', label: 'Part-time' },
  { id: 'contract', label: 'Contract' },
]);

export function filterByWorkType(matches, filterId) { ... }
export function countByWorkType(matches) { ... }
```

Reads the raw fields already present on a match (`match.contractTime` ∈ `full_time`/`part_time`/null, `match.contractType` ∈ `permanent`/`contract`/null — same fields `workTypeLabels()` in `matchExplanation.js` reads for the chip labels on `MatchCard`). `permanent` has no dedicated tab since it's the common/default case and not an interesting filter target; a listing with no contract fields at all is excluded by every non-`all` option (there is nothing to match).

**Distance filter**

```js
export const DISTANCE_FILTERS = Object.freeze([
  { id: 'all', label: 'All' },
  { id: 'preferred', label: 'Nearby' },
  { id: 'expanded', label: 'Expanded area' },
]);

export function filterByDistance(matches, filterId) { ... }
export function countByDistance(matches) { ... }
```

Needs the best distance band across a match's `matchedQueries`, which today is private logic (`bestDistance()`) inside `src/lib/matchExplanation.js`. That function will be exported (additive change, no behavior change to existing callers) and reused here instead of duplicating the band-ranking logic.

All three filter functions follow `filterByFit`'s existing convention: an unrecognized filter id returns the input array unchanged rather than throwing or hiding everything.

### Store (`src/hooks/useJobsStore.js`)

Add three pieces of state, defaulted to the no-op/expected-default choice:

- `sortBy` (default `'score'`)
- `workTypeFilter` (default `'all'`)
- `distanceFilter` (default `'all'`)

Pipeline, extending the existing `queueWithFit` → `filterByFit` chain:

```
queueWithFit = withFit(queue)
fitFiltered = filterByFit(queueWithFit, fitFilter)
workTypeFiltered = filterByWorkType(fitFiltered, workTypeFilter)
distanceFiltered = filterByDistance(workTypeFiltered, distanceFilter)
visibleQueue = sortMatches(distanceFiltered, sortBy)
```

Counts (`workTypeCounts`, `countByWorkType(queueWithFit)`; `distanceCounts`, `countByDistance(queueWithFit)`) are computed from `queueWithFit` — the same independence convention `fitCounts` already uses, so each filter row's badge counts reflect the full queue, not the subset left after the *other* active filters. This matches current UX: switching tabs shows how many matches exist in each bucket regardless of what else is currently filtered.

New setters (`setSortBy`, `setWorkTypeFilter`, `setDistanceFilter`) are returned from the hook alongside the existing `setFitFilter`.

### UI (`src/components/ReviewQueue.jsx`)

- Sort: a small `<select>` next to the "New matches" heading (a single either/or choice reads better as a dropdown than as a tab row, and keeps the existing fit-filter row's visual weight for the thing that already works well).
- Work type and distance: two more compact pill-button rows below the existing fit row, same visual treatment (`role="group"`, active pill highlighted via `aria-pressed`, trailing count badge per pill) — just two more instances of the existing pattern, not a new UI idiom.
- Empty state: the existing "No matches at this level" / "Show all matches" block is generalized to fire whenever *any* non-default filter (fit, work type, or distance) has emptied the list, and its reset action clears whichever filters are currently non-default.
- Layout: in `wide` mode the sidebar is a fixed 318px column, so the new rows need to wrap/stack the same way the existing fit row already does — no new layout mechanism, same flex-wrap pill group.

### Testing

`tests/match-queue-filters.test.js`, mirroring `tests/match-fit.test.js`'s structure:
- annotate/sort: `sortMatches` by score and by date, including a tie to confirm stability, and an unknown sort id returning input unchanged.
- `filterByWorkType` for each of the four options plus an unknown id.
- `filterByDistance` for each of the three options plus an unknown id, using matches with varying `matchedQueries[].distanceBand`.
- `countByWorkType` / `countByDistance` over a fixture queue, including the empty-queue case.

## Non-goals

- No free-text search box (explicitly deferred).
- No multi-select filters — each dimension stays single-select tabs/dropdown, consistent with the existing fit filter.
- No changes to how the discovery API orders or returns matches server-side; all sorting/filtering here is client-side over the already-fetched queue.
