# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # production build
npm run preview    # serve the production build
npm test           # node --test tests/*.test.js
node --test tests/jobListOperations.test.js                   # single test file
node --test --test-name-pattern "reorders visible jobs" tests/ # single test by name
```

There is no linter or formatter configured. Tests use the built-in `node:test` runner (no Jest/Vitest), so test files import source modules directly and must use explicit `.js` extensions in import paths.

## Architecture

Waypoint is a single-screen React + Vite dashboard for tracking a job search. All state lives in the browser; there is no backend.

**All application state flows through one hook: `src/hooks/useJobsStore.js`.** `App.jsx` calls it once and passes callbacks down as props. Components are presentational and hold only local UI state (open menus, edit-mode buffers) — they never own job data. When adding a feature that touches jobs, add the action to the store and thread it through `App.jsx`, rather than introducing a second state source or context.

**Pure list logic lives in `src/lib/jobListOperations.js` and is the only tested layer.** These functions take `allJobs` and return new arrays/results with no React involvement. The store is the thin stateful wrapper around them. Put new job-list behavior here and test it; keep the store free of algorithmic logic.

**Visible vs. all jobs is a load-bearing distinction.** The store filters `jobs` by `stageFilter` into `visibleJobs` and exposes *that* as `jobs`, while `totalCount` reports the full list. Reordering therefore operates on visible IDs against the full array: `reorderVisibleJobs` permutes only the slots occupied by visible jobs and leaves filtered-out jobs pinned in place. Anything that reorders must go through `reorderVisibleJobs`/`moveVisibleJob`, and these functions defensively return the original array unchanged on any inconsistent input (duplicate IDs, unknown IDs, count mismatch, no-op).

**Persistence:** the whole `jobs` array is serialized to `localStorage` under `waypoint.jobs` in an effect on every change. `parseStoredJobs` validates on load and falls back to `INITIAL_JOBS` with a user-facing notice if the stored value is missing, invalid JSON, or not an array. Read/write failures surface as error toasts rather than throwing. The queue (`INITIAL_QUEUE`) is *not* persisted and resets each load.

**Drafts:** capturing a URL calls `parseJobUrl` (`src/lib/parseJobUrl.js`), currently a **stub** returning an empty draft. It inserts a job with `isDraft: true`, which renders inline input fields in `JobRow` and is always visible regardless of `stageFilter` until committed (`isDraft: false`) or discarded.

**Delete/undo:** `deleteJob` stashes `{ job, index }` in `deletedSnapshot` and raises a toast with `action: 'undo-delete'`. Any subsequent `notify()` or `dismissToast()` clears the snapshot, so the undo window is tied to the toast lifetime (`TOAST_DURATION_MS`, 6s).

## Styling

There are no CSS files or classes. Every component styles itself with **inline `style` objects** built from tokens in `src/theme.js` (`color`, `chipColor`, `font`, `radius`). Fonts are loaded via a Google Fonts link in `index.html`; base body styles live in that file's `<style>` block. Follow the token pattern — do not hardcode hex values or introduce a CSS framework. The layout is deliberately desktop-first (`minWidth: 1280` on the app shell).

## Reference files

`Dashboard.dc.html`, `support.js`, and `.thumbnail` at the repo root are the original design handoff artifacts, not part of the build. Consult them for visual intent; do not import from or edit them.
