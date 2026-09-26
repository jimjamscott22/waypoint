// External job boards shown in the Boards view. `search` describes how to
// deep-link into a board's own search; boards without one (sign-in walls,
// role-slug routing) link to their landing page instead.
export const JOB_BOARDS = [
  {
    id: 'linkedin',
    name: 'LinkedIn Jobs',
    url: 'https://www.linkedin.com/jobs/',
    category: 'Network',
    description: 'The largest professional network. Listings sit next to the people who work there, so you can find a referral or message a recruiter before you apply.',
    bestFor: ['Referrals', 'Recruiter outreach', 'Company research'],
    search: { url: 'https://www.linkedin.com/jobs/search/', keywords: 'keywords', location: 'location' },
  },
  {
    id: 'indeed',
    name: 'Indeed',
    url: 'https://www.indeed.com/',
    category: 'Aggregator',
    description: 'A high-volume aggregator that pulls listings from company career pages and other boards. Good for seeing the whole market in a single search.',
    bestFor: ['Breadth', 'Local roles', 'Salary estimates'],
    search: { url: 'https://www.indeed.com/jobs', keywords: 'q', location: 'l' },
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor',
    url: 'https://www.glassdoor.com/',
    category: 'Research',
    description: 'Job listings paired with anonymous employee reviews, salary reports, and real interview questions. Useful for vetting a company before you commit time to it.',
    bestFor: ['Company reviews', 'Salary data', 'Interview prep'],
    search: { url: 'https://www.glassdoor.com/Job/jobs.htm', keywords: 'sc.keyword' },
  },
  {
    id: 'handshake',
    name: 'Handshake',
    url: 'https://joinhandshake.com/',
    category: 'Early career',
    description: 'Built for students and recent graduates. Employers recruit from specific schools here, and many universities keep access open for recent alumni.',
    bestFor: ['New grads', 'Internships', 'Campus recruiting'],
    search: null,
    note: 'Sign in with your school account to search.',
  },
  {
    id: 'wellfound',
    name: 'Wellfound',
    url: 'https://wellfound.com/jobs',
    category: 'Startups',
    description: 'Formerly AngelList Talent. Startup roles that show salary and equity up front, and applications often go straight to a founder or hiring manager.',
    bestFor: ['Startups', 'Transparent pay', 'Remote roles'],
    search: null,
    note: 'Browse by role and location on the site.',
  },
  {
    id: 'dice',
    name: 'Dice',
    url: 'https://www.dice.com/',
    category: 'Tech',
    description: 'A board dedicated to technology careers, from support and QA through software engineering. Filters for contract versus full-time work are especially useful.',
    bestFor: ['Tech-only', 'Contract roles', 'IT & support'],
    search: { url: 'https://www.dice.com/jobs', keywords: 'q', location: 'location' },
  },
  {
    id: 'builtin',
    name: 'Built In',
    url: 'https://builtin.com/jobs',
    category: 'Tech',
    description: 'Tech jobs at startups and established tech companies, with profiles covering culture, benefits, and perks. Organized around regional tech hubs.',
    bestFor: ['Tech companies', 'Culture fit', 'Remote roles'],
    search: { url: 'https://builtin.com/jobs', keywords: 'search' },
  },
  {
    id: 'usajobs',
    name: 'USAJOBS',
    url: 'https://www.usajobs.gov/',
    category: 'Public sector',
    description: 'The official board for U.S. federal government jobs, including IT specialist and data roles. Filter by hiring path to find openings aimed at recent graduates.',
    bestFor: ['Federal roles', 'Stability', 'Recent-grad paths'],
    search: { url: 'https://www.usajobs.gov/Search/Results', keywords: 'k', location: 'l' },
  },
];

// Returns the board's own search results for the given terms, or its landing
// page when the board has no search link or no keywords were given.
export function buildBoardSearchUrl(board, { keywords = '', location = '' } = {}) {
  const terms = keywords.trim();
  if (!board.search || !terms) return board.url;
  const url = new URL(board.search.url);
  url.searchParams.set(board.search.keywords, terms);
  const place = location.trim();
  if (place && board.search.location) url.searchParams.set(board.search.location, place);
  return url.toString();
}

export function boardHost(board) {
  return new URL(board.url).hostname.replace(/^www\./, '');
}
