# Syracuse Discovery Queries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Waypoint's discovery feed return local Syracuse-area jobs by clearing orphaned listings, re-centering the saved queries on Syracuse, and searching more than one provider phrase per role family.

**Architecture:** Tasks 1-3 are code: widen the role-family synonym lists, add a `providerPhrases` helper that feeds Adzuna up to three phrases per family, and wrap the existing page loop in `searchRoleFamily` with a phrase loop. Tasks 4-6 are data and operations: delete the dead saved queries so the existing `expireOrphanedListings` cleanup fires, re-point the four live queries at Syracuse through `PATCH /api/queries/:id`, then deploy and verify. No schema change, no migration.

**Tech Stack:** Node 20+, Fastify 5, MariaDB 10.6+, `node:test` runner, Adzuna REST API.

**Spec:** `docs/superpowers/specs/2026-08-27-syracuse-discovery-queries-design.md`

**Status (2026-08-29):** Tasks 1-3 (code) are complete, committed, and green — `npm test`
passes 114/114. Tasks 4-6 remain: they are data and operations against the running
instance and the operator-owned `/etc/waypoint/waypoint.env`, not code, so they cannot be
finished by editing this repository.

## Global Constraints

- Test runner is built-in `node:test`. No Jest, no Vitest. Test files import source modules directly and **must use explicit `.js` extensions** in import paths.
- Full suite command is `npm test` (`node --test tests/*.test.js`). Single file: `node --test tests/<file>.test.js`.
- No linter or formatter is configured. Match surrounding style by hand.
- No schema changes and no new files in `server/db/migrations/`.
- `MAX_RADIUS_MILES` in `server/routes/queries.js` is **40**. No radius may exceed it.
- `maxAgeDays` is constrained to the enum `[1, 3, 7, 14, 30]`.
- Provider phrases per role family are capped at **3** (`PROVIDER_PHRASE_LIMIT`).
- Syracuse center, used verbatim wherever a center is written:
  `displayName: "City of Syracuse, Onondaga County, New York, United States"`,
  `latitude: 43.0481221`, `longitude: -76.1474244`, `provider: "nominatim"`, `placeId: "174916"`.
- Work happens on branch `feat/syracuse-discovery-queries`, already created.
- The API base for data tasks is `http://127.0.0.1:3000`.

---

### Task 1: Widen the role-family synonym lists

Adzuna only returns postings matching the phrase we send, and `evaluateListing` only accepts a listing whose **title** contains a family synonym. Both need more vocabulary. Synonym order is load-bearing: Task 2 takes the first three entries as the phrases sent to the provider, so each list is ordered with the three most productive, least redundant search phrases first.

**Files:**
- Modify: `server/discovery/roleFamilies.js:1-40` (the `ROLE_FAMILIES` object)
- Test: `tests/discovery-criteria.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ROLE_FAMILIES[id].synonyms` — a `string[]` of length >= 3 for every id in `ROLE_FAMILY_IDS`. `synonyms[0]` is unchanged for the three families existing tests assert on (`systems-administration`, `it-support`, `internet-service-installation`), so those `whatPhrase` assertions keep passing. `junior-systems-engineering[0]` deliberately changes from `'junior systems engineer'` to `'systems engineer'` — see Step 3. No test asserts that family's phrase directly.

- [x] **Step 1: Write the failing test**

Append to `tests/discovery-criteria.test.js`:

```js
test('gives every role family at least three distinct provider-ready synonyms', () => {
  for (const roleFamily of ROLE_FAMILY_IDS) {
    const { synonyms } = ROLE_FAMILIES[roleFamily];
    assert.ok(synonyms.length >= 3, `${roleFamily} has ${synonyms.length} synonyms`);
    assert.equal(new Set(synonyms.map(term => term.toLowerCase())).size, synonyms.length, roleFamily);
  }
});

test('matches the local technician titles this market actually posts', () => {
  const cases = [
    ['it-support', 'IT Technician'],
    ['it-support', 'Technical Support Specialist'],
    ['desktop-support', 'Field Service Technician'],
    ['network-administration', 'Network Technician'],
    ['it-operations', 'Data Center Technician'],
    ['cloud-support', 'Cloud Engineer'],
    ['junior-systems-engineering', 'Systems Engineer'],
    ['internet-service-installation', 'Installation Technician'],
  ];
  for (const [roleFamily, title] of cases) {
    const result = evaluateListing({
      query: query({ roleFamilies: [roleFamily] }),
      listing: listing({ title }),
      roleFamily,
      now: NOW,
    });
    assert.equal(result.accepted, true, `${roleFamily} rejected "${title}"`);
  }
});
```

