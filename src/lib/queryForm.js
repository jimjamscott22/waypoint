import { ROLE_FAMILIES, ROLE_FAMILY_IDS } from '../../server/discovery/roleFamilies.js';

// Mirrors the limits enforced by server/routes/queries.js so the editor can explain a
// problem before the request is rejected.
export const MAX_AGE_OPTIONS = Object.freeze([1, 3, 7, 14, 30]);
export const MAX_RADIUS_MILES = 40;
export const MAX_TERMS = 20;
export const MAX_TERM_LENGTH = 60;
export const MAX_NAME_LENGTH = 80;

const DEFAULT_PREFERRED_RADIUS_MILES = 20;
const DEFAULT_MAXIMUM_RADIUS_MILES = 40;

export const ROLE_FAMILY_OPTIONS = Object.freeze(ROLE_FAMILY_IDS.map(id => Object.freeze({
  id,
  label: ROLE_FAMILIES[id].label,
  synonyms: ROLE_FAMILIES[id].synonyms,
})));

const EMPTY_CENTER = Object.freeze({ displayName: null, latitude: null, longitude: null, provider: null, placeId: null });

export function isPinned(center) {
  return Number.isFinite(center?.latitude) && Number.isFinite(center?.longitude);
}

function termsToText(terms) {
  return (terms ?? []).join(', ');
}

