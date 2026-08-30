import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_FAMILY_IDS, ROLE_FAMILIES, normalizeTerms } from '../server/discovery/roleFamilies.js';
import { adzunaParameters, buildRoleFamilyPlan, providerPhrases } from '../server/discovery/criteria.js';
import { classifyDistance, haversineMiles, milesToKilometres } from '../server/discovery/distance.js';
import { evaluateListing } from '../server/discovery/evaluateListing.js';

const AUBURN = { latitude: 42.9317, longitude: -76.5661 };
const NOW = new Date('2026-08-12T12:00:00.000Z');

function query(overrides = {}) {
  return {
    center: { displayName: 'Auburn, Cayuga County, New York, United States', ...AUBURN },
    preferredRadiusMiles: 20,
    maximumRadiusMiles: 40,
    roleFamilies: ['systems-administration'],
    requiredTerms: [],
    optionalTerms: [],
    excludedTerms: [],
    maxAgeDays: 14,
    minimumSalary: null,
    ...overrides,
  };
}

function listing(overrides = {}) {
  return {
    providerJobId: 'listing-1',
    title: 'Systems Administrator',
    company: 'Northwind',
    location: 'Auburn, NY',
    description: 'Maintain Windows servers',
    url: 'https://example.test/listing-1',
    publishedAt: NOW.toISOString(),
    salaryMin: null,
    salaryMax: null,
    latitude: AUBURN.latitude,
    longitude: AUBURN.longitude,
    ...overrides,
  };
}

// Places a listing a given number of miles due north of the search center, using the
// same earth radius as the implementation so the conversion round-trips.
const MILES_PER_DEGREE_LATITUDE = 3958.7613 * Math.PI / 180;

function atMiles(miles, overrides = {}) {
  return listing({
    latitude: AUBURN.latitude + miles / MILES_PER_DEGREE_LATITUDE,
    longitude: AUBURN.longitude,
    ...overrides,
  });
}

function evaluate(overrides = {}, queryOverrides = {}) {
  return evaluateListing({
    query: query(queryOverrides),
    listing: listing(overrides),
    roleFamily: 'systems-administration',
    now: NOW,
  });
}

test('normalizes terms by trimming, collapsing, and removing case-insensitive duplicates', () => {
  assert.deepEqual(
    normalizeTerms(['  Windows  ', 'windows', 'Active   Directory', '', '   ', 'WINDOWS']),
    ['Windows', 'Active Directory']
  );
});

test('plans one provider request group per selected role family', () => {
  const plan = buildRoleFamilyPlan(query({ roleFamilies: ['it-support', 'cloud-support'] }));
  assert.deepEqual(plan.map(entry => entry.roleFamily), ['it-support', 'cloud-support']);
  assert.deepEqual(plan[1].synonyms, ['cloud support', 'cloud engineer', 'cloud administrator', 'cloud operations', 'Azure administrator', 'AWS administrator']);
});

test('translates a structured search into provider parameters', () => {
  const parameters = adzunaParameters(query(), 'systems-administration', 2);
  assert.deepEqual(parameters, {
    page: 2,
    resultsPerPage: 50,
    whatPhrase: 'systems administrator',
    whatExclude: undefined,
    where: 'Auburn, NY',
    distanceKm: 65,
    maxDaysOld: 14,
    sortBy: 'date',
    salaryMin: undefined,
    includeUnknownSalary: undefined,
  });

  const withSalary = adzunaParameters(query({ minimumSalary: 60000, excludedTerms: ['sales'] }), 'it-support', 1);
  assert.equal(withSalary.salaryMin, 60000);
  assert.equal(withSalary.includeUnknownSalary, true);
  assert.equal(withSalary.whatExclude, 'sales');
  assert.equal(withSalary.whatPhrase, 'IT support');
});

test('converts miles to kilometres and measures great-circle distance', () => {
  assert.equal(Math.round(milesToKilometres(40) * 1000) / 1000, 64.374);
  assert.equal(Math.round(haversineMiles(AUBURN, AUBURN)), 0);
  // Auburn to Syracuse is roughly 22 miles.
  const syracuse = { latitude: 43.0481, longitude: -76.1474 };
  const miles = haversineMiles(AUBURN, syracuse);
  assert.ok(miles > 20 && miles < 25, `expected ~22 miles, received ${miles}`);
});

