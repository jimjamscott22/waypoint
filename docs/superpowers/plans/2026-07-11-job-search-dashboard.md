# Waypoint Pipeline Dashboard (v0.1 Prototype) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working React + Vite recreation of the "Pipeline Dashboard" screen from `design_handoff_job_search_dashboard` (README.md + `Dashboard.dc.html`), pixel-accurate to the handoff, as a modular v0.1 prototype.

**Architecture:** Single-page app, no router. One state hook (`useJobsStore`) owns all data (jobs, queue, filters, selection) and is used once in `App.jsx`, passed down as props. Presentational components under `src/components/` each own one region of the screen. All design values (colors, fonts, radii) live in `src/theme.js` as named constants consumed by component inline `style` objects, so a later move to a real stylesheet only requires swapping how `theme.js` values are consumed, not re-deriving them from the README.

**Tech Stack:** React 18, Vite 5, plain JS (no TypeScript, no CSS framework, no router, no test framework), `localStorage` for job persistence.

## Global Constraints

- Pixel-accurate to `README.md` / `Dashboard.dc.html`: exact colors, spacing, radii, type sizes, and copy — no placeholder text or "lorem ipsum".
- Desktop-only, `min-width: 1280px` (per README) — no responsive/mobile layout in this pass.
- Styling this pass is React inline `style` objects sourced from `src/theme.js` constants — no CSS files/frameworks (explicitly deferred to next revision).
- No router: "Capture & queries", "Contacts", "Insights" nav items render with correct hover states but are non-functional.
- No automated test framework — verify each task by running `npm run dev` and checking behavior in the browser (or a one-off `node -e` sanity check for pure-data/logic files with no render surface).
- `jobs[]` persists to `localStorage` under key `waypoint.jobs`; `queue[]` does not persist (matches the prototype's static "ran 2h ago" framing).
- Theme/density/queue-visibility are hardcoded to spec defaults (accent `#2f6fdb`, comfortable density, queue shown) — no settings UI.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `index.html`
- Create: `.gitignore`
- Create: `src/main.jsx`
- Create: `src/App.jsx`

**Interfaces:**
- Produces: a running Vite dev server serving `src/App.jsx` at `#root`, with Google Fonts (Bricolage Grotesque, Public Sans) loaded and page background `#eef1f5` set globally — later tasks build on this `App.jsx`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "waypoint-job-search-dashboard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules
dist
.DS_Store
*.local
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Waypoint</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=Public+Sans:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      body { margin: 0; background: #eef1f5; font-family: 'Public Sans', system-ui, sans-serif; color: #1c2734; }
      * { box-sizing: border-box; }
      ::placeholder { color: #93a1b1; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 6: Create placeholder `src/App.jsx`**

```jsx
export default function App() {
  return <div style={{ padding: 40 }}>Waypoint — scaffold OK</div>;
}
```

- [ ] **Step 7: Install dependencies and verify dev server**

Run: `npm install`
Expected: installs without errors, creates `node_modules/` and `package-lock.json`.

Run: `npm run dev`
Expected: Vite prints a local URL (e.g. `http://localhost:5173/`). Open it in a browser — page background is light gray-blue (`#eef1f5`), text "Waypoint — scaffold OK" is visible, browser tab title is "Waypoint". Stop the server (Ctrl+C) after confirming.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html .gitignore src/main.jsx src/App.jsx
git commit -m "chore: scaffold Vite + React project"
```

---

### Task 2: Design tokens and seed data

**Files:**
- Create: `src/theme.js`
- Create: `src/lib/seedData.js`

**Interfaces:**
- Produces (from `src/theme.js`): `color` (object with keys `pageBg, cardBg, cardBorder, rowDivider, inputBg, inputBorder, dashedBorder, ink, textSecondary, textMuted, textBodyMid, accent, accentSoft, accentLight, urgent, sidebarBg, sidebarText, sidebarMuted, sidebarBulletOutline`), `chipColor` (object keyed by stage name `Saved | Applied | Interviewing | Offer | Closed`, each `{ bg, fg }`), `font` (`{ heading, body }` CSS font-family strings), `radius` (`{ pill, card, statCard, input, smallButton, badge }` numbers in px).
- Produces (from `src/lib/seedData.js`): `STAGES` (array of 5 stage-tab labels including `'All'`), `INITIAL_JOBS` (array of 8 job objects: `{ id, role, company, stage, location, salary, contact, next, urgent }`), `INITIAL_QUEUE` (array of 3 match objects: `{ id, role, company, match, meta }`).

- [ ] **Step 1: Create `src/theme.js`**

```js
export const color = {
  pageBg: '#eef1f5',
  cardBg: '#ffffff',
  cardBorder: '#e3e8ee',
  rowDivider: '#eef1f5',
  inputBg: '#f8fafc',
  inputBorder: '#dde3ea',
  dashedBorder: '#c4cdd8',
  ink: '#1c2734',
  textSecondary: '#5c6b7c',
  textMuted: '#93a1b1',
  textBodyMid: '#3d4c5d',
  accent: '#2f6fdb',
  accentSoft: '#e8effc',
  accentLight: '#8fb4f0',
  urgent: '#b3423a',
  sidebarBg: '#1c2734',
  sidebarText: '#c8d2dd',
  sidebarMuted: '#9fb0c2',
  sidebarBulletOutline: '#6b7a8c',
};

export const chipColor = {
  Saved: { bg: '#eef1f5', fg: '#5c6b7c' },
  Applied: { bg: '#e8effc', fg: '#2f6fdb' },
  Interviewing: { bg: '#fdf1df', fg: '#b26a00' },
  Offer: { bg: '#e3f4ec', fg: '#1f8a5b' },
  Closed: { bg: '#f2f2f2', fg: '#93a1b1' },
};

export const font = {
  heading: "'Bricolage Grotesque', sans-serif",
  body: "'Public Sans', system-ui, sans-serif",
};

export const radius = {
  pill: 999,
  card: 12,
  statCard: 10,
  input: 8,
  smallButton: 7,
  badge: 6,
};
```

- [ ] **Step 2: Create `src/lib/seedData.js`**

```js
export const STAGES = ['All', 'Saved', 'Applied', 'Interviewing', 'Closed'];

export const INITIAL_JOBS = [
  { id: 'job-1', role: 'Systems Administrator', company: 'Corvid Managed Services', stage: 'Interviewing', location: 'Remote (US)', salary: '$75–90k', contact: 'Marcus Lee · IT Dir.', next: 'Tech interview · Jul 14', urgent: true },
  { id: 'job-2', role: 'Help Desk Team Lead', company: 'Brightpath Credit Union', stage: 'Interviewing', location: 'Madison, WI', salary: '$60–70k', contact: 'Priya Raman · HR', next: 'Panel interview · Jul 17', urgent: false },
  { id: 'job-3', role: 'Cloud Support Associate', company: 'Nimbus Hosting', stage: 'Applied', location: 'Remote (US)', salary: '$65–78k', contact: '—', next: 'Follow up · Jul 16', urgent: false },
  { id: 'job-4', role: 'IT Support Specialist II', company: 'Northlake Health System', stage: 'Applied', location: 'Madison, WI · hybrid', salary: '$58–68k', contact: 'Dana Whitfield · HR', next: 'Follow up · Jul 15', urgent: false },
  { id: 'job-5', role: 'Network Administrator', company: 'Lakeview School District', stage: 'Applied', location: 'Middleton, WI', salary: '$62–74k', contact: 'jobs@lakeview.k12', next: 'Follow up due today', urgent: true },
  { id: 'job-6', role: 'Junior Systems Engineer', company: 'Halberd Logistics', stage: 'Saved', location: 'Sun Prairie, WI', salary: '$70–82k', contact: '—', next: 'Tailor resume & apply', urgent: false },
  { id: 'job-7', role: 'IT Operations Technician', company: 'Meridian Colo', stage: 'Saved', location: 'Verona, WI · onsite', salary: '$55–64k', contact: '—', next: 'Research team on LinkedIn', urgent: false },
  { id: 'job-8', role: 'Desktop Support Analyst', company: 'Kettering College', stage: 'Closed', location: 'Madison, WI', salary: '$52–60k', contact: 'HR portal', next: 'Closed Jul 1 · keep contact', urgent: false },
];

export const INITIAL_QUEUE = [
  { id: 'queue-1', role: 'Systems Administrator (Linux)', company: 'Fairwater Insurance Group', match: '92% match', meta: 'Remote · $78–92k · posted 1d ago · via "Sysadmin · remote"' },
  { id: 'queue-2', role: 'IT Support Specialist', company: 'Oakline Veterinary Partners', match: '84% match', meta: 'Madison, WI · $56–63k · posted 3d ago · via "IT support · Madison"' },
  { id: 'queue-3', role: 'Network Admin I', company: 'Talgrove Manufacturing', match: '77% match', meta: 'Waunakee, WI · hybrid · posted 2d ago · via "Network admin"' },
];
```

- [ ] **Step 3: Sanity-check the modules load and shapes are correct**

Run:
```bash
node -e "import('./src/theme.js').then(m => console.log(Object.keys(m.color).length, Object.keys(m.chipColor).length))"
node -e "import('./src/lib/seedData.js').then(m => console.log(m.STAGES.length, m.INITIAL_JOBS.length, m.INITIAL_QUEUE.length))"
```
Expected first command output: `18 5`
Expected second command output: `5 8 3`

- [ ] **Step 4: Commit**

```bash
git add src/theme.js src/lib/seedData.js
git commit -m "feat: add design tokens and seed data"
```

---

### Task 3: Scraper stub

**Files:**
- Create: `src/lib/parseJobUrl.js`

**Interfaces:**
- Consumes: nothing (pure function).
- Produces: `parseJobUrl(url: string): Promise<{ role: string, company: string, location: string, salary: string, contact: string, url: string }>` — used by `useJobsStore.captureJob` in Task 4.

- [ ] **Step 1: Create `src/lib/parseJobUrl.js`**

```js
// Stub for a future real scraper. Resolves immediately with an empty
// draft so the UI can let the user fill in details by hand.
export function parseJobUrl(url) {
  return Promise.resolve({
    role: '',
    company: '',
    location: '',
    salary: '',
    contact: '',
    url,
  });
}
```

- [ ] **Step 2: Verify the stub resolves the expected shape**

Run:
```bash
node -e "import('./src/lib/parseJobUrl.js').then(m => m.parseJobUrl('https://example.com/job/1').then(r => console.log(JSON.stringify(r))))"
```
Expected output: `{"role":"","company":"","location":"","salary":"","contact":"","url":"https://example.com/job/1"}`

- [ ] **Step 3: Commit**

```bash
git add src/lib/parseJobUrl.js
git commit -m "feat: add parseJobUrl scraper stub"
```

---

### Task 4: Jobs store hook

**Files:**
- Create: `src/hooks/useJobsStore.js`
- Modify: `src/App.jsx` (temporary debug render, replaced in Task 11)

**Interfaces:**
- Consumes: `STAGES, INITIAL_JOBS, INITIAL_QUEUE` from `src/lib/seedData.js` (Task 2); `parseJobUrl` from `src/lib/parseJobUrl.js` (Task 3).
- Produces: `useJobsStore()` returning `{ jobs, totalCount, stageFilter, setStageFilter, tabs, queue, selectedJob, captureJob, updateDraftField, commitDraft, discardDraft, saveToPipeline, dismissMatch, selectJob, clearSelection }`, where:
  - `jobs`: array of job objects currently visible (filtered by `stageFilter`; draft rows always included regardless of filter)
  - `totalCount`: number, total job count unfiltered
  - `tabs`: array of `{ stage, count }` for the 5 `STAGES`
  - `queue`: array of match objects
  - `selectedJob`: job object or `null`
  - `captureJob(url: string): Promise<void>` — inserts a new draft row at the top of `jobs`
  - `updateDraftField(id, field, value)`, `commitDraft(id)`, `discardDraft(id)`
  - `saveToPipeline(queueId)`, `dismissMatch(queueId)`
  - `selectJob(id)`, `clearSelection()`

- [ ] **Step 1: Create `src/hooks/useJobsStore.js`**

```js
import { useState, useEffect, useMemo, useCallback } from 'react';
import { STAGES, INITIAL_JOBS, INITIAL_QUEUE } from '../lib/seedData';
import { parseJobUrl } from '../lib/parseJobUrl';

const STORAGE_KEY = 'waypoint.jobs';

function loadJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_JOBS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_JOBS;
    return parsed;
  } catch {
    return INITIAL_JOBS;
  }
}

export function useJobsStore() {
  const [jobs, setJobs] = useState(loadJobs);
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [stageFilter, setStageFilter] = useState('All');
  const [selectedJobId, setSelectedJobId] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  const visibleJobs = useMemo(
    () => jobs.filter(j => j.isDraft || stageFilter === 'All' || j.stage === stageFilter),
    [jobs, stageFilter]
  );

  const tabs = useMemo(
    () => STAGES.map(stage => ({
      stage,
      count: stage === 'All' ? jobs.length : jobs.filter(j => j.stage === stage).length,
    })),
    [jobs]
  );

  const captureJob = useCallback(async url => {
    const draft = await parseJobUrl(url);
    const id = `draft-${Date.now()}`;
    setJobs(prev => [
      {
        id,
        role: draft.role,
        company: draft.company,
        location: draft.location,
        salary: draft.salary,
        contact: draft.contact,
        stage: 'Saved',
        next: 'Tailor resume & apply',
        urgent: false,
        isDraft: true,
        url: draft.url,
      },
      ...prev,
    ]);
  }, []);

  const updateDraftField = useCallback((id, field, value) => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, [field]: value } : j)));
  }, []);

  const commitDraft = useCallback(id => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, isDraft: false } : j)));
  }, []);

  const discardDraft = useCallback(id => {
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  const saveToPipeline = useCallback(
    queueId => {
      const match = queue.find(q => q.id === queueId);
      if (!match) return;
      setJobs(prev => [
        {
          id: `job-${match.id}`,
          role: match.role,
          company: match.company,
          stage: 'Saved',
          location: match.meta.split(' · ')[0] ?? '',
          salary: '',
          contact: '—',
          next: 'Tailor resume & apply',
          urgent: false,
        },
        ...prev,
      ]);
      setQueue(prev => prev.filter(q => q.id !== queueId));
    },
    [queue]
  );

  const dismissMatch = useCallback(queueId => {
    setQueue(prev => prev.filter(q => q.id !== queueId));
  }, []);

  const selectJob = useCallback(id => setSelectedJobId(id), []);
  const clearSelection = useCallback(() => setSelectedJobId(null), []);

  const selectedJob = useMemo(
    () => jobs.find(j => j.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  return {
    jobs: visibleJobs,
    totalCount: jobs.length,
    stageFilter,
    setStageFilter,
    tabs,
    queue,
    selectedJob,
    captureJob,
    updateDraftField,
    commitDraft,
    discardDraft,
    saveToPipeline,
    dismissMatch,
    selectJob,
    clearSelection,
  };
}
```

- [ ] **Step 2: Temporarily wire the store into `App.jsx` to verify it in the browser**

```jsx
import { useJobsStore } from './hooks/useJobsStore';

export default function App() {
  const store = useJobsStore();
  return (
    <pre style={{ padding: 40, fontSize: 12 }}>
      {JSON.stringify({ totalCount: store.totalCount, tabs: store.tabs, queueLen: store.queue.length }, null, 2)}
    </pre>
  );
}
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open the printed URL.
Expected: JSON showing `"totalCount": 8`, `tabs` with counts `All 8, Saved 2, Applied 3, Interviewing 2, Closed 1`, `"queueLen": 3`. Stop the server after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useJobsStore.js src/App.jsx
git commit -m "feat: add useJobsStore state hook"
```

---

### Task 5: Sidebar component

**Files:**
- Create: `src/components/Sidebar.jsx`

**Interfaces:**
- Consumes: `color, font, radius` from `src/theme.js`.
- Produces: `Sidebar` (default export, no props) — rendered once in `App.jsx` in Task 11.

- [ ] **Step 1: Create `src/components/Sidebar.jsx`**

```jsx
import { useState } from 'react';
import { color, font, radius } from '../theme';

const NAV_ITEMS = [
  { label: 'Pipeline', active: true },
  { label: 'Capture & queries', active: false },
  { label: 'Contacts', active: false },
  { label: 'Insights', active: false },
];

function NavItem({ label, active }) {
  const [hovered, setHovered] = useState(false);
  const bullet = active ? (
    <span style={{ width: 7, height: 7, borderRadius: 2, background: color.accent }} />
  ) : (
    <span style={{ width: 7, height: 7, borderRadius: '50%', border: `1.5px solid ${color.sidebarBulletOutline}` }} />
  );

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 10px',
        borderRadius: radius.input,
        fontSize: 13.5,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        color: active || hovered ? '#fff' : color.sidebarText,
        background: active ? 'rgba(255,255,255,0.09)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {bullet} {label}
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 224,
        flex: 'none',
        background: color.sidebarBg,
        color: color.sidebarText,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 22px' }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: radius.input,
            background: color.accent,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            font: `700 14px ${font.heading}`,
          }}
        >
          W
        </div>
        <div style={{ font: `600 16px ${font.heading}`, color: '#fff', letterSpacing: '0.2px' }}>Waypoint</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(item => (
          <NavItem key={item.label} label={item.label} active={item.active} />
        ))}
      </nav>

      <div
        style={{
          marginTop: 'auto',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: radius.statCard,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>3 follow-ups due</div>
        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: color.sidebarMuted }}>
          Lakeview School District is the oldest — a short nudge keeps you on their radar.
        </div>
        <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: color.accentLight, cursor: 'pointer' }}>
          Review follow-ups →
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Temporarily replace `src/App.jsx` contents with:
```jsx
import Sidebar from './components/Sidebar';

export default function App() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
    </div>
  );
}
```
Run: `npm run dev`, open the printed URL.
Expected: dark slate sidebar (224px wide) with "W" logo square, "Waypoint" wordmark, 4 nav items ("Pipeline" highlighted white/bold with a filled square bullet, others with outlined circle bullets), and at the bottom a "3 follow-ups due" card. Hovering an inactive nav item lightens its background. Stop the server after confirming.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.jsx src/App.jsx
git commit -m "feat: add Sidebar component"
```

---

### Task 6: Header component

**Files:**
- Create: `src/components/Header.jsx`

**Interfaces:**
- Consumes: `color, font` from `src/theme.js`.
- Produces: `Header` (default export, no props) — static stat values per README (not derived from job state, matching the source prototype which hardcodes them too).

- [ ] **Step 1: Create `src/components/Header.jsx`**

```jsx
import { color, font, radius } from '../theme';

