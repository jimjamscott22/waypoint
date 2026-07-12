# Handoff: Waypoint — Job Search Manager Dashboard

## Overview
"Waypoint" is a personal job-search manager. This handoff covers its main screen: a **pipeline dashboard** where the user captures job postings (paste-a-URL + saved scraper queries), tracks every job through stages (Saved → Applied → Interviewing → Offer/Closed), and reviews new scraper matches in a side queue. Tone is warm and encouraging (job hunting is stressful); visuals are cool slate + blue.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behavior, not production code to copy directly. The task is to **recreate this design in a real codebase**. There is no existing target codebase: choose an appropriate modern web stack (e.g. React + Vite) and implement the design there using idiomatic patterns.

`Job Search Dashboard.dc.html` contains two parts to read:
- The markup template (inside `<x-dc>…</x-dc>`) — all styling is inline on elements.
- The logic class (inside the `<script data-dc-script>` tag) — sample data, stage-filter behavior, and stage-chip color map.

`support.js` is the prototype's rendering runtime — ignore it; do not port it.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final. Recreate pixel-perfectly.

---

## Screen: Pipeline Dashboard

Desktop web app, min-width 1280px. Three-region horizontal flex layout on a `#eef1f5` page background:

| Region | Width | Notes |
|---|---|---|
| Sidebar | 224px fixed | dark slate `#1c2734` |
| Main | flex 1 | padding 28px 32px 40px, column flex, 20px gap |
| Review queue rail | 296px fixed | padding 28px 24px 40px 0, hideable |

### 1. Sidebar (`#1c2734`, text `#c8d2dd`, padding 20px 14px)
- **Logo row**: 28×28px rounded-8px square in accent `#2f6fdb` with white "W" (Bricolage Grotesque 700 14px), wordmark "Waypoint" (Bricolage Grotesque 600 16px, white). Padding 4px 10px 22px.
- **Nav** (column, 2px gap): items "Pipeline" (active), "Capture & queries", "Contacts", "Insights".
  - Item: flex row, 10px gap, padding 9px 10px, radius 8px, 13.5px text.
  - Active: background `rgba(255,255,255,0.09)`, white 600-weight text, 7×7px accent square (radius 2px) as bullet.
  - Inactive: 7×7px circle outline `1.5px solid #6b7a8c` bullet; hover = background `rgba(255,255,255,0.05)`, white text.
- **Follow-up card** (pinned to bottom via `margin-top:auto`): background `rgba(255,255,255,0.06)`, radius 10px, padding 14px. Title "3 follow-ups due" (12px 700 white); body "Lakeview School District is the oldest — a short nudge keeps you on their radar." (11.5px, line-height 1.5, `#9fb0c2`); link "Review follow-ups →" (12px 600, light accent `#8fb4f0`).

### 2. Header row
- Left: greeting "Good morning" (Bricolage Grotesque 600 26px, letter-spacing −0.2px) with subline "2 interviews on the calendar this week — momentum is on your side." (13.5px `#5c6b7c`).
- Right: three stat cards (white, border `1px solid #e3e8ee`, radius 10px, padding 10px 16px): big number (Bricolage Grotesque 600 18px) over label (11px 500 `#5c6b7c`). Values: **4** applied this week · **2** interviews booked · **38%** response rate.

### 3. Capture bar (white card, border `#e3e8ee`, radius 12px, padding 14px 16px)
- Row 1: text input (flex 1, background `#f8fafc`, border `1px solid #dde3ea`, radius 8px, padding 10px 14px, 13px; placeholder "Paste a job posting URL — title, company, salary and location fill in automatically", placeholder color `#93a1b1`; focus: accent border + white bg) + primary button "Capture job" (accent bg, white 600 13px text, radius 8px, padding 0 18px; hover brighten).
- Row 2: label "SAVED QUERIES" (11px 600 uppercase, letter-spacing 0.6px, `#93a1b1`) + pill chips (border `1px solid #dde3ea`, radius 999px, padding 4px 11px, 12px `#3d4c5d`; hover: accent border + accent text):
  - "Sysadmin · remote · <7 days"
  - "IT support · Madison · <14 days"
  - "Network admin · hybrid"
  - "+ New query" (dashed border `#c4cdd8`, text `#93a1b1`)

