import test from 'node:test';
import assert from 'node:assert/strict';
import { runMigrations } from '../../server/db/migrate.js';
import { createPool, verifyDatabase, withConnection } from '../../server/db/pool.js';
import { withTransaction } from '../../server/db/pool.js';
import { createJobRepository } from '../../server/db/jobRepository.js';
import { createListingRepository, upsertListingMatch } from '../../server/db/listingRepository.js';
import { createQueryRepository } from '../../server/db/queryRepository.js';
import { createDiscoveryRepository, persistMatch } from '../../server/db/discoveryRepository.js';
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

test('applies the structured discovery migration with Auburn defaults and safe seed handling', { skip: !enabled }, async () => {
  const env = {
    ...process.env,
    DB_NAME: process.env.TEST_DB_NAME || 'waypoint_test',
    DB_USER: process.env.TEST_DB_USER || 'waypoint_test_app',
    DB_PASSWORD: process.env.TEST_DB_PASSWORD,
    MIGRATION_DB_USER: process.env.TEST_MIGRATION_DB_USER || 'waypoint_test_migrate',
    MIGRATION_DB_PASSWORD: process.env.TEST_MIGRATION_DB_PASSWORD,
  };
  await runMigrations(env);

  const connection = env.DB_HOST
    ? { host: env.DB_HOST, port: Number(env.DB_PORT || 3306) }
    : { socketPath: env.DB_SOCKET || '/run/mysqld/mysqld.sock' };
  const pool = createPool({
    ...connection, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD, connectionLimit: 2,
  });
  try {
    const auburnId = '10000000-0000-4000-8000-000000000004';
    const auburn = await withConnection(pool, connection => connection.query('SELECT * FROM saved_queries WHERE id = ?', [auburnId]));
    assert.equal(auburn.length, 1);
    assert.equal(auburn[0].center_display_name, 'Auburn, Cayuga County, New York, United States');
    assert.equal(Number(auburn[0].preferred_radius_miles), 20);
    assert.equal(Number(auburn[0].maximum_radius_miles), 40);
    assert.equal(Number(auburn[0].enabled), 1);
    const auburnFamilies = await withConnection(pool, connection => connection.query(
      'SELECT role_family FROM saved_query_role_families WHERE query_id = ? ORDER BY role_family', [auburnId]
    ));
    assert.deepEqual(auburnFamilies.map(row => row.role_family), [
      'cloud-support', 'desktop-support', 'it-operations', 'it-support',
      'junior-systems-engineering', 'network-administration', 'systems-administration',
    ]);

    const seedFamilies = await withConnection(pool, connection => connection.query(
      `SELECT query_id, role_family FROM saved_query_role_families
       WHERE query_id IN (
         '10000000-0000-4000-8000-000000000001',
         '10000000-0000-4000-8000-000000000002',
         '10000000-0000-4000-8000-000000000003'
       ) ORDER BY query_id`
    ));
    assert.deepEqual(seedFamilies.map(row => `${row.query_id}:${row.role_family}`), [
      '10000000-0000-4000-8000-000000000001:systems-administration',
      '10000000-0000-4000-8000-000000000002:it-support',
      '10000000-0000-4000-8000-000000000003:network-administration',
    ]);

    const queryRepository = createQueryRepository(pool);
    const legacyQuery = await queryRepository.create({ name: 'Legacy sysadmin', keywords: 'systems administrator', location: 'Syracuse, NY', maxAgeDays: 7 });
    const legacyRow = await withConnection(pool, connection => connection.query('SELECT * FROM saved_queries WHERE id = ?', [legacyQuery.id]));
    assert.equal(legacyRow[0].name, 'Legacy sysadmin');
    assert.equal(legacyRow[0].keywords, 'systems administrator');
    assert.equal(legacyRow[0].location, 'Syracuse, NY');
    await withConnection(pool, connection => connection.query(
      `UPDATE saved_queries SET optional_terms = CASE WHEN TRIM(keywords) = '' THEN JSON_ARRAY() ELSE JSON_ARRAY(keywords) END WHERE id = ?`,
      [legacyQuery.id]
    ));
    const legacyOptionalTerms = await withConnection(pool, connection => connection.query(
      'SELECT optional_terms FROM saved_queries WHERE id = ?', [legacyQuery.id]
    ));
    const parsedOptionalTerms = typeof legacyOptionalTerms[0].optional_terms === 'string'
      ? JSON.parse(legacyOptionalTerms[0].optional_terms)
      : legacyOptionalTerms[0].optional_terms;
    assert.deepEqual(parsedOptionalTerms, ['systems administrator']);
    await queryRepository.remove(legacyQuery.id);

    const untouchedProbeId = '40000000-0000-4000-8000-000000000001';
    const editedProbeId = '40000000-0000-4000-8000-000000000002';
    await withConnection(pool, async connection => {
      await connection.query(
        `INSERT INTO saved_queries (id, name, keywords, location, max_age_days, enabled, created_at, updated_at) VALUES
          (?, 'Untouched seed probe', 'probe', '', 7, 1, '2026-01-01 00:00:00.000', '2026-01-01 00:00:00.000'),
          (?, 'Edited seed probe', 'probe', '', 7, 1, '2026-01-01 00:00:00.000', '2026-02-01 00:00:00.000')`,
        [untouchedProbeId, editedProbeId]
      );
      await connection.query(
        `UPDATE saved_queries SET enabled = 0, updated_at = UTC_TIMESTAMP(3)
         WHERE id IN (?, ?) AND updated_at = created_at`,
        [untouchedProbeId, editedProbeId]
      );
      const probeRows = await connection.query(
        'SELECT id, enabled FROM saved_queries WHERE id IN (?, ?) ORDER BY id',
        [untouchedProbeId, editedProbeId]
      );
      assert.deepEqual(probeRows.map(row => [row.id, Number(row.enabled)]), [
        [untouchedProbeId, 0],
        [editedProbeId, 1],
      ]);
      await connection.query('DELETE FROM saved_queries WHERE id IN (?, ?)', [untouchedProbeId, editedProbeId]);
    });

    await assert.rejects(withConnection(pool, connection => connection.query(
      `INSERT INTO saved_query_role_families (query_id, role_family) VALUES (?, 'not-a-role-family')`,
      [auburnId]
    )), /constraint/i);
    await assert.rejects(withTransaction(pool, async connection => {
      const id = '50000000-0000-4000-8000-000000000001';
      await connection.query(
        `INSERT INTO saved_queries (id, name, keywords, location, max_age_days, enabled, preferred_radius_miles, maximum_radius_miles)
         VALUES (?, 'Bad radius', '', '', 7, 1, 40, 20)`,
        [id]
      );
    }), /constraint/i);
    const anyListingQuery = await withConnection(pool, connection => connection.query('SELECT listing_id, query_id FROM listing_queries LIMIT 1'));
    assert.equal(anyListingQuery.length, 1);
    await assert.rejects(withConnection(pool, connection => connection.query(
      `UPDATE listing_queries SET distance_band = 'far-away' WHERE listing_id = ? AND query_id = ?`,
      [anyListingQuery[0].listing_id, anyListingQuery[0].query_id]
    )), /constraint/i);
    const probeRunId = '60000000-0000-4000-8000-000000000099';
    await withConnection(pool, connection => connection.query(
      `INSERT INTO scrape_runs (id, trigger_type, status, started_at) VALUES (?, 'manual', 'running', UTC_TIMESTAMP(3))`,
      [probeRunId]
    ));
    await assert.rejects(withConnection(pool, connection => connection.query(
      `INSERT INTO scrape_run_searches (id, run_id, query_id, role_family, status, started_at)
       VALUES ('60000000-0000-4000-8000-000000000001', ?, ?, 'systems-administration', 'not-a-status', UTC_TIMESTAMP(3))`,
      [probeRunId, auburnId]
    )), /constraint/i);
    await withConnection(pool, connection => connection.query('DELETE FROM scrape_runs WHERE id = ?', [probeRunId]));

    const jobRows = await withConnection(pool, connection => connection.query('SELECT COUNT(*) AS count FROM jobs'));
    assert.ok(Number(jobRows[0].count) >= 1);
    const listingRows = await withConnection(pool, connection => connection.query('SELECT COUNT(*) AS count FROM listings'));
    assert.ok(Number(listingRows[0].count) >= 1);
    const stageEventRows = await withConnection(pool, connection => connection.query('SELECT COUNT(*) AS count FROM job_stage_events'));
    assert.ok(Number(stageEventRows[0].count) >= 1);
  } finally {
    await pool.end();
  }
});