const STATS = [
  { value: '4', label: 'applied this week' },
  { value: '2', label: 'interviews booked' },
  { value: '38%', label: 'response rate' },
];

export default function Header() {
  return (
    <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ font: `600 26px ${font.heading}`, letterSpacing: '-0.2px' }}>Good morning</div>
        <div style={{ fontSize: 13.5, color: color.textSecondary }}>
          2 interviews on the calendar this week — momentum is on your side.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {STATS.map(stat => (
          <div
            key={stat.label}
            style={{
              background: color.cardBg,
              border: `1px solid ${color.cardBorder}`,
              borderRadius: radius.statCard,
              padding: '10px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            <div style={{ font: `600 18px ${font.heading}` }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: color.textSecondary, fontWeight: 500 }}>{stat.label}</div>
          </div>
        ))}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Temporarily add `<Header />` under `<Sidebar />` inside a `<main>` wrapper in `src/App.jsx`, run `npm run dev`, and confirm: "Good morning" heading, subline text, and 3 white bordered stat cards showing 4 / 2 / 38% with correct labels, right-aligned next to the greeting. Stop the server after confirming.

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.jsx src/App.jsx
git commit -m "feat: add Header component"
```

---

### Task 7: Capture bar component

**Files:**
- Create: `src/components/CaptureBar.jsx`

**Interfaces:**
- Consumes: `color, font, radius` from `src/theme.js`; prop `onCapture(url: string): void`.
- Produces: `CaptureBar` (default export, prop `onCapture`) — calls `onCapture(trimmedUrl)` when the user submits a non-empty URL (via button click or Enter key), then clears the input.

- [ ] **Step 1: Create `src/components/CaptureBar.jsx`**

```jsx
import { useState } from 'react';
import { color, font, radius } from '../theme';

const SAVED_QUERIES = ['Sysadmin · remote · <7 days', 'IT support · Madison · <14 days', 'Network admin · hybrid'];

function QueryChip({ label }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px solid ${hovered ? color.accent : color.inputBorder}`,
        borderRadius: radius.pill,
        padding: '4px 11px',
        fontSize: 12,
        color: hovered ? color.accent : color.textBodyMid,
        cursor: 'pointer',
        background: '#fff',
        transition: 'border-color 120ms ease, color 120ms ease',
      }}
    >
      {label}
    </span>
  );
}

function NewQueryChip() {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px dashed ${hovered ? color.accent : color.dashedBorder}`,
        borderRadius: radius.pill,
        padding: '4px 11px',
        fontSize: 12,
        color: hovered ? color.accent : color.textMuted,
        cursor: 'pointer',
        transition: 'border-color 120ms ease, color 120ms ease',
      }}
    >
      + New query
    </span>
  );
}

