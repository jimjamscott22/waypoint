import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AppError } from './errors.js';
import { verifyDatabase } from './db/pool.js';
import { jobRoutes } from './routes/jobs.js';
import { queryRoutes } from './routes/queries.js';
import { listingRoutes } from './routes/listings.js';
import { runRoutes } from './routes/runs.js';
import { insightRoutes } from './routes/insights.js';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

export function buildApp({ services, logger = false, serveStatic = true }) {
  const app = Fastify({ logger });

  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: error.message } });
    }
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    }
    request.log.error(error);
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred' } });
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    databaseVersion: await verifyDatabase(services.pool),
    providerConfigured: services.config.adzuna.configured,
  }));

  app.get('/api/bootstrap', async () => {
    const [jobs, serverJobsEmpty, queries, matches, latestRun] = await Promise.all([
      services.jobs.list(), services.jobs.isEmpty(), services.queries.list(), services.listings.listNew(), services.runs.latest(),
    ]);
    return {
      jobs,
      queries,
      matches,
      latestRun,
      serverJobsEmpty,
      provider: { name: 'Adzuna', attributionUrl: 'https://www.adzuna.com/' },
      providerConfigured: services.config.adzuna.configured,
    };
  });

  app.register(jobRoutes, services);
  app.register(queryRoutes, services);
  app.register(listingRoutes, services);
  app.register(runRoutes, services);
  app.register(insightRoutes, services);

  const staticAvailable = serveStatic && existsSync(dist);
  if (staticAvailable) {
    app.register(fastifyStatic, { root: dist, wildcard: false });
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url.startsWith('/api/')) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'API endpoint not found' } });
    }
    if (staticAvailable) return reply.sendFile('index.html', { maxAge: 0, immutable: false });
    return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
  });

  return app;
}
