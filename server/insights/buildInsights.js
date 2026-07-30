import { AppError } from '../errors.js';

export const INSIGHTS_RANGES = ['30d', '90d', 'all'];

const DAY_MS = 86_400_000;
const OUTCOME_STAGES = ['Applied', 'Interviewing', 'Offer'];

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function rate(numerator, denominator) {
  return denominator ? roundOne((numerator / denominator) * 100) : null;
}

function startOfUtcWeek(value) {
  const date = asDate(value);
  const day = date.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offset));
}

function inRange(date, startsAt) {
  return date && (!startsAt || date >= startsAt);
}

function eventTime(event) {
  return asDate(event.occurredAt);
}

function latestStageTimes(events) {
  const latest = new Map();
  for (const event of events) {
    const occurredAt = eventTime(event);
    if (!occurredAt) continue;
    const current = latest.get(event.jobId);
    if (!current || occurredAt > current) latest.set(event.jobId, occurredAt);
  }
  return latest;
}

function buildOutcomeMetrics(jobs, events, startsAt) {
  const transitions = events
    .filter(event => event.fromStage !== null)
    .map(event => ({ ...event, time: eventTime(event) }))
    .filter(event => event.time)
    .sort((left, right) => left.time - right.time);

  const firstApplied = new Map();
  for (const event of transitions) {
    if (event.toStage === 'Applied' && !firstApplied.has(event.jobId)) {
      firstApplied.set(event.jobId, event.time);
    }
  }

  const cohort = new Map([...firstApplied].filter(([, appliedAt]) => inRange(appliedAt, startsAt)));
  let interviewing = 0;
  let offer = 0;

  for (const [jobId, appliedAt] of cohort) {
    const laterStages = transitions.filter(event => event.jobId === jobId && event.time >= appliedAt);
    if (laterStages.some(event => event.toStage === 'Interviewing' || event.toStage === 'Offer')) interviewing += 1;
    if (laterStages.some(event => event.toStage === 'Offer')) offer += 1;
  }

  const applicationsSent = cohort.size;
  const activeOpportunities = jobs.filter(job =>
    !job.deletedAt && ['Applied', 'Interviewing', 'Offer'].includes(job.stage)
  ).length;

  return {
    outcomes: {
      applicationsSent,
      interviewsReached: interviewing,
      interviewRate: rate(interviewing, applicationsSent),
      activeOpportunities,
    },
    funnel: [
      { stage: 'Applied', count: applicationsSent },
      { stage: 'Interviewing', count: interviewing },
      { stage: 'Offer', count: offer },
    ],
  };
}

function buildWeeklyActivity(events, startsAt, now) {
  const transitions = events
    .filter(event => event.fromStage !== null && OUTCOME_STAGES.includes(event.toStage))
    .map(event => ({ ...event, time: eventTime(event) }))
    .filter(event => event.time && event.time <= now && inRange(event.time, startsAt));

  const earliest = transitions.reduce(
    (minimum, event) => !minimum || event.time < minimum ? event.time : minimum,
    null
  );
  const firstWeek = startOfUtcWeek(startsAt ?? earliest ?? now);
  const lastWeek = startOfUtcWeek(now);
  const weeks = [];

  for (let cursor = firstWeek; cursor <= lastWeek; cursor = new Date(cursor.getTime() + 7 * DAY_MS)) {
    weeks.push({
      weekStart: cursor.toISOString().slice(0, 10),
      applied: 0,
      interviewing: 0,
      offer: 0,
    });
  }

  const byWeek = new Map(weeks.map(week => [week.weekStart, week]));
  for (const event of transitions) {
    const key = startOfUtcWeek(event.time).toISOString().slice(0, 10);
    const bucket = byWeek.get(key);
    if (!bucket) continue;
    bucket[event.toStage.toLowerCase()] += 1;
  }
  return weeks;
}

function groupDiscovery(listingMatches, queries, startsAt) {
  const matches = listingMatches.filter(match => inRange(asDate(match.firstMatchedAt), startsAt));
  const listings = new Map();

  for (const match of matches) {
    if (!listings.has(match.listingId)) {
      listings.set(match.listingId, { status: match.status });
    }
  }

  const overall = [...listings.values()];
  const reviewedResults = overall.filter(listing => ['saved', 'dismissed'].includes(listing.status)).length;
  const savedListings = overall.filter(listing => listing.status === 'saved').length;
  const dismissedListings = overall.filter(listing => listing.status === 'dismissed').length;

  const queryRows = queries.map(query => {
    const queryMatches = matches.filter(match => match.queryId === query.id);
    const uniqueMatches = new Map();
    for (const match of queryMatches) {
      const current = uniqueMatches.get(match.listingId);
      if (!current || Number(match.score) > Number(current.score)) uniqueMatches.set(match.listingId, match);
    }
    const rows = [...uniqueMatches.values()];
    const reviewed = rows.filter(row => ['saved', 'dismissed'].includes(row.status));
    const saved = reviewed.filter(row => row.status === 'saved');
    const averageScore = rows.length
      ? roundOne(rows.reduce((sum, row) => sum + Number(row.score), 0) / rows.length)
      : null;
    return {
      id: query.id,
      name: query.name,
      enabled: Boolean(query.enabled),
      matchesFound: rows.length,
      reviewedResults: reviewed.length,
      savedListings: saved.length,
      saveRate: rate(saved.length, reviewed.length),
      averageScore,
    };
  }).sort((left, right) =>
    (right.saveRate ?? -1) - (left.saveRate ?? -1) ||
    right.reviewedResults - left.reviewedResults ||
    left.name.localeCompare(right.name)
  );

  return {
    matchesFound: listings.size,
    reviewedResults,
    savedListings,
    saveRate: rate(savedListings, reviewedResults),
    dismissedListings,
    queries: queryRows,
  };
}