export default function CaptureBar({ onCapture }) {
  const [url, setUrl] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);

  const handleCapture = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onCapture(trimmed);
    setUrl('');
  };

  return (
    <div
      style={{
        background: color.cardBg,
        border: `1px solid ${color.cardBorder}`,
        borderRadius: radius.card,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleCapture();
          }}
          placeholder="Paste a job posting URL — title, company, salary and location fill in automatically"
          style={{
            flex: 1,
            border: `1px solid ${inputFocused ? color.accent : color.inputBorder}`,
            borderRadius: radius.input,
            padding: '10px 14px',
            font: `400 13px ${font.body}`,
            color: color.ink,
            background: inputFocused ? '#fff' : color.inputBg,
            outline: 'none',
            transition: 'border-color 120ms ease, background 120ms ease',
          }}
        />
        <button
          onClick={handleCapture}
          onMouseEnter={() => setButtonHovered(true)}
          onMouseLeave={() => setButtonHovered(false)}
          style={{
            flex: 'none',
            border: 'none',
            borderRadius: radius.input,
            background: color.accent,
            color: '#fff',
            font: `600 13px ${font.body}`,
            padding: '0 18px',
            cursor: 'pointer',
            filter: buttonHovered ? 'brightness(1.08)' : 'none',
            transition: 'filter 120ms ease',
          }}
        >
          Capture job
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: color.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}
        >
          Saved queries
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SAVED_QUERIES.map(label => (
            <QueryChip key={label} label={label} />
          ))}
          <NewQueryChip />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Temporarily add `<CaptureBar onCapture={url => console.log('captured', url)} />` under `<Header />` in `src/App.jsx`. Run `npm run dev`. Confirm: white card with URL input + blue "Capture job" button + 4 pill chips (3 solid-border, 1 dashed "+ New query"). Type a URL, press Enter or click "Capture job" — open the browser devtools console and confirm `captured <url>` is logged and the input clears. Stop the server after confirming.

