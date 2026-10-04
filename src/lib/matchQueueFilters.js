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