// Commas and new lines both separate terms; duplicates collapse case-insensitively,
// matching the server's normalizeTerms so a round trip never reorders or reshapes input.
export function parseTermList(text) {
  const seen = new Set();
  return String(text ?? '')
    .split(/[,\n]/)
    .map(term => term.trim().replace(/\s+/g, ' '))
    .filter(term => {
      const key = term.toLocaleLowerCase('en-US');
      if (!term || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function queryToForm(query) {
  if (!query) {
    return {
      name: '',
      locationText: '',
      center: { ...EMPTY_CENTER },
      preferredRadiusMiles: String(DEFAULT_PREFERRED_RADIUS_MILES),
      maximumRadiusMiles: String(DEFAULT_MAXIMUM_RADIUS_MILES),
      roleFamilies: [],
      requiredTerms: '',
      optionalTerms: '',
      excludedTerms: '',
      maxAgeDays: 7,
      minimumSalary: '',
      enabled: true,
    };
  }
  const center = { ...EMPTY_CENTER, ...query.center };
  return {
    name: query.name ?? '',
    locationText: center.displayName ?? '',
    center,
    preferredRadiusMiles: String(query.preferredRadiusMiles ?? DEFAULT_PREFERRED_RADIUS_MILES),
    maximumRadiusMiles: String(query.maximumRadiusMiles ?? DEFAULT_MAXIMUM_RADIUS_MILES),
    roleFamilies: [...(query.roleFamilies ?? [])],
    requiredTerms: termsToText(query.requiredTerms),
    optionalTerms: termsToText(query.optionalTerms),
    excludedTerms: termsToText(query.excludedTerms),
    maxAgeDays: MAX_AGE_OPTIONS.includes(query.maxAgeDays) ? query.maxAgeDays : 7,
    minimumSalary: query.minimumSalary == null ? '' : String(query.minimumSalary),
    enabled: query.enabled ?? true,
  };
}

// Picking a geocoder candidate pins the center and rewrites the text to match, which is
// what tells validation the location was confirmed rather than merely typed.
export function applyLocationCandidate(form, candidate) {
  return {
    ...form,
    locationText: candidate.displayName,
    center: {
      displayName: candidate.displayName,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      provider: candidate.provider ?? null,
      placeId: candidate.placeId ?? null,
    },
  };
}

// The typed text only counts as confirmed while it still equals the stored center. An
// unchanged but unpinned center is accepted so older queries remain editable.
export function locationStatus(form) {
  const text = form.locationText.trim();
  if (!text) return 'missing';
  if (text !== (form.center.displayName ?? '')) return 'unconfirmed';
  return isPinned(form.center) ? 'pinned' : 'unpinned';
}

function parseRadius(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const miles = Number(text);
  return miles >= 1 && miles <= MAX_RADIUS_MILES ? miles : null;
}

function termErrors(text) {
  const terms = parseTermList(text);
  if (terms.length > MAX_TERMS) return `Use at most ${MAX_TERMS} terms.`;
  const long = terms.find(term => term.length > MAX_TERM_LENGTH);
  if (long) return `"${long.slice(0, 20)}…" is longer than ${MAX_TERM_LENGTH} characters.`;
  return null;
}

export function validateQueryForm(form) {
  const errors = {};
  const name = form.name.trim();
  if (!name) errors.name = 'Give the query a name.';
  else if (name.length > MAX_NAME_LENGTH) errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`;

  const location = locationStatus(form);
  if (location === 'missing') errors.location = 'Enter a place to search around.';
  else if (location === 'unconfirmed') errors.location = 'Look up this place and pick a match to confirm it.';

  const preferred = parseRadius(form.preferredRadiusMiles);
  const maximum = parseRadius(form.maximumRadiusMiles);
  if (preferred == null) errors.preferredRadiusMiles = `Use a whole number from 1 to ${MAX_RADIUS_MILES}.`;
  if (maximum == null) errors.maximumRadiusMiles = `Use a whole number from 1 to ${MAX_RADIUS_MILES}.`;
  if (preferred != null && maximum != null && preferred > maximum) {
    errors.preferredRadiusMiles = 'Preferred radius cannot exceed the maximum.';
  }

  if (form.roleFamilies.length === 0) errors.roleFamilies = 'Choose at least one role family.';

  for (const field of ['requiredTerms', 'optionalTerms', 'excludedTerms']) {
    const message = termErrors(form[field]);
    if (message) errors[field] = message;
  }

  const salary = String(form.minimumSalary ?? '').trim().replace(/[$,\s]/g, '');
  if (salary && (!/^\d+(\.\d{1,2})?$/.test(salary))) errors.minimumSalary = 'Use a plain yearly amount, like 45000.';

  return errors;
}

function parseSalary(value) {
  const text = String(value ?? '').trim().replace(/[$,\s]/g, '');
  return text ? Number(text) : null;
}

// Produces the structured request body. It never includes `keywords` or `location`,
// because either one routes the server through its legacy compatibility path.
export function formToPayload(form) {
  const displayName = form.locationText.trim();
  const center = displayName === form.center.displayName
    ? { ...form.center }
    : { ...EMPTY_CENTER, displayName };
  return {
    name: form.name.trim(),
    center,
    preferredRadiusMiles: Number(form.preferredRadiusMiles),
    maximumRadiusMiles: Number(form.maximumRadiusMiles),
    roleFamilies: ROLE_FAMILY_IDS.filter(id => form.roleFamilies.includes(id)),
    requiredTerms: parseTermList(form.requiredTerms),
    optionalTerms: parseTermList(form.optionalTerms),
    excludedTerms: parseTermList(form.excludedTerms),
    maxAgeDays: Number(form.maxAgeDays),
    minimumSalary: parseSalary(form.minimumSalary),
    enabled: Boolean(form.enabled),
  };
}

// Preview requires a pinned center, so it is offered only once the form would save
// and the location is on the map.
export function canPreview(form) {
  return Object.keys(validateQueryForm(form)).length === 0 && locationStatus(form) === 'pinned';
}

function shortPlace(displayName) {
  return String(displayName ?? '').split(',')[0].trim();
}

export function describeQuery(query) {
  const parts = [];
  const place = shortPlace(query.center?.displayName);
  if (place) {
    parts.push(query.preferredRadiusMiles && query.maximumRadiusMiles
      ? `${place} · ${query.preferredRadiusMiles}–${query.maximumRadiusMiles} mi`
      : place);
  }
  const families = query.roleFamilies?.length ?? 0;
  if (families) parts.push(`${families} role ${families === 1 ? 'family' : 'families'}`);
  if (query.maxAgeDays) parts.push(`last ${query.maxAgeDays} ${query.maxAgeDays === 1 ? 'day' : 'days'}`);
  if (query.minimumSalary != null) parts.push(`$${Number(query.minimumSalary).toLocaleString('en-US')}+`);
  return parts.join(' · ');
}

const REJECTION_LABELS = Object.freeze([
  ['rejectedTerms', 'title or terms'],
  ['rejectedDistance', 'too far'],
  ['rejectedAge', 'too old'],
  ['rejectedSalary', 'below salary'],
  ['rejectedRemoteOnly', 'remote-only'],
]);

// Turns preview diagnostics into what someone tuning a query needs to see: how many
// listings survive, and which filter is removing the rest.
export function summarizePreview(diagnostics = {}) {
  const count = key => Number(diagnostics[key] ?? 0);
  const known = [
    ['duplicates', 'already in review'],
    ['previouslySaved', 'already saved'],
    ['previouslyDismissed', 'dismissed before'],
  ].filter(([key]) => count(key) > 0).map(([key, label]) => ({ label, count: count(key) }));
  const filteredOut = REJECTION_LABELS
    .filter(([key]) => count(key) > 0)
    .map(([key, label]) => ({ label, count: count(key) }))
    .sort((left, right) => right.count - left.count);
  return {
    newMatches: count('newMatches'),
    scanned: count('recordsReceived'),
    known,
    filteredOut,
    truncated: Boolean(diagnostics.truncated),
  };
}
