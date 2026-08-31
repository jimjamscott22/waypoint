import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createJobRepository } from './db/jobRepository.js';
import { createQueryRepository } from './db/queryRepository.js';
import { createListingRepository } from './db/listingRepository.js';
import { createRunRepository } from './db/runRepository.js';
import { createInsightsRepository } from './db/insightsRepository.js';
import { createInsightsService } from './insights/service.js';
import { createAdzunaClient } from './scraper/adzuna.js';
import { createDiscoveryRepository } from './db/discoveryRepository.js';
import { createDiscoveryService } from './discovery/service.js';
import { createNominatimClient } from './geocoding/nominatim.js';
import { createLogger } from './logger.js';

export function createServices({
  env = process.env,
  pool: suppliedPool,
  providers: suppliedProviders,
  geocoder: suppliedGeocoder,
  logger = createLogger(),
} = {}) {
  const config = loadConfig(env);
  const pool = suppliedPool ?? createPool(config.database);
  const jobs = createJobRepository(pool);
  const queries = createQueryRepository(pool);
  const listings = createListingRepository(pool);
  const runs = createRunRepository(pool);
  const insightsRepository = createInsightsRepository(pool);
  const insights = createInsightsService({ repository: insightsRepository });
  const discoveryRepository = createDiscoveryRepository(pool);
  // Discovery runs against whichever providers are configured; an unconfigured one is
  // simply absent from the list. With none of them configured there is nothing to
  // search, and the service stays off entirely.
  const providers = suppliedProviders
    ?? [config.adzuna.configured ? createAdzunaClient(config.adzuna) : null].filter(Boolean);
  const discovery = providers.length ? createDiscoveryService({
    pool, queryRepository: queries, listingRepository: listings, runRepository: runs,
    discoveryRepository, providers, logger, discovery: config.discovery,
  }) : null;
  // Nominatim requires a contact identity, so location lookup stays off until it is configured.
  const geocoder = suppliedGeocoder ?? (config.geocoder.userAgent ? createNominatimClient(config.geocoder) : null);
  return { config, pool, jobs, queries, listings, runs, insights, discovery, discoveryRepository, geocoder, logger };
}
