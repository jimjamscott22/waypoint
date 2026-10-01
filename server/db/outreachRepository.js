import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';
import { OUTREACH_CHANNELS } from '../lib/followUps.js';
import { withConnection, withTransaction } from './pool.js';
import { mapOutreach } from './rows.js';

const columns = {
  contactId: 'contact_id',
  occurredAt: 'occurred_at',
  channel: 'channel',
  note: 'note',
  nextFollowUpAt: 'next_follow_up_at',
};

function databaseTimestamp(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(400, 'INVALID_TIMESTAMP', 'Timestamp is invalid');
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function values(input) {
  const channel = input.channel ?? 'email';
  if (!OUTREACH_CHANNELS.includes(channel)) {
    throw new AppError(400, 'INVALID_OUTREACH_CHANNEL', 'Outreach channel is invalid');
  }
  const occurredAt = databaseTimestamp(input.occurredAt);
  if (!occurredAt) throw new AppError(400, 'OUTREACH_DATE_REQUIRED', 'Outreach date is required');
  return {
    contactId: input.contactId || null,
    occurredAt,
    channel,
    note: input.note ?? '',
    nextFollowUpAt: databaseTimestamp(input.nextFollowUpAt),
  };
}

async function assertJobExists(connection, jobId) {
  const rows = await connection.query(
    'SELECT id FROM jobs WHERE id = ? AND deleted_at IS NULL',
    [jobId]
  );
  if (!rows[0]) throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
}

async function assertContactBelongsToJob(connection, jobId, contactId) {
  if (!contactId) return;
  const rows = await connection.query(
    'SELECT id FROM job_contacts WHERE id = ? AND job_id = ?',
    [contactId, jobId]
  );
  if (!rows[0]) throw new AppError(404, 'CONTACT_NOT_FOUND', 'Contact not found for this job');
}

async function rowById(connection, jobId, entryId) {
  const rows = await connection.query(
    `SELECT oe.*, jc.name AS contact_name
     FROM outreach_entries oe
     LEFT JOIN job_contacts jc ON jc.id = oe.contact_id
     WHERE oe.id = ? AND oe.job_id = ?`,
    [entryId, jobId]
  );
  return rows[0] ?? null;
}

export function createOutreachRepository(pool) {
  return {
    listForJob(jobId) {
      return withConnection(pool, async connection => {
        await assertJobExists(connection, jobId);
        const rows = await connection.query(
          `SELECT oe.*, jc.name AS contact_name
           FROM outreach_entries oe
           LEFT JOIN job_contacts jc ON jc.id = oe.contact_id
           WHERE oe.job_id = ?
           ORDER BY oe.occurred_at DESC, oe.created_at DESC`,
          [jobId]
        );
        return rows.map(mapOutreach);
      });
    },

    listPendingFollowUps() {
      return withConnection(pool, async connection => {
        const rows = await connection.query(
          `SELECT oe.*, jc.name AS contact_name
           FROM outreach_entries oe
           JOIN jobs j ON j.id = oe.job_id
           LEFT JOIN job_contacts jc ON jc.id = oe.contact_id
           WHERE oe.next_follow_up_at IS NOT NULL
             AND j.deleted_at IS NULL
             AND j.stage <> 'Closed'`
        );
        return rows.map(mapOutreach);
      });
    },

    create(jobId, input) {
      return withTransaction(pool, async connection => {
        await assertJobExists(connection, jobId);
        const entry = values(input);
        await assertContactBelongsToJob(connection, jobId, entry.contactId);
        const id = randomUUID();
        await connection.query(
          `INSERT INTO outreach_entries
            (id, job_id, contact_id, occurred_at, channel, note, next_follow_up_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, jobId, entry.contactId, entry.occurredAt, entry.channel, entry.note, entry.nextFollowUpAt]
        );
        return mapOutreach(await rowById(connection, jobId, id));
      });
    },

    update(jobId, entryId, changes) {
      return withTransaction(pool, async connection => {
        await assertJobExists(connection, jobId);
        const current = await rowById(connection, jobId, entryId);
        if (!current) throw new AppError(404, 'OUTREACH_NOT_FOUND', 'Outreach entry not found');
        const assignments = [];
        const parameters = [];
        for (const [key, value] of Object.entries(changes)) {
          const column = columns[key];
          if (!column) continue;
          assignments.push(`${column} = ?`);
          if (key === 'contactId') parameters.push(value || null);
          else if (key === 'occurredAt' || key === 'nextFollowUpAt') parameters.push(databaseTimestamp(value));
          else if (key === 'channel') {
            if (!OUTREACH_CHANNELS.includes(value)) {
              throw new AppError(400, 'INVALID_OUTREACH_CHANNEL', 'Outreach channel is invalid');
            }
            parameters.push(value);
          } else parameters.push(value ?? '');
        }
        if (changes.contactId !== undefined) {
          await assertContactBelongsToJob(connection, jobId, changes.contactId || null);
        }
        if (assignments.length) {
          parameters.push(entryId, jobId);
          await connection.query(
            `UPDATE outreach_entries SET ${assignments.join(', ')}, updated_at = UTC_TIMESTAMP(3) WHERE id = ? AND job_id = ?`,
            parameters
          );
        }
        return mapOutreach(await rowById(connection, jobId, entryId));
      });
    },

    remove(jobId, entryId) {
      return withTransaction(pool, async connection => {
        await assertJobExists(connection, jobId);
        const current = await rowById(connection, jobId, entryId);
        if (!current) throw new AppError(404, 'OUTREACH_NOT_FOUND', 'Outreach entry not found');
        await connection.query('DELETE FROM outreach_entries WHERE id = ? AND job_id = ?', [entryId, jobId]);
        return mapOutreach(current);
      });
    },
  };
}