`ROLE_FAMILIES` may not be imported in that file yet. Check the import line at the top and extend it so both `ROLE_FAMILIES` and `ROLE_FAMILY_IDS` come from `'../server/discovery/roleFamilies.js'`.

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/discovery-criteria.test.js`
Expected: FAIL. `cloud-support has 2 synonyms`, and several of the title cases assert `accepted` was `false`.

- [x] **Step 3: Replace the synonym lists**

In `server/discovery/roleFamilies.js`, replace the `synonyms` array of each family:

```js
  'systems-administration': {
    label: 'Systems administration',
    synonyms: [
      'systems administrator',
      'sysadmin',
      'IT administrator',
      'system administrator',
      'infrastructure administrator',
    ],
  },
  'it-support': {
    label: 'IT support',
    synonyms: [
      'IT support',
      'help desk',
      'IT technician',
      'service desk',
      'technical support',
      'support technician',
      'computer technician',
      'client support',
      'IT specialist',
    ],
  },
  'network-administration': {
    label: 'Network administration',
    synonyms: [
      'network administrator',
      'network engineer',
      'network technician',
      'network support',
      'network analyst',
      'network specialist',
    ],
  },
  'cloud-support': {
    label: 'Cloud support',
    synonyms: [
      'cloud support',
      'cloud engineer',
      'cloud administrator',
      'cloud operations',
      'Azure administrator',
      'AWS administrator',
    ],
  },
  'it-operations': {
    label: 'IT operations',
    synonyms: [
      'IT operations',
      'data center technician',
      'NOC technician',
      'infrastructure operations',
      'operations technician',
      'systems operations',
    ],
  },
  'desktop-support': {
    label: 'Desktop support',
    synonyms: [
      'desktop support',
      'desktop technician',
      'field service technician',
      'deskside support',
      'endpoint support',
      'PC technician',
    ],
  },
  'junior-systems-engineering': {
    label: 'Junior systems engineering',
    synonyms: [
      'systems engineer',
      'IT engineer',
      'infrastructure engineer',
      'junior systems engineer',
      'associate systems engineer',
      'systems engineer I',
    ],
  },
  'internet-service-installation': {
    label: 'Internet service installation',
    synonyms: [
      'cable installer',
      'broadband technician',
      'fiber technician',
      'internet service installer',
      'cable technician',
      'telecommunications installer',
      'telecom installer',
      'installation technician',
      'line technician',
      'field technician',
    ],
  },
```

Two ordering constraints that existing tests depend on — do not violate them:
- `systems-administration[0]` stays `'systems administrator'`.
- `it-support[0]` stays `'IT support'`.
- `internet-service-installation[0]` stays `'cable installer'`.

Note that `junior-systems-engineering` now leads with the broad `'systems engineer'` rather than `'junior systems engineer'`. That is deliberate: the narrow phrase returns a strict subset of the broad one's results, so spending a provider request on it is wasted. Seniority is handled by the query's `entry level` / `junior` / `associate` optional terms feeding the score, not by the search phrase.

- [x] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/discovery-criteria.test.js`
Expected: PASS, including the pre-existing `covers every published role family with a usable synonym list` and `accepts a local listing whose title matches the planned role family` (whose `matchedSynonyms` assertion of `['systems administrator', 'system administrator']` still holds, because `filter` preserves list order and neither `'sysadmin'` nor `'IT administrator'` tokenizes into the title `Systems Administrator`).

Run: `npm test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add server/discovery/roleFamilies.js tests/discovery-criteria.test.js
git commit -m "Widen role-family synonyms for the Syracuse market"
```