- [ ] **Step 3: Commit**

```bash
git add src/components/CaptureBar.jsx src/App.jsx
git commit -m "feat: add CaptureBar component"
```

---

### Task 8: Pipeline table (stage tabs, rows, draft editing)

**Files:**
- Create: `src/components/JobRow.jsx`
- Create: `src/components/PipelineTable.jsx`

**Interfaces:**
- Consumes: `color, font, radius, chipColor` from `src/theme.js`.
- `JobRow` produces: default export, props `{ job, columns, onSelect, onUpdateDraftField, onCommitDraft, onDiscardDraft }`. Renders `DraftJobRow` (editable inputs + Save/Discard) when `job.isDraft` is true, otherwise a static row that calls `onSelect()` on click.
- `PipelineTable` produces: default export, props `{ jobs, totalCount, tabs, stageFilter, onSelectStage, onSelectJob, onUpdateDraftField, onCommitDraft, onDiscardDraft }`.

- [ ] **Step 1: Create `src/components/JobRow.jsx`**

```jsx
import { useState } from 'react';
import { color, chipColor, font, radius } from '../theme';

function DraftJobRow({ job, columns, onUpdateDraftField, onCommitDraft, onDiscardDraft }) {
  const fieldStyle = {
    border: `1px solid ${color.inputBorder}`,
    borderRadius: radius.badge,
    padding: '4px 6px',
    font: `400 12.5px ${font.body}`,
    color: color.ink,
    width: '100%',
    outline: 'none',
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gap: 12,
        alignItems: 'center',
        padding: '10px 18px',
        borderBottom: `1px solid ${color.rowDivider}`,
        background: color.inputBg,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input style={fieldStyle} placeholder="Role" value={job.role} onChange={e => onUpdateDraftField(job.id, 'role', e.target.value)} />
        <input style={fieldStyle} placeholder="Company" value={job.company} onChange={e => onUpdateDraftField(job.id, 'company', e.target.value)} />
      </div>
      <div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: radius.pill,
            padding: '3px 10px',
            fontSize: 11.5,
            fontWeight: 600,
            background: chipColor.Saved.bg,
            color: chipColor.Saved.fg,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: chipColor.Saved.fg }} />
          Saved
        </span>
      </div>
      <input style={fieldStyle} placeholder="Location" value={job.location} onChange={e => onUpdateDraftField(job.id, 'location', e.target.value)} />
      <input style={fieldStyle} placeholder="Salary" value={job.salary} onChange={e => onUpdateDraftField(job.id, 'salary', e.target.value)} />
      <input style={fieldStyle} placeholder="Contact" value={job.contact} onChange={e => onUpdateDraftField(job.id, 'contact', e.target.value)} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onCommitDraft(job.id)}
          style={{ border: 'none', borderRadius: radius.badge, background: color.accent, color: '#fff', font: `600 11.5px ${font.body}`, padding: '5px 10px', cursor: 'pointer' }}
        >
          Save
        </button>
        <button
          onClick={() => onDiscardDraft(job.id)}
          style={{ border: `1px solid ${color.inputBorder}`, borderRadius: radius.badge, background: '#fff', color: color.textMuted, font: `500 11.5px ${font.body}`, padding: '5px 10px', cursor: 'pointer' }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

export default function JobRow({ job, columns, onSelect, onUpdateDraftField, onCommitDraft, onDiscardDraft }) {
  const [hovered, setHovered] = useState(false);

  if (job.isDraft) {
    return (
      <DraftJobRow
        job={job}
        columns={columns}
        onUpdateDraftField={onUpdateDraftField}
        onCommitDraft={onCommitDraft}
        onDiscardDraft={onDiscardDraft}
      />
    );
  }

  const chip = chipColor[job.stage];

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gap: 12,
        alignItems: 'center',
        padding: '13px 18px',
        borderBottom: `1px solid ${color.rowDivider}`,
        cursor: 'pointer',
        background: hovered ? color.inputBg : 'transparent',
        transition: 'background 120ms ease',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {job.role}
        </div>
        <div style={{ fontSize: 12, color: color.textSecondary }}>{job.company}</div>
      </div>
      <div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            borderRadius: radius.pill,
            padding: '3px 10px',
            fontSize: 11.5,
            fontWeight: 600,
            background: chip.bg,
            color: chip.fg,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: chip.fg }} />
          {job.stage}
        </span>
      </div>
      <div style={{ fontSize: 12.5, color: color.textBodyMid }}>{job.location}</div>
      <div style={{ fontSize: 12.5, color: color.textBodyMid }}>{job.salary}</div>
      <div style={{ fontSize: 12.5, color: color.textBodyMid }}>{job.contact}</div>
      <div style={{ fontSize: 12.5, fontWeight: job.urgent ? 600 : 400, color: job.urgent ? color.urgent : color.textBodyMid }}>
        {job.next}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/PipelineTable.jsx`**

