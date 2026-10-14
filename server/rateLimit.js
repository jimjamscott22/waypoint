import rateLimit from '@fastify/rate-limit';

/** Per-IP limits for lightweight routes that still hit MariaDB (health checks, etc.). */
export const databaseRouteRateLimit = {
  max: 30,
  timeWindow: '1 minute',
};

export function registerRateLimit(app) {
  return app.register(rateLimit, { global: false });
}
