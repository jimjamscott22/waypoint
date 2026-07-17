import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';
import { withConnection, withTransaction } from './pool.js';
import { mapJob } from './rows.js';

const columns = {
  role: 'role',
  company: 'company',
  stage: 'stage',
  location: 'location',
  salary: 'salary',
  contact: 'contact',
  next: 'next_action',
  notes: 'notes',
  urgent: 'urgent',
  isDraft: 'is_draft',
  url: 'url',
};

function values(input) {
  return {
    role: input.role ?? '',
    company: input.company ?? '',
    stage: input.stage ?? 'Saved',
    location: input.location ?? '',
    salary: input.salary ?? '',
    contact: input.contact ?? '',
    next: input.next ?? 'Tailor resume & apply',
    notes: input.notes ?? '',
    urgent: input.urgent ? 1 : 0,
    isDraft: input.isDraft ? 1 : 0,
    url: input.url || null,
  };
}

async function rowById(connection, id, { includeDeleted = false } = {}) {
  const rows = await connection.query(
    `SELECT * FROM jobs WHERE id = ? ${includeDeleted ? '' : 'AND deleted_at IS NULL'}`,
    [id]
  );
  return rows[0] ?? null;
}

export async function insertJob(connection, input, { id = randomUUID(), sourceListingId = null } = {}) {
  const job = values(input);
  await connection.query('UPDATE jobs SET sort_order = sort_order + 1 WHERE deleted_at IS NULL');
  await connection.query(
    `INSERT INTO jobs
      (id, role, company, stage, location, salary, contact, next_action, notes, urgent, is_draft, url, sort_order, source_listing_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [id, job.role, job.company, job.stage, job.location, job.salary, job.contact, job.next, job.notes, job.urgent, job.isDraft, job.url, sourceListingId]
  );
  return mapJob(await rowById(connection, id));
}

export function createJobRepository(pool) {
  return {
    list() {
      return withConnection(pool, async connection => {
        const rows = await connection.query('SELECT * FROM jobs WHERE deleted_at IS NULL ORDER BY sort_order, created_at');
        return rows.map(mapJob);
      });
    },

    isEmpty() {
      return withConnection(pool, async connection => {
        const rows = await connection.query('SELECT COUNT(*) AS count FROM jobs');
        return Number(rows[0].count) === 0;
      });
    },

    create(input) {
      return withTransaction(pool, connection => insertJob(connection, input));
    },

    update(id, changes) {
      return withTransaction(pool, async connection => {
        const current = await rowById(connection, id);
        if (!current) throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
        const assignments = [];
        const parameters = [];
        for (const [key, value] of Object.entries(changes)) {
          const column = columns[key];
          if (!column) continue;
          assignments.push(`${column} = ?`);
          parameters.push(key === 'urgent' || key === 'isDraft' ? (value ? 1 : 0) : (key === 'url' ? value || null : value));
        }
        if (assignments.length) {
          parameters.push(id);
          await connection.query(
            `UPDATE jobs SET ${assignments.join(', ')}, updated_at = UTC_TIMESTAMP(3) WHERE id = ? AND deleted_at IS NULL`,
            parameters
          );
        }
        return mapJob(await rowById(connection, id));
      });
    },

    remove(id) {
      return withTransaction(pool, async connection => {
        const row = await rowById(connection, id);
        if (!row) throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
        await connection.query('UPDATE jobs SET deleted_at = UTC_TIMESTAMP(3), updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [id]);
        return mapJob(row);
      });
    },

    restore(id) {
      return withTransaction(pool, async connection => {
        const row = await rowById(connection, id, { includeDeleted: true });
        if (!row) throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
        await connection.query('UPDATE jobs SET deleted_at = NULL, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [id]);
        return mapJob(await rowById(connection, id));
      });
    },

    reorder(orderedIds) {
      return withTransaction(pool, async connection => {
        const rows = await connection.query('SELECT id FROM jobs WHERE deleted_at IS NULL ORDER BY sort_order');
        const current = rows.map(row => row.id);
        if (current.length !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length || current.some(id => !orderedIds.includes(id))) {
          throw new AppError(409, 'JOB_ORDER_MISMATCH', 'Ordered IDs must contain every active job exactly once');
        }
        for (const [sortOrder, id] of orderedIds.entries()) {
          await connection.query('UPDATE jobs SET sort_order = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = ?', [sortOrder, id]);
        }
        const updated = await connection.query('SELECT * FROM jobs WHERE deleted_at IS NULL ORDER BY sort_order');
        return updated.map(mapJob);
      });
    },

    importAll(jobs) {
      return withTransaction(pool, async connection => {
        const count = await connection.query('SELECT COUNT(*) AS count FROM jobs');
        if (Number(count[0].count) > 0) throw new AppError(409, 'JOBS_NOT_EMPTY', 'Jobs can only be imported into an empty workspace');
        const imported = [];
        for (const [sortOrder, item] of jobs.entries()) {
          const job = values(item);
          const id = randomUUID();
          await connection.query(
            `INSERT INTO jobs
              (id, role, company, stage, location, salary, contact, next_action, notes, urgent, is_draft, url, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, job.role, job.company, job.stage, job.location, job.salary, job.contact, job.next, job.notes, job.urgent, job.isDraft, job.url, sortOrder]
          );
          imported.push(mapJob(await rowById(connection, id)));
        }
        return imported;
      });
    },
  };
}
