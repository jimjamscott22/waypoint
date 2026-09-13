# Graph Report - /home/jimjamscozz/Desktop/GitHub-Repos/waypoint  (2026-09-13)

## Corpus Check
- 116 files · ~88,983 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 564 nodes · 1130 edges · 33 communities (21 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Dashboard UI Components
- Discovery Query Criteria
- Server Composition
- Design Handoff Runtime
- Package Dependencies
- Discovery Persistence
- Query Lifecycle
- Job Store Operations
- Deployment Architecture
- Insights Analytics
- Component Architecture Diagram
- Daily Scrape Pipeline
- Discovery API Client
- Adzuna Provider
- Database Schema
- Ingestion Documentation
- Provider Expansion
- Backup Script
- Location Branding
- Device Deployment
- Tailscale Setup Script
- Migration Script
- Insights Migration
- Jobs Store Design
- Dashboard Design Handoff
- Legacy Import
- URL Capture
- Theme Tokens
- Error Sanitization
- Project Overview

## God Nodes (most connected - your core abstractions)
1. `color` - 21 edges
2. `font` - 21 edges
3. `radius` - 20 edges
4. `createDiscoveryService()` - 17 edges
5. `evaluateListing()` - 16 edges
6. `createServices()` - 16 edges
7. `withConnection()` - 15 edges
8. `createRuntime()` - 14 edges
9. `AppError` - 13 edges
10. `scripts` - 11 edges

## Surprising Connections (you probably didn't know these)
- `clientWith()` --calls--> `createNominatimClient()`  [EXTRACTED]
  tests/geocoding.test.js → server/geocoding/nominatim.js
- `capturingClient()` --calls--> `createAdzunaClient()`  [EXTRACTED]
  tests/adzuna.test.js → server/scraper/adzuna.js
- `Provider-Agnostic Discovery Interface` --conceptually_related_to--> `USAJOBS as a Second Discovery Provider`  [INFERRED]
  CLAUDE.md → docs/superpowers/specs/2026-08-30-usajobs-provider-design.md
- `Centralized Backend and Daily Ingestion` --semantically_similar_to--> `Daily Ingestion Pipeline`  [INFERRED] [semantically similar]
  docs/implementation-summary-daily-ingestion.md → docs/project-summary.md
- `buildApp()` --indirect_call--> `queryRoutes()`  [INFERRED]
  server/app.js → server/routes/queries.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Durable Daily Ingestion System** — docs_implementation_summary_daily_ingestion_backend_pipeline, docs_project_summary_daily_ingestion_pipeline, docs_project_summary_nonoverlapping_scrape_runs, docs_project_summary_query_failure_isolation, docs_project_summary_listing_scoring [INFERRED 0.95]
- **Client Job State Flow** — docs_diagrams_component_relationships_app_jsx, docs_diagrams_component_relationships_usejobsstore, docs_diagrams_component_relationships_presentational_components [EXTRACTED 1.00]
- **Server Persistence Flow** — docs_diagrams_component_relationships_server_app_js, docs_diagrams_component_relationships_routes, docs_diagrams_component_relationships_services_js, docs_diagrams_component_relationships_db_repositories, docs_diagrams_component_relationships_pool_js, docs_diagrams_component_relationships_mariadb [EXTRACTED 1.00]
- **Waypoint Operational Services** — docs_diagrams_high_level_architecture_waypoint_service, docs_diagrams_high_level_architecture_db_backup_timer, docs_diagrams_high_level_architecture_scraper_timer, docs_diagrams_high_level_architecture_systemd [EXTRACTED 1.00]
- **Job Data Persistence** — docs_diagrams_high_level_architecture_waypoint_spa, docs_diagrams_high_level_architecture_node_server_index_js, docs_diagrams_high_level_architecture_mariadb, docs_diagrams_high_level_architecture_server_cli_scrape_js [EXTRACTED 1.00]
- **Enabled Saved Query Processing Loop** — docs_diagrams_processing_pipeline_adzuna_search, docs_diagrams_processing_pipeline_listing_normalization, docs_diagrams_processing_pipeline_listing_match_upsert [EXTRACTED 1.00]

## Communities (33 total, 12 thin omitted)

### Community 0 - "Dashboard UI Components"
Cohesion: 0.06
Nodes (56): App(), CaptureBar(), DiscoverySummary(), display(), METRICS, action(), FocusNext(), TYPE_LABELS (+48 more)

### Community 1 - "Discovery Query Criteria"
Cohesion: 0.06
Nodes (56): createRequestBudget(), adzunaParameters(), buildRoleFamilyPlan(), PROVIDER_PHRASE_LIMIT, providerLocation(), providerPhrases(), RESULTS_PER_PAGE, STATE_ABBREVIATIONS (+48 more)

### Community 2 - "Server Composition"
Cohesion: 0.07
Nodes (40): buildApp(), defaultDist, runScheduledScrape(), integer(), loadConfig(), publicConfig(), createDiscoveryRepository(), createInsightsRepository() (+32 more)

### Community 3 - "Design Handoff Runtime"
Cohesion: 0.08
Nodes (48): boot(), bundledBlob(), cdnScriptFor(), collectProps(), compileAttr(), compileTemplate(), contentKey(), createComponentFactory() (+40 more)

### Community 4 - "Package Dependencies"
Cohesion: 0.06
Nodes (35): fastify, @fastify/static, mariadb, allowScripts, esbuild@0.21.5, dependencies, fastify, @fastify/static (+27 more)

### Community 5 - "Discovery Persistence"
Cohesion: 0.11
Nodes (28): buildConditions(), databaseTimestamp(), DISTANCE_BAND_BY_RANK, escapeLike(), mapDiscoveryItem(), OUTCOME_BY_PREVIOUS_STATUS, persistMatch(), SORT_CLAUSES (+20 more)

### Community 6 - "Query Lifecycle"
Cohesion: 0.10
Nodes (27): centerFromRow(), clearPendingMatches(), criteriaChanged(), expireOrphanedListings(), find(), isLegacyInput(), loadRoleFamilies(), normalizeCenter() (+19 more)

### Community 7 - "Job Store Operations"
Cohesion: 0.16
Nodes (17): importCandidate(), toastId(), useJobsStore(), deleteJob(), duplicateJob(), moveVisibleJob(), parseStoredJobs(), reorderVisibleJobs() (+9 more)

### Community 8 - "Deployment Architecture"
Cohesion: 0.09
Nodes (24): Adzuna Jobs Search API, API Routes, apiClient, Waypoint High-Level Architecture Diagram, backup-waypoint.sh, Browser, Built dist Directory, db-backup.timer (+16 more)

### Community 9 - "Insights Analytics"
Cohesion: 0.22
Nodes (18): ageInDays(), asDate(), buildInsights(), buildOutcomeMetrics(), buildRecommendations(), buildWeeklyActivity(), eventTime(), groupDiscovery() (+10 more)

### Community 10 - "Component Architecture Diagram"
Cohesion: 0.14
Nodes (16): apiClient.js, App.jsx, db repositories, Dependency Injection, HTTP API Seam, jobListOperations.js, MariaDB, MigrationBanner (+8 more)

### Community 11 - "Daily Scrape Pipeline"
Cohesion: 0.14
Nodes (15): GET_LOCK waypoint:scrape, adzunaClient.search, Daily Ingestion Pipeline, listings.expire, upsertListingMatch, Listing Normalization and Age Filter, scoreListing, RELEASE_LOCK (+7 more)

### Community 12 - "Discovery API Client"
Cohesion: 0.22
Nodes (8): api, countActiveDiscoveryFilters(), DEFAULT_DISCOVERY_FILTERS, isOmitted(), KEY_ORDER, resetDiscoveryPage(), serialize(), toDiscoverySearchParams()

### Community 13 - "Adzuna Provider"
Cohesion: 0.22
Nodes (9): constrained(), CONTRACT_TIMES, CONTRACT_TYPES, coordinate(), createAdzunaClient(), normalizeAdzunaJob(), nullableNumber(), auburnQuery (+1 more)

### Community 14 - "Database Schema"
Cohesion: 0.20
Nodes (9): jobs, listing_queries, listings, saved_queries, scrape_run_queries, scrape_runs, listing_query_role_families, saved_query_role_families (+1 more)

### Community 15 - "Ingestion Documentation"
Cohesion: 0.33
Nodes (6): Centralized Backend and Daily Ingestion, Daily Ingestion Pipeline, Explainable Listing Scoring, Non-Overlapping Scrape Runs, Per-Query Failure Isolation, Waypoint Project Summary

### Community 16 - "Provider Expansion"
Cohesion: 0.67
Nodes (3): Provider-Agnostic Discovery Interface, Per-Provider Request Budgets, USAJOBS as a Second Discovery Provider

### Community 18 - "Location Branding"
Cohesion: 0.67
Nodes (3): Location Pin, Location Pin Center, Waypoint Favicon

## Knowledge Gaps
- **128 isolated node(s):** `backup-waypoint.sh script`, `MYSQL_PWD`, `configure-tailscale.sh script`, `migrate-waypoint.sh script`, `name` (+123 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `Server Composition` to `Discovery Query Criteria`, `Discovery Persistence`, `Query Lifecycle`, `Insights Analytics`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `createDiscoveryService()` connect `Discovery Query Criteria` to `Server Composition`, `Discovery Persistence`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `backup-waypoint.sh script`, `MYSQL_PWD`, `configure-tailscale.sh script` to the rest of the system?**
  _128 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05568039950062422 - nodes in this community are weakly interconnected._
- **Should `Discovery Query Criteria` be split into smaller, more focused modules?**
  _Cohesion score 0.056265984654731455 - nodes in this community are weakly interconnected._
- **Should `Server Composition` be split into smaller, more focused modules?**
  _Cohesion score 0.07191316146540028 - nodes in this community are weakly interconnected._
- **Should `Design Handoff Runtime` be split into smaller, more focused modules?**
  _Cohesion score 0.0777323202805377 - nodes in this community are weakly interconnected._