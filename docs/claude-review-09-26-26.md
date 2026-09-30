# Two bugs I found
- The seeded "Auburn IT infrastructure" query can't be edited in the UI. Its keywords are empty (migration 006), and SavedQueries.jsx blocks saving when keywords are empty (if (!cleaned.name || !cleaned.keywords) return;). Clicking Save does nothing and shows no error.
- The scoring text in the review queue is out of date. ReviewQueue.jsx:40 says scores combine "title fit, description fit, and posting recency." The real scorer (server/discovery/evaluateListing.js) also counts distance (15 pts) and optional terms (10 pts).
Tier 1: expose what the backend already does
Structured query editor. The API accepts a geocoded center, preferred and maximum radius, role families, required/optional/excluded terms, and a minimum salary. It also has resolveQueryLocation, previewQuery and runQuery. The form only sets name, keywords, location and age. A proper editor would have:
a location picker with a radius slider
role-family checkboxes
term inputs
a live preview ("~14 listings would match right now")
Discovery browser. GET /api/listings supports text search, filters (role family, distance band, score range, salary known/unknown, status) and four sorts (best, nearest, newest, salary). api.listListings exists but nothing calls it. A "Browse" view would also let you look back at dismissed and expired listings.
Show why each match matched. The server stores distanceMiles, distanceBand, matchFacts (matched synonyms and terms), contractTime/contractType and description. MatchCard shows almost none of it. Add a distance badge, "Matched: help desk, Active Directory" chips, full-time/contract tags and an expandable description snippet.
Run diagnostics. scrape_run_queries records each reason a listing was rejected (age, distance, terms, salary, remote-only, duplicates, truncated). Showing these through api.runDetail answers "why did I get 0 matches today?" A funnel chart would fit well.
Tier 2: signals for better-quality postings
Entry-level fit score. Pull "3+ years", "Senior/Lead/Manager/Principal", "clearance required" and certification requirements out of the title and description. Show a fit badge and let a query filter or down-rank on it. This is useful for your own search.
Ghost and repost detection. Adzuna often carries the same role from several staffing agencies, and some listings get reposted every few weeks. Group listings by normalized company + title + location, and flag listings that keep being republished or come from known recruiters.
Salary transparency. Mark "salary listed" versus "not listed" (NY's pay-transparency law makes a missing range a signal in itself), and turn the free-text jobs.salary field into min and max numbers so it can be sorted.
Company watchlist and blocklist. Pin employers you want to see first and hide ones you never want to see.
Dismiss reasons. Offer quick picks like "too senior", "too far", "agency" or "pay". Today a dismissal is permanent and has no undo. The reasons could later suggest excluded terms for a query.
Finish the USAJOBS provider. The groundwork is merged (server/providers.js has the hooks). Federal IT jobs list salaries and are usually posted by the actual hiring agency.
Tier 3: pipeline usability
Real URL capture. parseJobUrl is still a stub. Reading schema.org JobPosting JSON-LD on the server would fill most drafts automatically.
Board view. Add a kanban (drag between stages) alongside the priority list.
Agenda view. nextActionAt exists but only appears in Insights. A "Today / This week" strip at the top of the Pipeline view would make follow-ups hard to miss.
Contacts and interview log. Add contacts per job, plus interview dates and notes. "Which resume version did I send?" is the question you'll need answered right before an interview.
Keyboard triage. Use j/k to move, s to save, d to dismiss and o to open when working through the review queue.
UI/UX enjoyment
Less toast noise. Every drag-reorder shows "Job priority updated." Keep toasts for undoable or failed actions.
Celebrate progress. Add a small animation when a job moves to Interviewing or Offer, a weekly goal ("5 applications: 3/5"), and a streak on the momentum chart. Job hunting wears people down, and small wins help.
Dark mode. There are 31 hardcoded hex colors in src/components/ (for example #fbefed and #fff), which breaks the theme-token rule in CLAUDE.md. Moving them into theme.js is the prerequisite for a dark theme.
Shareable view state. Put the view, stage filter and discovery filters in the URL so refreshing or bookmarking keeps your place.
A morning digest. The Pi already scrapes at 06:00. A push notification (ntfy, which is self-hosted) or an email with the top 3 new matches brings you back to the app without having to remember to check.
My recommended order
Fix the Auburn editing bug and build the structured query editor. They're one piece of work and unlock everything else in discovery.
Show why each match matched on the match card. It's all frontend, since the data is already in the API.
Add the entry-level fit signal. It's a pure, testable function in the style of evaluateListing.js, and the biggest boost to posting quality for you.
