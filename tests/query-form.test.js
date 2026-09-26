import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLE_FAMILY_OPTIONS,
  applyLocationCandidate,
  canPreview,
  describeQuery,
  formToPayload,
  locationStatus,
  parseTermList,
  queryToForm,
  summarizePreview,
  validateQueryForm,
} from '../src/lib/queryForm.js';

// Shape of the seeded Auburn query as mapQuery returns it: structured, with no keywords.
const auburn = {
  id: '10000000-0000-4000-8000-000000000004',
  name: 'Auburn IT infrastructure',
  center: {
    displayName: 'Auburn, Cayuga County, New York, United States',
    latitude: 42.9317,
    longitude: -76.5661,
    provider: 'seeded',
    placeId: null,
  },
  preferredRadiusMiles: 20,
  maximumRadiusMiles: 40,
  roleFamilies: ['it-support', 'systems-administration'],
  requiredTerms: [],
  optionalTerms: [],
  excludedTerms: [],
  maxAgeDays: 14,
  minimumSalary: null,
  enabled: true,
  keywords: '',
  location: 'Auburn, Cayuga County, New York, United States',
};

const candidate = {
  displayName: 'Syracuse, Onondaga County, New York, United States',
  latitude: 43.0481,
  longitude: -76.1474,
  provider: 'nominatim',
  placeId: '174987',
};

test('a keyword-less structured query validates and round-trips unchanged', () => {
  const form = queryToForm(auburn);
  assert.deepEqual(validateQueryForm(form), {});
  const payload = formToPayload(form);
  assert.deepEqual(payload, {
    name: 'Auburn IT infrastructure',
    center: auburn.center,
    preferredRadiusMiles: 20,
    maximumRadiusMiles: 40,
    roleFamilies: ['systems-administration', 'it-support'],
    requiredTerms: [],
    optionalTerms: [],
    excludedTerms: [],
    maxAgeDays: 14,
    minimumSalary: null,
    enabled: true,
  });
});

test('payload never carries the legacy fields that switch the server to its compatibility path', () => {
  const payload = formToPayload(queryToForm(auburn));
  assert.equal(Object.hasOwn(payload, 'keywords'), false);
  assert.equal(Object.hasOwn(payload, 'location'), false);
});

test('a legacy query with no stored location maps to empty strings, not null', () => {
  const form = queryToForm({ ...auburn, center: { displayName: null, latitude: null, longitude: null }, location: null });
  assert.equal(form.locationText, '');
  assert.equal(locationStatus(form), 'missing');
  assert.match(validateQueryForm(form).location, /Enter a place/);
});

test('an unchanged but unpinned legacy location stays editable', () => {
  const form = queryToForm({ ...auburn, center: { displayName: 'Madison, WI', latitude: null, longitude: null } });
  assert.equal(locationStatus(form), 'unpinned');
  assert.equal(validateQueryForm(form).location, undefined);
  assert.equal(canPreview(form), false);
});

test('editing the location text requires confirming a lookup candidate', () => {
  const typed = { ...queryToForm(auburn), locationText: 'Syracuse' };
  assert.equal(locationStatus(typed), 'unconfirmed');
  assert.match(validateQueryForm(typed).location, /Look up/);

  const confirmed = applyLocationCandidate(typed, candidate);
  assert.equal(locationStatus(confirmed), 'pinned');
  assert.deepEqual(formToPayload(confirmed).center, candidate);
  assert.equal(canPreview(confirmed), true);
});

test('radius must be whole miles within range, preferred no larger than maximum', () => {
  const base = queryToForm(auburn);
  assert.ok(validateQueryForm({ ...base, preferredRadiusMiles: '0' }).preferredRadiusMiles);
  assert.ok(validateQueryForm({ ...base, maximumRadiusMiles: '41' }).maximumRadiusMiles);
  assert.ok(validateQueryForm({ ...base, maximumRadiusMiles: '12.5' }).maximumRadiusMiles);
  assert.match(validateQueryForm({ ...base, preferredRadiusMiles: '30', maximumRadiusMiles: '25' }).preferredRadiusMiles, /cannot exceed/);
  assert.deepEqual(validateQueryForm({ ...base, preferredRadiusMiles: '25', maximumRadiusMiles: '25' }), {});
});

test('requires a name and at least one role family', () => {
  const errors = validateQueryForm({ ...queryToForm(auburn), name: '   ', roleFamilies: [] });
  assert.ok(errors.name);
  assert.ok(errors.roleFamilies);
});

test('a new query starts empty and invalid until filled in', () => {
  const form = queryToForm(null);
  assert.deepEqual(Object.keys(validateQueryForm(form)).sort(), ['location', 'name', 'roleFamilies']);
  const filled = applyLocationCandidate({ ...form, name: 'Syracuse help desk', roleFamilies: ['it-support'] }, candidate);
  assert.deepEqual(validateQueryForm(filled), {});
  assert.equal(formToPayload(filled).preferredRadiusMiles, 20);
  assert.equal(formToPayload(filled).maximumRadiusMiles, 40);
});

test('term lists split on commas and new lines and collapse duplicates', () => {
  assert.deepEqual(parseTermList(' Active Directory,  help   desk\nactive directory ,, '), ['Active Directory', 'help desk']);
  assert.deepEqual(parseTermList(''), []);
  const tooMany = Array.from({ length: 21 }, (_, index) => `term${index}`).join(',');
  assert.match(validateQueryForm({ ...queryToForm(auburn), excludedTerms: tooMany }).excludedTerms, /at most 20/);
});

test('minimum salary accepts formatted amounts and rejects words', () => {
  const base = queryToForm(auburn);
  assert.equal(formToPayload({ ...base, minimumSalary: '$45,000' }).minimumSalary, 45000);
  assert.equal(formToPayload({ ...base, minimumSalary: '  ' }).minimumSalary, null);
  assert.ok(validateQueryForm({ ...base, minimumSalary: 'lots' }).minimumSalary);
});

test('role family options cover every server family with a label', () => {
  assert.ok(ROLE_FAMILY_OPTIONS.length >= 7);
  assert.ok(ROLE_FAMILY_OPTIONS.every(option => option.label && option.synonyms.length));
});

test('describes a query in one short line', () => {
  assert.equal(describeQuery(auburn), 'Auburn · 20–40 mi · 2 role families · last 14 days');
  assert.equal(describeQuery({ ...auburn, minimumSalary: 45000, maxAgeDays: 1 }), 'Auburn · 20–40 mi · 2 role families · last 1 day · $45,000+');
});

test('summarizes preview diagnostics with the heaviest filter first', () => {
  const summary = summarizePreview({
    recordsReceived: 120, newMatches: 6, duplicates: 2, previouslySaved: 0, previouslyDismissed: 1,
    rejectedAge: 4, rejectedDistance: 30, rejectedTerms: 70, rejectedSalary: 0, rejectedRemoteOnly: 7,
    truncated: true,
  });
  assert.equal(summary.newMatches, 6);
  assert.equal(summary.scanned, 120);
  assert.deepEqual(summary.known, [{ label: 'already in review', count: 2 }, { label: 'dismissed before', count: 1 }]);
  assert.deepEqual(summary.filteredOut.map(item => item.label), ['title or terms', 'too far', 'remote-only', 'too old']);
  assert.equal(summary.truncated, true);
  assert.deepEqual(summarizePreview().filteredOut, []);
});
