# Waypoint Insights Design

## Summary

Waypoint will add Insights as its second working top-level navigation section. Insights is an outcome-first command center that combines job-search performance with discovery quality, prioritizes the next useful action, and defaults to the last 90 days.

The feature uses authoritative MariaDB data. New stage-history tracking makes funnel and timing metrics accurate going forward, while the interface clearly identifies the start of reliable historical coverage.

## Goals

- Show whether the job search is producing applications, interviews, and active opportunities.
- Explain how jobs move through the pipeline over the selected period.
- Turn current pipeline state into a short, prioritized action list.
- Show whether saved queries produce useful, save-worthy matches.
- Let users move directly from an insight to the relevant job or existing query controls.
- Preserve Waypoint's current desktop-first visual system and centralized state architecture.

## Non-Goals

- Implement the Contacts or Capture & queries navigation sections.
- Build predictive scoring, AI-generated coaching, or external market benchmarks.
- Invent historical transitions for existing jobs.
- Add a general-purpose analytics or charting library.
- Introduce client-side routing or a second application state source.
- Add a new frontend testing framework.

## Product Decisions

- Default reporting period: last 90 days.
- Available reporting periods: last 30 days, last 90 days, and all time.
- Page emphasis: job-search outcomes first, discovery quality second.
- Recommendations are actionable and link back to jobs or query controls.
- Historical stage tracking is recorded from the migration forward.
- Existing jobs receive a baseline history event, not fabricated prior transitions.

## Page Anatomy

### App Shell

The existing sidebar remains visible. Pipeline and Insights become interactive navigation items with a controlled active state. Selecting Insights replaces the Pipeline workspace and right-side review queue with a full-width Insights workspace. Selecting Pipeline restores the existing screen without resetting loaded application data.

The app will use top-level state in `useJobsStore` for the active view, selected period, Insights request state, and navigation actions. No routing dependency is required for this private single-page dashboard.

### Insights Header

The header contains:

- Title: `Insights`
- Supporting text describing the selected reporting window
- Range selector with `30 days`, `90 days`, and `All time`
- Historical coverage note when the selected range begins before reliable stage history

The default selected range is `90 days`.

### Outcome Summary

Four compact metrics lead the page:

1. Applications sent
2. Interviews reached
3. Application-to-interview rate
4. Active opportunities

Each metric includes an exact value and a concise definition or comparison. Metrics do not imply precision for time periods before event tracking began.

### Progress Area

The primary analysis area contains:

- A pipeline funnel showing the selected application cohort progressing through Applied, Interviewing, and Offer.
- A weekly activity trend showing entries into Applied, Interviewing, and Offer.
- Exact numeric labels and accessible descriptions alongside visual marks.

Charts will be lightweight, code-native components using HTML and SVG. They will follow existing theme tokens and will not add a charting dependency.

### Focus Next

The page shows a prioritized list of recommendations. Each row includes:

- A plain-language reason
- The relevant company and role, when job-specific
- The useful next action
- A direct action that switches to Pipeline, applies the relevant stage filter, and opens the job

Initial recommendation categories are:

1. Active job with a past `next_action_at`
2. Applied job with no stage movement for at least 14 days and no future action scheduled
3. Saved job with no application movement for at least 7 days
4. Saved query with enough reviewed results but a low save rate

Recommendations use deterministic rules and expose their reason. They do not use opaque scoring.

### Discovery Quality

The secondary analysis area contains:

- Unique matches found
- Saved listings
- Save rate among reviewed listings
- Dismissed listings
- A per-query comparison table

The query table includes query name, unique matches, reviewed results, saved results, save rate, and average match score. Low-performing query guidance appears only after the minimum sample threshold is met.

Selecting a query recommendation returns to Pipeline and scrolls or focuses the existing saved-query controls. A dedicated Capture & queries page remains future work.

## Metric Definitions

### Reporting Windows

- `30 days`: events or first matches on or after current UTC time minus 30 days
- `90 days`: events or first matches on or after current UTC time minus 90 days
- `All time`: all stored records

Range calculations use UTC timestamps on the server.

