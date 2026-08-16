import { fileURLToPath } from 'node:url';
import { createServices } from '../services.js';
import { verifyDatabase } from '../db/pool.js';
import { sanitizeError } from '../errors.js';

export async function runScheduledScrape(options) {
  const services = createServices(options);
  try {
    await verifyDatabase(services.pool);
    if (!services.discovery) throw new Error('Adzuna credentials are not configured');
    return await services.discovery.runAll('scheduled');
  } finally {
    await services.pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runScheduledScrape()
    .then(run => console.log(JSON.stringify({ event: 'scrape.cli.complete', run })))
    .catch(error => {
      console.error(JSON.stringify({ event: 'scrape.cli.failed', message: sanitizeError(error) }));
      process.exitCode = 1;
    });
}
