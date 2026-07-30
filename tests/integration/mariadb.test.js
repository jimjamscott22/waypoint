import test from 'node:test';
import assert from 'node:assert/strict';
import { runMigrations } from '../../server/db/migrate.js';
import { createPool, verifyDatabase, withConnection } from '../../server/db/pool.js';
import { withTransaction } from '../../server/db/pool.js';
import { createJobRepository } from '../../server/db/jobRepository.js';
import { createListingRepository, upsertListingMatch } from '../../server/db/listingRepository.js';
import { createQueryRepository } from '../../server/db/queryRepository.js';
import { createInsightsRepository } from '../../server/db/insightsRepository.js';
import { createInsightsService } from '../../server/insights/service.js';
import { normalizeAdzunaJob } from '../../server/scraper/adzuna.js';

const enabled = Boolean(process.env.TEST_DB_PASSWORD && process.env.TEST_MIGRATION_DB_PASSWORD);

test('applies MariaDB migrations repeatably to the isolated test database', { skip: !enabled }, async () => {
  const env = {
    ...process.env,
    DB_NAME: process.env.TEST_DB_NAME || 'waypoint_test',
    DB_USER: process.env.TEST_DB_USER || 'waypoint_test_app',
    DB_PASSWORD: process.env.TEST_DB_PASSWORD,
    MIGRATION_DB_USER: process.env.TEST_MIGRATION_DB_USER || 'waypoint_test_migrate',
    MIGRATION_DB_PASSWORD: process.env.TEST_MIGRATION_DB_PASSWORD,
  };
  const first = await runMigrations(env);
  const second = await runMigrations(env);
  assert.ok(first.version);
  assert.deepEqual(second.applied, []);

  const connection = env.DB_HOST
    ? { host: env.DB_HOST, port: Number(env.DB_PORT || 3306) }
    : { socketPath: env.DB_SOCKET || '/run/mysqld/mysqld.sock' };
  const pool = createPool({
    ...connection, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD, connectionLimit: 2,
  });
  try {
    assert.ok(await verifyDatabase(pool));
    const tables = await withConnection(pool, connection => connection.query("SHOW TABLES LIKE 'jobs'"));
    assert.equal(tables.length, 1);
    const eventTables = await withConnection(pool, connection => connection.query("SHOW TABLES LIKE 'job_stage_events'"));
    assert.equal(eventTables.length, 1);

    await assert.rejects(
      withConnection(pool, connection => connection.query('CREATE TABLE runtime_privilege_probe (id INT)')),
      /denied|command/i
    );
    await assert.rejects(
      withConnection(pool, connection => connection.query('SELECT User FROM mysql.user LIMIT 1')),
      /denied|command/i
    );

    await withConnection(pool, async connection => {
      await connection.query('DELETE FROM jobs');
      await connection.query('DELETE FROM listings');
    });

    const jobs = createJobRepository(pool);
    const firstJob = await jobs.create({ role: 'First', company: 'Example', stage: 'Saved' });
    const secondJob = await jobs.create({ role: 'Second', company: 'Example', stage: 'Applied' });
    assert.match(firstJob.createdAt, /Z$/);
    const initialEvents = await withConnection(pool, connection => connection.query(
      'SELECT from_stage, to_stage FROM job_stage_events WHERE job_id = ? ORDER BY occurred_at, id',
      [secondJob.id]
    ));
    assert.deepEqual(initialEvents.map(row => [row.from_stage, row.to_stage]), [[null, 'Applied']]);
    const interviewed = await jobs.update(secondJob.id, {
      stage: 'Interviewing',
      nextActionAt: '2026-07-30T14:30:00.000Z',
    });
    assert.equal(interviewed.stage, 'Interviewing');
    assert.equal(interviewed.nextActionAt, '2026-07-30T14:30:00.000Z');
    await jobs.update(secondJob.id, { role: 'Second updated' });
    const transitionEvents = await withConnection(pool, connection => connection.query(
      'SELECT from_stage, to_stage FROM job_stage_events WHERE job_id = ? ORDER BY occurred_at, id',
      [secondJob.id]
    ));
    assert.deepEqual(transitionEvents.map(row => [row.from_stage, row.to_stage]), [
      [null, 'Applied'],
      ['Applied', 'Interviewing'],
    ]);
    assert.deepEqual((await jobs.reorder([firstJob.id, secondJob.id])).map(job => job.id), [firstJob.id, secondJob.id]);
    await assert.rejects(jobs.importAll([{ role: 'Imported', company: 'Example', stage: 'Saved' }]), error => error.code === 'JOBS_NOT_EMPTY');
    await jobs.remove(firstJob.id);
    assert.equal((await jobs.restore(firstJob.id)).id, firstJob.id);
    await jobs.update(firstJob.id, { stage: 'Applied' });
    await jobs.update(firstJob.id, { stage: 'Interviewing' });

    await assert.rejects(withTransaction(pool, async connection => {
      await connection.query(
        "INSERT INTO jobs (id, role, company, stage, notes, sort_order) VALUES ('30000000-0000-4000-8000-000000000001', 'Rollback', 'Example', 'Saved', '', 99)"
      );
      throw new Error('force rollback');
    }), /force rollback/);
    const rollbackCount = await withConnection(pool, connection => connection.query(
      "SELECT COUNT(*) AS count FROM jobs WHERE id = '30000000-0000-4000-8000-000000000001'"
    ));
    assert.equal(Number(rollbackCount[0].count), 0);

    const providerListing = normalizeAdzunaJob({
      id: 'integration-1', title: 'Systems Administrator', company: { display_name: 'Example' },
      location: { display_name: 'Remote' }, salary_min: 70000, salary_max: 85000,
      description: 'Linux systems', redirect_url: 'https://example.test/integration-1', created: '2026-07-16T10:00:00.000Z',
    });
    const queryId = '10000000-0000-4000-8000-000000000001';
    const inserted = await withTransaction(pool, connection => upsertListingMatch(connection, providerListing, queryId, 90, '2026-07-16 12:00:00.000'));
    const duplicate = await withTransaction(pool, connection => upsertListingMatch(connection, providerListing, queryId, 92, '2026-07-16 12:05:00.000'));
    assert.equal(duplicate.id, inserted.id);
    const listingCount = await withConnection(pool, connection => connection.query(
      "SELECT COUNT(*) AS count FROM listings WHERE provider = 'adzuna' AND provider_job_id = 'integration-1'"
    ));
    assert.equal(Number(listingCount[0].count), 1);

    const listings = createListingRepository(pool);
    const firstSave = await listings.save(inserted.id);
    const secondSave = await listings.save(inserted.id);
    assert.equal(secondSave.job.id, firstSave.job.id);
    await withTransaction(pool, connection => upsertListingMatch(connection, providerListing, queryId, 94, '2026-07-16 12:10:00.000'));
    const savedStatus = await withConnection(pool, connection => connection.query('SELECT status FROM listings WHERE id = ?', [inserted.id]));
    assert.equal(savedStatus[0].status, 'saved');

    const dismissedListing = { ...providerListing, providerJobId: 'integration-dismissed', url: 'https://example.test/integration-dismissed' };
    const dismissed = await withTransaction(pool, connection => upsertListingMatch(connection, dismissedListing, queryId, 80, '2026-07-16 12:00:00.000'));
    await listings.dismiss(dismissed.id);
    await withTransaction(pool, connection => upsertListingMatch(connection, dismissedListing, queryId, 82, '2026-07-16 12:05:00.000'));
    const dismissedStatus = await withConnection(pool, connection => connection.query('SELECT status FROM listings WHERE id = ?', [dismissed.id]));
    assert.equal(dismissedStatus[0].status, 'dismissed');

    const queryRepository = createQueryRepository(pool);
    const attributionQuery = await queryRepository.create({ name: 'Attribution', keywords: 'systems support', location: '', maxAgeDays: 7 });
    await withTransaction(pool, connection => upsertListingMatch(
      connection,
      providerListing,
      attributionQuery.id,
      88,
      '2026-07-16 12:15:00.000'
    ));
    const editableQuery = await queryRepository.create({ name: 'Editable', keywords: 'systems', location: '', maxAgeDays: 7 });
    const staleListing = { ...providerListing, providerJobId: 'integration-stale-query', url: 'https://example.test/integration-stale-query' };
    const stale = await withTransaction(pool, connection => upsertListingMatch(connection, staleListing, editableQuery.id, 75, '2026-07-16 12:00:00.000'));
    await queryRepository.update(editableQuery.id, { keywords: 'network support' });
    const staleStatus = await withConnection(pool, connection => connection.query('SELECT status FROM listings WHERE id = ?', [stale.id]));
    assert.equal(staleStatus[0].status, 'expired');
    await queryRepository.remove(editableQuery.id);

    const insights = createInsightsService({
      repository: createInsightsRepository(pool),
      now: () => new Date('2026-07-30T12:00:00.000Z'),
    });
    const report = await insights.get('all');
    assert.ok(report.outcomes.applicationsSent >= 1);
    assert.ok(report.outcomes.interviewsReached >= 1);
    assert.ok(report.discovery.matchesFound >= 2);
    assert.ok(
      report.discovery.queries.reduce((sum, query) => sum + query.matchesFound, 0) >
      report.discovery.matchesFound
    );

    await withConnection(pool, async firstLock => {
      const acquired = await firstLock.query("SELECT GET_LOCK('waypoint:test:scrape', 0) AS acquired");
      assert.equal(Number(acquired[0].acquired), 1);
      await withConnection(pool, async secondLock => {
        const rejected = await secondLock.query("SELECT GET_LOCK('waypoint:test:scrape', 0) AS acquired");
        assert.equal(Number(rejected[0].acquired), 0);
      });
      await firstLock.query("SELECT RELEASE_LOCK('waypoint:test:scrape')");
    });
  } finally {
    await pool.end();
  }
});
