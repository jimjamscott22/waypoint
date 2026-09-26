// Estimates how reachable a listing is for someone early in their career, from the
// title and whatever description the provider returned. Provider descriptions are
// often truncated, so absence of evidence yields 'unknown' rather than a guess.
//
// Buckets, strongest evidence first:
//   senior  - senior/lead/manager-style title, level III+, or 5+ years required
//   stretch - level II title, 3-4 years required, or an active clearance required
//   entry   - junior/entry/level-I title, entry-level language, or at most 2 years
//   unknown - none of the above

export const FIT_LEVELS = Object.freeze(['entry', 'stretch', 'senior', 'unknown']);

const MAX_PLAUSIBLE_YEARS = 15;

const WORD_NUMBERS = Object.freeze({
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
});

const SENIOR_TITLE_PATTERNS = [
  [/\bsenior\b|\bsr\b\.?/i, '“Senior” in title'],
  [/\blead\b/i, '“Lead” in title'],
  [/\bprincipal\b/i, '“Principal” in title'],
  [/\bmanager\b/i, 'Manager role'],
  [/\bdirector\b|\bhead of\b|\bchief\b|\bvice president\b|\bvp\b/i, 'Leadership role'],
  [/\barchitect\b/i, 'Architect role'],
  [/\bsupervisor\b/i, 'Supervisor role'],
];

const ENTRY_TITLE_PATTERNS = [
  [/\bjunior\b|\bjr\b\.?/i, 'Junior title'],
  [/\bentry[\s-]*level\b/i, 'Entry-level title'],
  [/\bassociate\b/i, 'Associate title'],
  [/\b(?:trainee|apprentice|apprenticeship|intern|internship)\b/i, 'Trainee title'],
  [/\b(?:new|recent)\s+grad(?:uate)?s?\b/i, 'New-grad title'],
];

const ENTRY_DESCRIPTION_PATTERNS = [
  [/\bentry[\s-]*level\b/i, '“Entry level” mentioned'],
  [/\bno (?:prior |previous )?experience (?:is )?(?:required|necessary|needed)\b/i, 'No experience required'],
  [/\bwill train\b|\btraining (?:is )?provided\b|\bpaid training\b|\bon[\s-]the[\s-]job training\b/i, 'Training provided'],
  [/\b(?:recent|new)\s+(?:college\s+)?grad(?:uate)?s?\b/i, 'Open to new grads'],
];

// "Active" or "current" clearances are a hard gate for most new graduates; "ability to
// obtain" one is not, so only the former counts against fit.
const CLEARANCE_PATTERN = /\b(?:active|current)\s+(?:\w+\s+){0,3}clearance\b|\bts\s*\/\s*sci\b|\btop secret\b/i;

const LEVEL_WORDS = Object.freeze({ i: 1, ii: 2, iii: 3, iv: 4, 1: 1, 2: 2, 3: 3, 4: 4 });

// Recognizes "Tier 2", "Level III", "L1", and a trailing "Technician II" or
// "Analyst 1 - Nights". Trailing roman numerals are case-sensitive so a stray lowercase
// "i" never reads as a level, and a number mid-title ("Windows 11 Support") is ignored.
function titleLevel(title) {
  const tiered = title.match(/\b(?:tier|level|lvl)\s*(iv|i{1,3}|[1-4])\b/i) ?? title.match(/\bL([1-4])\b/);
  const trailing = tiered ?? title.match(/\b(IV|III|II|I|[1-4])\s*(?:$|[-–—,(/|])/);
  return trailing ? LEVEL_WORDS[trailing[1].toLowerCase()] : null;
}

function toNumber(value) {
  const lower = value.toLowerCase();
  return Object.hasOwn(WORD_NUMBERS, lower) ? WORD_NUMBERS[lower] : Number(lower);
}

const NUMBER = '(\\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten)';
// Matches "2+ years of experience", "3-5 yrs experience", "minimum of two years' help
// desk experience", "at least 4 years in IT support experience". The lower bound of a
// range is what a posting actually requires.
const YEARS_PATTERN = new RegExp(
  `\\b${NUMBER}\\s*(?:\\+|plus)?\\s*(?:(?:-|–|to)\\s*${NUMBER}\\s*\\+?\\s*)?(?:years?|yrs?)['’]?(?:\\s+of)?\\b[^.;\\n]{0,50}?\\bexperience`,
  'gi'
);

const EMPLOYER_BOAST = /\b(?:our (?:company|team|firm|organization)|we have|we've|(?:company|firm|team) has|in business for)\b[^.]*$/i;

export function requiredYears(description) {
  const text = String(description ?? '');
  let minimum = null;
  for (const found of text.matchAll(YEARS_PATTERN)) {
    // "Our team has 10 years of experience" describes the employer, not the candidate.
    if (EMPLOYER_BOAST.test(text.slice(Math.max(0, found.index - 30), found.index))) continue;
    const years = toNumber(found[1]);
    if (!Number.isFinite(years) || years > MAX_PLAUSIBLE_YEARS) continue;
    minimum = minimum == null ? years : Math.min(minimum, years);
  }
  return minimum;
}

function matchAll(patterns, text) {
  return patterns.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

export function assessEntryLevelFit({ title, description } = {}) {
  const titleText = String(title ?? '');
  const descriptionText = String(description ?? '');
  const negative = [];
  const caution = [];
  const positive = [];

  negative.push(...matchAll(SENIOR_TITLE_PATTERNS, titleText));

  const level = titleLevel(titleText);
  if (level >= 3) negative.push(`Level ${level} title`);
  else if (level === 2) caution.push('Level 2 title');
  else if (level === 1) positive.push('Level 1 title');

  const years = requiredYears(descriptionText);
  if (years != null) {
    const label = years === 0 ? 'No years required' : `Asks ${years}+ yrs`;
    if (years >= 5) negative.push(label);
    else if (years >= 3) caution.push(label);
    else positive.push(label);
  }

  if (CLEARANCE_PATTERN.test(descriptionText) || CLEARANCE_PATTERN.test(titleText)) caution.push('Active clearance');

  positive.push(...matchAll(ENTRY_TITLE_PATTERNS, titleText));
  positive.push(...matchAll(ENTRY_DESCRIPTION_PATTERNS, descriptionText));

  const unique = labels => [...new Set(labels)];
  let fit = 'unknown';
  if (negative.length) fit = 'senior';
  else if (caution.length) fit = 'stretch';
  else if (positive.length) fit = 'entry';

  const reasons = [
    ...unique(negative).map(text => ({ text, tone: 'negative' })),
    ...unique(caution).map(text => ({ text, tone: 'caution' })),
    ...unique(positive).map(text => ({ text, tone: 'positive' })),
  ];
  return { fit, requiredYears: years, reasons };
}