---

### Task 2: Send up to three provider phrases per role family

`adzunaParameters` currently hardcodes `synonyms[0]` as the phrase. Make the phrase an argument so the service can iterate, defaulting to the existing value so nothing regresses.

**Files:**
- Modify: `server/discovery/criteria.js:1-32`
- Modify: `server/scraper/adzuna.js:96-99` (the `search` method signature and its `adzunaParameters` call)
- Test: `tests/discovery-criteria.test.js`, `tests/adzuna.test.js`

**Interfaces:**
- Consumes: `ROLE_FAMILIES[roleFamily].synonyms` from Task 1.
- Produces:
  - `providerPhrases(roleFamily: string) => string[]` exported from `server/discovery/criteria.js`, returning at most `PROVIDER_PHRASE_LIMIT` (3) entries, always non-empty, always `synonyms.slice(0, 3)`.
  - `adzunaParameters(query, roleFamily, page, phrase?)` — `phrase` defaults to `providerPhrases(roleFamily)[0]`; the returned object's `whatPhrase` is that phrase.
  - `adzunaClient.search({ query, roleFamily, phrase, page })` — `phrase` is optional and forwarded to `adzunaParameters`.

- [x] **Step 1: Write the failing tests**

Append to `tests/discovery-criteria.test.js`:

```js
test('exposes at most three provider phrases per role family', () => {
  assert.deepEqual(providerPhrases('it-support'), ['IT support', 'help desk', 'IT technician']);
  assert.deepEqual(
    providerPhrases('internet-service-installation'),
    ['cable installer', 'broadband technician', 'fiber technician']
  );
  for (const roleFamily of ROLE_FAMILY_IDS) {
    const phrases = providerPhrases(roleFamily);
    assert.ok(phrases.length > 0 && phrases.length <= 3, roleFamily);
    assert.deepEqual(phrases, ROLE_FAMILIES[roleFamily].synonyms.slice(0, phrases.length));
  }
});

test('accepts an explicit provider phrase and defaults to the first one', () => {
  assert.equal(adzunaParameters(query(), 'it-support', 1).whatPhrase, 'IT support');
  assert.equal(adzunaParameters(query(), 'it-support', 1, 'help desk').whatPhrase, 'help desk');
});
```

Extend that file's import from `'../server/discovery/criteria.js'` to include `providerPhrases`.

Append to `tests/adzuna.test.js`:

```js
test('sends the requested provider phrase rather than the family default', async () => {
  const { client, calls } = capturingClient();
  await client.search({ query: auburnQuery, roleFamily: 'it-support', phrase: 'help desk' });

  assert.equal(calls[0].url.searchParams.get('what_phrase'), 'help desk');
  assert.equal(calls[0].url.searchParams.has('what_or'), false);
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/discovery-criteria.test.js tests/adzuna.test.js`
Expected: FAIL with `providerPhrases is not defined` (or an import error), and the Adzuna case sending `IT support` instead of `help desk`.

- [x] **Step 3: Implement**

In `server/discovery/criteria.js`, add the constant and helper, and take the new parameter:

```js
export const PROVIDER_PHRASE_LIMIT = 3;

// Adzuna returns only postings matching the single phrase we send, so one phrase per
// family makes whole title styles invisible. `what_or` is not a substitute: it matches
// individual tokens and floods recent pages with unrelated records. Issuing a few
// separate phrase searches is the only way to widen recall.
export function providerPhrases(roleFamily) {
  return ROLE_FAMILIES[roleFamily].synonyms.slice(0, PROVIDER_PHRASE_LIMIT);
}
```

Then change the signature and the `whatPhrase` line:

```js
export function adzunaParameters(query, roleFamily, page, phrase = providerPhrases(roleFamily)[0]) {
```

```js
    whatPhrase: phrase,
```

Delete the now-stale three-line comment above `whatPhrase` that begins `// Adzuna treats what_or as individual tokens` — its content has moved onto `providerPhrases`.

In `server/scraper/adzuna.js`, change the `search` method:

```js
    async search({ query, roleFamily, phrase, page = 1 }) {
      const parameters = adzunaParameters(query, roleFamily, page, phrase);
```

