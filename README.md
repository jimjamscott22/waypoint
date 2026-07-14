# Waypoint

Waypoint is a job search manager dashboard for tracking applications, capturing new leads, and reviewing scraper matches in one place.

## Overview

This project is a React + Vite web app built around a single-screen pipeline dashboard. It helps you:

- capture job postings from a URL
- track jobs through stages like Saved, Applied, Interviewing, Offer, and Closed
- review new matches from saved queries in a side queue
- keep job data in localStorage for persistence between sessions

## Features

- **Pipeline dashboard** with a sidebar, header stats, capture bar, job table, and review queue
- **Stage filtering** to quickly narrow the pipeline by job stage
- **Job capture** from a pasted URL, with a draft flow for filling in details by hand
- **Review queue** for scraper matches, with save and dismiss actions
- **Job details drawer** for viewing and editing a selected job
- **Drag-and-drop reordering** for manual priority management
- **Undoable delete flow** with toast notifications
- **Local persistence** using browser localStorage

## Tech Stack

- [React](https://react.dev/)
- [Vite](https://vite.dev/)
- JavaScript
- HTML/CSS via inline component styles and theme tokens

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
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
```

## Project Structure

- `src/App.jsx` — top-level layout and app composition
- `src/components/` — UI components for the dashboard
- `src/hooks/useJobsStore.js` — application state and job actions
- `src/lib/` — job data helpers and seeded data
- `src/theme.js` — design tokens for color, typography, and spacing

## Data & State

Waypoint seeds the app with sample job data and queue items, then stores changes in localStorage under `waypoint.jobs`.

## Notes

- The app is designed as a desktop-first dashboard.
- The job URL scraper is currently a stub so users can capture a draft and fill in missing fields manually.
- The visual design favors a calm slate-and-blue palette intended to make the job search feel more manageable.

## License

No license has been specified for this repository.
