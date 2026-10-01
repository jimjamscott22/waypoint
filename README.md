# Waypoint

Waypoint is a private job search dashboard with a centralized MariaDB pipeline and daily Adzuna ingestion.

## Overview

This project is a React + Vite web app built around a pipeline and outcome dashboard. It helps you:

- capture job postings from a URL
- track jobs through stages like Saved, Applied, Interviewing, Offer, and Closed
- review new matches from saved queries in a side queue
- understand 30-day, 90-day, and all-time job-search outcomes
- act on overdue follow-ups, stalled applications, and low-performing searches
- keep job data synchronized through one MariaDB-backed API

## Features

- **Pipeline dashboard** with a sidebar, header stats, capture bar, job table, and review queue
- **Insights command center** with outcome metrics, a cohort funnel, weekly momentum, recommendations, and saved-query performance
- **Stage filtering** to quickly narrow the pipeline by job stage
- **Job capture** from a pasted URL, with a draft flow for filling in details by hand
- **Daily Adzuna ingestion** plus an in-app manual run
- **Review queue** for persisted matches, with save and dismiss actions
- **Job details drawer** for viewing and editing a selected job
- **Optional next-action dates** for accurate follow-up reminders
- **Contacts & outreach log** per job with follow-up reminders (phase 1)
- **In-app Coach** (optional) — LLM assistant grounded in your pipeline via read-only tools (phase 2)
- **Stage-history tracking** for forward-looking conversion and activity metrics
- **Drag-and-drop reordering** for manual priority management
- **Undoable delete flow** with toast notifications
- **Central persistence** using MariaDB 10.6+
- **Private deployment** on Raspberry Pi through Tailscale Serve

## Tech Stack

- [React](https://react.dev/)
- [Vite](https://vite.dev/)
- [Fastify](https://fastify.dev/)
- [MariaDB](https://mariadb.org/)
- JavaScript
- HTML/CSS via inline component styles and theme tokens

## Getting Started

### Prerequisites

- Node.js 24
- npm
- MariaDB 10.6+

### Install

```bash
npm install
```

Copy `.env.example` to a local environment file and provide the MariaDB and Adzuna credentials. Export those values in the shell before running commands.

### Optional: in-app Coach (LLM assistant)

The assistant uses any **OpenAI-compatible** `POST /v1/chat/completions` endpoint. Configure:

| Variable | Purpose |
|---|---|
| `ASSISTANT_BASE_URL` | API root, usually ending in `/v1` (required with model) |
| `ASSISTANT_MODEL` | Model name sent to the provider |
| `ASSISTANT_API_KEY` | Bearer token for hosted APIs; omit for local Ollama/LM Studio |

**Ollama (local):**

```bash
export ASSISTANT_BASE_URL=http://127.0.0.1:11434/v1
export ASSISTANT_MODEL=llama3.2
```

**LM Studio (local):**

```bash
export ASSISTANT_BASE_URL=http://127.0.0.1:1234/v1
export ASSISTANT_MODEL=your-loaded-model
```

**Hosted OpenAI-compatible API:**

```bash
export ASSISTANT_BASE_URL=https://api.openai.com/v1
export ASSISTANT_MODEL=gpt-4o-mini
export ASSISTANT_API_KEY=sk-...
```

If `ASSISTANT_BASE_URL` or `ASSISTANT_MODEL` is missing, Waypoint runs normally and the **Coach** sidebar view explains that the assistant is disabled (same pattern as unconfigured Adzuna ingestion).

### Run locally

```bash
npm run dev
npm run dev:server
```

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

### Run tests

```bash
npm test
npm run test:integration
```

## Project Structure

- `src/App.jsx` — top-level layout and app composition
- `src/components/` — UI components for the dashboard
- `src/hooks/useJobsStore.js` — application state and job actions
- `src/lib/` — API client and job data helpers
- `server/` — Fastify API, MariaDB repositories, migrations, and scraper
- `deploy/` — systemd units, backup script, and Tailscale helper
- `docs/` — deployment, operations, and implementation notes
- `src/theme.js` — design tokens for color, typography, and spacing

## Data & State

MariaDB is authoritative. On the first server-backed load only, existing `waypoint.jobs` localStorage data can be imported or discarded. After that, every device uses the same API-backed pipeline. Stage transitions are recorded from the Insights migration forward; Waypoint does not invent earlier movement and displays the reliable-history start date.

## Notes

- The app is designed as a desktop-first dashboard.
- Pasted job URLs still create editable drafts; scheduled discovery comes from Adzuna.
- The visual design favors a calm slate-and-blue palette intended to make the job search feel more manageable.

## License

No license has been specified for this repository.
