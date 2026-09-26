import { assessEntryLevelFit } from '../../server/discovery/entryLevelFit.js';

export const FIT_FILTERS = Object.freeze([
  Object.freeze({ id: 'all', label: 'All' }),
  Object.freeze({ id: 'hide-senior', label: 'Hide senior' }),
  Object.freeze({ id: 'entry', label: 'Entry-level' }),
]);

const PREDICATES = Object.freeze({
  all: () => true,
  'hide-senior': match => match.fit?.fit !== 'senior',
  entry: match => match.fit?.fit === 'entry',
});

// Fit is derived from the listing text, so it is computed on the client and never
// stored; matches saved before this existed get a verdict too.
export function withFit(matches) {
  return matches.map(match => ({
    ...match,
    fit: assessEntryLevelFit({ title: match.title ?? match.role, description: match.description }),
  }));
}

export function filterByFit(matches, filter) {
  return matches.filter(PREDICATES[filter] ?? PREDICATES.all);
}

export function countByFit(matches) {
  return Object.fromEntries(FIT_FILTERS.map(({ id }) => [id, matches.filter(PREDICATES[id]).length]));
}
