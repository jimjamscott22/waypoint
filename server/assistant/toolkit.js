import { AppError } from '../errors.js';
import { buildInsights, parseInsightsRange, INSIGHTS_RANGES } from '../insights/buildInsights.js';

const MAX_LIST_ITEMS = 40;

function trimPayload(value, maxChars = 14_000) {
  const text = JSON.stringify(value);
  if (text.length <= maxChars) return value;
  return {
    truncated: true,
    preview: `${text.slice(0, maxChars)}…`,
    message: 'Result was truncated for size; narrow the query or ask for a specific job.',
  };
}

function summarizeJob(job) {
  return {
    id: job.id,
    role: job.role,
    company: job.company,
    stage: job.stage,
    location: job.location,
    next: job.next,
    nextActionAt: job.nextActionAt,
    urgent: job.urgent,
    contact: job.contact,
    url: job.url,
    createdAt: job.createdAt,
  };
}

export function assistantToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'list_jobs_by_stage',
        description: 'List pipeline jobs, optionally filtered by stage.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            stage: { type: 'string', enum: ['Saved', 'Applied', 'Interviewing', 'Offer', 'Closed', 'All'] },
            limit: { type: 'integer', minimum: 1, maximum: MAX_LIST_ITEMS },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_follow_ups',
        description: 'List due or upcoming follow-ups from job next actions and outreach reminders.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            window: { type: 'string', enum: ['due_today', 'overdue', 'upcoming_7d', 'all_due_and_upcoming'] },
            limit: { type: 'integer', minimum: 1, maximum: MAX_LIST_ITEMS },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_stalled_applications',
        description: 'Applications in Applied stage with no recent movement (Insights stalled-applied logic).',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: { limit: { type: 'integer', minimum: 1, maximum: MAX_LIST_ITEMS } },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_insights_summary',
        description: 'Outcome metrics, funnel, weekly activity snapshot, and top recommendations for a reporting range.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: { range: { type: 'string', enum: INSIGHTS_RANGES } },
          required: ['range'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_saved_query_performance',
        description: 'Saved-query discovery performance (matches, save rate, average score).',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            range: { type: 'string', enum: INSIGHTS_RANGES },
            limit: { type: 'integer', minimum: 1, maximum: MAX_LIST_ITEMS },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_job_engagement',
        description: 'Contacts and outreach log for one pipeline job.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: { jobId: { type: 'string', minLength: 1 } },
          required: ['jobId'],
        },
      },
    },
  ];
}

export function createAssistantToolkit({ jobs, followUps, contacts, outreach, insightsRepository, now = () => new Date() }) {
  async function insightsSnapshot(range) {
    const currentTime = now();
    const parsed = parseInsightsRange(range, currentTime);
    const snapshot = await insightsRepository.snapshot();
    return buildInsights(snapshot, { ...parsed, now: currentTime });
  }

  const handlers = {
    async list_jobs_by_stage({ stage = 'All', limit = 25 } = {}) {
      const rows = await jobs.list();
      const filtered = stage === 'All' ? rows : rows.filter(job => job.stage === stage);
      return trimPayload({
        stage,
        total: filtered.length,
        jobs: filtered.slice(0, limit).map(summarizeJob),
      });
    },

    async list_follow_ups({ window = 'all_due_and_upcoming', limit = 25 } = {}) {
      const current = now();
      const due = await followUps.listDue(current);
      const upcoming7d = await followUps.listUpcoming(7, current);
      let items = due;
      if (window === 'overdue') items = due.filter(item => item.status === 'overdue');
      else if (window === 'due_today') items = due.filter(item => item.status === 'today');
      else if (window === 'upcoming_7d') items = upcoming7d;
      else if (window === 'all_due_and_upcoming') items = [...due, ...upcoming7d];
      return trimPayload({ window, total: items.length, followUps: items.slice(0, limit) });
    },

    async list_stalled_applications({ limit = 20 } = {}) {
      const report = await insightsSnapshot('90d');
      const stalled = report.recommendations.filter(item => item.type === 'stalled-applied');
      return trimPayload({ total: stalled.length, applications: stalled.slice(0, limit) });
    },

    async get_insights_summary({ range = '90d' } = {}) {
      const report = await insightsSnapshot(range);
      return trimPayload({
        range: report.range,
        generatedAt: report.generatedAt,
        outcomes: report.outcomes,
        funnel: report.funnel,
        weeklyActivity: report.weeklyActivity.slice(-8),
        recommendations: report.recommendations.slice(0, 8),
        discovery: {
          matchesFound: report.discovery.matchesFound,
          reviewedResults: report.discovery.reviewedResults,
          savedListings: report.discovery.savedListings,
          saveRate: report.discovery.saveRate,
        },
      });
    },

    async get_saved_query_performance({ range = '90d', limit = 20 } = {}) {
      const report = await insightsSnapshot(range);
      return trimPayload({
        range: report.range,
        queries: report.discovery.queries.slice(0, limit),
      });
    },

    async get_job_engagement({ jobId } = {}) {
      if (!jobId) throw new AppError(400, 'JOB_ID_REQUIRED', 'jobId is required');
      const [jobList, contactRows, outreachRows] = await Promise.all([
        jobs.list(),
        contacts.listForJob(jobId),
        outreach.listForJob(jobId),
      ]);
      const job = jobList.find(item => item.id === jobId);
      if (!job) throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
      return trimPayload({
        job: summarizeJob(job),
        contacts: contactRows,
        outreach: outreachRows,
      });
    },
  };

  return {
    definitions: assistantToolDefinitions(),
    async execute(name, args) {
      const handler = handlers[name];
      if (!handler) throw new AppError(400, 'UNKNOWN_ASSISTANT_TOOL', `Unknown tool: ${name}`);
      return handler(args ?? {});
    },
  };
}
