# Daily ingestion implementation summary

## Outcome

Waypoint now has a centralized Fastify/MariaDB backend, daily Adzuna ingestion, persisted review decisions and run history, and Raspberry Pi systemd/Tailscale deployment assets. The React application continues to use `useJobsStore` as its single state owner, but all durable state is loaded and changed through the same-origin API.

## Implemented

- MariaDB 10.6+ configuration, five-connection pool, UTC sessions, explicit transactions, graceful shutdown, runtime/migration credential separation, numbered/checksummed migrations, and advisory locks.
- Tables and repositories for jobs, saved queries, listings, query matches, scrape runs, per-query results, and schema migrations.
- Seeded editable queries, Adzuna normalization, age filtering, explainable scoring, retry/timeout behavior, overlap prevention, manual cooldown, partial-run continuation, decision preservation, and 30-day expiration.
- Validated Fastify routes for bootstrap, job CRUD/reorder/import, query CRUD, listing save/dismiss, manual ingestion, and health checks with consistent error envelopes.
- API-backed React state, one-time localStorage migration prompt, query controls, real match/run state, attribution, unread counts, matched-query labels, scoring details, and manual run feedback.
- Raspberry Pi service, scraper timer, backup timer, least-privilege environment separation, Tailscale Serve helper, 14-day compressed checksummed backups, and operations documentation.

## Verification

- Focused unit/API tests use Node's built-in test runner and fake repositories.
- MariaDB integration coverage is available through `npm run test:integration` and skips unless dedicated test credentials are configured.
- Live Adzuna access is excluded from default tests and is available only through the explicit credentialed scrape command.
- Production builds use Node 24-compatible Vite 8. Dependency audit findings were removed by upgrading Vite and `@fastify/static` to Fastify 5-compatible current releases.

Pi-only checks such as live MariaDB privilege validation, `systemd-analyze verify`, Tailscale ACL authorization, reboot persistence, and backup restoration must be completed on the target Raspberry Pi using the deployment runbook.