`adzunaParameters` applies its own default when `phrase` is `undefined`, so existing callers are unaffected.

- [x] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/discovery-criteria.test.js tests/adzuna.test.js`
Expected: PASS, including the untouched assertions `what_phrase === 'systems administrator'` and `what_phrase === 'IT support'`.

Run: `npm test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add server/discovery/criteria.js server/scraper/adzuna.js tests/discovery-criteria.test.js tests/adzuna.test.js
git commit -m "Let the provider phrase be chosen per search"
```

---

### Task 3: Search every provider phrase inside searchRoleFamily

Wrap the existing page loop in a phrase loop. All phrases for one family share that family's slice of the request budget, and the existing short-page break still applies per phrase.

**Files:**
- Modify: `server/discovery/service.js:79-121` (the `searchRoleFamily` function)
- Test: `tests/discovery-service.test.js`

**Interfaces:**
- Consumes: `providerPhrases` from Task 2; `adzunaClient.search({ query, roleFamily, phrase, page })`.
- Produces: no signature change. `searchRoleFamily` still returns `{ providerResultCount, pagesRequested, recordsReceived, acceptedMatches, truncated }`. `pagesRequested` now counts pages across all phrases for the family.

- [x] **Step 1: Write the failing test**

Append to `tests/discovery-service.test.js`:

```js
test('searches every provider phrase for a role family and deduplicates across them', async () => {
  const { pool } = fakePool();
  const requested = [];
  const { service } = harness({
    pool,
    search: async ({ phrase, page: requestedPage }) => {
      requested.push(`${phrase}:${requestedPage}`);
      return page([listing(1)]);
    },
    discovery: { runRequestBudget: 20, maxPagesPerFamily: 3, persistedMatchTarget: 500 },
  });

  await service.runAll('scheduled');

  assert.deepEqual(requested, [
    'systems administrator:1',
    'sysadmin:1',
    'IT administrator:1',
  ]);
});

test('stops searching later phrases once the request budget runs out', async () => {
  const { pool } = fakePool();
  const requested = [];
  const { service, finishedQueries } = harness({
    pool,
    search: async ({ phrase }) => { requested.push(phrase); return page([]); },
    discovery: { runRequestBudget: 2, maxPagesPerFamily: 3, persistedMatchTarget: 500 },
  });

  await service.runAll('scheduled');

  assert.deepEqual(requested, ['systems administrator', 'sysadmin']);
  assert.equal(finishedQueries[0].truncated, true);
  assert.ok(finishedQueries[0].unsearchedRequests >= 1);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test tests/discovery-service.test.js`
Expected: FAIL. The first new test sees `requested` as `['undefined:1']` because `phrase` is not yet forwarded.

- [x] **Step 3: Implement the phrase loop**

Add `providerPhrases` to the existing import from `'./criteria.js'` at the top of `server/discovery/service.js`, then replace the body of `searchRoleFamily` with:

```js
  // One page loop drives both preview and persisted runs. `onAccepted` decides what
  // happens with a match; everything else — budgets, paging, diagnostics — is shared.
  // Phrases are searched in sequence because Adzuna returns only records matching the
  // one phrase per request; they share the family's budget rather than multiplying it.
  async function searchRoleFamily({ query, roleFamily, budget, counters, accepted, matchTarget, at, onAccepted }) {
    const familyCounters = { providerResultCount: 0, pagesRequested: 0, recordsReceived: 0, acceptedMatches: 0 };
    let truncated = false;
    let exhausted = false;

    for (const phrase of providerPhrases(roleFamily)) {
      if (exhausted) break;

      for (let page = 1; page <= limits.maxPagesPerFamily; page += 1) {
        if (budget.remaining <= 0) {
          counters.unsearchedRequests += 1;
          truncated = true;
          exhausted = true;
          break;
        }
        budget.remaining -= 1;
        counters.pagesRequested += 1;
        familyCounters.pagesRequested += 1;

        const response = await adzunaClient.search({ query, roleFamily, phrase, page });
        counters.providerResultCount = Math.max(counters.providerResultCount, response.providerCount ?? 0);
        familyCounters.providerResultCount = Math.max(familyCounters.providerResultCount, response.providerCount ?? 0);
        counters.recordsReceived += response.results.length;
        familyCounters.recordsReceived += response.results.length;
        counters.malformedRecords += response.malformedCount ?? 0;

        for (const listing of response.results) {
          const evaluation = evaluateListing({ query, listing, roleFamily, now: at });
          if (!evaluation.accepted) {
            counters[REJECT_COUNTERS[evaluation.rejectReason] ?? 'malformedRecords'] += 1;
            continue;
          }
          familyCounters.acceptedMatches += 1;
          await onAccepted(listing, evaluation);
        }

        if (accepted.size >= matchTarget) {
          // Stopping on target still leaves provider results unseen.
          truncated = true;
          exhausted = true;
          break;
        }
        if (response.results.length < (response.pageSize ?? response.results.length)) break;
        if (page === limits.maxPagesPerFamily) truncated = true;
      }
    }

    if (truncated) counters.truncated = true;
    return { ...familyCounters, truncated };
  }
```

Deduplication needs no new code: `onAccepted` keys on `listing.providerJobId` in both the preview `Map` and the run `Set`, so a posting returned by two phrases is recorded once.

- [x] **Step 4: Update the three existing tests that count requests**

Three pre-existing tests assert request counts that were written when one family meant one phrase. Their intent is unchanged; only the expected counts move.

In `tests/discovery-service.test.js`, `preview returns ranked samples, writes nothing, and reports diagnostics` — the stub returns the same three records for each of the three phrases, so every received-record counter triples while `newMatches` stays 1 through deduplication:

```js
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].title, 'Systems Administrator');
  assert.equal(result.diagnostics.recordsReceived, 9);
  assert.equal(result.diagnostics.rejectedTerms, 3);
  assert.equal(result.diagnostics.rejectedAge, 3);
  assert.equal(result.diagnostics.newMatches, 1);