test('round-trips structured saved searches and preserves decided attribution', { skip: !enabled }, async () => {
  const env = {
    ...process.env,
    DB_NAME: process.env.TEST_DB_NAME || 'waypoint_test',
    DB_USER: process.env.TEST_DB_USER || 'waypoint_test_app',
    DB_PASSWORD: process.env.TEST_DB_PASSWORD,
    MIGRATION_DB_USER: process.env.TEST_MIGRATION_DB_USER || 'waypoint_test_migrate',
    MIGRATION_DB_PASSWORD: process.env.TEST_MIGRATION_DB_PASSWORD,
  };
  await runMigrations(env);

  const connection = env.DB_HOST
    ? { host: env.DB_HOST, port: Number(env.DB_PORT || 3306) }
    : { socketPath: env.DB_SOCKET || '/run/mysqld/mysqld.sock' };
  const pool = createPool({
    ...connection, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD, connectionLimit: 2,
  });
  const queries = createQueryRepository(pool);
  const listings = createListingRepository(pool);
  const created = [];

  try {
    const structured = await queries.create({
      name: 'Structured Auburn',
      center: {
        displayName: 'Auburn, Cayuga County, New York, United States',
        latitude: 42.9317,
        longitude: -76.5661,
        provider: 'nominatim',
        placeId: '9001',
      },
      preferredRadiusMiles: 20,
      maximumRadiusMiles: 40,
      roleFamilies: ['it-support', 'systems-administration'],
      requiredTerms: ['  Windows  ', 'windows', 'Active   Directory'],
      optionalTerms: ['powershell'],
      excludedTerms: ['sales'],
      maxAgeDays: 14,
      minimumSalary: 55000,
      enabled: true,
    });
    created.push(structured.id);

    assert.equal(structured.center.displayName, 'Auburn, Cayuga County, New York, United States');
    assert.equal(structured.center.latitude, 42.9317);
    assert.equal(structured.center.longitude, -76.5661);
    assert.equal(structured.center.provider, 'nominatim');
    assert.equal(structured.center.placeId, '9001');
    assert.equal(structured.preferredRadiusMiles, 20);
    assert.equal(structured.maximumRadiusMiles, 40);
    assert.deepEqual(structured.roleFamilies, ['it-support', 'systems-administration']);
    // Blank, whitespace-collapsed, and case-insensitive duplicate terms are normalized away.
    assert.deepEqual(structured.requiredTerms, ['Windows', 'Active Directory']);
    assert.deepEqual(structured.optionalTerms, ['powershell']);
    assert.deepEqual(structured.excludedTerms, ['sales']);
    assert.equal(structured.minimumSalary, 55000);
    assert.equal(structured.enabled, true);

    const reloaded = (await queries.list()).find(query => query.id === structured.id);
    assert.deepEqual(reloaded.roleFamilies, ['it-support', 'systems-administration']);
    assert.deepEqual(reloaded.requiredTerms, ['Windows', 'Active Directory']);

    const relabelled = await queries.update(structured.id, {
      roleFamilies: ['cloud-support'],
      minimumSalary: null,
      enabled: false,
    });
    assert.deepEqual(relabelled.roleFamilies, ['cloud-support']);
    assert.equal(relabelled.minimumSalary, null);
    assert.equal(relabelled.enabled, false);

    await assert.rejects(
      queries.update(structured.id, { preferredRadiusMiles: 40, maximumRadiusMiles: 20 }),
      error => error.code === 'INVALID_RADIUS_RANGE'
    );
    await assert.rejects(
      queries.update(structured.id, { roleFamilies: [] }),
      error => error.code === 'ROLE_FAMILY_REQUIRED'
    );

    const attribution = await queries.create({
      name: 'Attribution retention',
      center: { displayName: 'Auburn, New York', latitude: 42.9317, longitude: -76.5661, provider: 'nominatim', placeId: '9002' },
      preferredRadiusMiles: 20,
      maximumRadiusMiles: 40,
      roleFamilies: ['it-support'],
      maxAgeDays: 14,
    });
    created.push(attribution.id);

    const listingFor = suffix => normalizeAdzunaJob({
      id: `structured-${suffix}`,
      title: 'IT Support Specialist',
      company: { display_name: 'Example' },
      location: { display_name: 'Auburn, NY' },
      description: 'Help desk',
      redirect_url: `https://example.test/structured-${suffix}`,
      created: '2026-07-16T10:00:00.000Z',
    });

    const pending = await withTransaction(pool, c => upsertListingMatch(c, listingFor('pending'), attribution.id, 70, '2026-07-16 12:00:00.000'));
    const kept = await withTransaction(pool, c => upsertListingMatch(c, listingFor('saved'), attribution.id, 80, '2026-07-16 12:00:00.000'));
    const refused = await withTransaction(pool, c => upsertListingMatch(c, listingFor('dismissed'), attribution.id, 60, '2026-07-16 12:00:00.000'));
    await listings.save(kept.id);
    await listings.dismiss(refused.id);

    await queries.update(attribution.id, { roleFamilies: ['network-administration'] });

    const survivors = await withConnection(pool, c => c.query(
      'SELECT listing_id FROM listing_queries WHERE query_id = ? ORDER BY listing_id', [attribution.id]
    ));
    const survivingIds = survivors.map(row => row.listing_id).sort();
    assert.deepEqual(survivingIds, [kept.id, refused.id].sort());

    const statuses = await withConnection(pool, c => c.query(
      'SELECT id, status FROM listings WHERE id IN (?, ?, ?)', [pending.id, kept.id, refused.id]
    ));
    const byId = new Map(statuses.map(row => [row.id, row.status]));
    assert.equal(byId.get(kept.id), 'saved');
    assert.equal(byId.get(refused.id), 'dismissed');
    assert.equal(byId.get(pending.id), 'expired');
  } finally {
    for (const id of created) {
      await queries.remove(id).catch(() => {});
    }
    await pool.end();
  }
});

