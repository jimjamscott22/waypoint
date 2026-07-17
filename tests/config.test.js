import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../server/config.js';

test('defaults to the MariaDB Unix socket and keeps secrets private', () => {
  const config = loadConfig({ DB_PASSWORD: 'runtime-secret' });
  assert.equal(config.database.socketPath, '/run/mysqld/mysqld.sock');
  assert.equal(config.database.host, null);
  assert.equal(config.database.password, 'runtime-secret');
});

test('rejects simultaneous socket and TCP database modes', () => {
  assert.throws(() => loadConfig({ DB_PASSWORD: 'secret', DB_SOCKET: '/tmp/mysql.sock', DB_HOST: '127.0.0.1' }), /not both/);
});