```

In `requests the next page after a full page and stops after a short one`, each phrase pages independently:

```js
  assert.deepEqual(requested, [1, 2, 1, 2, 1, 2]);
```

In `stops at the per-family page cap and reports truncation`, each phrase hits the three-page cap:

```js
  assert.deepEqual(requested, [1, 2, 3, 1, 2, 3, 1, 2, 3]);
```

Leave `shares one request budget across role families and records unsearched work` and `runs a single enabled search under the per-query budget` alone — both assert `requested.length` against a budget of 2 and 1 respectively, which the phrase loop does not change.

- [x] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS. If another test fails on a request count, read its stub and expected value and apply the same reasoning — phrase count multiplies requests, deduplication keeps persisted matches flat.

- [x] **Step 6: Commit**

```bash
git add server/discovery/service.js tests/discovery-service.test.js
git commit -m "Search each provider phrase within the family request budget"
```

---

### Task 4: Clear the stale out-of-area feed

No code. `queryRepository.remove()` already deletes the query, cascades `listing_queries` via the `ON DELETE CASCADE` foreign key, and calls `expireOrphanedListings()`, which flips any listing left with no query association and `status = 'new'` to `'expired'`. Saved and dismissed rows are untouched by that `WHERE` clause.

**Files:** none. This task operates on the running instance's data.

**Interfaces:**
- Consumes: nothing.
- Produces: a review queue containing only listings attributable to a live query.

- [ ] **Step 1: Record the before state**

```bash
curl -s "http://127.0.0.1:3000/api/listings?pageSize=100" | python3 -c "import json,sys; print('total', json.load(sys.stdin)['total'])"
```

Expected: `total 231`. If the number differs, that is fine — a scrape may have run since. Note the value.

- [ ] **Step 2: Delete the five dead queries**

```bash
for id in cc3c4775-ac31-4117-a7d8-84d09b4bec05 \
          10000000-0000-4000-8000-000000000002 \
          10000000-0000-4000-8000-000000000003 \
          10000000-0000-4000-8000-000000000001 \
          10000000-0000-4000-8000-000000000004; do
  curl -s -X DELETE "http://127.0.0.1:3000/api/queries/$id" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('query',{}).get('name') or d)"
