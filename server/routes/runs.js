import { AppError } from '../errors.js';

export async function runRoutes(app, { discovery }) {
  app.post('/api/scrape-runs', async () => {
    if (!discovery) throw new AppError(503, 'PROVIDER_NOT_CONFIGURED', 'Adzuna credentials are not configured');
    return { run: await discovery.runAll('manual') };
  });
}