test('classifies rediscovery outcomes without overwriting listing decisions', { skip: !enabled }, async () => {
  const env = {
    ...process.env,
    DB_NAME: process.env.TEST_DB_NAME || 'waypoint_test',
    DB_USER: process.env.TEST_DB_USER || 'waypoint_test_app',
    DB_PASSWORD: process.env.TEST_DB_PASSWORD,
    MIGRATION_DB_USER: process.env.TEST_MIGRATION_DB_USER || 'waypoint_test_migrate',
    MIGRATION_DB_PASSWORD: process.env.TEST_MIGRATION_DB_PASSWORD,
  };
  await runMigrations(env);

  const connection = env.DB_HOST
    ? { host: env.DB_HOST, port: Number(env.DB_PORT || 3306) }
    : { socketPath: env.DB_SOCKET || '/run/mysqld/mysqld.sock' };
  const pool = createPool({
    ...connection, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD, connectionLimit: 2,
  });
  const queries = createQueryRepository(pool);
  const listings = createListingRepository(pool);
  let queryId;

  try {
    const query = await queries.create({
      name: 'Rediscovery outcomes',
      center: { displayName: 'Auburn, New York', latitude: 42.9317, longitude: -76.5661, provider: 'nominatim', placeId: '9100' },
      preferredRadiusMiles: 20,
      maximumRadiusMiles: 40,
      roleFamilies: ['it-support', 'systems-administration'],
      maxAgeDays: 14,
    });
    queryId = query.id;

    const provider = suffix => normalizeAdzunaJob({
      id: `outcome-${suffix}`,
      title: 'IT Support Specialist',
      company: { display_name: 'Example' },
      location: { display_name: 'Auburn, NY' },
      description: 'Help desk',
      redirect_url: `https://example.test/outcome-${suffix}`,
      created: '2026-08-10T10:00:00.000Z',
      latitude: 42.94,
      longitude: -76.57,
      category: { tag: 'it-jobs' },
      contract_time: 'full_time',
      contract_type: 'permanent',
    });

    const evaluation = {
      score: 88,
      distanceMiles: 0.72,
      distanceBand: 'preferred',
      matchFacts: { matchedSynonyms: ['IT support'], requiredTerms: [], optionalTerms: [], excludedTerms: [] },
      matchedRoleFamilies: ['it-support'],
    };
    const persist = (listing, overrides = {}) => withTransaction(pool, c => persistMatch(c, {
      listing, queryId, evaluation: { ...evaluation, ...overrides }, seenAt: '2026-08-12 12:00:00.000',
    }));

    const first = await persist(provider('a'));
    assert.equal(first.outcome, 'new');
    const again = await persist(provider('a'));
    assert.equal(again.outcome, 'duplicate-new');
    assert.equal(again.id, first.id);

    // A second role family adds evidence to the same stored match rather than a new row.
    await persist(provider('a'), { matchedRoleFamilies: ['systems-administration'] });
    const families = await withConnection(pool, c => c.query(
      'SELECT role_family FROM listing_query_role_families WHERE listing_id = ? AND query_id = ? ORDER BY role_family',
      [first.id, queryId]
    ));
    assert.deepEqual(families.map(row => row.role_family), ['it-support', 'systems-administration']);

    const stored = await withConnection(pool, c => c.query(
      'SELECT distance_miles, distance_band, match_facts FROM listing_queries WHERE listing_id = ? AND query_id = ?',
      [first.id, queryId]
    ));
    assert.equal(Number(stored[0].distance_miles), 0.72);
    assert.equal(stored[0].distance_band, 'preferred');

    const savedListing = await persist(provider('b'));
    await listings.save(savedListing.id);
    assert.equal((await persist(provider('b'))).outcome, 'previously-saved');

    const dismissedListing = await persist(provider('c'));
    await listings.dismiss(dismissedListing.id);
    assert.equal((await persist(provider('c'))).outcome, 'previously-dismissed');

    const finalStatuses = await withConnection(pool, c => c.query(
      'SELECT id, status FROM listings WHERE id IN (?, ?)', [savedListing.id, dismissedListing.id]
    ));
    const byId = new Map(finalStatuses.map(row => [row.id, row.status]));
    assert.equal(byId.get(savedListing.id), 'saved');
    assert.equal(byId.get(dismissedListing.id), 'dismissed');

    await withConnection(pool, c => c.query(
      "UPDATE listings SET status = 'expired' WHERE id = ?", [first.id]
    ));
    assert.equal((await persist(provider('a'))).outcome, 'expired-reopened');
  } finally {
    if (queryId) await queries.remove(queryId).catch(() => {});
    await pool.end();
  }
});