test('classifies distance bands inclusively at both radius boundaries', () => {
  assert.equal(classifyDistance(20.00, 20, 40), 'preferred');
  assert.equal(classifyDistance(20.01, 20, 40), 'expanded');
  assert.equal(classifyDistance(40.00, 20, 40), 'expanded');
  assert.equal(classifyDistance(40.01, 20, 40), 'rejected');
  assert.equal(classifyDistance(null, 20, 40), 'unknown');
});

test('accepts a local listing whose title matches the planned role family', () => {
  const result = evaluate();
  assert.equal(result.accepted, true);
  assert.equal(result.rejectReason, null);
  assert.equal(result.distanceBand, 'preferred');
  assert.equal(result.distanceMiles, 0);
  assert.deepEqual(result.matchFacts.matchedSynonyms, ['systems administrator', 'system administrator']);
  assert.deepEqual(result.matchedRoleFamilies, ['systems-administration']);
});

test('requires the role family in the title rather than the description', () => {
  const result = evaluate({ title: 'Warehouse Associate', description: 'Reports to the systems administrator' });
  assert.equal(result.accepted, false);
  assert.equal(result.rejectReason, 'terms');
});

test('rejects listings past the maximum radius and keeps unknown coordinates eligible', () => {
  assert.equal(evaluate(atMiles(19.9)).distanceBand, 'preferred');
  assert.equal(evaluate(atMiles(30)).distanceBand, 'expanded');
  assert.equal(evaluate(atMiles(39.9)).distanceBand, 'expanded');

  const tooFar = evaluate(atMiles(45));
  assert.equal(tooFar.accepted, false);
  assert.equal(tooFar.rejectReason, 'distance');
  assert.ok(tooFar.distanceMiles > 40);

  const unknown = evaluate({ latitude: null, longitude: null });
  assert.equal(unknown.accepted, true);
  assert.equal(unknown.distanceBand, 'unknown');
  assert.equal(unknown.distanceMiles, null);
});

test('rejects listings older than the age limit at the day boundary', () => {
  const withinLimit = new Date(NOW.getTime() - 14 * 86_400_000).toISOString();
  const pastLimit = new Date(NOW.getTime() - 14 * 86_400_000 - 1000).toISOString();
  assert.equal(evaluate({ publishedAt: withinLimit }).accepted, true);
  assert.equal(evaluate({ publishedAt: pastLimit }).rejectReason, 'age');
});

test('enforces required and excluded terms across title and description', () => {
  const missingRequired = evaluate({}, { requiredTerms: ['Active Directory'] });
  assert.equal(missingRequired.rejectReason, 'terms');

  const satisfied = evaluate({ description: 'Maintain Active Directory and Windows servers' }, { requiredTerms: ['Active Directory'] });
  assert.equal(satisfied.accepted, true);
  assert.deepEqual(satisfied.matchFacts.requiredTerms, ['Active Directory']);

  const excluded = evaluate({ description: 'Primarily a sales role' }, { excludedTerms: ['sales'] });
  assert.equal(excluded.rejectReason, 'terms');
  assert.deepEqual(excluded.matchFacts.excludedTerms, ['sales']);

  const excludedByTitle = evaluate({ title: 'Systems Administrator - Sales Team' }, { excludedTerms: ['sales'] });
  assert.equal(excludedByTitle.rejectReason, 'terms');
});

test('rejects a known salary ceiling below the floor and keeps unknown salary eligible', () => {
  assert.equal(evaluate({ salaryMax: 40000 }, { minimumSalary: 60000 }).rejectReason, 'salary');
  assert.equal(evaluate({ salaryMax: 60000 }, { minimumSalary: 60000 }).accepted, true);
  assert.equal(evaluate({ salaryMax: null }, { minimumSalary: 60000 }).accepted, true);
});