done
```

Expected output, one name per line:

```
All
IT support · Madison · <14 days
Network admin · hybrid · <14 days
Sysadmin · remote · <7 days
Auburn IT Support
```

If any call returns `{"error":{"code":"RUN_IN_PROGRESS",...}}`, a scrape holds the `waypoint:scrape` advisory lock. Wait for it to finish and re-run only the ids that failed — deletion is not idempotent, and a second attempt on an already-deleted id returns `404 QUERY_NOT_FOUND`, which is harmless.

- [ ] **Step 3: Verify the feed is clear of orphans**

```bash
curl -s "http://127.0.0.1:3000/api/listings?pageSize=100" | python3 -c "
import json,sys,collections
d=json.load(sys.stdin)
print('total', d['total'])
print(collections.Counter(i['distanceBand'] for i in d['items']))
print(collections.Counter(m['name'] for i in d['items'] for m in i['matchedQueries']))
"
```

Expected: `total` around 10, no `unknown` band entries, and only the four Auburn query names remaining. The 221 orphans are now `status = 'expired'` and no longer in the default `status = 'new'` feed.

- [ ] **Step 4: Confirm saved and dismissed decisions survived**

```bash
for s in saved dismissed; do
  curl -s "http://127.0.0.1:3000/api/listings?status=$s&pageSize=100" \
    | python3 -c "import json,sys; print('$s', json.load(sys.stdin)['total'])"
done
```

Expected: the same totals as before Step 2. Record them beforehand if you want a strict comparison.

- [ ] **Step 5: Commit**

Nothing to commit — this task changes data, not files. Skip.

---

### Task 5: Re-center the four live queries on Syracuse

Updated in place with `PATCH` rather than deleted and recreated, so query ids stay stable and `scrape_run_queries` history survives the change.

Editing criteria triggers `clearPendingMatches`, which drops undecided `listing_queries` rows for the edited query and expires the resulting orphans. The ten Auburn-attributed listings will therefore disappear from the feed and be rediscovered against the Syracuse center on the next run. **Save anything in the current feed you want to keep before starting this task** — saved listings are exempt from the cleanup.

**Files:** none. Data only.

**Interfaces:**
- Consumes: the deletions from Task 4 (`cloud-support` is only free to move once `Auburn IT Support` is gone).
- Produces: four enabled queries centered on Syracuse covering all eight role families.

- [ ] **Step 1: Confirm the center resolves**

```bash
curl -s -X POST http://127.0.0.1:3000/api/queries/resolve-location \
  -H 'content-type: application/json' -d '{"query":"Syracuse, NY"}'
```

Expected: one candidate, `City of Syracuse, Onondaga County, New York, United States`, latitude `43.0481221`, longitude `-76.1474244`, placeId `174916`. If the geocoder returns something else, use what it returns rather than the literal above — Nominatim is the source of truth for the center.

- [ ] **Step 2: Patch all four queries**

```bash
CENTER='{"displayName":"City of Syracuse, Onondaga County, New York, United States","latitude":43.0481221,"longitude":-76.1474244,"provider":"nominatim","placeId":"174916"}'

patch() {
  curl -s -X PATCH "http://127.0.0.1:3000/api/queries/$1" \
    -H 'content-type: application/json' -d "$2" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); q=d.get('query'); print(q['name'],'|',q['center']['displayName'],'|',q['preferredRadiusMiles'],q['maximumRadiusMiles'],'|',','.join(q['roleFamilies'])) if q else print(d)"
}

patch f5e90f3e-0fbf-4e88-84f6-acf60ae7d69b "{
  \"name\":\"Syracuse Help Desk & Desktop Support\",
  \"center\":$CENTER,
  \"preferredRadiusMiles\":25,\"maximumRadiusMiles\":40,
  \"roleFamilies\":[\"it-support\",\"desktop-support\"],
  \"optionalTerms\":[\"help desk\",\"service desk\",\"tier 1\",\"entry level\"],
  \"excludedTerms\":[],\"maxAgeDays\":14,\"enabled\":true}"

