# Modern web guidance implementation

Status: UI implementation complete. Local unit/build/browser verification passed. Device deployment is blocked because this workstation has no Waypoint service or release installation. The branch is intended for a PR against `master`, the repository's default branch.

## Scope and implementation decisions

Complete the original accessibility and overlay audit while preserving the existing visual design, responsive layouts, theme tokens, store ownership, and API behavior. Include the optional motion enhancements with reduced motion and browser feature guards.

Use native Popover without a polyfill and native Dialog via `showModal()`. Menus use measured fixed coordinates instead of CSS anchor positioning. Drawer light dismissal uses `closedby="any"` and a pointer fallback when `closedBy` is unavailable. Global selectors and at-rules live in the existing `index.html` style block; component surfaces and layout remain inline. These browser support decisions are recorded in `AGENTS.md`.

## Completed work

- [x] Actions menu: escape table overflow through the top layer, flip above the last row, clamp to the viewport, reposition on scrolling/resizing, retain native light dismissal/Escape, expose disclosure state, and remove incomplete ARIA menu roles.
- [x] Drawer: native modal inertness and focus navigation, close button/Escape/backdrop dismissal, return focus, and protection against a queued Strict Mode cleanup close event.
- [x] Toast: persistent polite/assertive live regions, a manual popover, theme tokens, and independent hover/focus pause reasons that preserve the remaining six-second lifetime. Portal the notification into the active modal so Undo remains interactive.
- [x] Pipeline: table/rowgroup/row/header/cell semantics on desktop, real job-details buttons, separate posting links, and labelled draft inputs. Preserve mouse row selection and existing drag/reorder operations.
- [x] Forms: labelled URL capture with native URL validation and Enter submission; drawer form with required role/company fields, whitespace validation, error descriptions, and Enter submission. Keep edits open when a save fails.
- [x] Theme and shell: accessible Review count, dark-mode surfaces, native accent/scrollbar tokens, page metadata, and loading status.
- [x] Progressive enhancements: view transitions for view/stage changes, drawer/toast entry and exit transitions, and reduced motion handling. Correct the responsive heading's conflicting font shorthand/line-height styles found during browser QA.
- [x] Add pure helper tests for viewport positioning and timer pause/resume/disposal.
- [x] Run full unit suite, integration command, production build, and rendered desktop/mobile checks.
- [ ] **Blocked:** deploy to the device; the local installation is missing as described below.

## Affected surfaces

`src/hooks/useJobsStore.js` retains job and toast state. `src/lib/toastTimer.js` manages timeout bookkeeping; `src/lib/overlayPosition.js` calculates menu bounds. `App.jsx` supplies the active dialog element to the toast portal without introducing another job state source. `JobDetailPanel` waits for a successful store save before leaving edit mode.

The changes also touch `JobActionsMenu`, `Toast`, `PipelineTable`, `JobRow`, `CaptureBar`, `Sidebar`, `FollowUpsPanel`, `JobEngagementPanel`, `PipelineRoute`, `theme.js`, and the existing HTML shell.

## Verification evidence

- `npm ci --cache /tmp/waypoint-npm-cache`: restored the committed dependency set after the initial full test run found the installed `@fastify/rate-limit` missing. No manifest or lockfile changes. npm reported six dependency vulnerabilities (one low, two moderate, three high); dependency remediation was outside this UI change.
- `npm test`: **215 passed, zero failed**. Includes seven new positioning/timer tests for last-row flipping, short viewports, offscreen triggers, remaining lifetime, overlapping pause reasons, and disposal.
- `npm run build`: passed with Vite 8.1.5 on Node 24.22.0.
- `git diff --check`: passed.
- `npm run test:integration`: all six tests skipped because isolated MariaDB test credentials are not configured. No live database verification is claimed.
- Playwright with local Chrome at the development server `http://127.0.0.1:5173` and production preview `http://127.0.0.1:4173`, using API fixtures: wide 1440×900, compact 1024×768, and mobile 390×844; light/dark themes and reduced motion. Browser plugin was not available, so regular Playwright was used. The QA script and screenshots are under `/tmp`, outside committed source.
- Browser checks cover page identity/content, absence of framework overlays, table semantics, last-row menu bounds, Escape and return focus, modal background inertness, required validation/Enter save, retained buffers on a simulated failed save, usable toast controls inside the dialog, focus pause after hover ends, Undo, URL capture/draft labels, compact Review count, navigation, reduced motion, mobile overflow, and native plus simulated fallback dismissal. The intentional HTTP 500 in the failed-save test is the only expected console error.

Browser checks use API fixtures and do not prove production persistence or provider behavior. Actual Safari/Firefox, Orca announcement delivery, and the production device remain unverified.

## Deployment blocker

The required local deployment preflight found:

- `/opt/waypoint/current` and `/opt/waypoint/releases` do not exist.
- `systemctl show waypoint.service -p LoadState -p ActiveState` reports `LoadState=not-found` and `ActiveState=inactive`.
- `systemctl list-timers --all waypoint-scraper.timer waypoint-db-backup.timer` lists zero timers.
- `curl --fail --max-time 3 http://127.0.0.1:3000/api/health` cannot connect.
- `tailscale serve status --json` returns `{}`.

There is no installed release to upgrade or preserve for rollback on this workstation. No protected environment files were read, migrations run, symlinks changed, or services restarted. Use the authorized target device and `docs/deployment-raspberry-pi.md` to finish deployment once its installation is available.
