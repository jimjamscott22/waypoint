# Waypoint — Job Search Dashboard: React + Vite Prototype

## Overview
Recreate the "Pipeline Dashboard" screen from `design_handoff_job_search_dashboard` (README.md + `Dashboard.dc.html`) as a working React + Vite app. High-fidelity: colors, typography, spacing, and copy per the handoff are final and must be pixel-accurate. This is a **prototype pass** — working, modular, but not over-engineered. A follow-up plan will cover additional features once this is running; a later revision will move styling out of inline style objects into a stylesheet.

Source of truth for visuals/copy/data: `README.md` (this repo root) and `Dashboard.dc.html`. `support.js` is prototype tooling only — not ported.

## Stack
- React 18 + Vite, plain JS (no TypeScript — no typed API boundary exists yet to justify it)
- Google Fonts (Bricolage Grotesque, Public Sans) via `<link>` tags in `index.html`
- No CSS framework. Styling via React inline `style` objects for this pass (see "Styling approach" below) — chosen for fastest path to pixel fidelity; explicitly slated to move to a stylesheet next revision, so today's structure must make that migration cheap.
- No router — only the Pipeline screen exists; other nav items are static/non-functional.
- No test framework requested; verify manually via `npm run dev` click-through.

## Styling approach (with future migration in mind)
To keep the later move to a real stylesheet cheap, all colors/typography/radii/spacing values live in one module, `src/theme.js`, as named constants (e.g. `color.accent`, `color.ink`, `font.heading`, `radius.card`). Components build their inline `style` objects from these constants rather than hardcoding hex/px literals inline. When the stylesheet migration happens, `theme.js` becomes the source for CSS custom properties and components swap `style={{...}}` for `className`, without re-deriving values from the README again.

Hover states (the prototype's `style-hover`) become local `useState` toggles (`isHovered`) per interactive element, merging a hover-style object over the base style.

## Component breakdown (`src/components/`)
Each component owns rendering only; state and actions live in a store hook (below) and are passed in as props — keeps components testable/replaceable independently, which matters since more screens/features are coming.

- `Sidebar.jsx` — logo, nav list (static — "Pipeline" active, others non-functional per spec), follow-up card
- `Header.jsx` — greeting + 3 stat cards; receives derived stats as props (appliedThisWeek, interviewsBooked, responseRate)
- `CaptureBar.jsx` — URL input + "Capture job" button + saved-query chips (chips are static per README — no chip-click behavior specified); calls `onCapture(url)` prop
- `PipelineTable.jsx` — stage tabs, column headers, footer count; maps `jobs` to `JobRow`
- `JobRow.jsx` — one row. Renders editable inputs when `job.isDraft`; otherwise static cells. Non-draft rows are clickable → `onSelect(job)`.
- `JobDetailPanel.jsx` — slide-over/modal with all fields of the selected job, read-only, close control. Renders only when a job is selected.
- `ReviewQueue.jsx` — header ("Scraper results", static "ran 2h ago"), intro copy, maps `queue` to `MatchCard`, tip box
- `MatchCard.jsx` — one queue match; "Save to pipeline" / "Dismiss" call `onSave(id)` / `onDismiss(id)` props

## State & data (`src/hooks/useJobsStore.js`)
Single hook, used once in `App.jsx`, passed down as props (no context needed at this scale — revisit if the tree grows with new screens).

- `jobs[]` — `{id, role, company, stage, location, salary, contact, next, urgent, isDraft?, url?, notes?}`. Seeded from the README sample data on first load; persisted to `localStorage` under a namespaced key (`waypoint.jobs`) and re-read on mount (fall back to seed data if absent/corrupt).
- `queue[]` — seeded from README sample data; **not** persisted (matches "ran 2h ago" being a static/fresh-per-load concept in this prototype).
- `stageFilter` — `'All' | 'Saved' | 'Applied' | 'Interviewing' | 'Closed'`; drives tab active state and row filtering; derived per-stage counts computed from `jobs`.
- `selectedJobId` — for the detail panel; `null` when closed.
- Actions:
  - `captureJob(url)` — calls stub `parseJobUrl(url)` (in `src/lib/parseJobUrl.js`, returns `Promise<JobDraft>` resolving immediately with `{role: '', company: '', location: '', salary: '', contact: '', url}` — a clean seam for a real scraper later), then inserts a new draft row (`isDraft: true`, `stage: 'Saved'`) at the top of `jobs`.
  - `updateDraftField(id, field, value)` — edits an in-progress draft row's fields.
  - `commitDraft(id)` — clears `isDraft`, finalizing the row into the normal pipeline.
  - `saveToPipeline(queueId)` — moves a queue match into `jobs` with `stage: 'Saved'`, removes it from `queue`.
  - `dismissMatch(queueId)` — removes a match from `queue`.
  - `selectJob(id)` / `clearSelection()`.
- Derived stats for `Header`: applied-this-week count, interviews-booked count, response rate — computed from `jobs` (matching the README's sample values of 4 / 2 / 38% given the seed data).

## Interactions (confirmed)
- Stage tabs filter rows client-side; footer count updates (`Showing N of 8 tracked jobs`).
- Row click (non-draft rows) opens `JobDetailPanel` with that job's full data, read-only, closeable.
- Sidebar items other than "Pipeline" render with correct hover styles but are non-functional (no navigation).
- "Capture job" inserts an inline-editable draft row per above; user fills fields, then commits it.
- "Save to pipeline" / "Dismiss" on match cards mutate `queue`/`jobs` as described.
- All hover transitions ~120ms ease, per README.

## Out of scope for this pass
- Any screen other than Pipeline Dashboard (Capture & queries, Contacts, Insights)
- Theme/density/queue-visibility settings UI (hardcoded to spec defaults: accent `#2f6fdb`, comfortable density, queue shown)
- Real scraper integration (stubbed via `parseJobUrl`)
- Persistence of `queue`, saved-query chip management, follow-up card logic beyond static display
- Automated tests
- Moving styles to a stylesheet (explicitly deferred to next revision — this pass just needs to make that migration cheap via `theme.js`)

A follow-up plan (after this prototype is verified working) will scope additional features the user wants to add next.
