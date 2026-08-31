import { AppError, sanitizeError } from '../errors.js';
import { withConnection, withTransaction } from '../db/pool.js';
import { persistMatch } from '../db/discoveryRepository.js';
import { buildRoleFamilyPlan } from './criteria.js';
import { evaluateListing } from './evaluateListing.js';
import { createRequestBudget } from './budget.js';

const MINUTE = 60_000;
const DAY = 86_400_000;
const PREVIEW_SAMPLE_TARGET = 10;
const MANUAL_COOLDOWN_MINUTES = 15;
const STALE_RUN_MINUTES = 30;
const EXPIRY_DAYS = 30;

const REJECT_COUNTERS = Object.freeze({
  age: 'rejectedAge',
  distance: 'rejectedDistance',
  terms: 'rejectedTerms',
  salary: 'rejectedSalary',
  'remote-only': 'rejectedRemoteOnly',
  malformed: 'malformedRecords',
});

const REOPENING_OUTCOMES = new Set(['new', 'expired-reopened']);
const OUTCOME_COUNTERS = Object.freeze({
  'duplicate-new': 'duplicates',
  'previously-saved': 'previouslySaved',
  'previously-dismissed': 'previouslyDismissed',
});

function sqlDate(date) {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

export function emptyCounters() {
  return {
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
  };
}

function emptyFamilyCounters() {
  return { providerResultCount: 0, pagesRequested: 0, recordsReceived: 0, acceptedMatches: 0 };
}

function hasResolvedCenter(query) {
  return Number.isFinite(query.center?.latitude) && Number.isFinite(query.center?.longitude);
}

// `provider_job_id` is unique only within a provider, so two providers may legitimately
// issue the same id for unrelated postings. Everything that deduplicates accepted matches
// keys on the pair.
function listingKey(listing) {
  return `${listing.provider}:${listing.providerJobId}`;
}

export function createDiscoveryService({
  pool,
  queryRepository,
  listingRepository,
  runRepository,
  discoveryRepository,
  providers,
  logger,
  discovery,
  now = () => new Date(),
}) {
  const limits = {
    runRequestBudget: discovery?.runRequestBudget ?? 20,
    queryRequestBudget: discovery?.queryRequestBudget ?? 12,
    previewRequestBudget: discovery?.previewRequestBudget ?? 8,
    maxPagesPerFamily: discovery?.maxPagesPerFamily ?? 3,
    persistedMatchTarget: discovery?.persistedMatchTarget ?? 50,
  };

  // One page loop drives both preview and persisted runs. `onAccepted` decides what
  // happens with a match; everything else — budgets, paging, diagnostics — is shared.
  // Each provider supplies its own request plan for the family rather than being driven
  // through a phrase list, because how a query decomposes into requests is the provider's
  // concern; requests within a plan share the provider's budget rather than multiplying it.
  async function searchRoleFamily({ query, roleFamily, budget, counters, accepted, matchTarget, at, onAccepted, familyCounters }) {
    let truncated = false;

    for (const provider of providers) {
      let exhausted = false;

      for (const request of provider.planRoleFamily({ query, roleFamily })) {
        if (exhausted) break;

        for (let page = 1; page <= limits.maxPagesPerFamily; page += 1) {
          if (!budget.take(provider.id)) {
            counters.unsearchedRequests += 1;
            truncated = true;
            exhausted = true;
            break;
          }

          // Counted only once the request actually completes, so a family that throws
          // mid-request (see runOneQuery's catch) reports the work it truly finished.
          const response = await provider.search({ query, roleFamily, page, ...request });
          counters.pagesRequested += 1;
          familyCounters.pagesRequested += 1;
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

      // Enough matches is enough regardless of which provider supplied them; the
      // remaining providers keep their budget for a later family.
      if (accepted.size >= matchTarget) break;
    }

    if (truncated) counters.truncated = true;
    return { ...familyCounters, truncated };
  }

  async function acquireLock(connection, message) {
    const lock = await connection.query("SELECT GET_LOCK('waypoint:scrape', 0) AS acquired");
    if (Number(lock[0].acquired) !== 1) throw new AppError(409, 'RUN_IN_PROGRESS', message);
  }

  async function preview(criteria) {
    if (!hasResolvedCenter(criteria)) {
      throw new AppError(400, 'QUERY_LOCATION_UNRESOLVED', 'Confirm a search location before previewing');
    }
    const at = now();
    return withConnection(pool, async connection => {
      await acquireLock(connection, 'A discovery run is already in progress');
      try {
        const counters = emptyCounters();
        const budget = createRequestBudget(limits.previewRequestBudget, providers);
        const accepted = new Map();

        for (const { roleFamily } of buildRoleFamilyPlan(criteria)) {
          if (accepted.size >= PREVIEW_SAMPLE_TARGET || budget.exhausted()) {
            counters.unsearchedRequests += 1;
            counters.truncated = true;
            continue;
          }
          await searchRoleFamily({
            query: criteria,
            roleFamily,
            budget,
            counters,
            accepted,
            matchTarget: PREVIEW_SAMPLE_TARGET,
            at,
            familyCounters: emptyFamilyCounters(),
            onAccepted: (listing, evaluation) => {
              if (!accepted.has(listingKey(listing))) {
                accepted.set(listingKey(listing), { listing, evaluation });
              }
            },
          });
        }

        // Preview never writes, so duplicate and decision counts come from a read-only
        // lookup. It is scoped per provider because `provider_job_id` is only unique
        // within one — querying another provider's ids would match the wrong rows.
        const statuses = new Map();
        for (const provider of providers) {
          const providerJobIds = [...accepted.values()]
            .filter(({ listing }) => listing.provider === provider.id)
            .map(({ listing }) => listing.providerJobId);
          if (providerJobIds.length === 0) continue;
          const found = await discoveryRepository.statusesByProviderId(provider.id, providerJobIds);
          for (const [providerJobId, status] of found) {
            statuses.set(`${provider.id}:${providerJobId}`, status);
          }
        }
        for (const status of statuses.values()) {
          if (status === 'new') counters.duplicates += 1;
          else if (status === 'saved') counters.previouslySaved += 1;
          else if (status === 'dismissed') counters.previouslyDismissed += 1;
        }
        counters.newMatches = accepted.size - statuses.size;

        const results = [...accepted.values()]
          .sort((left, right) => right.evaluation.score - left.evaluation.score
            || right.listing.publishedAt.localeCompare(left.listing.publishedAt))
          .slice(0, PREVIEW_SAMPLE_TARGET)
          .map(({ listing, evaluation }) => ({
            title: listing.title,
            company: listing.company,
            location: listing.location,
            url: listing.url,
            publishedAt: listing.publishedAt,
            salaryMin: listing.salaryMin,
            salaryMax: listing.salaryMax,
            score: evaluation.score,
            distanceMiles: evaluation.distanceMiles,
            distanceBand: evaluation.distanceBand,
            matchedRoleFamilies: evaluation.matchedRoleFamilies,
            matchFacts: evaluation.matchFacts,
            status: statuses.get(listingKey(listing)) ?? null,
          }));

        return { results, diagnostics: counters };
      } finally {
        await connection.query("SELECT RELEASE_LOCK('waypoint:scrape')");
      }
    });
  }

  async function runOneQuery({ query, lockConnection, runId, budget, at }) {
    const counters = emptyCounters();
    const accepted = new Set();
    const queryStarted = now();
    const errors = [];
    let familiesSucceeded = 0;
    const plan = buildRoleFamilyPlan(query);

    for (const { roleFamily } of plan) {
      const familyStarted = now();
      if (accepted.size >= limits.persistedMatchTarget || budget.exhausted()) {
        counters.unsearchedRequests += 1;
        counters.truncated = true;
        continue;
      }
      // Hoisted so a mid-family provider failure (caught below) can still report the
      // requests and matches that completed before the error, rather than zeros.
      const familyCounters = emptyFamilyCounters();
      try {
        const { truncated } = await searchRoleFamily({
          query,
          roleFamily,
          budget,
          counters,
          accepted,
          matchTarget: limits.persistedMatchTarget,
          at,
          familyCounters,
          onAccepted: async (listing, evaluation) => {
            if (accepted.has(listingKey(listing))) {
              counters.duplicates += 1;
              return;
            }
            const { outcome } = await withTransaction(pool, connection => persistMatch(connection, {
              listing, queryId: query.id, evaluation, seenAt: sqlDate(at),
            }));
            accepted.add(listingKey(listing));
            if (REOPENING_OUTCOMES.has(outcome)) counters.newMatches += 1;
            else counters[OUTCOME_COUNTERS[outcome]] += 1;
          },
        });
        familiesSucceeded += 1;
        await runRepository.addSearchResult(lockConnection, {
          runId, queryId: query.id, roleFamily, status: truncated ? 'partial' : 'success',
          providerResultCount: familyCounters.providerResultCount,
          pagesRequested: familyCounters.pagesRequested,
          recordsReceived: familyCounters.recordsReceived,
          acceptedMatches: familyCounters.acceptedMatches,
          truncated, errorMessage: null,
          startedAt: sqlDate(familyStarted), finishedAt: sqlDate(now()),
        });
      } catch (error) {
        const message = sanitizeError(error);
        errors.push(`${query.name} / ${roleFamily}: ${message}`);
        // Some requests may have completed before the failure; report that real progress
        // as 'partial' instead of erasing it. Only a family that never got a response
        // (zero completed page requests) is truly 'failed'.
        const status = familyCounters.pagesRequested > 0 ? 'partial' : 'failed';
        await runRepository.addSearchResult(lockConnection, {
          runId, queryId: query.id, roleFamily, status,
          providerResultCount: familyCounters.providerResultCount,
          pagesRequested: familyCounters.pagesRequested,
          recordsReceived: familyCounters.recordsReceived,
          acceptedMatches: familyCounters.acceptedMatches,
          truncated: false, errorMessage: message,
          startedAt: sqlDate(familyStarted), finishedAt: sqlDate(now()),
        });
        logger.error('discovery.family.failed', { runId, queryId: query.id, roleFamily, message });
      }
    }

    const status = familiesSucceeded === plan.length ? 'success' : familiesSucceeded === 0 ? 'failed' : 'partial';
    await runRepository.finishQuery(lockConnection, {
      runId, queryId: query.id, queryName: query.name, status,
      listingsFetched: counters.recordsReceived, newMatches: counters.newMatches,
      errorMessage: errors.length ? errors.join('; ').slice(0, 500) : null,
      startedAt: sqlDate(queryStarted), finishedAt: sqlDate(now()),
      ...counters,
    });

    return { status, counters, errors };
  }

  async function run({ trigger, queryIds }) {
    const started = now();
    if (trigger === 'manual') {
      const recent = await runRepository.recentManual(sqlDate(new Date(started.getTime() - MANUAL_COOLDOWN_MINUTES * MINUTE)));
      if (recent) throw new AppError(429, 'RUN_COOLDOWN', 'Manual discovery can run once every 15 minutes');
    }

    let selected;
    if (queryIds) {
      selected = [];
      for (const queryId of queryIds) {
        const query = await queryRepository.get(queryId);
        if (!query) throw new AppError(404, 'QUERY_NOT_FOUND', 'Saved search not found');
        if (!query.enabled) throw new AppError(409, 'QUERY_DISABLED', 'Enable this saved search before running it');
        if (!hasResolvedCenter(query)) {
          throw new AppError(409, 'QUERY_LOCATION_UNRESOLVED', 'Confirm this search location before running it');
        }
        selected.push(query);
      }
    }

    return withConnection(pool, async lockConnection => {
      await acquireLock(lockConnection, 'A discovery run is already in progress');
      let runId;
      let succeeded = 0;
      let fetched = 0;
      let newMatches = 0;
      const errors = [];
      try {
        await runRepository.recoverStale(sqlDate(new Date(started.getTime() - STALE_RUN_MINUTES * MINUTE)));
        const queries = selected ?? await queryRepository.list({ enabledOnly: true });
        runId = await runRepository.create(lockConnection, trigger, queries.length, sqlDate(started));
        logger.info('discovery.started', { runId, trigger, queries: queries.length });

        const budget = createRequestBudget(queryIds ? limits.queryRequestBudget : limits.runRequestBudget, providers);

        for (const query of queries) {
          // A scheduled run must not abandon later searches because one is unresolved.
          if (!hasResolvedCenter(query)) {
            const message = 'Search location is not confirmed';
            errors.push(`${query.name}: ${message}`);
            await runRepository.finishQuery(lockConnection, {
              runId, queryId: query.id, queryName: query.name, status: 'failed',
              listingsFetched: 0, newMatches: 0, errorMessage: message,
              startedAt: sqlDate(now()), finishedAt: sqlDate(now()), ...emptyCounters(),
            });
            continue;
          }

          const outcome = await runOneQuery({ query, lockConnection, runId, budget, at: started });
          if (outcome.status !== 'failed') succeeded += 1;
          fetched += outcome.counters.recordsReceived;
          newMatches += outcome.counters.newMatches;
          errors.push(...outcome.errors);
          logger.info('discovery.query.complete', {
            runId, queryId: query.id, status: outcome.status, newMatches: outcome.counters.newMatches,
          });
        }

        await listingRepository.expire(lockConnection, sqlDate(new Date(started.getTime() - EXPIRY_DAYS * DAY)));
        const status = queries.length === 0 || succeeded === queries.length
          ? 'success'
          : succeeded === 0 ? 'failed' : 'partial';
        const summary = await runRepository.finish(lockConnection, runId, {
          status,
          finishedAt: sqlDate(now()),
          queriesSucceeded: succeeded,
          listingsFetched: fetched,
          newMatches,
          errorSummary: errors.length ? errors.join('; ').slice(0, 2000) : null,
        });
        logger.info('discovery.finished', { runId, status, fetched, newMatches });
        return summary;
      } catch (error) {
        if (runId) {
          errors.push(sanitizeError(error));
          await runRepository.finish(lockConnection, runId, {
            status: succeeded > 0 ? 'partial' : 'failed', finishedAt: sqlDate(now()),
            queriesSucceeded: succeeded, listingsFetched: fetched, newMatches,
            errorSummary: errors.join('; ').slice(0, 2000),
          });
        }
        throw error;
      } finally {
        await lockConnection.query("SELECT RELEASE_LOCK('waypoint:scrape')");
      }
    });
  }

  return {
    preview,
    runQuery: (queryId, trigger = 'manual') => run({ trigger, queryIds: [queryId] }),
    runAll: (trigger = 'scheduled') => run({ trigger, queryIds: null }),
  };
}