patch 9ff96465-4948-48d7-b027-9e5fcd199ad7 "{
  \"name\":\"Syracuse Systems & Network Infrastructure\",
  \"center\":$CENTER,
  \"preferredRadiusMiles\":25,\"maximumRadiusMiles\":40,
  \"roleFamilies\":[\"systems-administration\",\"network-administration\"],
  \"optionalTerms\":[\"Windows Server\",\"VMware\",\"Cisco\",\"Azure\",\"Active Directory\"],
  \"excludedTerms\":[],\"maxAgeDays\":30,\"enabled\":true}"

patch d454db9d-ca67-4e4b-89bb-8992fe1026fb "{
  \"name\":\"Syracuse Entry-Level IT, Cloud & Ops\",
  \"center\":$CENTER,
  \"preferredRadiusMiles\":25,\"maximumRadiusMiles\":40,
  \"roleFamilies\":[\"it-operations\",\"junior-systems-engineering\",\"cloud-support\"],
  \"optionalTerms\":[\"entry level\",\"junior\",\"associate\",\"trainee\"],
  \"excludedTerms\":[],\"maxAgeDays\":30,\"enabled\":true}"

patch 21ab3614-5839-49dd-891c-2b5323b56608 "{
  \"name\":\"Syracuse Internet & Fiber Installation\",
  \"center\":$CENTER,
  \"preferredRadiusMiles\":25,\"maximumRadiusMiles\":40,
  \"roleFamilies\":[\"internet-service-installation\"],
  \"optionalTerms\":[\"broadband\",\"fiber\",\"internet\",\"cable\",\"entry level\"],
  \"excludedTerms\":[\"HVAC\",\"solar\",\"appliance\"],
  \"maxAgeDays\":30,\"enabled\":true}"
```

Expected: four lines, each naming a Syracuse query with center `City of Syracuse, ...`, radii `25 40`, and the listed role families.

- [ ] **Step 3: Verify the whole query set**

```bash
curl -s http://127.0.0.1:3000/api/queries | python3 -c "
import json,sys
qs=json.load(sys.stdin)['queries']
fams=set()
for q in qs:
    print(('ON ' if q['enabled'] else 'off'), q['name'], '|', q['center']['displayName'], '|', q['preferredRadiusMiles'], q['maximumRadiusMiles'])
    if q['enabled']: fams |= set(q['roleFamilies'])
print('families covered:', len(fams), sorted(fams))
"
```

Expected: exactly four queries, all `ON`, all centered on Syracuse, and `families covered: 8`.

- [ ] **Step 4: Preview one query against the live provider**

```bash
curl -s -X POST http://127.0.0.1:3000/api/queries/preview \
  -H 'content-type: application/json' -d "{
    \"center\":{\"displayName\":\"City of Syracuse, Onondaga County, New York, United States\",\"latitude\":43.0481221,\"longitude\":-76.1474244,\"provider\":\"nominatim\",\"placeId\":\"174916\"},
    \"preferredRadiusMiles\":25,\"maximumRadiusMiles\":40,
    \"roleFamilies\":[\"it-support\"],\"maxAgeDays\":30}" \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(json.dumps(d['diagnostics']))
