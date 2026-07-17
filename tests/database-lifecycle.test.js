import test from 'node:test';
import assert from 'node:assert/strict';
import { withConnection, withTransaction } from '../server/db/pool.js';
import { runScheduledScrape } from '../server/cli/scrape.js';

function poolWith(connection) {
  return { getConnection: async () => connection };
}

test('releases connections when an operation fails', async () => {
  let released = false;
  const connection = {
    query: async () => undefined,
    release: () => { released = true; },
  };
  await assert.rejects(withConnection(poolWith(connection), async () => { throw new Error('failed'); }), /failed/);
  assert.equal(released, true);
});

test('rolls back failed transactions and releases their connection', async () => {
  const events = [];
  const connection = {
    query: async () => undefined,
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
  };
  await assert.rejects(withTransaction(poolWith(connection), async () => { throw new Error('failed'); }), /failed/);
  assert.deepEqual(events, ['begin', 'rollback', 'release']);
});

test('scheduled CLI closes its pool when provider setup fails', async () => {
  let ended = false;
  const connection = {
    query: async sql => sql.includes('VERSION') ? [{ version: '10.11.8-MariaDB' }] : undefined,
    release: () => {},
  };
  const pool = { ...poolWith(connection), end: async () => { ended = true; } };
  const env = { DB_PASSWORD: 'runtime-test-password', ADZUNA_APP_ID: '', ADZUNA_APP_KEY: '' };
  await assert.rejects(runScheduledScrape({ env, pool }), /credentials are not configured/);
  assert.equal(ended, true);
});

