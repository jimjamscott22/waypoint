# Review Queue Sort & Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sort (best match / newest) and two new filters (work type, distance band) to the Discovery Review "New matches" queue (`ReviewQueue.jsx`), alongside the existing entry-level fit filter.

**Architecture:** New pure-function lib file `src/lib/matchQueueFilters.js` (sibling to `src/lib/matchFit.js`) holds sort/filter/count logic, tested directly with `node:test`. `useJobsStore.js` wires three new pieces of state through the existing `queueWithFit` → filter → (now also) sort pipeline. `ReviewQueue.jsx` gets a sort `<select>` and two more filter-pill rows, extracting the existing fit-pill markup into a small shared `FilterGroup` component so the three rows share one implementation.

**Tech Stack:** React (presentational components, inline `style` objects from `src/theme.js` tokens), plain JS lib functions, `node:test` + `node:assert/strict` for tests.

## Global Constraints

- No CSS files or classes anywhere — every style is an inline `style` object built from `src/theme.js` tokens (`color`, `chipColor`, `font`, `radius`). Never hardcode hex values.
- Tests use the built-in `node:test` runner (not Jest/Vitest); test files import source modules directly with explicit `.js` extensions.
- All application state flows through `src/hooks/useJobsStore.js`; components stay presentational and receive data/callbacks via props.
- Pure list/queue logic belongs in `src/lib/*.js`, exercised directly by tests — this is project's only consistently tested layer for this kind of logic.
- Filter/count functions follow the existing `matchFit.js` convention: an unrecognized filter id returns the input array unchanged (never throws, never empties the list).
- The app shell is desktop-first (`minWidth: 1280` in `App.jsx`); the review sidebar is a fixed 318px column in `wide` layout mode.

---

### Task 1: Export `bestDistance` from `matchExplanation.js`

`matchQueueFilters.js` (Task 4) needs to determine a match's best distance band. That ranking logic already exists as a private function inside `src/lib/matchExplanation.js` — this task makes it reusable without duplicating the band-ranking rules.

**Files:**
- Modify: `src/lib/matchExplanation.js:24` (add `export` to the existing `bestDistance` function declaration)
- Test: `tests/match-explanation.test.js`

**Interfaces:**
- Produces: `export function bestDistance(matchedQueries: Array<{ distanceBand?: string, distanceMiles?: number }>): { band: string, miles: number|null, label: string } | null` — same behavior as before (now just importable), used by Task 4.

- [ ] **Step 1: Write the failing test**

Add to `tests/match-explanation.test.js` (the file already imports from `'../src/lib/matchExplanation.js'` — add `bestDistance` to that import list):

```js
import { bestDistance, descriptionSnippet, explainMatch, highlightSegments } from '../src/lib/matchExplanation.js';
```

Add this test anywhere in the file, alongside the other `distance`-related tests:

```js
test('exposes bestDistance directly for reuse outside explainMatch', () => {
  assert.deepEqual(
    bestDistance([{ distanceMiles: 4.2, distanceBand: 'preferred' }]),
    { band: 'preferred', miles: 4.2, label: '4 mi · in preferred area' }
  );
  assert.equal(bestDistance([]), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/match-explanation.test.js`
Expected: FAIL — `bestDistance is not a function` (it's not exported yet, so the import binds `undefined`).

- [ ] **Step 3: Export the function**

In `src/lib/matchExplanation.js`, change:

```js
function bestDistance(matchedQueries) {
```

to:

```js
export function bestDistance(matchedQueries) {
```

No other code in the file changes — the existing internal call inside `explainMatch` still resolves the same way.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/match-explanation.test.js`
Expected: PASS, all tests in the file green (including the pre-existing ones — confirms nothing broke).

- [ ] **Step 5: Commit**

```bash
git add src/lib/matchExplanation.js tests/match-explanation.test.js
git commit -m "Export bestDistance from matchExplanation for reuse in queue filters"
```

---

### Task 2: Create `matchQueueFilters.js` — sort by score / date

**Files:**
- Create: `src/lib/matchQueueFilters.js`
- Test: Create `tests/match-queue-filters.test.js`

**Interfaces:**
- Produces: `SORT_OPTIONS: Array<{id: string, label: string}>`, `sortMatches(matches: Array, sortId: string): Array` — used by `useJobsStore.js` (Task 5) and `ReviewQueue.jsx` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `tests/match-queue-filters.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SORT_OPTIONS, sortMatches } from '../src/lib/matchQueueFilters.js';