function ageInDays(now, value) {
  const date = asDate(value);
  return date ? (now.getTime() - date.getTime()) / DAY_MS : 0;
}

function buildRecommendations(jobs, events, queryRows, now) {
  const latest = latestStageTimes(events);
  const activeJobs = jobs.filter(job => !job.deletedAt && job.stage !== 'Closed');
  const recommendations = [];
  const includedJobs = new Set();

  const dueJobs = activeJobs
    .filter(job => {
      const due = asDate(job.nextActionAt);
      return due && due < now;
    })
    .sort((left, right) => asDate(left.nextActionAt) - asDate(right.nextActionAt));

  for (const job of dueJobs) {
    includedJobs.add(job.id);
    recommendations.push({
      id: `follow-up-due:${job.id}`,
      type: 'follow-up-due',
      title: `Follow up with ${job.company || 'this employer'}`,
      detail: `${job.role || 'This opportunity'} has a past-due next action.`,
      actionLabel: 'Open job',
      jobId: job.id,
      stage: job.stage,
    });
  }

  const stalledApplied = activeJobs
    .filter(job => job.stage === 'Applied' && !includedJobs.has(job.id))
    .filter(job => {
      const due = asDate(job.nextActionAt);
      const lastMove = latest.get(job.id) ?? asDate(job.createdAt);
      return (!due || due <= now) && ageInDays(now, lastMove) >= 14;
    })
    .sort((left, right) =>
      (latest.get(left.id) ?? asDate(left.createdAt)) - (latest.get(right.id) ?? asDate(right.createdAt))
    );

  for (const job of stalledApplied) {
    includedJobs.add(job.id);
    recommendations.push({
      id: `stalled-applied:${job.id}`,
      type: 'stalled-applied',
      title: `Check in with ${job.company || 'this employer'}`,
      detail: `${job.role || 'This application'} has not moved for at least 14 days.`,
      actionLabel: 'Review application',
      jobId: job.id,
      stage: job.stage,
    });
  }

  const staleSaved = activeJobs
    .filter(job => job.stage === 'Saved' && !includedJobs.has(job.id))
    .filter(job => ageInDays(now, latest.get(job.id) ?? job.createdAt) >= 7)
    .sort((left, right) =>
      (latest.get(left.id) ?? asDate(left.createdAt)) - (latest.get(right.id) ?? asDate(right.createdAt))
    );

  for (const job of staleSaved) {
    recommendations.push({
      id: `stale-saved:${job.id}`,
      type: 'stale-saved',
      title: `Decide on ${job.company || 'this saved job'}`,
      detail: `${job.role || 'This role'} has been saved for at least 7 days.`,
      actionLabel: 'Review saved job',
      jobId: job.id,
      stage: job.stage,
    });
  }

  for (const query of queryRows.filter(row =>
    row.enabled && row.reviewedResults >= 10 && row.saveRate !== null && row.saveRate < 10
  )) {
    recommendations.push({
      id: `low-performing-query:${query.id}`,
      type: 'low-performing-query',
      title: `Refine ${query.name}`,
      detail: `${query.reviewedResults} reviewed matches produced a ${query.saveRate}% save rate.`,
      actionLabel: 'Review query',
      queryId: query.id,
    });
  }

  return recommendations;
}

export function parseInsightsRange(range = '90d', now = new Date()) {
  if (!INSIGHTS_RANGES.includes(range)) {
    throw new AppError(400, 'INVALID_INSIGHTS_RANGE', 'Range must be 30d, 90d, or all');
  }
  if (range === 'all') return { range, startsAt: null };
  const days = range === '30d' ? 30 : 90;
  return { range, startsAt: new Date(now.getTime() - days * DAY_MS) };
}

export function buildInsights(snapshot, { range, startsAt, now = new Date() }) {
  const currentTime = asDate(now);
  const coverage = asDate(snapshot.historyCoverageStartsAt);
  const { outcomes, funnel } = buildOutcomeMetrics(snapshot.jobs, snapshot.events, startsAt);
  const discovery = groupDiscovery(snapshot.listingMatches, snapshot.queries, startsAt);

  return {
    range,
    generatedAt: currentTime.toISOString(),
    historyCoverageStartsAt: coverage?.toISOString() ?? null,
    historyCompleteForRange: Boolean(startsAt && coverage && startsAt >= coverage),
    outcomes,
    funnel,
    weeklyActivity: buildWeeklyActivity(snapshot.events, startsAt, currentTime),
    recommendations: buildRecommendations(snapshot.jobs, snapshot.events, discovery.queries, currentTime),
    discovery,
  };
}