### Outcome Metrics

- **Applications sent:** distinct jobs whose first transition into Applied occurred in the selected period.
- **Interviews reached:** jobs in the selected application cohort that subsequently reached Interviewing or Offer, including movement after the period ended.
- **Application-to-interview rate:** interviews reached divided by applications sent. It is `null`, displayed as unavailable, when the denominator is zero.
- **Active opportunities:** current, non-deleted jobs in Applied, Interviewing, or Offer. This is a present-state metric and is labeled accordingly rather than being presented as a period total.

The funnel uses the same application cohort. Each job appears at its furthest recorded stage so funnel values cannot increase at later stages.

Weekly activity counts stage-entry events by UTC week. Repeated movement back into a stage is visible as activity but does not duplicate a job within the cohort funnel.

### Discovery Metrics

- **Matches found:** unique listings with a `listing_queries.first_matched_at` value in the selected period.
- **Reviewed results:** selected-period matches whose current listing status is saved or dismissed.
- **Saved listings:** selected-period matches whose current listing status is saved.
- **Save rate:** saved listings divided by reviewed results. Unreviewed and expired listings are excluded from the denominator.
- **Dismissed listings:** selected-period matches whose current listing status is dismissed.
- **Average match score:** average `listing_queries.score` for the relevant result set.

Overall listing totals are deduplicated. A listing matched by multiple queries contributes once to overall totals and once to each matching query's row.

### Query Recommendation Threshold

A saved query becomes eligible for optimization guidance after at least 10 reviewed results in the selected period. It is flagged when its save rate is below 10 percent. Disabled queries remain visible in historical comparison but do not receive an action prompt to change current discovery behavior.

## Data Model

### `job_stage_events`

Add a numbered migration creating:

- `id CHAR(36) PRIMARY KEY`
- `job_id CHAR(36) NOT NULL`
- `from_stage VARCHAR(30) NULL`
- `to_stage VARCHAR(30) NOT NULL`
- `occurred_at DATETIME(3) NOT NULL`
- Foreign key to `jobs(id)`
- Index on `(job_id, occurred_at)`
- Index on `(occurred_at, to_stage)`
- Stage constraints matching the `jobs.stage` constraint

The migration inserts one baseline event for every active existing job:

- `from_stage` is `NULL`
- `to_stage` is the job's current stage
- `occurred_at` is the migration timestamp

Baseline events establish current state but are excluded from inferred application and interview transitions. The API returns the earliest reliable tracking timestamp as `historyCoverageStartsAt`.

Stage changes update the job and insert the corresponding event within the same database transaction. Job creation inserts an initial baseline event for the created stage. A draft committed without changing stage does not create a duplicate stage event.

### `jobs.next_action_at`

Add a nullable `DATETIME(3)` column and supporting index. The job API accepts and returns the field as an ISO-8601 timestamp or `null`. The job detail editor exposes an optional date and time next to the existing next-action text.

Deleting a job remains a soft delete. Its history remains stored but deleted jobs are excluded from all current recommendations and active-opportunity metrics.

## API Design

Add:

`GET /api/insights?range=30d|90d|all`

The default range is `90d`. Invalid values return the existing structured `400` response format.

The response shape is:

```json
{
  "range": "90d",
  "generatedAt": "2026-07-29T14:00:00.000Z",
  "historyCoverageStartsAt": "2026-07-29T13:30:00.000Z",
  "historyCompleteForRange": false,
  "outcomes": {
    "applicationsSent": 0,
    "interviewsReached": 0,
    "interviewRate": null,
    "activeOpportunities": 0
  },
  "funnel": [
    { "stage": "Applied", "count": 0 },
    { "stage": "Interviewing", "count": 0 },
    { "stage": "Offer", "count": 0 }
  ],
  "weeklyActivity": [
    {
      "weekStart": "2026-07-27",
      "applied": 0,
      "interviewing": 0,
      "offer": 0
    }
  ],
  "recommendations": [],
  "discovery": {
    "matchesFound": 0,
    "reviewedResults": 0,
    "savedListings": 0,
    "saveRate": null,
    "dismissedListings": 0,
    "queries": []
  }
}
```