const queue = [
  { id: 'a', score: 60, publishedAt: '2026-01-01T00:00:00Z' },
  { id: 'b', score: 90, publishedAt: '2026-01-03T00:00:00Z' },
  { id: 'c', score: 90, publishedAt: '2026-01-02T00:00:00Z' },
];

test('sorts by score descending, breaking ties by original order', () => {
  assert.deepEqual(sortMatches(queue, 'score').map(match => match.id), ['b', 'c', 'a']);
});

test('sorts by publish date descending', () => {
  assert.deepEqual(sortMatches(queue, 'date').map(match => match.id), ['b', 'c', 'a']);
});

test('returns the input unchanged for an unknown sort id', () => {
  assert.deepEqual(sortMatches(queue, 'bogus').map(match => match.id), ['a', 'b', 'c']);
});

test('exposes the sort option ids the UI renders, in display order', () => {
  assert.deepEqual(SORT_OPTIONS.map(option => option.id), ['score', 'date']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/match-queue-filters.test.js`
Expected: FAIL — cannot find module `../src/lib/matchQueueFilters.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/matchQueueFilters.js`:

```js
export const SORT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'score', label: 'Best match' }),
  Object.freeze({ id: 'date', label: 'Newest' }),
]);

const SORT_KEYS = Object.freeze({
  score: match => match.score ?? 0,
  date: match => new Date(match.publishedAt ?? 0).getTime(),
});

