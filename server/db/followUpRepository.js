import { withConnection } from './pool.js';
import { toIso } from './rows.js';
import { buildFollowUpItems, buildUpcomingFollowUpItems } from '../lib/followUps.js';

export function createFollowUpRepository(pool) {
  return {
    listDue(now = new Date()) {
      return withConnection(pool, async connection => {
        const jobs = await connection.query(
          `SELECT id, role, company, stage, next_action, next_action_at, deleted_at
           FROM jobs`
        );
        const outreach = await connection.query(
          `SELECT oe.id, oe.job_id, oe.contact_id, oe.channel, oe.note, oe.next_follow_up_at, jc.name AS contact_name
           FROM outreach_entries oe
           JOIN jobs j ON j.id = oe.job_id
           LEFT JOIN job_contacts jc ON jc.id = oe.contact_id
           WHERE oe.next_follow_up_at IS NOT NULL
             AND j.deleted_at IS NULL
             AND j.stage <> 'Closed'`
        );
        return buildFollowUpItems({
          now,
          jobs: jobs.map(row => ({
            id: row.id,
            role: row.role,
            company: row.company,
            stage: row.stage,
            next: row.next_action,
            nextActionAt: toIso(row.next_action_at),
            deletedAt: toIso(row.deleted_at),
          })),
          outreachEntries: outreach.map(row => ({
            id: row.id,
            jobId: row.job_id,
            contactId: row.contact_id,
            contactName: row.contact_name,
            channel: row.channel,
            note: row.note,
            nextFollowUpAt: toIso(row.next_follow_up_at),
          })),
        });
      });
    },

    listUpcoming(horizonDays = 7, now = new Date()) {
      return withConnection(pool, async connection => {
        const jobs = await connection.query(
          `SELECT id, role, company, stage, next_action, next_action_at, deleted_at
           FROM jobs`
        );
        const outreach = await connection.query(
          `SELECT oe.id, oe.job_id, oe.contact_id, oe.channel, oe.note, oe.next_follow_up_at, jc.name AS contact_name
           FROM outreach_entries oe
           JOIN jobs j ON j.id = oe.job_id
           LEFT JOIN job_contacts jc ON jc.id = oe.contact_id
           WHERE oe.next_follow_up_at IS NOT NULL
             AND j.deleted_at IS NULL
             AND j.stage <> 'Closed'`
        );
        const jobRows = jobs.map(row => ({
          id: row.id,
          role: row.role,
          company: row.company,
          stage: row.stage,
          next: row.next_action,
          nextActionAt: toIso(row.next_action_at),
          deletedAt: toIso(row.deleted_at),
        }));
        const outreachRows = outreach.map(row => ({
          id: row.id,
          jobId: row.job_id,
          contactId: row.contact_id,
          contactName: row.contact_name,
          channel: row.channel,
          note: row.note,
          nextFollowUpAt: toIso(row.next_follow_up_at),
        }));
        return buildUpcomingFollowUpItems({
          now,
          horizonDays,
          jobs: jobRows,
          outreachEntries: outreachRows,
        });
      });
    },
  };
}
