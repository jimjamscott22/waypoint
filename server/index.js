import { createServices } from './services.js';
import { buildApp } from './app.js';
import { verifyDatabase } from './db/pool.js';
import { sanitizeError } from './errors.js';

const services = createServices();
const app = buildApp({ services, logger: true });

async function shutdown(signal) {
  services.logger.info('server.shutdown', { signal });
  await app.close();
  await services.pool.end();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => shutdown(signal).finally(() => process.exit(0)));
}

try {
  await verifyDatabase(services.pool);
  await app.listen({ host: services.config.server.host, port: services.config.server.port });
} catch (error) {
  services.logger.error('server.start.failed', { message: sanitizeError(error) });
  await services.pool.end();
  process.exitCode = 1;
}
