import { AppError } from '../errors.js';

export async function runRoutes(app, { discovery, runs }) {
  app.post('/api/scrape-runs', async () => {
    if (!discovery) throw new AppError(503, 'PROVIDER_NOT_CONFIGURED', 'Adzuna credentials are not configured');
    return { run: await discovery.runAll('manual') };
  });

  app.get('/api/scrape-runs/:id', async request => {
    const detail = await runs.detail(request.params.id);
    if (!detail) throw new AppError(404, 'RUN_NOT_FOUND', 'Discovery run not found');
    return detail;
  });
}