### 4. Pipeline table (white card, radius 12px, border `#e3e8ee`)
- **Stage tabs** (top-left, 4px gap): All 8 · Saved 2 · Applied 3 · Interviewing 2 · Closed 1. Tab: radius 8px, padding 7px 13px, 12.5px 600. Active: `#1c2734` bg, white text. Inactive: transparent, `#5c6b7c`. Count in 500 weight at 55% opacity. Clicking filters rows. Top-right caption: "Sorted by last activity" (12px `#93a1b1`).
- **Column headers**: CSS grid `2.3fr 1fr 1.2fr 1fr 1.3fr 1.5fr`, 12px gap, padding 12px 18px 8px, 10.5px 700 uppercase letter-spacing 0.7px `#93a1b1`, bottom border `#eef1f5`. Columns: Role / Stage / Location / Salary / Contact / Next action.
- **Rows**: same grid; vertical padding 13px (comfortable) or 8px (compact density option); bottom border `#eef1f5`; hover background `#f8fafc`; cursor pointer.
  - Role cell: title 13.5px 600 (ellipsis overflow) over company 12px `#5c6b7c`.
  - Stage chip: pill radius 999px, padding 3px 10px, 11.5px 600, with 5px dot in the chip's fg color. Colors:
    - Saved: bg `#eef1f5` / fg `#5c6b7c`
    - Applied: bg `#e8effc` / fg `#2f6fdb`
    - Interviewing: bg `#fdf1df` / fg `#b26a00`
    - Offer: bg `#e3f4ec` / fg `#1f8a5b`
    - Closed: bg `#f2f2f2` / fg `#93a1b1`
  - Location / Salary / Contact: 12.5px `#3d4c5d`.
  - Next action: 12.5px; urgent items are `#b3423a` 600-weight, otherwise `#3d4c5d` 400.
- **Footer**: "Showing N of 8 tracked jobs" (12px `#93a1b1`, padding 12px 18px).

#### Sample data (seed the app with this)
| Role | Company | Stage | Location | Salary | Contact | Next action | Urgent |
|---|---|---|---|---|---|---|---|
| Systems Administrator | Corvid Managed Services | Interviewing | Remote (US) | $75–90k | Marcus Lee · IT Dir. | Tech interview · Jul 14 | yes |
| Help Desk Team Lead | Brightpath Credit Union | Interviewing | Madison, WI | $60–70k | Priya Raman · HR | Panel interview · Jul 17 | no |
| Cloud Support Associate | Nimbus Hosting | Applied | Remote (US) | $65–78k | — | Follow up · Jul 16 | no |
| IT Support Specialist II | Northlake Health System | Applied | Madison, WI · hybrid | $58–68k | Dana Whitfield · HR | Follow up · Jul 15 | no |
| Network Administrator | Lakeview School District | Applied | Middleton, WI | $62–74k | jobs@lakeview.k12 | Follow up due today | yes |
| Junior Systems Engineer | Halberd Logistics | Saved | Sun Prairie, WI | $70–82k | — | Tailor resume & apply | no |
| IT Operations Technician | Meridian Colo | Saved | Verona, WI · onsite | $55–64k | — | Research team on LinkedIn | no |
| Desktop Support Analyst | Kettering College | Closed | Madison, WI | $52–60k | HR portal | Closed Jul 1 · keep contact | no |

