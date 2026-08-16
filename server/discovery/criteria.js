import { ROLE_FAMILIES } from './roleFamilies.js';
import { milesToKilometres } from './distance.js';

export const RESULTS_PER_PAGE = 50;

export function buildRoleFamilyPlan(query) {
  return query.roleFamilies.map(roleFamily => ({
    roleFamily,
    synonyms: ROLE_FAMILIES[roleFamily].synonyms,
  }));
}

// Translates one structured query plus one role family into provider request parameters.
// Empty optional values stay undefined so the adapter can omit them entirely.
export function adzunaParameters(query, roleFamily, page) {
  const excluded = query.excludedTerms?.join(' ') || '';
  const minimumSalary = query.minimumSalary ?? null;
  return {
    page,
    resultsPerPage: RESULTS_PER_PAGE,
    whatOr: ROLE_FAMILIES[roleFamily].synonyms.join(' '),
    whatExclude: excluded || undefined,
    where: query.center.displayName,
    distanceKm: Math.ceil(milesToKilometres(query.maximumRadiusMiles)),
    maxDaysOld: query.maxAgeDays,
    sortBy: 'date',
    sortDirection: 'down',
    salaryMin: minimumSalary ?? undefined,
    includeUnknownSalary: minimumSalary == null ? undefined : true,
  };
}
