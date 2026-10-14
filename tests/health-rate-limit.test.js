import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../server/app.js';
import { databaseRouteRateLimit } from '../server/rateLimit.js';

function mariaDbPool() {
  return {
    getConnection: async () => ({
      query: async sql => {
        if (sql.includes('time_zone')) return [];
        return [{ version: '10.11.0-MariaDB' }];
      },
      release: () => {},
    }),
  };
}

function healthServices() {
  return {
    config: { adzuna: { configured: true }, geocoder: { userAgent: 'waypoint-test' } },
    pool: mariaDbPool(),
  };
}

test('/api/health succeeds under the rate limit', async t => {
  const app = buildApp({ services: healthServices(), serveStatic: false });
  await app.ready();
  t.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, 'ok');
  assert.match(response.json().databaseVersion, /10\.11/);
});

test('/api/health returns 429 when the per-IP limit is exceeded', async t => {
  const app = buildApp({ services: healthServices(), serveStatic: false });
  await app.ready();
  t.after(() => app.close());

  const { max } = databaseRouteRateLimit;
  for (let i = 0; i < max; i += 1) {
    const allowed = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(allowed.statusCode, 200, `request ${i + 1} should be allowed`);
  }

  const blocked = await app.inject({ method: 'GET', url: '/api/health' });
  assert.equal(blocked.statusCode, 429);
  assert.deepEqual(blocked.json().error, {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded, retry in 1 minute',
  });
});