### 5. Review queue rail ("Scraper results")
- Header: "Scraper results" (Bricolage Grotesque 600 15px) + "ran 2h ago" (11.5px `#93a1b1`), then intro "3 new matches from your saved queries — keep the good ones, dismiss the rest." (12px `#5c6b7c`, line-height 1.5).
- **Match cards** (white, border `#e3e8ee`, radius 12px, padding 14px, column 8px gap):
  - Role 13px 600 / company 12px `#5c6b7c`; match badge top-right (10.5px 700 accent text on `#e8effc`, radius 6px, padding 3px 7px).
  - Meta line 11.5px `#93a1b1`.
  - Buttons: "Save to pipeline" (flex 1, accent outline + accent text, radius 7px, 12px 600; hover fill `#e8effc`) and "Dismiss" (border `#dde3ea`, `#93a1b1` text).
  - Cards: Fairwater Insurance Group "Systems Administrator (Linux)" 92% match, Remote · $78–92k · posted 1d ago; Oakline Veterinary Partners "IT Support Specialist" 84%, Madison · $56–63k · 3d ago; Talgrove Manufacturing "Network Admin I" 77%, Waunakee · hybrid · 2d ago.
- **Tip box**: dashed border `#c4cdd8`, radius 12px, padding 14px, 12px `#5c6b7c`: "**Tip:** queries re-run every morning. Anything you dismiss trains the match score."

---

## Interactions & Behavior
- **Stage tabs** filter the table client-side; "All" shows everything. Footer count updates.
- **Row hover**: background `#f8fafc`; rows will open a job detail view (not designed yet — stub or ask).
- **Capture job**: adds a job from the URL field. Stub the scraper: create a card holding the URL, let the user fill in fields; design a clean interface (e.g. `parseJobUrl(url): Promise<JobDraft>`) where a real scraper can plug in later.
- **Save to pipeline / Dismiss** on match cards mutate local state (move into table as Saved / remove).
- **Hovers** as specified per component above; transitions can be subtle (~120ms ease).
- No loading/error states designed; keep them minimal and consistent with the palette.

## State Management
- `jobs[]` — {id, role, company, stage, location, salary, contact, nextAction, urgent, url?, notes?}; persist in **localStorage**, seeded with sample data.
- `stageFilter` — 'All' | 'Saved' | 'Applied' | 'Interviewing' | 'Closed'.
- `queue[]` — scraper matches; `savedQueries[]` — query chip definitions.
- Derived: per-stage counts, weekly applied count, response rate.

## Design Tokens
**Colors**
- Page background `#eef1f5`; card white `#ffffff`; card border `#e3e8ee`; row divider `#eef1f5`; input bg `#f8fafc`; input border `#dde3ea`; dashed border `#c4cdd8`
- Ink `#1c2734` (also sidebar bg); secondary text `#5c6b7c`; tertiary/muted `#93a1b1`; body-mid `#3d4c5d`
- Accent `#2f6fdb`; accent soft `#e8effc`; accent light `#8fb4f0`; urgent red `#b3423a`
- Sidebar text `#c8d2dd`; sidebar muted `#9fb0c2`; sidebar bullet outline `#6b7a8c`
- Stage chips: see table above
- Alternate accent options (theme setting in prototype): `#5b5bd6` (soft `#ebebfa`), `#0f8a8a` (soft `#e2f3f3`)

**Typography** (Google Fonts)
- Headings/numbers: Bricolage Grotesque — 26px/600 greeting, 18px/600 stats, 15–16px/600 section titles & wordmark
- Body: Public Sans — 13.5px rows/nav, 13px inputs, 12–12.5px secondary, 11–11.5px meta, 10.5px table headers (uppercase)

**Radii**: 999px pills · 12px cards · 10px stat cards/sidebar card · 8px inputs/buttons/tabs/nav · 7px small buttons · 6px badges
**Spacing**: 20px main column gap · 28/32/40px main padding · 14–18px card padding · 12px grid gap
**Shadows**: none — borders only.

## Assets
None. Logo is a CSS-drawn square with a "W". No images or icon fonts; bullets/dots are CSS shapes.

## Files
- `Job Search Dashboard.dc.html` — the full design (template + logic + sample data)
- `support.js` — prototype runtime, reference only
