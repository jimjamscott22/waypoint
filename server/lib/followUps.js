const DAY_MS = 86_400_000;

export const OUTREACH_CHANNELS = ['email', 'linkedin', 'phone', 'in_person', 'other'];

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfUtcDay(value) {
  const date = asDate(value);
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function classifyDueDate(dueAt, now = new Date()) {
  const due = asDate(dueAt);
  const current = asDate(now);
  if (!due || !current) return null;
  const todayStart = startOfUtcDay(current);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  if (due < todayStart) return 'overdue';
  if (due < tomorrowStart) return 'today';
  return null;
}

export function buildFollowUpItems({ jobs = [], outreachEntries = [], now = new Date() }) {
  const activeJobs = jobs.filter(job => !job.deletedAt && job.stage !== 'Closed');
  const activeJobIds = new Set(activeJobs.map(job => job.id));
  const jobById = new Map(jobs.map(job => [job.id, job]));
  const items = [];

  for (const job of activeJobs) {
    const status = classifyDueDate(job.nextActionAt, now);
    if (!status) continue;
    items.push({
      id: `job-next:${job.id}`,
      kind: 'job-next-action',
      status,
      jobId: job.id,
      stage: job.stage,
      dueAt: job.nextActionAt,
      title: job.next?.trim() || 'Next action due',
      detail: `${job.role || 'Role'} at ${job.company || 'this company'}`,
    });
  }

  for (const entry of outreachEntries) {
    if (!activeJobIds.has(entry.jobId)) continue;
    const status = classifyDueDate(entry.nextFollowUpAt, now);
    if (!status) continue;
    const job = jobById.get(entry.jobId);
    const contactLabel = entry.contactName?.trim();
    items.push({
      id: `outreach:${entry.id}`,
      kind: 'outreach-follow-up',
      status,
      jobId: entry.jobId,
      contactId: entry.contactId ?? null,
      stage: job?.stage ?? null,
      dueAt: entry.nextFollowUpAt,
      title: contactLabel ? `Follow up with ${contactLabel}` : 'Outreach follow-up due',
      detail: `${job?.company || 'Employer'} · ${formatChannel(entry.channel)}${entry.note?.trim() ? ` — ${entry.note.trim().slice(0, 100)}` : ''}`,
    });
  }

  return items.sort((left, right) => {
    const statusOrder = { overdue: 0, today: 1 };
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];
    if (statusDiff !== 0) return statusDiff;
    return asDate(left.dueAt) - asDate(right.dueAt);
  });
}

export function formatChannel(channel) {
  switch (channel) {
    case 'email': return 'Email';
    case 'linkedin': return 'LinkedIn';
    case 'phone': return 'Phone';
    case 'in_person': return 'In person';
    case 'other': return 'Other';
    default: return channel || 'Outreach';
  }
}
