import { ROLE_FAMILIES } from './roleFamilies.js';
import { milesToKilometres } from './distance.js';

export const RESULTS_PER_PAGE = 50;
export const PROVIDER_PHRASE_LIMIT = 3;

export function buildRoleFamilyPlan(query) {
  return query.roleFamilies.map(roleFamily => ({
    roleFamily,
    synonyms: ROLE_FAMILIES[roleFamily].synonyms,
  }));
}

// Adzuna returns only postings matching the single phrase we send, so one phrase per
// family makes whole title styles invisible. `what_or` is not a substitute: it matches
// individual tokens and floods recent pages with unrelated records. Issuing a few
// separate phrase searches is the only way to widen recall.
export function providerPhrases(roleFamily) {
  return ROLE_FAMILIES[roleFamily].synonyms.slice(0, PROVIDER_PHRASE_LIMIT);
}

// Translates one structured query plus one role family into provider request parameters.
// Empty optional values stay undefined so the adapter can omit them entirely.
export function adzunaParameters(query, roleFamily, page, phrase = providerPhrases(roleFamily)[0]) {
  const excluded = query.excludedTerms?.join(' ') || '';
  const minimumSalary = query.minimumSalary ?? null;
  return {
    page,
    resultsPerPage: RESULTS_PER_PAGE,
    whatPhrase: phrase,
    whatExclude: excluded || undefined,
    where: query.center.displayName,
    distanceKm: Math.ceil(milesToKilometres(query.maximumRadiusMiles)),
    maxDaysOld: query.maxAgeDays,
    sortBy: 'date',
    salaryMin: minimumSalary ?? undefined,
    includeUnknownSalary: minimumSalary == null ? undefined : true,
  };
}