for r in d['results']: print(' -', r['title'],'|',r['location'],'|',r['distanceMiles'],r['distanceBand'])
"
```

Expected: several results in Syracuse, East Syracuse, or DeWitt with `distanceBand: "preferred"` and distances under 6 miles. A prior run of this exact preview returned 6 matches from 30 provider records. This preview costs provider requests but writes nothing.

- [ ] **Step 5: Commit**

Nothing to commit — data only. Skip.

---

### Task 6: Raise the request budgets, deploy, and verify

**Files:**
- Modify (by the operator, outside this session's permissions): `/etc/waypoint/waypoint.env`

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: a deployed instance whose scheduled runs search three phrases per family without truncating.

- [ ] **Step 1: Raise the budgets**

Tasks 1-3 take a full run from 8 provider requests to **24 at minimum and 72 at maximum** — eight role families, three phrases each, up to `DISCOVERY_MAX_PAGES_PER_FAMILY` (3) pages per phrase. An earlier draft of this step said "roughly 24"; that counted only the minimum and was wrong.

**This step must be done by the user.** `/etc/waypoint/waypoint.env` is not readable or writable from this session. Ask them to set all three:

```
DISCOVERY_RUN_REQUEST_BUDGET=72
DISCOVERY_QUERY_REQUEST_BUDGET=18
DISCOVERY_PREVIEW_REQUEST_BUDGET=27
```

Current defaults are `20`, `12`, and `8` (`server/config.js`). The preview budget matters as much as the other two: the preview shares the same phrase loop, and at `8` a three-family query truncates before the third family gets a single request.

Without these, runs report `truncated: true` and silently skip role families. Starvation is silent — neither `truncated` nor `unsearchedRequests` is surfaced in the UI or any route, so the only symptom is a thin feed. Lowering `DISCOVERY_MAX_PAGES_PER_FAMILY` to `2` is a reasonable alternative to the largest budget, bounding per-family cost at six requests. Adzuna's free tier accommodates either.

See "Operator Follow-Up" in the spec for the full table and rationale.

- [ ] **Step 2: Confirm the suite and build are green**

```bash
npm test && npm run build
```

Expected: all tests pass, Vite build succeeds.

- [ ] **Step 3: Deploy**

The live instance runs from `/opt/waypoint/current`, a symlink into `/opt/waypoint/releases/`. Deployment is root-owned and outside this session's permissions. Hand the branch to the user and let them deploy and restart `waypoint.service`, or confirm with them how they want it rolled out.

- [ ] **Step 4: Trigger a run and read the diagnostics**

```bash
curl -s -X POST http://127.0.0.1:3000/api/scrape-runs | python3 -m json.tool
```

Expected: a run summary with `truncated: false`, a non-zero `newMatches`, and `pagesRequested` around 24. If `truncated` is `true` and `unsearchedRequests` is above zero, Step 1 was not applied.

- [ ] **Step 5: Confirm the feed is local**

```bash
curl -s "http://127.0.0.1:3000/api/listings?pageSize=100" | python3 -c "
import json,sys,collections
d=json.load(sys.stdin)
print('total', d['total'])
print(collections.Counter(i['distanceBand'] for i in d['items']))
for i in d['items'][:15]: print(' -', i['title'],'|',i['location'],'|',i['distanceMiles'])
"
```

Expected: listings concentrated in Onondaga and Cayuga counties, a meaningful share in the `preferred` band, and no Madison, Phoenix, or Anchorage entries.

- [ ] **Step 6: Commit and open a pull request**

```bash
git push -u origin feat/syracuse-discovery-queries
gh pr create --title "Re-center discovery on Syracuse and widen provider phrases" --body "$(cat <<'BODY'
## Summary

The discovery feed was returning mostly out-of-area jobs. 221 of 231 queued listings
were orphans of three long-disabled seed queries, all with an unknown distance band
that bypasses the radius filter. The Auburn center also cost a 20-mile penalty against
a market that is really in Syracuse.

- Widened the role-family synonym lists to the technician titles this market posts.
- Added `providerPhrases`, capped at 3, and made the Adzuna phrase a per-search argument.
- `searchRoleFamily` now loops phrases within the family's existing request budget,
  deduplicating on `providerJobId`.

Saved queries were re-centered on Syracuse (25 preferred / 40 maximum) and the dead seed
queries deleted, which let the existing `expireOrphanedListings` cleanup clear the feed.
Those are data changes against the running instance, not code.

## Test plan

- `npm test` and `npm run build` pass.
- A live preview centered on Syracuse returns matches in the `preferred` band at 0-6 miles.

## Operator note

`DISCOVERY_RUN_REQUEST_BUDGET`, `DISCOVERY_QUERY_REQUEST_BUDGET`, and
`DISCOVERY_PREVIEW_REQUEST_BUDGET` in `/etc/waypoint/waypoint.env` must be raised to
72, 18, and 27, or runs will truncate and silently skip role families.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

Only run this once the user has confirmed they want the branch pushed.
