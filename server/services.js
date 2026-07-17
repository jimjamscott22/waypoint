import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createJobRepository } from './db/jobRepository.js';
import { createQueryRepository } from './db/queryRepository.js';
import { createListingRepository } from './db/listingRepository.js';
import { createRunRepository } from './db/runRepository.js';
import { createAdzunaClient } from './scraper/adzuna.js';
import { createScrapeService } from './scraper/service.js';
import { createLogger } from './logger.js';

export function createServices({ env = process.env, pool: suppliedPool, adzunaClient: suppliedClient, logger = createLogger() } = {}) {
  const config = loadConfig(env);
  const pool = suppliedPool ?? createPool(config.database);
  const jobs = createJobRepository(pool);
  const queries = createQueryRepository(pool);
  const listings = createListingRepository(pool);
  const runs = createRunRepository(pool);
  const adzunaClient = suppliedClient ?? (config.adzuna.configured ? createAdzunaClient(config.adzuna) : null);
  const scraper = adzunaClient ? createScrapeService({
    pool, queryRepository: queries, listingRepository: listings, runRepository: runs, adzunaClient, logger,
  }) : null;
  return { config, pool, jobs, queries, listings, runs, scraper, logger };
}
