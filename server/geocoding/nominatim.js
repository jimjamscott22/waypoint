import { AppError } from '../errors.js';
import { sanitizeError } from '../errors.js';

const MAX_CANDIDATES = 5;
const MIN_REQUEST_INTERVAL_MS = 1_000;

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Location lookup timed out')), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function toCandidate(item) {
  const latitude = Number(item?.lat);
  const longitude = Number(item?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const displayName = String(item?.display_name ?? '').trim();
  if (!displayName) return null;
  const placeId = item?.osm_id ?? item?.place_id;
  return {
    displayName,
    latitude,
    longitude,
    provider: 'nominatim',
    placeId: placeId == null ? null : String(placeId),
  };
}

export function createNominatimClient({
  baseUrl,
  userAgent,
  fetchImpl = fetch,
  timeoutMs = 8_000,
  now = () => Date.now(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  if (!userAgent) throw new Error('Nominatim requires a contact User-Agent');

  let nextAllowedAt = 0;
  let queue = Promise.resolve();

  const resolveOne = async query => {
    const search = String(query ?? '').trim();
    if (!search) throw new AppError(400, 'INVALID_LOCATION_QUERY', 'Enter a place to look up');

    const delayMs = Math.max(0, nextAllowedAt - now());
    if (delayMs) await sleep(delayMs);
    nextAllowedAt = now() + MIN_REQUEST_INTERVAL_MS;

    const url = new URL('/search', baseUrl);
    url.search = new URLSearchParams({
      format: 'jsonv2',
      limit: String(MAX_CANDIDATES),
      countrycodes: 'us',
      q: search,
    }).toString();

    let response;
    try {
      response = await fetchWithTimeout(fetchImpl, url, {
        headers: { Accept: 'application/json', 'User-Agent': userAgent },
      }, timeoutMs);
    } catch (error) {
      throw new AppError(502, 'LOCATION_LOOKUP_FAILED', sanitizeError(error));
    }

    if (!response.ok) {
      throw new AppError(502, 'LOCATION_LOOKUP_FAILED', `Nominatim request failed with HTTP ${response.status}`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new AppError(502, 'LOCATION_LOOKUP_FAILED', sanitizeError(error));
    }

    const items = Array.isArray(payload) ? payload.slice(0, MAX_CANDIDATES) : [];
    return items.map(toCandidate).filter(Boolean);
  };

  return {
    resolve(query) {
      const operation = queue.then(() => resolveOne(query));
      queue = operation.then(() => {}, () => {});
      return operation;
    },
  };
}
