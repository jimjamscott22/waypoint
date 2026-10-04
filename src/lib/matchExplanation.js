import { ROLE_FAMILIES } from '../../server/discovery/roleFamilies.js';

export const SNIPPET_LENGTH = 220;

const BAND_RANK = Object.freeze({ preferred: 1, expanded: 2, unknown: 3 });
const BAND_LABELS = Object.freeze({
  preferred: 'in preferred area',
  expanded: 'in expanded area',
});
const CONTRACT_TIME_LABELS = Object.freeze({ full_time: 'Full-time', part_time: 'Part-time' });
const CONTRACT_TYPE_LABELS = Object.freeze({ permanent: 'Permanent', contract: 'Contract' });

function uniqueTerms(lists) {
  const seen = new Set();
  return lists.flat().filter(term => {
    const key = String(term ?? '').trim().toLocaleLowerCase('en-US');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// A listing matched by several queries is as close as its nearest query center, and
// sits in the best band any of them assigned. Queries saved before distance scoring
// carry no band at all, which is different from a known "unknown" distance.
export function bestDistance(matchedQueries) {
  const banded = matchedQueries.filter(query => query.distanceBand);
  if (!banded.length) return null;
  const band = banded
    .map(query => query.distanceBand)
    .sort((left, right) => (BAND_RANK[left] ?? 9) - (BAND_RANK[right] ?? 9))[0];
  const miles = banded
    .map(query => query.distanceMiles)
    .filter(value => Number.isFinite(value));
  const nearest = miles.length ? Math.min(...miles) : null;
  if (nearest == null) return { band: 'unknown', miles: null, label: 'Distance unknown' };
  const rounded = nearest < 1 ? '<1' : String(Math.round(nearest));
  return { band, miles: nearest, label: `${rounded} mi${BAND_LABELS[band] ? ` · ${BAND_LABELS[band]}` : ''}` };
}

function workTypeLabels(match) {
  return [CONTRACT_TIME_LABELS[match.contractTime], CONTRACT_TYPE_LABELS[match.contractType]].filter(Boolean);
}

// Collapses provider whitespace and cuts at a word boundary so the card never ends
// mid-word; the full text is still available when expanded.
export function descriptionSnippet(description, length = SNIPPET_LENGTH) {
  const text = String(description ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= length) return { text, truncated: false };
  const cut = text.slice(0, length);
  const boundary = cut.lastIndexOf(' ');
  const trimmed = (boundary > length * 0.6 ? cut.slice(0, boundary) : cut).replace(/[\s,.;:–-]+$/, '');
  return { text: `${trimmed}…`, truncated: true };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Splits text into plain and highlighted runs. Longer terms are tried first so
// "help desk analyst" wins over "help desk" when both are present.
export function highlightSegments(text, terms) {
  const source = String(text ?? '');
  const patterns = uniqueTerms([terms ?? []])
    .map(term => String(term).trim())
    .filter(term => term.length >= 2)
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp);
  if (!source || !patterns.length) return source ? [{ text: source, match: false }] : [];
  const expression = new RegExp(`(?<!\\w)(${patterns.join('|')})`, 'gi');
  const segments = [];
  let last = 0;
  for (const found of source.matchAll(expression)) {
    if (found.index > last) segments.push({ text: source.slice(last, found.index), match: false });
    segments.push({ text: found[0], match: true });
    last = found.index + found[0].length;
  }
  if (last < source.length) segments.push({ text: source.slice(last), match: false });
  return segments;
}

export function explainMatch(match) {
  const matchedQueries = match.matchedQueries ?? [];
  const facts = matchedQueries.map(query => query.matchFacts).filter(Boolean);
  const titleMatches = uniqueTerms(facts.map(fact => fact.matchedSynonyms ?? []));
  const requiredTerms = uniqueTerms(facts.map(fact => fact.requiredTerms ?? []));
  const optionalTerms = uniqueTerms(facts.map(fact => fact.optionalTerms ?? []));
  const roleFamilies = (match.roleFamilies ?? [])
    .map(id => ROLE_FAMILIES[id]?.label)
    .filter(Boolean);

  return {
    distance: bestDistance(matchedQueries),
    workType: workTypeLabels(match),
    roleFamilies,
    titleMatches,
    requiredTerms,
    optionalTerms,
    highlightTerms: uniqueTerms([titleMatches, requiredTerms, optionalTerms]),
    hasEvidence: Boolean(titleMatches.length || requiredTerms.length || optionalTerms.length || roleFamilies.length),
  };
}