The server computes aggregates in a focused Insights repository/service boundary. The frontend does not download event or listing histories to recompute metrics.

## Frontend Architecture

### Store

Extend `useJobsStore` with:

- `activeView`
- `setActiveView`
- `insightsRange`
- `setInsightsRange`
- `insights`
- `insightsLoading`
- `insightsError`
- `retryInsights`
- `openInsightJob`
- `openInsightQuery`

Insights data loads when the view is first opened and reloads when the selected range changes. Previously loaded results remain visible during a background refresh. A failed refresh preserves the last successful response and shows a non-blocking error; a first-load failure shows the page error state.

`openInsightJob` sets the matching Pipeline stage filter, switches views, and opens the selected job. `openInsightQuery` switches to Pipeline and focuses the existing saved-query controls.

### Components

Add focused components rather than expanding `App.jsx` into a large page:

- `InsightsView`
- `InsightsHeader`
- `OutcomeSummary`
- `PipelineFunnel`
- `WeeklyActivityChart`
- `FocusNext`
- `DiscoverySummary`
- `QueryPerformanceTable`
- `InsightsEmptyState`

Shared metric formatting and chart coordinate helpers live in pure library modules so they can be tested with the existing Node test runner.

### Sidebar

`Sidebar` receives the active view and selection callback. Pipeline and Insights are semantic buttons with visible hover, selected, and keyboard focus states. The unimplemented Contacts and Capture & queries items remain visibly unavailable. Query recommendations navigate directly to the existing saved-query controls inside Pipeline without presenting Capture & queries as a completed top-level view.

## Loading, Empty, and Error States

- **Loading:** stable skeleton regions matching the final layout.
- **No activity:** explain that no qualifying activity exists in the selected range and retain the range selector.
- **Insufficient history:** show current-state and discovery metrics, replace unsupported historical comparisons with a coverage explanation, and never backfill invented transitions.
- **First-load error:** show the server message in Waypoint's error tone with a Retry action.
- **Refresh error:** retain the previous data and show a compact retry notice.
- **Partial recommendation inputs:** omit rules whose required data is absent rather than fabricating urgency.

## Accessibility and Interaction

- Sidebar items and range controls are buttons, not clickable `div` elements.
- Active navigation and range states use `aria-current` or `aria-pressed`.
- Charts include exact text summaries and do not rely on color alone.
- Tooltips are supplemental; the same values remain available without hover.
- Focus is moved to the Insights heading after top-level navigation.
- Recommendation actions have descriptive accessible labels.
- Motion respects `prefers-reduced-motion`.

## Verification

Use the existing Node test runner and MariaDB integration suite.

### Unit Coverage

- Reporting-range parsing
- Cohort and funnel aggregation
- Repeated stage transitions
- Zero-denominator rates
- Weekly UTC bucketing
- Discovery deduplication
- Per-query attribution
- Recommendation eligibility, threshold boundaries, and priority order
- Formatting and chart coordinate helpers

### API Coverage

- Default and supported range values
- Invalid range response
- Empty database response
- History coverage metadata
- Response schema and null-rate behavior

### Integration Coverage

- Stage update and event insert commit together
- Failure rolls back both job and event changes
- Baseline migration behavior
- Soft-deleted jobs are excluded where specified
- Discovery aggregation across listings matched by multiple queries

### Browser Verification

- Sidebar switches between Pipeline and Insights and exposes the correct active state.
- The 90-day range is selected by default.
- Range changes refresh the visible metrics.
- Recommendation actions return to the correct job or query controls.
- Loading, empty, insufficient-history, and error states render correctly.
- The page is visually checked at Waypoint's minimum 1280-pixel desktop layout.
- Keyboard navigation reaches all controls and chart values remain understandable without hover.

## Rollout

The schema migration ships before or with the application version that writes stage events. Existing jobs remain usable throughout the migration. Insights may initially show limited outcome history; discovery metrics and current active opportunities remain immediately useful. The coverage notice disappears for a selected finite range once that range begins on or after `historyCoverageStartsAt`.