```jsx
import { color, font, radius } from '../theme';
import JobRow from './JobRow';

const COLUMNS = '2.3fr 1fr 1.2fr 1fr 1.3fr 1.5fr';

function StageTab({ tab, active, onSelect }) {
  return (
    <button
      onClick={onSelect}
      style={{
        border: 'none',
        cursor: 'pointer',
        borderRadius: radius.input,
        padding: '7px 13px',
        font: `600 12.5px ${font.body}`,
        background: active ? color.ink : 'transparent',
        color: active ? '#fff' : color.textSecondary,
      }}
    >
      {tab.stage} <span style={{ opacity: 0.55, fontWeight: 500 }}>{tab.count}</span>
    </button>
  );
}

export default function PipelineTable({
  jobs,
  totalCount,
  tabs,
  stageFilter,
  onSelectStage,
  onSelectJob,
  onUpdateDraftField,
  onCommitDraft,
  onDiscardDraft,
}) {
  return (
    <div style={{ background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 0' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(tab => (
            <StageTab key={tab.stage} tab={tab} active={tab.stage === stageFilter} onSelect={() => onSelectStage(tab.stage)} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: color.textMuted }}>Sorted by last activity</div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: COLUMNS,
          gap: 12,
          padding: '12px 18px 8px',
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.7px',
          textTransform: 'uppercase',
          color: color.textMuted,
          borderBottom: `1px solid ${color.rowDivider}`,
        }}
      >
        <div>Role</div>
        <div>Stage</div>
        <div>Location</div>
        <div>Salary</div>
        <div>Contact</div>
        <div>Next action</div>
      </div>

      {jobs.map(job => (
        <JobRow
          key={job.id}
          job={job}
          columns={COLUMNS}
          onSelect={() => onSelectJob(job.id)}
          onUpdateDraftField={onUpdateDraftField}
          onCommitDraft={onCommitDraft}
          onDiscardDraft={onDiscardDraft}
        />
      ))}

      <div style={{ padding: '12px 18px', fontSize: 12, color: color.textMuted }}>
        Showing {jobs.length} of {totalCount} tracked jobs
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify in the browser**

Temporarily render, under `<CaptureBar />` in `src/App.jsx`:
```jsx
<PipelineTable
  jobs={store.jobs}
  totalCount={store.totalCount}
  tabs={store.tabs}
  stageFilter={store.stageFilter}
  onSelectStage={store.setStageFilter}
  onSelectJob={id => console.log('select', id)}
  onUpdateDraftField={store.updateDraftField}
  onCommitDraft={store.commitDraft}
  onDiscardDraft={store.discardDraft}
