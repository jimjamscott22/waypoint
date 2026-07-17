import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { createPool, verifyDatabase, withConnection } from './pool.js';
import { sanitizeError } from '../errors.js';

const migrationDirectory = fileURLToPath(new URL('./migrations/', import.meta.url));

export async function runMigrations(env = process.env) {
  const config = loadConfig(env, { migration: true });
  const pool = createPool(config.database, { connectionLimit: 1, multipleStatements: true });
  try {
    const version = await verifyDatabase(pool);
    return await withConnection(pool, async connection => {
      const lock = await connection.query("SELECT GET_LOCK('waypoint:migrate', 30) AS acquired");
      if (Number(lock[0].acquired) !== 1) throw new Error('Could not acquire migration lock');
      try {
        await connection.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            name VARCHAR(255) PRIMARY KEY,
            checksum CHAR(64) NOT NULL,
            applied_at DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        const files = (await readdir(migrationDirectory)).filter(file => file.endsWith('.sql')).sort();
        const applied = [];
        for (const file of files) {
          const sql = await readFile(path.join(migrationDirectory, file), 'utf8');
          const checksum = createHash('sha256').update(sql).digest('hex');
          const existing = await connection.query('SELECT checksum FROM schema_migrations WHERE name = ?', [file]);
          if (existing.length) {
            if (existing[0].checksum !== checksum) throw new Error(`Applied migration ${file} has changed`);
            continue;
          }
          await connection.query(sql);
          await connection.query('INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)', [file, checksum]);
          applied.push(file);
        }
        return { version, applied };
      } finally {
        await connection.query("SELECT RELEASE_LOCK('waypoint:migrate')");
      }
    });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(result => console.log(JSON.stringify({ event: 'migrations.complete', ...result })))
    .catch(error => {
      console.error(JSON.stringify({ event: 'migrations.failed', message: sanitizeError(error) }));
      process.exitCode = 1;
    });
}
