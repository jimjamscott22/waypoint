export const SORT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'score', label: 'Best match' }),
  Object.freeze({ id: 'date', label: 'Newest' }),
]);

const SORT_KEYS = Object.freeze({
  score: match => match.score ?? 0,
  date: match => new Date(match.publishedAt ?? 0).getTime(),
});

// Explicit index tie-break keeps order deterministic regardless of the JS
// engine's sort stability guarantees, and matches the "ties keep their
// relative order" expectation from the design.
export function sortMatches(matches, sortId) {
  const key = SORT_KEYS[sortId];
  if (!key) return matches;
  return matches
    .map((match, index) => ({ match, index }))
    .sort((a, b) => key(b.match) - key(a.match) || a.index - b.index)
    .map(entry => entry.match);
}

export const WORK_TYPE_FILTERS = Object.freeze([
  Object.freeze({ id: 'all', label: 'All' }),
  Object.freeze({ id: 'full-time', label: 'Full-time' }),
  Object.freeze({ id: 'part-time', label: 'Part-time' }),
  Object.freeze({ id: 'contract', label: 'Contract' }),
]);

// No dedicated "permanent" tab: it's the common/default case for a listing's
// contractType and not an interesting filter target on its own.
const WORK_TYPE_PREDICATES = Object.freeze({
  all: () => true,
  'full-time': match => match.contractTime === 'full_time',
  'part-time': match => match.contractTime === 'part_time',
  contract: match => match.contractType === 'contract',
});

export function filterByWorkType(matches, filterId) {
  return matches.filter(WORK_TYPE_PREDICATES[filterId] ?? WORK_TYPE_PREDICATES.all);
}

export function countByWorkType(matches) {
  return Object.fromEntries(WORK_TYPE_FILTERS.map(({ id }) => [id, matches.filter(WORK_TYPE_PREDICATES[id]).length]));
}
