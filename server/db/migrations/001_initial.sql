CREATE TABLE IF NOT EXISTS listings (
  id CHAR(36) PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  provider_job_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL DEFAULT '',
  location VARCHAR(255) NOT NULL DEFAULT '',
  salary_min DECIMAL(12,2) NULL,
  salary_max DECIMAL(12,2) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at DATETIME(3) NOT NULL,
  first_seen_at DATETIME(3) NOT NULL,
  last_seen_at DATETIME(3) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  created_at DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3),
  CONSTRAINT listings_status_check CHECK (status IN ('new', 'saved', 'dismissed', 'expired')),
  UNIQUE KEY listings_provider_job_unique (provider, provider_job_id),
  KEY listings_status_score (status, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS jobs (
  id CHAR(36) PRIMARY KEY,
  role VARCHAR(255) NOT NULL DEFAULT '',
  company VARCHAR(255) NOT NULL DEFAULT '',
  stage VARCHAR(30) NOT NULL,
  location VARCHAR(255) NOT NULL DEFAULT '',
  salary VARCHAR(120) NOT NULL DEFAULT '',
  contact VARCHAR(255) NOT NULL DEFAULT '',
  next_action VARCHAR(255) NOT NULL DEFAULT '',
  notes TEXT NOT NULL,
  urgent TINYINT(1) NOT NULL DEFAULT 0,
  is_draft TINYINT(1) NOT NULL DEFAULT 0,
  url TEXT NULL,
  sort_order INT NOT NULL,
  source_listing_id CHAR(36) NULL,
  deleted_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3),
  CONSTRAINT jobs_stage_check CHECK (stage IN ('Saved', 'Applied', 'Interviewing', 'Offer', 'Closed')),
  UNIQUE KEY jobs_source_listing_unique (source_listing_id),
  KEY jobs_active_order (deleted_at, sort_order),
  CONSTRAINT jobs_source_listing_fk FOREIGN KEY (source_listing_id) REFERENCES listings(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saved_queries (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  keywords VARCHAR(120) NOT NULL,
  location VARCHAR(120) NOT NULL DEFAULT '',
  max_age_days TINYINT UNSIGNED NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3),
  CONSTRAINT saved_queries_max_age_check CHECK (max_age_days IN (1, 3, 7, 14, 30))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_queries (
  listing_id CHAR(36) NOT NULL,
  query_id CHAR(36) NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  first_matched_at DATETIME(3) NOT NULL,
  last_matched_at DATETIME(3) NOT NULL,
  CONSTRAINT listing_queries_score_check CHECK (score >= 0 AND score <= 100),
  PRIMARY KEY (listing_id, query_id),
  CONSTRAINT listing_queries_listing_fk FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
  CONSTRAINT listing_queries_query_fk FOREIGN KEY (query_id) REFERENCES saved_queries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scrape_runs (
  id CHAR(36) PRIMARY KEY,
  trigger_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  queries_total INT NOT NULL DEFAULT 0,
  queries_succeeded INT NOT NULL DEFAULT 0,
  listings_fetched INT NOT NULL DEFAULT 0,
  new_matches INT NOT NULL DEFAULT 0,
  error_summary TEXT NULL,
  CONSTRAINT scrape_runs_trigger_check CHECK (trigger_type IN ('manual', 'scheduled')),
  CONSTRAINT scrape_runs_status_check CHECK (status IN ('running', 'success', 'partial', 'failed')),
  KEY scrape_runs_latest (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scrape_run_queries (
  id CHAR(36) PRIMARY KEY,
  run_id CHAR(36) NOT NULL,
  query_id CHAR(36) NULL,
  query_name VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL,
  listings_fetched INT NOT NULL DEFAULT 0,
  new_matches INT NOT NULL DEFAULT 0,
  error_message VARCHAR(500) NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NOT NULL,
  CONSTRAINT scrape_run_queries_status_check CHECK (status IN ('success', 'failed')),
  CONSTRAINT scrape_run_queries_run_fk FOREIGN KEY (run_id) REFERENCES scrape_runs(id) ON DELETE CASCADE,
  CONSTRAINT scrape_run_queries_query_fk FOREIGN KEY (query_id) REFERENCES saved_queries(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO saved_queries (id, name, keywords, location, max_age_days, enabled) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Sysadmin · remote · <7 days', 'systems administrator remote', '', 7, 1),
  ('10000000-0000-4000-8000-000000000002', 'IT support · Madison · <14 days', 'IT support', 'Madison, WI', 14, 1),
  ('10000000-0000-4000-8000-000000000003', 'Network admin · hybrid · <14 days', 'network administrator hybrid', 'Madison, WI', 14, 1);
