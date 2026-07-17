import { AppError } from '../errors.js';

export async function runRoutes(app, { scraper }) {
  app.post('/api/scrape-runs', async () => {
    if (!scraper) throw new AppError(503, 'PROVIDER_NOT_CONFIGURED', 'Adzuna credentials are not configured');
    return { run: await scraper.run('manual') };
  });
}
