import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, publicConfig } from '../server/config.js';

test('defaults to the MariaDB Unix socket and keeps secrets private', () => {
  const config = loadConfig({ DB_PASSWORD: 'runtime-secret' });
  assert.equal(config.database.socketPath, '/run/mysqld/mysqld.sock');
  assert.equal(config.database.host, null);
  assert.equal(config.database.password, 'runtime-secret');
});

test('rejects simultaneous socket and TCP database modes', () => {
  assert.throws(() => loadConfig({ DB_PASSWORD: 'secret', DB_SOCKET: '/tmp/mysql.sock', DB_HOST: '127.0.0.1' }), /not both/);
});

test('defaults the geocoder and discovery request budgets', () => {
  const config = loadConfig({ DB_PASSWORD: 'secret' });
  assert.equal(config.geocoder.baseUrl, 'https://nominatim.openstreetmap.org');
  assert.equal(config.geocoder.userAgent, '');
  assert.deepEqual(config.discovery, {
    runRequestBudget: 20,
    queryRequestBudget: 12,
    previewRequestBudget: 8,
    maxPagesPerFamily: 3,
    persistedMatchTarget: 50,
  });
});

test('reads configured discovery budgets and rejects non-positive values', () => {
  const config = loadConfig({
    DB_PASSWORD: 'secret',
    DISCOVERY_RUN_REQUEST_BUDGET: '30',
    DISCOVERY_MAX_PAGES_PER_FAMILY: '5',
  });
  assert.equal(config.discovery.runRequestBudget, 30);
  assert.equal(config.discovery.maxPagesPerFamily, 5);

  assert.throws(
    () => loadConfig({ DB_PASSWORD: 'secret', DISCOVERY_PREVIEW_REQUEST_BUDGET: '0' }),
    /DISCOVERY_PREVIEW_REQUEST_BUDGET must be a positive integer/
  );
  assert.throws(
    () => loadConfig({ DB_PASSWORD: 'secret', DISCOVERY_QUERY_REQUEST_BUDGET: 'many' }),
    /DISCOVERY_QUERY_REQUEST_BUDGET must be a positive integer/
  );
});

test('reports location resolution availability without exposing the geocoder identity', () => {
  const contact = 'Waypoint/0.1 (contact: person@example.com)';
  const configured = publicConfig(loadConfig({ DB_PASSWORD: 'secret', GEOCODER_USER_AGENT: contact }));
  const unconfigured = publicConfig(loadConfig({ DB_PASSWORD: 'secret' }));

  assert.deepEqual(configured, { providerConfigured: false, locationResolutionConfigured: true });
  assert.equal(unconfigured.locationResolutionConfigured, false);
  assert.equal(JSON.stringify(configured).includes('person@example.com'), false);
});
