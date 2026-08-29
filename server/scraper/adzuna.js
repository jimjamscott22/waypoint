import { sanitizeError } from '../errors.js';
import { adzunaParameters, RESULTS_PER_PAGE } from '../discovery/criteria.js';

const ENDPOINT_BASE = 'https://api.adzuna.com/v1/api/jobs/us/search';
const CONTRACT_TIMES = new Set(['full_time', 'part_time']);
const CONTRACT_TYPES = new Set(['permanent', 'contract']);

function nullableNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function coordinate(value, limit) {
  const number = nullableNumber(value);
  if (number == null || Math.abs(number) > limit) return null;
  return number;
}

function constrained(value, allowed) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  return allowed.has(normalized) ? normalized : null;
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Adzuna request timed out')), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function retryDelay(response, attempt) {
  const header = response?.headers?.get?.('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  return attempt === 0 ? 1000 : 3000;
}

export function normalizeAdzunaJob(job) {
  if (!job?.id || !job?.title || !job?.created || !job?.redirect_url) return null;
  const publishedAt = new Date(job.created);
  if (Number.isNaN(publishedAt.getTime())) return null;
  return {
    provider: 'adzuna',
    providerJobId: String(job.id),
    title: String(job.title).trim(),
    company: String(job.company?.display_name ?? '').trim(),
    location: String(job.location?.display_name ?? '').trim(),
    salaryMin: nullableNumber(job.salary_min),
    salaryMax: nullableNumber(job.salary_max),
    currency: 'USD',
    description: String(job.description ?? '').trim(),
    url: String(job.redirect_url),
    publishedAt: publishedAt.toISOString(),
    latitude: coordinate(job.latitude, 90),
    longitude: coordinate(job.longitude, 180),
    providerCategory: job.category?.tag == null ? null : String(job.category.tag).slice(0, 80),
    contractTime: constrained(job.contract_time, CONTRACT_TIMES),
    contractType: constrained(job.contract_type, CONTRACT_TYPES),
  };
}

function buildUrl({ appId, appKey, parameters }) {
  const url = new URL(`${ENDPOINT_BASE}/${parameters.page}`);
  const searchParams = url.searchParams;
  searchParams.set('app_id', appId);
  searchParams.set('app_key', appKey);
  searchParams.set('results_per_page', String(parameters.resultsPerPage));
  searchParams.set('content-type', 'application/json');
  searchParams.set('what_phrase', parameters.whatPhrase);
  if (parameters.whatExclude) searchParams.set('what_exclude', parameters.whatExclude);
  if (parameters.where) searchParams.set('where', parameters.where);
  if (parameters.distanceKm != null) searchParams.set('distance', String(parameters.distanceKm));
  if (parameters.maxDaysOld != null) searchParams.set('max_days_old', String(parameters.maxDaysOld));
  if (parameters.sortBy) searchParams.set('sort_by', parameters.sortBy);
  if (parameters.salaryMin != null) searchParams.set('salary_min', String(parameters.salaryMin));
  if (parameters.includeUnknownSalary) searchParams.set('salary_include_unknown', '1');
  return url;
}

export function createAdzunaClient({
  appId,
  appKey,
  fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  timeoutMs = 15_000,
}) {
  if (!appId || !appKey) throw new Error('Adzuna credentials are not configured');
  return {
    async search({ query, roleFamily, phrase, page = 1 }) {
      const parameters = adzunaParameters(query, roleFamily, page, phrase);
      const url = buildUrl({ appId, appKey, parameters });

      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        let response;
        try {
          response = await fetchWithTimeout(fetchImpl, url, { headers: { Accept: 'application/json' } }, timeoutMs);
          if (response.ok) {
            const payload = await response.json();
            const raw = Array.isArray(payload.results) ? payload.results : [];
            const results = raw.map(normalizeAdzunaJob).filter(Boolean);
            return {
              providerCount: nullableNumber(payload.count) ?? 0,
              page,
              pageSize: parameters.resultsPerPage ?? RESULTS_PER_PAGE,
              results,
              // Records the provider returned that could not be normalized at all.
              malformedCount: raw.length - results.length,
            };
          }
          const retryable = response.status === 429 || response.status >= 500;
          lastError = new Error(`Adzuna request failed with HTTP ${response.status}`);
          if (!retryable || attempt === 2) throw lastError;
        } catch (error) {
          lastError = error;
          const retryable = error === lastError && (response?.status === 429 || response?.status >= 500 || !response);
          if (!retryable || attempt === 2) throw new Error(sanitizeError(error));
        }
        await sleep(retryDelay(response, attempt));
      }
      throw new Error(sanitizeError(lastError));
    },
  };
}