test('rejects only explicit nationwide remote work', () => {
  const rejected = [
    'This is a fully remote position',
    'Work from anywhere in the country',
    '100% remote team',
    'Remote only, no office',
    'Nationwide remote opportunity',
    'Remote - anywhere in the US',
  ];
  for (const description of rejected) {
    assert.equal(evaluate({ description }).rejectReason, 'remote-only', description);
  }

  const accepted = [
    'Hybrid schedule with two office days',
    'Fully remote within commuting distance is available on a hybrid basis',
    'Flexible work arrangements considered',
    'Occasional remote work supported',
    'Some remote days each week',
  ];
  for (const description of accepted) {
    assert.equal(evaluate({ description }).accepted, true, description);
  }
});

test('rejects malformed records before any other rule', () => {
  assert.equal(evaluate({ title: '' }).rejectReason, 'malformed');
  assert.equal(evaluate({ url: null }).rejectReason, 'malformed');
  assert.equal(evaluate({ publishedAt: 'not-a-date' }).rejectReason, 'malformed');
});

test('scores each documented component and clamps to the 0-100 range', () => {
  // Title family 50, description 15, preferred distance 15, full recency 10, no optional terms.
  const best = evaluate({ description: 'Systems administrator maintaining servers' });
  assert.equal(best.score, 90);

  // Same listing with every optional term matched reaches the full 100.
  const complete = evaluate(
    { description: 'Systems administrator maintaining Windows servers' },
    { optionalTerms: ['windows'] }
  );
  assert.equal(complete.score, 100);

  // Half the optional terms matched contributes half of the 10-point allowance.
  const halfOptional = evaluate(
    { description: 'Systems administrator maintaining Windows servers' },
    { optionalTerms: ['windows', 'vmware'] }
  );
  assert.equal(halfOptional.score, 95);

  // An expanded-radius listing gives up 8 distance points against the preferred band.
  const expanded = evaluate({ ...atMiles(30), description: 'Systems administrator maintaining servers' });
  assert.equal(expanded.score, 82);

  // An unknown-distance listing keeps only the 3-point allowance.
  const unknown = evaluate({ latitude: null, longitude: null, description: 'Systems administrator maintaining servers' });
  assert.equal(unknown.score, 78);

  // A listing at the age limit loses the whole recency allowance.
  const oldest = evaluate({
    publishedAt: new Date(NOW.getTime() - 14 * 86_400_000).toISOString(),
    description: 'Systems administrator maintaining servers',
  });
  assert.equal(oldest.score, 80);

  // A description with no family language forfeits the description allowance.
  const bareDescription = evaluate({ description: 'Great benefits and parking' });
  assert.equal(bareDescription.score, 75);
});

test('reports every role family whose synonyms appear in the title', () => {
  const result = evaluateListing({
    query: query({ roleFamilies: ['systems-administration', 'it-support', 'cloud-support'] }),
    listing: listing({ title: 'Systems Administrator and IT Support Specialist' }),
    roleFamily: 'systems-administration',
    now: NOW,
  });
  assert.deepEqual(result.matchedRoleFamilies, ['systems-administration', 'it-support']);
});

test('supports internet service installation searches and related technician titles', () => {
  const roleFamily = 'internet-service-installation';
  const plan = buildRoleFamilyPlan(query({ roleFamilies: [roleFamily] }));

  assert.ok(ROLE_FAMILY_IDS.includes(roleFamily));
  assert.equal(plan[0].synonyms[0], 'cable installer');
  assert.equal(
    adzunaParameters(query({ roleFamilies: [roleFamily] }), roleFamily, 1).whatPhrase,
    'cable installer'
  );

  const result = evaluateListing({
    query: query({ roleFamilies: [roleFamily] }),
    listing: listing({ title: 'Entry-Level Broadband Technician' }),
    roleFamily,
    now: NOW,
  });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.matchedRoleFamilies, [roleFamily]);
});

test('covers every published role family with a usable synonym list', () => {
  for (const roleFamily of ROLE_FAMILY_IDS) {
    const plan = buildRoleFamilyPlan(query({ roleFamilies: [roleFamily] }));
    assert.ok(plan[0].synonyms.length > 0, roleFamily);
    assert.equal(
      adzunaParameters(query({ roleFamilies: [roleFamily] }), roleFamily, 1).whatPhrase,
      plan[0].synonyms[0],
      roleFamily
    );
  }
});

