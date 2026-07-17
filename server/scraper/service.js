import { AppError, sanitizeError } from '../errors.js';
import { withConnection, withTransaction } from '../db/pool.js';
import { upsertListingMatch } from '../db/listingRepository.js';
import { isWithinAgeLimit, scoreListing } from './scoring.js';

const MINUTE = 60_000;
const DAY = 86_400_000;

function sqlDate(date) {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

export function createScrapeService({ pool, queryRepository, listingRepository, runRepository, adzunaClient, logger, now = () => new Date() }) {
  return {
    async run(trigger = 'scheduled') {
      const started = now();
      if (trigger === 'manual') {
        const recent = await runRepository.recentManual(sqlDate(new Date(started.getTime() - 15 * MINUTE)));
        if (recent) throw new AppError(429, 'RUN_COOLDOWN', 'Manual scraping can run once every 15 minutes');
      }
      return withConnection(pool, async lockConnection => {
        const lock = await lockConnection.query("SELECT GET_LOCK('waypoint:scrape', 0) AS acquired");
        if (Number(lock[0].acquired) !== 1) throw new AppError(409, 'RUN_IN_PROGRESS', 'A scrape run is already in progress');
        let runId;
        let succeeded = 0;
        let fetched = 0;
        let newMatches = 0;
        const errors = [];
        try {
          await runRepository.recoverStale(sqlDate(new Date(started.getTime() - 30 * MINUTE)));
          const queries = await queryRepository.list({ enabledOnly: true });
          runId = await runRepository.create(lockConnection, trigger, queries.length, sqlDate(started));
          logger.info('scrape.started', { runId, trigger, queries: queries.length });

          for (const query of queries) {
            const queryStarted = now();
            try {
              const rawListings = await adzunaClient.search(query);
              const listings = rawListings.filter(listing => isWithinAgeLimit(listing, query, started));
              let queryNew = 0;
              await withTransaction(pool, async connection => {
                for (const listing of listings) {
                  const result = await upsertListingMatch(
                    connection,
                    listing,
                    query.id,
                    scoreListing(query, listing, started),
                    sqlDate(started)
                  );
                  if (result.isNew) queryNew += 1;
                }
              });
              succeeded += 1;
              fetched += listings.length;
              newMatches += queryNew;
              await runRepository.addQueryResult(lockConnection, {
                runId, queryId: query.id, queryName: query.name, status: 'success',
                listingsFetched: listings.length, newMatches: queryNew, errorMessage: null,
                startedAt: sqlDate(queryStarted), finishedAt: sqlDate(now()),
              });
              logger.info('scrape.query.complete', { runId, queryId: query.id, fetched: listings.length, newMatches: queryNew });
            } catch (error) {
              const message = sanitizeError(error);
              errors.push(`${query.name}: ${message}`);
              await runRepository.addQueryResult(lockConnection, {
                runId, queryId: query.id, queryName: query.name, status: 'failed',
                listingsFetched: 0, newMatches: 0, errorMessage: message,
                startedAt: sqlDate(queryStarted), finishedAt: sqlDate(now()),
              });
              logger.error('scrape.query.failed', { runId, queryId: query.id, message });
            }
          }

          await listingRepository.expire(lockConnection, sqlDate(new Date(started.getTime() - 30 * DAY)));
          const status = queries.length === 0 || succeeded === queries.length ? 'success' : succeeded === 0 ? 'failed' : 'partial';
          const summary = await runRepository.finish(lockConnection, runId, {
            status,
            finishedAt: sqlDate(now()),
            queriesSucceeded: succeeded,
            listingsFetched: fetched,
            newMatches,
            errorSummary: errors.length ? errors.join('; ').slice(0, 2000) : null,
          });
          logger.info('scrape.finished', { runId, status, fetched, newMatches });
          return summary;
        } catch (error) {
          if (runId) {
            const fatalError = sanitizeError(error);
            errors.push(fatalError);
            await runRepository.finish(lockConnection, runId, {
              status: succeeded > 0 ? 'partial' : 'failed', finishedAt: sqlDate(now()), queriesSucceeded: succeeded,
              listingsFetched: fetched, newMatches, errorSummary: errors.join('; ').slice(0, 2000),
            });
          }
          throw error;
        } finally {
          await lockConnection.query("SELECT RELEASE_LOCK('waypoint:scrape')");
        }
      });
    },
  };
}
