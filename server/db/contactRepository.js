import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';
import { withConnection, withTransaction } from './pool.js';
import { mapContact } from './rows.js';

const columns = {
  name: 'name',
  title: 'title',
  email: 'email',
  profileUrl: 'profile_url',
  notes: 'notes',
};

function values(input) {
  return {
    name: (input.name ?? '').trim(),
    title: input.title ?? '',
    email: input.email ?? '',
    profileUrl: input.profileUrl || null,
    notes: input.notes ?? '',
  };
}

async function assertJobExists(connection, jobId) {
  const rows = await connection.query(
    'SELECT id FROM jobs WHERE id = ? AND deleted_at IS NULL',
    [jobId]
  );
  if (!rows[0]) throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
}

async function rowById(connection, jobId, contactId) {
  const rows = await connection.query(
    'SELECT * FROM job_contacts WHERE id = ? AND job_id = ?',
    [contactId, jobId]
  );
  return rows[0] ?? null;
}

export function createContactRepository(pool) {
  return {
    listForJob(jobId) {
      return withConnection(pool, async connection => {
        await assertJobExists(connection, jobId);
        const rows = await connection.query(
          'SELECT * FROM job_contacts WHERE job_id = ? ORDER BY sort_order, created_at, name',
          [jobId]
        );
        return rows.map(mapContact);
      });
    },

    create(jobId, input) {
      return withTransaction(pool, async connection => {
        await assertJobExists(connection, jobId);
        const contact = values(input);
        if (!contact.name) throw new AppError(400, 'CONTACT_NAME_REQUIRED', 'Contact name is required');
        const id = randomUUID();
        const orderRows = await connection.query(
          'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM job_contacts WHERE job_id = ?',
          [jobId]
        );
        const sortOrder = Number(orderRows[0].next_order);
        await connection.query(
          `INSERT INTO job_contacts (id, job_id, name, title, email, profile_url, notes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, jobId, contact.name, contact.title, contact.email, contact.profileUrl, contact.notes, sortOrder]
        );
        return mapContact(await rowById(connection, jobId, id));
      });
    },

    update(jobId, contactId, changes) {
      return withTransaction(pool, async connection => {
        await assertJobExists(connection, jobId);
        const current = await rowById(connection, jobId, contactId);
        if (!current) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found');
        const assignments = [];
        const parameters = [];
        for (const [key, value] of Object.entries(changes)) {
          const column = columns[key];
          if (!column) continue;
          assignments.push(`${column} = ?`);
          if (key === 'profileUrl') parameters.push(value || null);
          else if (key === 'name') parameters.push(String(value ?? '').trim());
          else parameters.push(value ?? '');
        }
        if (changes.name !== undefined && !String(changes.name ?? '').trim()) {
          throw new AppError(400, 'CONTACT_NAME_REQUIRED', 'Contact name is required');
        }
        if (assignments.length) {
          parameters.push(contactId, jobId);
          await connection.query(
            `UPDATE job_contacts SET ${assignments.join(', ')}, updated_at = UTC_TIMESTAMP(3) WHERE id = ? AND job_id = ?`,
            parameters
          );
        }
        return mapContact(await rowById(connection, jobId, contactId));
      });
    },

    remove(jobId, contactId) {
      return withTransaction(pool, async connection => {
        await assertJobExists(connection, jobId);
        const current = await rowById(connection, jobId, contactId);
        if (!current) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found');
        await connection.query('DELETE FROM job_contacts WHERE id = ? AND job_id = ?', [contactId, jobId]);
        return mapContact(current);
      });
    },
  };
}