/>
```
(import `PipelineTable` and keep the `useJobsStore()` call from Task 4). Run `npm run dev`. Confirm: 5 stage tabs with correct counts (All 8, Saved 2, Applied 3, Interviewing 2, Closed 1), clicking a tab filters the 8 rows and updates "Showing N of 8 tracked jobs", stage chips show correct colors per stage, urgent "Next action" cells are red/bold (Systems Administrator, Network Administrator rows). Capture a job via the capture bar from Task 7 and confirm an editable draft row appears at the top with Save/Discard buttons; fill fields and click Save — row becomes a normal static row. Stop the server after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/components/JobRow.jsx src/components/PipelineTable.jsx src/App.jsx
git commit -m "feat: add PipelineTable and JobRow components"
```

---

### Task 9: Job detail panel

**Files:**
- Create: `src/components/JobDetailPanel.jsx`

**Interfaces:**
- Consumes: `color, font` from `src/theme.js`; props `{ job, onClose }` where `job` is a non-null job object.
- Produces: default export `JobDetailPanel` — a right-side overlay panel; clicking the backdrop or the close button calls `onClose()`.

- [ ] **Step 1: Create `src/components/JobDetailPanel.jsx`**

```jsx
import { color, font } from '../theme';

export default function JobDetailPanel({ job, onClose }) {
  const fields = [
    ['Company', job.company],
    ['Stage', job.stage],
    ['Location', job.location],
    ['Salary', job.salary],
    ['Contact', job.contact],
    ['Next action', job.next],
  ];

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(28,39,52,0.35)', display: 'flex', justifyContent: 'flex-end', zIndex: 10 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 360,
          background: color.cardBg,
          height: '100%',
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          borderLeft: `1px solid ${color.cardBorder}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ font: `600 18px ${font.heading}` }}>{job.role}</div>
            <div style={{ fontSize: 13, color: color.textSecondary }}>{job.company}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 18, color: color.textMuted, cursor: 'pointer' }}>
            ×
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {fields.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: color.textMuted }}>
                {label}
              </div>
              <div style={{ fontSize: 13, color: color.textBodyMid }}>{value || '—'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Temporarily update `src/App.jsx`'s `onSelectJob` to call `store.selectJob(id)`, and conditionally render `{store.selectedJob && <JobDetailPanel job={store.selectedJob} onClose={store.clearSelection} />}`. Run `npm run dev`, click a non-draft row — confirm a right-side panel slides in over a dimmed backdrop showing role/company as heading and the 6 labeled fields below. Click the "×" and separately click the dimmed backdrop — both close the panel. Stop the server after confirming.

- [ ] **Step 3: Commit**

```bash
git add src/components/JobDetailPanel.jsx src/App.jsx
git commit -m "feat: add JobDetailPanel component"
```

---

### Task 10: Review queue rail

**Files:**
- Create: `src/components/MatchCard.jsx`
- Create: `src/components/ReviewQueue.jsx`

**Interfaces:**
- Consumes: `color, font, radius` from `src/theme.js`.
- `MatchCard` produces: default export, props `{ match, onSave, onDismiss }`.
- `ReviewQueue` produces: default export, props `{ queue, onSave, onDismiss }` where `onSave`/`onDismiss` take a `queueId`.

- [ ] **Step 1: Create `src/components/MatchCard.jsx`**

```jsx
import { useState } from 'react';
import { color, font, radius } from '../theme';

export default function MatchCard({ match, onSave, onDismiss }) {
  const [saveHovered, setSaveHovered] = useState(false);
  const [dismissHovered, setDismissHovered] = useState(false);

  return (
    <div style={{ background: color.cardBg, border: `1px solid ${color.cardBorder}`, borderRadius: radius.card, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{match.role}</div>
          <div style={{ fontSize: 12, color: color.textSecondary }}>{match.company}</div>
        </div>
        <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 700, color: color.accent, background: color.accentSoft, borderRadius: radius.badge, padding: '3px 7px' }}>
          {match.match}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: color.textMuted }}>{match.meta}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button
          onClick={onSave}
          onMouseEnter={() => setSaveHovered(true)}
          onMouseLeave={() => setSaveHovered(false)}
          style={{
            flex: 1,
            border: `1px solid ${color.accent}`,
            background: saveHovered ? color.accentSoft : '#fff',
            color: color.accent,
            borderRadius: radius.smallButton,
            padding: '6px 0',
            font: `600 12px ${font.body}`,
            cursor: 'pointer',
            transition: 'background 120ms ease',
          }}
        >
          Save to pipeline
        </button>
        <button
          onClick={onDismiss}
          onMouseEnter={() => setDismissHovered(true)}
          onMouseLeave={() => setDismissHovered(false)}
          style={{
            flex: 'none',
            border: `1px solid ${color.inputBorder}`,
            background: '#fff',
            color: dismissHovered ? color.textSecondary : color.textMuted,
            borderRadius: radius.smallButton,
            padding: '6px 12px',
            font: `500 12px ${font.body}`,
            cursor: 'pointer',
            transition: 'color 120ms ease',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/ReviewQueue.jsx`**

```jsx
import { color, font, radius } from '../theme';
import MatchCard from './MatchCard';

export default function ReviewQueue({ queue, onSave, onDismiss }) {
  return (
    <aside style={{ width: 296, flex: 'none', padding: '28px 24px 40px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ font: `600 15px ${font.heading}` }}>Scraper results</div>
        <div style={{ fontSize: 11.5, color: color.textMuted }}>ran 2h ago</div>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: color.textSecondary, marginTop: -8 }}>
        3 new matches from your saved queries — keep the good ones, dismiss the rest.
      </div>

      {queue.map(match => (
        <MatchCard key={match.id} match={match} onSave={() => onSave(match.id)} onDismiss={() => onDismiss(match.id)} />
      ))}

      <div style={{ border: `1px dashed ${color.dashedBorder}`, borderRadius: radius.card, padding: 14, fontSize: 12, lineHeight: 1.55, color: color.textSecondary }}>
        <span style={{ fontWeight: 700, color: color.textBodyMid }}>Tip:</span> queries re-run every morning. Anything you dismiss trains the match score.
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Verify in the browser**

Temporarily add `<ReviewQueue queue={store.queue} onSave={store.saveToPipeline} onDismiss={store.dismissMatch} />` as a sibling after `<main>` in `src/App.jsx`. Run `npm run dev`. Confirm: "Scraper results" header with "ran 2h ago", intro copy, 3 match cards (Fairwater/92%, Oakline/84%, Talgrove/77%) each with "Save to pipeline" and "Dismiss" buttons, and a dashed tip box below. Click "Dismiss" on one card — it disappears from the rail. Click "Save to pipeline" on another — it disappears from the rail and a new row appears at the top of the pipeline table with stage "Saved". Stop the server after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/components/MatchCard.jsx src/components/ReviewQueue.jsx src/App.jsx
git commit -m "feat: add ReviewQueue and MatchCard components"
```

---

### Task 11: Final layout assembly

**Files:**
- Modify: `src/App.jsx` (replace all temporary debug wiring with the final layout)

**Interfaces:**
- Consumes: `useJobsStore` (Task 4), `Sidebar` (Task 5), `Header` (Task 6), `CaptureBar` (Task 7), `PipelineTable` (Task 8), `JobDetailPanel` (Task 9), `ReviewQueue` (Task 10).
- Produces: the complete three-region Pipeline Dashboard screen.

- [ ] **Step 1: Replace `src/App.jsx` with the final assembly**

```jsx
import { useJobsStore } from './hooks/useJobsStore';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CaptureBar from './components/CaptureBar';
import PipelineTable from './components/PipelineTable';
import JobDetailPanel from './components/JobDetailPanel';
import ReviewQueue from './components/ReviewQueue';

export default function App() {
  const store = useJobsStore();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', minWidth: 1280 }}>
      <Sidebar />

      <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Header />
        <CaptureBar onCapture={store.captureJob} />
        <PipelineTable
          jobs={store.jobs}
          totalCount={store.totalCount}
          tabs={store.tabs}
          stageFilter={store.stageFilter}
          onSelectStage={store.setStageFilter}
          onSelectJob={store.selectJob}
          onUpdateDraftField={store.updateDraftField}
          onCommitDraft={store.commitDraft}
          onDiscardDraft={store.discardDraft}
        />
      </main>

      <ReviewQueue queue={store.queue} onSave={store.saveToPipeline} onDismiss={store.dismissMatch} />

      {store.selectedJob && <JobDetailPanel job={store.selectedJob} onClose={store.clearSelection} />}
    </div>
  );
}
```

- [ ] **Step 2: Full manual verification pass**

Run: `npm run dev`, open the printed URL at a browser window at least 1280px wide.

Check each of the following (all must pass):
1. Three-region layout: dark 224px sidebar, flexible main column, 296px review rail — matches README region widths/padding.
2. Header shows "Good morning", subline, and 3 stat cards (4 / 2 / 38%).
3. Capture bar: paste a URL (e.g. `https://example.com/job/42`), click "Capture job" — an editable draft row appears at the top of the pipeline table regardless of the currently selected stage tab. Fill in Role/Company/Location/Salary/Contact, click "Save" — it becomes a normal row with stage chip "Saved".
4. Stage tabs filter rows correctly and counts match: All 9 (8 seed + 1 captured), Saved 3, Applied 3, Interviewing 2, Closed 1. Footer caption updates to match (e.g. "Showing 3 of 9 tracked jobs" under Saved).
5. Click a non-draft row — `JobDetailPanel` opens with correct fields; close via "×" and via backdrop click both work.
6. In the review queue, click "Dismiss" on one match (disappears) and "Save to pipeline" on another (disappears from queue, appears as a new Saved row in the pipeline table).
7. Reload the page (F5) — captured/edited jobs and stage changes persist (from `localStorage`); the queue resets to its original 3 matches (not persisted, by design).
8. Hover sidebar nav items, capture bar chips, table rows, and queue card buttons — confirm subtle background/color transitions, and that "Capture & queries" / "Contacts" / "Insights" are inert on click.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: assemble Pipeline Dashboard layout"
```

---

## Self-Review Notes

- **Spec coverage:** Sidebar (Task 5), Header (Task 6), Capture bar (Task 7), Pipeline table + stage tabs + rows + draft capture flow (Task 8), Job detail stub (Task 9), Review queue rail (Task 10), overall layout/state/persistence (Tasks 4, 11) — every README section (1–5) and the Interactions/State Management sections map to a task.
- **Known limitation (documented, not a gap):** committed draft jobs keep the default "Tailor resume & apply" next-action text since the draft UI doesn't expose editing that field — acceptable for a v0.1 prototype per the spec's "keep it minimal" guidance; revisit if a future feature pass adds full job editing.
- **Type/signature consistency:** `job.id`, `stage`, `isDraft`, and all action names (`captureJob`, `updateDraftField`, `commitDraft`, `discardDraft`, `saveToPipeline`, `dismissMatch`, `selectJob`, `clearSelection`) are identical across `useJobsStore.js` (Task 4), `PipelineTable`/`JobRow` (Task 8), `ReviewQueue`/`MatchCard` (Task 10), and `App.jsx` (Task 11) — verified by re-reading each task's Interfaces block against the others.
- **No placeholders:** every task has complete, runnable code — no TBDs.
