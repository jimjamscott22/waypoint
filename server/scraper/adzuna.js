import { sanitizeError } from '../errors.js';

const ENDPOINT = 'https://api.adzuna.com/v1/api/jobs/us/search/1';

function nullableNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
  };
}

export function createAdzunaClient({ appId, appKey, fetchImpl = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 15_000 }) {
  if (!appId || !appKey) throw new Error('Adzuna credentials are not configured');
  return {
    async search(query) {
      const url = new URL(ENDPOINT);
      url.searchParams.set('app_id', appId);
      url.searchParams.set('app_key', appKey);
      url.searchParams.set('results_per_page', '50');
      url.searchParams.set('content-type', 'application/json');
      url.searchParams.set('what', query.keywords);
      if (query.location) url.searchParams.set('where', query.location);

      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        let response;
        try {
          response = await fetchWithTimeout(fetchImpl, url, { headers: { Accept: 'application/json' } }, timeoutMs);
          if (response.ok) {
            const payload = await response.json();
            return (Array.isArray(payload.results) ? payload.results : []).map(normalizeAdzunaJob).filter(Boolean);
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
