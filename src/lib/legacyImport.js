import { JOB_STAGES } from './seedData.js';

const stringLimits = {
  role: 255, company: 255, location: 255, salary: 120,
  contact: 255, next: 255, notes: 10000, url: 4000,
};

export function parseLegacyJobs(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { jobs: [], error: 'Browser job data is not valid JSON. You can discard it or preserve it for manual recovery.' };
  }
  if (!Array.isArray(parsed)) return { jobs: [], error: 'Browser job data is not a job list. You can discard it or preserve it for manual recovery.' };
  if (parsed.length > 500) return { jobs: [], error: 'Browser job data contains more than the 500-job import limit.' };

  const jobs = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { jobs: [], error: 'Browser job data contains an invalid job record.' };
    }
    if (typeof item.role !== 'string' || typeof item.company !== 'string' || !JOB_STAGES.includes(item.stage)) {
      return { jobs: [], error: 'Browser job data contains a job with invalid required fields.' };
    }
    const job = { role: item.role, company: item.company, stage: item.stage };
    for (const [field, limit] of Object.entries(stringLimits)) {
      if (field === 'role' || field === 'company') continue;
      const value = item[field];
      if (value == null && field === 'url') { job[field] = null; continue; }
      if (value === undefined) continue;
      if (typeof value !== 'string' || value.length > limit) {
        return { jobs: [], error: `Browser job data contains an invalid ${field} field.` };
      }
      job[field] = value;
    }
    if (item.role.length > stringLimits.role || item.company.length > stringLimits.company) {
      return { jobs: [], error: 'Browser job data contains a job with fields that are too long.' };
    }
    if (item.urgent !== undefined && typeof item.urgent !== 'boolean') return { jobs: [], error: 'Browser job data contains an invalid urgent flag.' };
    if (item.isDraft !== undefined && typeof item.isDraft !== 'boolean') return { jobs: [], error: 'Browser job data contains an invalid draft flag.' };
    job.urgent = Boolean(item.urgent);
    job.isDraft = Boolean(item.isDraft);
    jobs.push(job);
  }
  return { jobs, error: null };
}