// Explicit index tie-break keeps order deterministic regardless of the JS
// engine's sort stability guarantees, and matches the "ties keep their
// relative order" expectation from the design.
export function sortMatches(matches, sortId) {
  const key = SORT_KEYS[sortId];
  if (!key) return matches;
  return matches
    .map((match, index) => ({ match, index }))
    .sort((a, b) => key(b.match) - key(a.match) || a.index - b.index)
    .map(entry => entry.match);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/match-queue-filters.test.js`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matchQueueFilters.js tests/match-queue-filters.test.js
git commit -m "Add sortMatches (score/date) for the review queue"
```

---

### Task 3: Extend `matchQueueFilters.js` — work type filter

**Files:**
- Modify: `src/lib/matchQueueFilters.js` (append)
- Test: Modify `tests/match-queue-filters.test.js` (append)

**Interfaces:**
- Consumes: nothing new (reads raw `match.contractTime` / `match.contractType` fields already present on every match — same fields `workTypeLabels()` in `matchExplanation.js` reads for the `MatchCard` chip).
- Produces: `WORK_TYPE_FILTERS: Array<{id, label}>`, `filterByWorkType(matches, filterId): Array`, `countByWorkType(matches): Record<string, number>` — used by `useJobsStore.js` (Task 5) and `ReviewQueue.jsx` (Task 6).

- [ ] **Step 1: Write the failing test**

Append to `tests/match-queue-filters.test.js`. First, widen the shared `queue` fixture at the top of the file to carry work-type fields (replace the existing `queue` declaration):

```js
const queue = [
  { id: 'a', score: 60, publishedAt: '2026-01-01T00:00:00Z', contractTime: 'full_time', contractType: 'permanent' },
  { id: 'b', score: 90, publishedAt: '2026-01-03T00:00:00Z', contractTime: 'part_time', contractType: 'contract' },
  { id: 'c', score: 90, publishedAt: '2026-01-02T00:00:00Z', contractTime: null, contractType: null },
];
```

Update the import line to add the new names:

```js
import { SORT_OPTIONS, WORK_TYPE_FILTERS, countByWorkType, filterByWorkType, sortMatches } from '../src/lib/matchQueueFilters.js';
```

Add these tests:

```js
test('filters by work type', () => {
  assert.deepEqual(filterByWorkType(queue, 'all').map(match => match.id), ['a', 'b', 'c']);
  assert.deepEqual(filterByWorkType(queue, 'full-time').map(match => match.id), ['a']);
  assert.deepEqual(filterByWorkType(queue, 'part-time').map(match => match.id), ['b']);
  assert.deepEqual(filterByWorkType(queue, 'contract').map(match => match.id), ['b']);
  assert.deepEqual(filterByWorkType(queue, 'bogus').map(match => match.id), ['a', 'b', 'c']);
});

test('counts every work type option', () => {
  assert.deepEqual(countByWorkType(queue), { all: 3, 'full-time': 1, 'part-time': 1, contract: 1 });
  assert.deepEqual(countByWorkType([]), { all: 0, 'full-time': 0, 'part-time': 0, contract: 0 });
  assert.deepEqual(Object.keys(countByWorkType(queue)), WORK_TYPE_FILTERS.map(option => option.id));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/match-queue-filters.test.js`
Expected: FAIL — `WORK_TYPE_FILTERS`/`filterByWorkType`/`countByWorkType` are not exported yet.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/matchQueueFilters.js`:

```js
export const WORK_TYPE_FILTERS = Object.freeze([
  Object.freeze({ id: 'all', label: 'All' }),
  Object.freeze({ id: 'full-time', label: 'Full-time' }),
  Object.freeze({ id: 'part-time', label: 'Part-time' }),
  Object.freeze({ id: 'contract', label: 'Contract' }),
]);

// No dedicated "permanent" tab: it's the common/default case for a listing's
// contractType and not an interesting filter target on its own.
const WORK_TYPE_PREDICATES = Object.freeze({
  all: () => true,
  'full-time': match => match.contractTime === 'full_time',
  'part-time': match => match.contractTime === 'part_time',
  contract: match => match.contractType === 'contract',
});

export function filterByWorkType(matches, filterId) {
  return matches.filter(WORK_TYPE_PREDICATES[filterId] ?? WORK_TYPE_PREDICATES.all);
}

export function countByWorkType(matches) {
  return Object.fromEntries(WORK_TYPE_FILTERS.map(({ id }) => [id, matches.filter(WORK_TYPE_PREDICATES[id]).length]));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/match-queue-filters.test.js`
Expected: PASS, all tests green (including Task 2's sort tests — confirms the fixture change didn't break them).

- [ ] **Step 5: Commit**

```bash
git add src/lib/matchQueueFilters.js tests/match-queue-filters.test.js
git commit -m "Add work-type filter for the review queue"
```

---

### Task 4: Extend `matchQueueFilters.js` — distance band filter

**Files:**
- Modify: `src/lib/matchQueueFilters.js` (append + new import)
- Test: Modify `tests/match-queue-filters.test.js` (append)

**Interfaces:**
- Consumes: `bestDistance` from `../src/lib/matchExplanation.js` (Task 1) — `bestDistance(matchedQueries): { band: string, miles: number|null, label: string } | null`.
- Produces: `DISTANCE_FILTERS: Array<{id, label}>`, `filterByDistance(matches, filterId): Array`, `countByDistance(matches): Record<string, number>` — used by `useJobsStore.js` (Task 5) and `ReviewQueue.jsx` (Task 6).

- [ ] **Step 1: Write the failing test**

Append to `tests/match-queue-filters.test.js`. Widen the shared `queue` fixture again (replace it once more, this time adding `matchedQueries` — note `bestDistance` only resolves a real band when at least one matched query carries a finite `distanceMiles`; without one it reports `band: 'unknown'` regardless of the `distanceBand` value, so each fixture needs a `distanceMiles`):

```js
const queue = [
  { id: 'a', score: 60, publishedAt: '2026-01-01T00:00:00Z', contractTime: 'full_time', contractType: 'permanent', matchedQueries: [{ distanceBand: 'preferred', distanceMiles: 5 }] },
  { id: 'b', score: 90, publishedAt: '2026-01-03T00:00:00Z', contractTime: 'part_time', contractType: 'contract', matchedQueries: [{ distanceBand: 'expanded', distanceMiles: 20 }] },
  { id: 'c', score: 90, publishedAt: '2026-01-02T00:00:00Z', contractTime: null, contractType: null, matchedQueries: [] },
];
```

Update the import line:

```js
import { DISTANCE_FILTERS, SORT_OPTIONS, WORK_TYPE_FILTERS, countByDistance, countByWorkType, filterByDistance, filterByWorkType, sortMatches } from '../src/lib/matchQueueFilters.js';
```

Add these tests:

```js
test('filters by distance band', () => {
  assert.deepEqual(filterByDistance(queue, 'all').map(match => match.id), ['a', 'b', 'c']);
  assert.deepEqual(filterByDistance(queue, 'preferred').map(match => match.id), ['a']);
  assert.deepEqual(filterByDistance(queue, 'expanded').map(match => match.id), ['b']);
  assert.deepEqual(filterByDistance(queue, 'bogus').map(match => match.id), ['a', 'b', 'c']);
});

test('counts every distance option, excluding matches with no distance data from either band', () => {
  assert.deepEqual(countByDistance(queue), { all: 3, preferred: 1, expanded: 1 });
  assert.deepEqual(countByDistance([]), { all: 0, preferred: 0, expanded: 0 });
  assert.deepEqual(Object.keys(countByDistance(queue)), DISTANCE_FILTERS.map(option => option.id));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/match-queue-filters.test.js`
Expected: FAIL — `DISTANCE_FILTERS`/`filterByDistance`/`countByDistance` are not exported yet.

- [ ] **Step 3: Write minimal implementation**

Add this import at the top of `src/lib/matchQueueFilters.js`:

```js
import { bestDistance } from './matchExplanation.js';
```

Append to `src/lib/matchQueueFilters.js`:

```js
export const DISTANCE_FILTERS = Object.freeze([
  Object.freeze({ id: 'all', label: 'All' }),
  Object.freeze({ id: 'preferred', label: 'Nearby' }),
  Object.freeze({ id: 'expanded', label: 'Expanded area' }),
]);

const DISTANCE_PREDICATES = Object.freeze({
  all: () => true,
  preferred: match => bestDistance(match.matchedQueries ?? [])?.band === 'preferred',
  expanded: match => bestDistance(match.matchedQueries ?? [])?.band === 'expanded',
});

export function filterByDistance(matches, filterId) {
  return matches.filter(DISTANCE_PREDICATES[filterId] ?? DISTANCE_PREDICATES.all);
}

export function countByDistance(matches) {
  return Object.fromEntries(DISTANCE_FILTERS.map(({ id }) => [id, matches.filter(DISTANCE_PREDICATES[id]).length]));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/match-queue-filters.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite as a regression check**

Run: `npm test`
Expected: PASS, no failures anywhere else (confirms the `matchExplanation.js` export in Task 1 didn't disturb anything else that imports from it).

- [ ] **Step 6: Commit**

```bash
git add src/lib/matchQueueFilters.js tests/match-queue-filters.test.js
git commit -m "Add distance-band filter for the review queue"
```

---

### Task 5: Wire sort/filter state into `useJobsStore.js`

**Files:**
- Modify: `src/hooks/useJobsStore.js`

**Interfaces:**
- Consumes: `sortMatches`, `filterByWorkType`, `countByWorkType`, `filterByDistance`, `countByDistance` from `../lib/matchQueueFilters.js` (Tasks 2–4).
- Produces (new hook return fields, consumed by `App.jsx`/`ReviewQueue.jsx` in Tasks 6–7): `sortBy: string`, `setSortBy: (id: string) => void`, `workTypeFilter: string`, `setWorkTypeFilter: (id: string) => void`, `workTypeCounts: Record<string, number>`, `distanceFilter: string`, `setDistanceFilter: (id: string) => void`, `distanceCounts: Record<string, number>`. (`visibleQueue`, `fitFilter`, `setFitFilter`, `fitCounts` already exist and keep their current names/shapes.)

- [ ] **Step 1: Update the import line**

In `src/hooks/useJobsStore.js`, find:

```js
import { countByFit, filterByFit, withFit } from '../lib/matchFit';
```

Change it to:

```js
import { countByFit, filterByFit, withFit } from '../lib/matchFit';
import { countByDistance, countByWorkType, filterByDistance, filterByWorkType, sortMatches } from '../lib/matchQueueFilters';
```

- [ ] **Step 2: Add the new state**

Find:

```js
const [stageFilter, setStageFilter] = useState('All');
const [fitFilter, setFitFilter] = useState('all');
```

Change to:

```js
const [stageFilter, setStageFilter] = useState('All');
const [fitFilter, setFitFilter] = useState('all');
const [sortBy, setSortBy] = useState('score');
const [workTypeFilter, setWorkTypeFilter] = useState('all');
const [distanceFilter, setDistanceFilter] = useState('all');
```

- [ ] **Step 3: Extend the derived-queue pipeline**

Find:

```js
  // Like stageFilter, the fit filter narrows what the review queue shows while
  // `reviewCount` and actions still work against the full queue.
  const queueWithFit = useMemo(() => withFit(queue), [queue]);
  const visibleQueue = useMemo(() => filterByFit(queueWithFit, fitFilter), [queueWithFit, fitFilter]);
  const fitCounts = useMemo(() => countByFit(queueWithFit), [queueWithFit]);
```

Replace with:

```js
  const queueWithFit = useMemo(() => withFit(queue), [queue]);
  // Like stageFilter, these filters narrow what the review queue shows while
  // the *Counts below and `reviewCount` still read from the full queue.
  const fitFiltered = useMemo(() => filterByFit(queueWithFit, fitFilter), [queueWithFit, fitFilter]);
  const workTypeFiltered = useMemo(() => filterByWorkType(fitFiltered, workTypeFilter), [fitFiltered, workTypeFilter]);
  const distanceFiltered = useMemo(() => filterByDistance(workTypeFiltered, distanceFilter), [workTypeFiltered, distanceFilter]);
  const visibleQueue = useMemo(() => sortMatches(distanceFiltered, sortBy), [distanceFiltered, sortBy]);
  const fitCounts = useMemo(() => countByFit(queueWithFit), [queueWithFit]);
  const workTypeCounts = useMemo(() => countByWorkType(queueWithFit), [queueWithFit]);
  const distanceCounts = useMemo(() => countByDistance(queueWithFit), [queueWithFit]);
```

- [ ] **Step 4: Return the new fields**

Find, in the hook's final `return` object:

```js
    jobs: visibleJobs, totalCount: jobs.length, stageFilter, setStageFilter, tabs, queue, queries,
    visibleQueue, fitFilter, setFitFilter, fitCounts,
```

Change to:

```js
    jobs: visibleJobs, totalCount: jobs.length, stageFilter, setStageFilter, tabs, queue, queries,
    visibleQueue, fitFilter, setFitFilter, fitCounts,
    sortBy, setSortBy, workTypeFilter, setWorkTypeFilter, workTypeCounts,
    distanceFilter, setDistanceFilter, distanceCounts,
```

- [ ] **Step 5: Verify nothing broke**

Run: `npm test`
Expected: PASS. (There is no dedicated test file for `useJobsStore.js` — it's a stateful React hook, outside this project's "pure list logic" testing layer per `CLAUDE.md`. This step confirms the lib-level tests from Tasks 1–4 still pass and nothing else regressed.)

Run: `npm run build`
Expected: build succeeds with no errors (catches any typo in the edits above, since `App.jsx` doesn't reference the new fields yet — that's fine, extra hook return fields are simply unused until Task 7).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useJobsStore.js
git commit -m "Wire sort/work-type/distance state into useJobsStore"
```

---

### Task 6: Add sort/filter UI to `ReviewQueue.jsx`

**Files:**
- Modify: `src/components/ReviewQueue.jsx`

**Interfaces:**
- Consumes: `SORT_OPTIONS`, `WORK_TYPE_FILTERS`, `DISTANCE_FILTERS` from `../lib/matchQueueFilters` (Tasks 2–4); new props `sortBy`, `onChangeSort`, `workTypeFilter`, `workTypeCounts`, `onChangeWorkTypeFilter`, `distanceFilter`, `distanceCounts`, `onChangeDistanceFilter` (wired by Task 7's `App.jsx` changes to the matching `useJobsStore` fields from Task 5).
- Produces: no new exports — this is a leaf component. The existing `FIT_FILTERS`-rendering markup is extracted into a local `FilterGroup` component (not exported) used three times in this file.

There's no component test harness in this project (no jsdom/testing-library — `CLAUDE.md` confirms pure list logic in `src/lib/*.js` is "the only tested layer"). Verification for this task is visual, done together with Task 7's browser check, since the new props need `App.jsx` wiring to actually reach this component with real values. This task's own "test" is a manual render-sanity pass with default prop values.

- [ ] **Step 1: Add the import**

In `src/components/ReviewQueue.jsx`, find:

```js
import { color, font, radius } from '../theme';
import MatchCard from './MatchCard';
import { FIT_FILTERS } from '../lib/matchFit';
```

Change to:

```js
import { color, font, radius } from '../theme';
import MatchCard from './MatchCard';
import { FIT_FILTERS } from '../lib/matchFit';
import { DISTANCE_FILTERS, SORT_OPTIONS, WORK_TYPE_FILTERS } from '../lib/matchQueueFilters';
```

- [ ] **Step 2: Add the shared `FilterGroup` component**

Add this new function above `export default function ReviewQueue(...)`, right after the `relativeTime` function:

```js
function FilterGroup({ label, options, activeId, counts, onChange, wide }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 4, padding: 3, borderRadius: radius.input, background: color.inputBg, border: `1px solid ${color.rowDivider}`, width: wide ? 'auto' : 'fit-content' }}>
      {options.map(option => {
        const active = activeId === option.id;
        return (
          <button key={option.id} type="button" aria-pressed={active} onClick={() => onChange(option.id)} style={{ flex: wide ? 1 : 'none', minHeight: 32, border: 'none', borderRadius: radius.badge, padding: '5px 10px', background: active ? color.cardBg : 'transparent', boxShadow: active ? '0 1px 3px rgba(24,56,67,0.12)' : 'none', color: active ? color.ink : color.textSecondary, font: `${active ? 650 : 500} 11px ${font.body}`, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {option.label} <span style={{ color: color.textMuted, font: `500 10px ${font.utility}` }}>{counts?.[option.id] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
```

This is the existing fit-row markup, generalized — the inline styles are copied verbatim from the current `FIT_FILTERS.map(...)` block so there is no visual change for the fit row itself.

- [ ] **Step 3: Update the component signature**

Find:

```js
export default function ReviewQueue({ queue, totalQueueCount = queue.length, fitFilter = 'all', fitCounts, onChangeFitFilter, latestRun, provider, providerConfigured, running, onRun, onSave, onDismiss, layoutMode }) {
```

Change to:

```js
export default function ReviewQueue({
  queue, totalQueueCount = queue.length,
  fitFilter = 'all', fitCounts, onChangeFitFilter,
  sortBy = 'score', onChangeSort,
  workTypeFilter = 'all', workTypeCounts, onChangeWorkTypeFilter,
  distanceFilter = 'all', distanceCounts, onChangeDistanceFilter,
  latestRun, provider, providerConfigured, running, onRun, onSave, onDismiss, layoutMode,
}) {
```

- [ ] **Step 4: Add the sort select next to the heading**

Find the header block:

```js
      <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'stretch' : 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ color: color.accent, font: `600 9.5px ${font.utility}`, letterSpacing: '1px', textTransform: 'uppercase' }}>Discovery review</div>
          <h1 id={!wide ? 'review-title' : undefined} style={{ margin: '5px 0 0', color: color.ink, font: `650 ${wide ? 20 : mobile ? 28 : 32}px ${font.heading}`, letterSpacing: '-0.5px' }}>New matches</h1>
          <div style={{ marginTop: 5, color: color.textSecondary, fontSize: 12.5, lineHeight: 1.45 }}>{providerConfigured ? `${totalQueueCount} match${totalQueueCount === 1 ? '' : 'es'} waiting for a decision.` : 'Configure the discovery provider to start reviewing matches.'}</div>
        </div>
        <button type="button" disabled={running || !providerConfigured} onClick={onRun} style={{ minHeight: 42, border: 'none', borderRadius: radius.input, background: running || !providerConfigured ? color.inputBorder : color.accent, color: color.onAccent, padding: '8px 13px', font: `600 11.5px ${font.body}`, cursor: running ? 'wait' : providerConfigured ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap' }}>{running ? 'Running…' : 'Run searches'}</button>
      </div>
```

Add this new block immediately after it (still before the status `div`):

```js

      {totalQueueCount && onChangeSort ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: color.textSecondary, alignSelf: mobile ? 'stretch' : 'flex-start' }}>
          Sort by
          <select value={sortBy} onChange={event => onChangeSort(event.target.value)} style={{ flex: mobile ? 1 : 'none', border: `1px solid ${color.inputBorder}`, borderRadius: radius.input, background: color.inputBg, color: color.ink, font: `600 11.5px ${font.body}`, padding: '6px 8px', minHeight: 32 }}>
            {SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
      ) : null}
```

- [ ] **Step 5: Replace the fit row and add the two new filter rows**

Find:

```js
      {totalQueueCount && onChangeFitFilter ? (
        <div role="group" aria-label="Filter matches by experience level" style={{ display: 'flex', gap: 4, padding: 3, borderRadius: radius.input, background: color.inputBg, border: `1px solid ${color.rowDivider}`, width: wide ? 'auto' : 'fit-content' }}>
          {FIT_FILTERS.map(option => {
            const active = fitFilter === option.id;
            return (
              <button key={option.id} type="button" aria-pressed={active} onClick={() => onChangeFitFilter(option.id)} style={{ flex: wide ? 1 : 'none', minHeight: 32, border: 'none', borderRadius: radius.badge, padding: '5px 10px', background: active ? color.cardBg : 'transparent', boxShadow: active ? '0 1px 3px rgba(24,56,67,0.12)' : 'none', color: active ? color.ink : color.textSecondary, font: `${active ? 650 : 500} 11px ${font.body}`, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {option.label} <span style={{ color: color.textMuted, font: `500 10px ${font.utility}` }}>{fitCounts?.[option.id] ?? 0}</span>
              </button>
            );
          })}
        </div>
      ) : null}
```

Replace with:

```js
      {totalQueueCount && onChangeFitFilter ? (
        <FilterGroup label="Filter matches by experience level" options={FIT_FILTERS} activeId={fitFilter} counts={fitCounts} onChange={onChangeFitFilter} wide={wide} />
      ) : null}
      {totalQueueCount && onChangeWorkTypeFilter ? (
        <FilterGroup label="Filter matches by work type" options={WORK_TYPE_FILTERS} activeId={workTypeFilter} counts={workTypeCounts} onChange={onChangeWorkTypeFilter} wide={wide} />
      ) : null}
      {totalQueueCount && onChangeDistanceFilter ? (
        <FilterGroup label="Filter matches by distance" options={DISTANCE_FILTERS} activeId={distanceFilter} counts={distanceCounts} onChange={onChangeDistanceFilter} wide={wide} />
      ) : null}
```

- [ ] **Step 6: Generalize the "emptied by filter" state**

Find:

```js
      {!queue.length && totalQueueCount ? <div style={{ border: `1px dashed ${color.dashedBorder}`, borderRadius: radius.card, padding: '22px 16px', textAlign: 'center' }}><div style={{ color: color.ink, font: `650 14px ${font.heading}` }}>No matches at this level</div><div style={{ marginTop: 4, fontSize: 11.5, color: color.textMuted }}>{totalQueueCount} other match{totalQueueCount === 1 ? '' : 'es'} hidden by this filter.</div><button type="button" onClick={() => onChangeFitFilter('all')} style={{ marginTop: 8, border: 'none', background: 'transparent', color: color.accent, font: `600 11.5px ${font.body}`, cursor: 'pointer' }}>Show all matches</button></div> : null}
```

Replace with:

```js
      {!queue.length && totalQueueCount ? <div style={{ border: `1px dashed ${color.dashedBorder}`, borderRadius: radius.card, padding: '22px 16px', textAlign: 'center' }}><div style={{ color: color.ink, font: `650 14px ${font.heading}` }}>No matches for these filters</div><div style={{ marginTop: 4, fontSize: 11.5, color: color.textMuted }}>{totalQueueCount} other match{totalQueueCount === 1 ? '' : 'es'} hidden by the current filters.</div><button type="button" onClick={() => { onChangeFitFilter?.('all'); onChangeWorkTypeFilter?.('all'); onChangeDistanceFilter?.('all'); }} style={{ marginTop: 8, border: 'none', background: 'transparent', color: color.accent, font: `600 11.5px ${font.body}`, cursor: 'pointer' }}>Clear filters</button></div> : null}
```

- [ ] **Step 7: Sanity-check the file parses and the app still builds**

Run: `npm run build`
Expected: build succeeds with no errors. (`App.jsx` doesn't pass the new props yet, so they'll be `undefined` at runtime until Task 7 — the `totalQueueCount && onChangeSort` / `onChangeWorkTypeFilter` / `onChangeDistanceFilter` guards mean those new rows simply don't render yet, which is expected and harmless.)

- [ ] **Step 8: Commit**

```bash
git add src/components/ReviewQueue.jsx
git commit -m "Add sort select and work-type/distance filter rows to ReviewQueue"
```

---

### Task 7: Thread new props through `App.jsx` and verify in the browser

**Files:**
- Modify: `src/App.jsx` (both `ReviewQueue` usages — the `wide && showPipeline` aside, and the `showReviewPage` narrow render)

**Interfaces:**
- Consumes: `store.sortBy`, `store.setSortBy`, `store.workTypeFilter`, `store.setWorkTypeFilter`, `store.workTypeCounts`, `store.distanceFilter`, `store.setDistanceFilter`, `store.distanceCounts` (Task 5).

- [ ] **Step 1: Update the narrow-layout `ReviewQueue` usage**

Find (inside the `showReviewPage ?` branch):

```jsx
        ) : showReviewPage ? (
          <ReviewQueue
            queue={store.visibleQueue}
            totalQueueCount={store.queue.length}
            fitFilter={store.fitFilter}
            fitCounts={store.fitCounts}
            onChangeFitFilter={store.setFitFilter}
            latestRun={store.latestRun}
            provider={store.provider}
            providerConfigured={store.providerConfigured}
            running={store.running}
            onRun={store.runScrape}
            onSave={store.saveToPipeline}
            onDismiss={store.dismissMatch}
            layoutMode={store.layoutMode}
          />
```

Change to:

```jsx
        ) : showReviewPage ? (
          <ReviewQueue
            queue={store.visibleQueue}
            totalQueueCount={store.queue.length}
            fitFilter={store.fitFilter}
            fitCounts={store.fitCounts}
            onChangeFitFilter={store.setFitFilter}
            sortBy={store.sortBy}
            onChangeSort={store.setSortBy}
            workTypeFilter={store.workTypeFilter}
            workTypeCounts={store.workTypeCounts}
            onChangeWorkTypeFilter={store.setWorkTypeFilter}
            distanceFilter={store.distanceFilter}
            distanceCounts={store.distanceCounts}
            onChangeDistanceFilter={store.setDistanceFilter}
            latestRun={store.latestRun}
            provider={store.provider}
            providerConfigured={store.providerConfigured}
            running={store.running}
            onRun={store.runScrape}
            onSave={store.saveToPipeline}
            onDismiss={store.dismissMatch}
            layoutMode={store.layoutMode}
          />
```

- [ ] **Step 2: Update the wide-layout `ReviewQueue` usage**

Find (the `{wide && showPipeline ? (...) : null}` block):

```jsx
      {wide && showPipeline ? (
        <ReviewQueue
          queue={store.visibleQueue}
          totalQueueCount={store.queue.length}
          fitFilter={store.fitFilter}
          fitCounts={store.fitCounts}
          onChangeFitFilter={store.setFitFilter}
          latestRun={store.latestRun}
          provider={store.provider}
          providerConfigured={store.providerConfigured}
          running={store.running}
          onRun={store.runScrape}
          onSave={store.saveToPipeline}
          onDismiss={store.dismissMatch}
          layoutMode={store.layoutMode}
        />
      ) : null}
```

Change to:

```jsx
      {wide && showPipeline ? (
        <ReviewQueue
          queue={store.visibleQueue}
          totalQueueCount={store.queue.length}
          fitFilter={store.fitFilter}
          fitCounts={store.fitCounts}
          onChangeFitFilter={store.setFitFilter}
          sortBy={store.sortBy}
          onChangeSort={store.setSortBy}
          workTypeFilter={store.workTypeFilter}
          workTypeCounts={store.workTypeCounts}
          onChangeWorkTypeFilter={store.setWorkTypeFilter}
          distanceFilter={store.distanceFilter}
          distanceCounts={store.distanceCounts}
          onChangeDistanceFilter={store.setDistanceFilter}
          latestRun={store.latestRun}
          provider={store.provider}
          providerConfigured={store.providerConfigured}
          running={store.running}
          onRun={store.runScrape}
          onSave={store.saveToPipeline}
          onDismiss={store.dismissMatch}
          layoutMode={store.layoutMode}
        />
      ) : null}
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 4: Manual browser verification**

Run: `npm run dev` (and, in another terminal, `npm run dev:server` if the API isn't already running).

In the browser, on the Pipeline view with the review sidebar visible (window ≥ 1280px wide so `layoutMode` is `wide`):
1. Confirm the "Sort by" dropdown appears next to "New matches", defaulted to "Best match", and switching it to "Newest" reorders the match cards by `publishedAt` descending.
2. Confirm two new pill rows appear below the existing experience-level row: "Work type" (All / Full-time / Part-time / Contract) and "Distance" (All / Nearby / Expanded area), each with count badges that sum sensibly against the total match count.
3. Pick a combination of filters that empties the list and confirm the "No matches for these filters" / "Clear filters" empty state appears, and that clicking "Clear filters" resets all three filters (fit, work type, distance) back to "All" and the list repopulates.
4. Resize the window below 1280px (or use the Review nav item on mobile/compact layout) to check the narrow-layout render of the same controls — rows should wrap instead of overflowing.
5. Toggle dark mode (via the theme toggle in the sidebar) and confirm the new controls pick up theme tokens correctly (no hardcoded colors breaking contrast).

If anything looks wrong, fix it in this task before committing — this is the only real functional check this feature gets, since there's no component test harness in this project.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "Thread sort/work-type/distance props through App.jsx to ReviewQueue"
```
