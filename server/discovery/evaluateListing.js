import { ROLE_FAMILIES } from './roleFamilies.js';
import { keywordCoverage } from '../scraper/scoring.js';
import { classifyDistance, haversineMiles, roundMiles } from './distance.js';

const DAY_MS = 86_400_000;

const SCORE_WEIGHTS = Object.freeze({
  titleFamily: 50,
  description: 15,
  distance: 15,
  recency: 10,
  optionalTerms: 10,
});

const DISTANCE_POINTS = Object.freeze({ preferred: 15, expanded: 7, unknown: 3 });

// Only unambiguous nationwide-remote language rejects. Hybrid and vague flexible-work
// wording stays eligible because those roles are still commutable.
const REMOTE_ONLY_PATTERNS = [
  /\bfully[\s-]*remote\b/,
  /\b100\s*%\s*remote\b/,
  /\bremote[\s-]*only\b/,
  /\bnationwide\s+remote\b/,
  /\bremote\s*[-–—,(]*\s*anywhere\b/,
  /\bwork\s+from\s+anywhere\b/,
  /\banywhere\s+in\s+the\s+(?:us\b|u\.s\.|united\s+states\b)/,
];

const HYBRID_PATTERN = /\bhybrid\b/;

function termMatches(term, text) {
  return keywordCoverage(term, text) === 1;
}

function matchedSynonymsFor(roleFamily, title) {
  return ROLE_FAMILIES[roleFamily].synonyms.filter(synonym => termMatches(synonym, title));
}

function bestSynonymCoverage(roleFamily, text) {
  return ROLE_FAMILIES[roleFamily].synonyms.reduce(
    (best, synonym) => Math.max(best, keywordCoverage(synonym, text)),
    0
  );
}

function isRemoteOnly(listing) {
  const haystack = `${listing.title ?? ''} ${listing.location ?? ''} ${listing.description ?? ''}`.toLowerCase();
  if (HYBRID_PATTERN.test(haystack)) return false;
  return REMOTE_ONLY_PATTERNS.some(pattern => pattern.test(haystack));
}

function isMalformed(listing) {
  if (!listing?.title || !listing.providerJobId || !listing.url) return true;
  return Number.isNaN(new Date(listing.publishedAt).getTime());
}

function reject(reason, extra = {}) {
  return {
    accepted: false,
    rejectReason: reason,
    distanceMiles: null,
    distanceBand: null,
    matchedRoleFamilies: [],
    matchFacts: { matchedSynonyms: [], requiredTerms: [], optionalTerms: [], excludedTerms: [] },
    score: 0,
    ...extra,
  };
}

export function evaluateListing({ query, listing, roleFamily, now = new Date() }) {
  if (isMalformed(listing)) return reject('malformed');

  const title = listing.title ?? '';
  const description = listing.description ?? '';
  const searchable = `${title} ${description}`;

  const ageDays = Math.max(0, (now.getTime() - new Date(listing.publishedAt).getTime()) / DAY_MS);
  if (ageDays > query.maxAgeDays) return reject('age');

  // The planned role family must appear in the title; description-only hits are too weak.
  const matchedSynonyms = matchedSynonymsFor(roleFamily, title);
  if (matchedSynonyms.length === 0) return reject('terms');

  const excludedTerms = (query.excludedTerms ?? []).filter(term => termMatches(term, searchable));
  if (excludedTerms.length > 0) return reject('terms', { matchFacts: emptyFactsWith({ excludedTerms }) });

  const required = query.requiredTerms ?? [];
  const requiredTerms = required.filter(term => termMatches(term, searchable));
  if (requiredTerms.length < required.length) return reject('terms', { matchFacts: emptyFactsWith({ requiredTerms }) });

  if (isRemoteOnly(listing)) return reject('remote-only');

  const hasCoordinates = Number.isFinite(listing.latitude) && Number.isFinite(listing.longitude)
    && Number.isFinite(query.center?.latitude) && Number.isFinite(query.center?.longitude);
  const rawDistanceMiles = hasCoordinates
    ? haversineMiles(
      { latitude: query.center.latitude, longitude: query.center.longitude },
      { latitude: listing.latitude, longitude: listing.longitude }
    )
    : null;
  const distanceBand = classifyDistance(rawDistanceMiles, query.preferredRadiusMiles, query.maximumRadiusMiles);
  if (distanceBand === 'rejected') {
    return reject('distance', { distanceMiles: roundMiles(rawDistanceMiles) });
  }

  // Unknown salary stays eligible; only a known ceiling below the floor disqualifies.
  if (query.minimumSalary != null && listing.salaryMax != null && listing.salaryMax < query.minimumSalary) {
    return reject('salary', { distanceMiles: roundMiles(rawDistanceMiles), distanceBand });
  }

  const optional = query.optionalTerms ?? [];
  const optionalTerms = optional.filter(term => termMatches(term, searchable));

  const score = clampScore(
    SCORE_WEIGHTS.titleFamily * bestSynonymCoverage(roleFamily, title) +
    SCORE_WEIGHTS.description * bestSynonymCoverage(roleFamily, description) +
    DISTANCE_POINTS[distanceBand] +
    SCORE_WEIGHTS.recency * Math.max(0, 1 - ageDays / query.maxAgeDays) +
    (optional.length ? SCORE_WEIGHTS.optionalTerms * (optionalTerms.length / optional.length) : 0)
  );

  const matchedRoleFamilies = (query.roleFamilies ?? []).filter(
    family => matchedSynonymsFor(family, title).length > 0
  );

  return {
    accepted: true,
    rejectReason: null,
    distanceMiles: roundMiles(rawDistanceMiles),
    distanceBand,
    matchedRoleFamilies,
    matchFacts: { matchedSynonyms, requiredTerms, optionalTerms, excludedTerms: [] },
    score,
  };
}

function emptyFactsWith(overrides) {
  return { matchedSynonyms: [], requiredTerms: [], optionalTerms: [], excludedTerms: [], ...overrides };
}

function clampScore(value) {
  return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
}