test('gives every role family at least three distinct provider-ready synonyms', () => {
  for (const roleFamily of ROLE_FAMILY_IDS) {
    const { synonyms } = ROLE_FAMILIES[roleFamily];
    assert.ok(synonyms.length >= 3, `${roleFamily} has ${synonyms.length} synonyms`);
    assert.equal(new Set(synonyms.map(term => term.toLowerCase())).size, synonyms.length, roleFamily);
  }
});

test('matches the local technician titles this market actually posts', () => {
  const cases = [
    ['it-support', 'IT Technician'],
    ['it-support', 'Technical Support Specialist'],
    ['desktop-support', 'Desktop Technician'],
    ['network-administration', 'Network Technician'],
    ['it-operations', 'Data Center Technician'],
    ['cloud-support', 'Cloud Engineer'],
    ['junior-systems-engineering', 'Junior Systems Engineer'],
    ['internet-service-installation', 'Installation Technician'],
  ];
  for (const [roleFamily, title] of cases) {
    const result = evaluateListing({
      query: query({ roleFamilies: [roleFamily] }),
      listing: listing({ title }),
      roleFamily,
      now: NOW,
    });
    assert.equal(result.accepted, true, `${roleFamily} rejected "${title}"`);
  }
});

test('rejects off-domain titles that only superficially resemble the family', () => {
  const cases = [
    ['junior-systems-engineering', 'Principal Systems Engineer - Radar'],
    ['junior-systems-engineering', 'Mechanical Systems Engineer'],
    ['junior-systems-engineering', 'Systems Engineering Manager'],
    ['desktop-support', 'Field Service Technician - Medical Imaging'],
    ['it-support', 'Client Support Associate - Wealth Management'],
  ];
  for (const [rf, title] of cases) {
    const result = evaluateListing({
      query: query({ roleFamilies: [rf] }),
      listing: listing({ title }),
      roleFamily: rf,
      now: NOW,
    });
    assert.equal(result.accepted, false, `${rf} accepted "${title}"`);
  }
});

test('exposes at most three provider phrases per role family', () => {
  assert.deepEqual(providerPhrases('it-support'), ['IT support', 'help desk', 'technical support']);
  assert.deepEqual(
    providerPhrases('internet-service-installation'),
    ['cable installer', 'broadband technician', 'fiber technician']
  );
  for (const roleFamily of ROLE_FAMILY_IDS) {
    const phrases = providerPhrases(roleFamily);
    assert.ok(phrases.length > 0 && phrases.length <= 3, roleFamily);
    assert.deepEqual(phrases, ROLE_FAMILIES[roleFamily].synonyms.slice(0, phrases.length));
  }
});

test('accepts an explicit provider phrase and defaults to the first one', () => {
  assert.equal(adzunaParameters(query(), 'it-support', 1).whatPhrase, 'IT support');
  assert.equal(adzunaParameters(query(), 'it-support', 1, 'help desk').whatPhrase, 'help desk');
});

// Adzuna geocodes the `where` string itself and answers HTTP 200 with count 0 when it
// cannot resolve one, so a verbose center name empties the feed silently.
test('sends the provider a location it can geocode rather than the full display name', () => {
  const cases = [
    ['City of Syracuse, Onondaga County, New York, United States', 'Syracuse, NY'],
    ['Auburn, Cayuga County, New York, United States', 'Auburn, NY'],
    ['Town of DeWitt, Onondaga County, New York, United States', 'DeWitt, NY'],
    ['Village of Liverpool, Onondaga County, New York, 13088, United States', 'Liverpool, NY'],
    ['Madison, Dane County, Wisconsin, United States', 'Madison, WI'],
  ];
  for (const [displayName, expected] of cases) {
    const parameters = adzunaParameters(query({ center: { displayName, ...AUBURN } }), 'it-support', 1);
    assert.equal(parameters.where, expected, `for ${displayName}`);
  }
});

test('leaves an already-compact location and an unparseable one alone', () => {
  const unchanged = ['Syracuse, NY', 'Madison, WI', 'Remote'];
  for (const displayName of unchanged) {
    const parameters = adzunaParameters(query({ center: { displayName, ...AUBURN } }), 'it-support', 1);
    assert.equal(parameters.where, displayName, `for ${displayName}`);
  }
});