test('filters, sorts, and paginates discovery results without inflating totals', { skip: !enabled }, async () => {
  const env = {
    ...process.env,
    DB_NAME: process.env.TEST_DB_NAME || 'waypoint_test',
    DB_USER: process.env.TEST_DB_USER || 'waypoint_test_app',
    DB_PASSWORD: process.env.TEST_DB_PASSWORD,
    MIGRATION_DB_USER: process.env.TEST_MIGRATION_DB_USER || 'waypoint_test_migrate',
    MIGRATION_DB_PASSWORD: process.env.TEST_MIGRATION_DB_PASSWORD,
  };
  await runMigrations(env);

  const connection = env.DB_HOST
    ? { host: env.DB_HOST, port: Number(env.DB_PORT || 3306) }
    : { socketPath: env.DB_SOCKET || '/run/mysqld/mysqld.sock' };
  const pool = createPool({
    ...connection, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD, connectionLimit: 2,
  });
  const queries = createQueryRepository(pool);
  const discovery = createDiscoveryRepository(pool);
  const created = [];

  try {
    await withConnection(pool, c => c.query('DELETE FROM listings'));

    const makeQuery = (name, placeId) => queries.create({
      name,
      center: { displayName: 'Auburn, New York', latitude: 42.9317, longitude: -76.5661, provider: 'nominatim', placeId },
      preferredRadiusMiles: 20,
      maximumRadiusMiles: 40,
      roleFamilies: ['it-support', 'systems-administration'],
      maxAgeDays: 30,
    });
    const first = await makeQuery('Filter search one', '9200');
    const second = await makeQuery('Filter search two', '9201');
    created.push(first.id, second.id);

    const provider = (suffix, overrides = {}) => normalizeAdzunaJob({
      id: `filter-${suffix}`,
      title: 'IT Support Specialist',
      company: { display_name: 'Example' },
      location: { display_name: 'Auburn, NY' },
      description: 'Help desk',
      redirect_url: `https://example.test/filter-${suffix}`,
      created: '2026-08-10T10:00:00.000Z',
      latitude: 42.94,
      longitude: -76.57,
      ...overrides,
    });

    const persist = (listing, queryId, evaluation) => withTransaction(pool, c => persistMatch(c, {
      listing, queryId, evaluation, seenAt: '2026-08-12 12:00:00.000',
    }));

    const facts = { matchedSynonyms: ['IT support'], requiredTerms: [], optionalTerms: [], excludedTerms: [] };
    const near = await persist(provider('near', { salary_min: 60000, salary_max: 80000 }), first.id, {
      score: 90, distanceMiles: 3.5, distanceBand: 'preferred', matchFacts: facts,
      matchedRoleFamilies: ['it-support', 'systems-administration'],
    });
    // The same listing also matches the second search and both role families.
    await persist(provider('near', { salary_min: 60000, salary_max: 80000 }), second.id, {
      score: 70, distanceMiles: 3.5, distanceBand: 'preferred', matchFacts: facts,
      matchedRoleFamilies: ['it-support'],
    });

    const far = await persist(provider('far'), first.id, {
      score: 50, distanceMiles: 33.25, distanceBand: 'expanded', matchFacts: facts,
      matchedRoleFamilies: ['it-support'],
    });
    const unknown = await persist(
      provider('unknown', { latitude: undefined, longitude: undefined, created: '2026-08-11T10:00:00.000Z' }),
      first.id,
      { score: 60, distanceMiles: null, distanceBand: 'unknown', matchFacts: facts, matchedRoleFamilies: ['it-support'] }
    );

    // Three distinct listings despite four query associations and five family rows.
    const all = await discovery.search({ status: 'new', sort: 'best', page: 1, pageSize: 25 });
    assert.equal(all.total, 3);
    assert.equal(all.items.length, 3);
    assert.equal(all.totalPages, 1);
    assert.deepEqual(all.items.map(item => item.id), [near.id, unknown.id, far.id]);
    assert.equal(all.items[0].matchedQueries.length, 2);
    assert.deepEqual(all.items[0].roleFamilies, ['it-support', 'systems-administration']);

    const nearest = await discovery.search({ status: 'new', sort: 'nearest', page: 1, pageSize: 25 });
    assert.deepEqual(nearest.items.map(item => item.id), [near.id, far.id, unknown.id]);

    const newest = await discovery.search({ status: 'new', sort: 'newest', page: 1, pageSize: 25 });
    assert.equal(newest.items[0].id, near.id);

    const bySalary = await discovery.search({ status: 'new', sort: 'salary', page: 1, pageSize: 25 });
    assert.equal(bySalary.items[0].id, near.id);
    assert.equal(bySalary.items.at(-1).salary, '');

    const scoped = await discovery.search({ status: 'new', queryId: second.id, page: 1, pageSize: 25 });
    assert.deepEqual(scoped.items.map(item => item.id), [near.id]);

    const byFamily = await discovery.search({ status: 'new', roleFamily: 'systems-administration', page: 1, pageSize: 25 });
    assert.deepEqual(byFamily.items.map(item => item.id), [near.id]);

    const byBand = await discovery.search({ status: 'new', distanceBand: 'expanded', page: 1, pageSize: 25 });
    assert.deepEqual(byBand.items.map(item => item.id), [far.id]);

    const byScore = await discovery.search({ status: 'new', minScore: 80, page: 1, pageSize: 25 });
    assert.deepEqual(byScore.items.map(item => item.id), [near.id]);

    const knownSalary = await discovery.search({ status: 'new', salaryStatus: 'known', page: 1, pageSize: 25 });
    assert.deepEqual(knownSalary.items.map(item => item.id), [near.id]);
    const unknownSalary = await discovery.search({ status: 'new', salaryStatus: 'unknown', page: 1, pageSize: 25 });
    assert.equal(unknownSalary.total, 2);

    // Wildcards typed by the user are escaped rather than matching everything.
    const literal = await discovery.search({ status: 'new', q: '%', page: 1, pageSize: 25 });
    assert.equal(literal.total, 0);
    const matched = await discovery.search({ status: 'new', q: 'IT Support', page: 1, pageSize: 25 });
    assert.equal(matched.total, 3);

    const firstPage = await discovery.search({ status: 'new', sort: 'best', page: 1, pageSize: 10 });
    assert.equal(firstPage.totalPages, 1);
    const beyondEnd = await discovery.search({ status: 'new', sort: 'best', page: 5, pageSize: 10 });
    assert.equal(beyondEnd.items.length, 0);
    assert.equal(beyondEnd.total, 3);
  } finally {
    for (const id of created) await queries.remove(id).catch(() => {});
    await pool.end();
  }
});
