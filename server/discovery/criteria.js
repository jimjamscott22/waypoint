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

const STATE_ABBREVIATIONS = new Map(Object.entries({
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'puerto rico': 'PR',
}));

// Nominatim labels a place "City of Syracuse"; Adzuna wants the bare locality.
const CIVIC_PREFIX = /^(?:city|town|village|hamlet|borough|township|municipality) of\s+/i;

// Adzuna geocodes `where` on its side and answers HTTP 200 with count 0 — never an
// error — when it cannot resolve the string. A full Nominatim display name is exactly
// such a string, so passing one through empties the feed with no signal anywhere. Reduce
// it to the "Locality, ST" form Adzuna does resolve, and fall back to the original
// whenever that cannot be derived, which keeps hand-entered values working untouched.
export function providerLocation(displayName) {
  const raw = String(displayName ?? '').trim();
  const segments = raw.split(',').map(segment => segment.trim()).filter(Boolean);
  if (segments.length < 2) return raw;
  if (segments.length === 2 && /^[A-Z]{2}$/.test(segments[1])) return raw;

  // The state is the last segment that names one; "Washington, Washington County, Utah"
  // must resolve to UT, not WA.
  let state;
  for (const segment of segments) {
    const abbreviation = STATE_ABBREVIATIONS.get(segment.toLowerCase());
    if (abbreviation) state = abbreviation;
  }
  if (!state) return raw;

  const locality = segments[0].replace(CIVIC_PREFIX, '').trim();
  return locality ? `${locality}, ${state}` : raw;
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
    where: providerLocation(query.center.displayName),
    distanceKm: Math.ceil(milesToKilometres(query.maximumRadiusMiles)),
    maxDaysOld: query.maxAgeDays,
    sortBy: 'date',
    salaryMin: minimumSalary ?? undefined,
    includeUnknownSalary: minimumSalary == null ? undefined : true,
  };
}
