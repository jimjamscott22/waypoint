ALTER TABLE saved_queries
  ADD COLUMN center_display_name VARCHAR(255) NULL AFTER location,
  ADD COLUMN center_latitude DECIMAL(9,6) NULL AFTER center_display_name,
  ADD COLUMN center_longitude DECIMAL(9,6) NULL AFTER center_latitude,
  ADD COLUMN geocoder_provider VARCHAR(40) NULL AFTER center_longitude,
  ADD COLUMN geocoder_place_id VARCHAR(120) NULL AFTER geocoder_provider,
  ADD COLUMN preferred_radius_miles SMALLINT UNSIGNED NULL AFTER geocoder_place_id,
  ADD COLUMN maximum_radius_miles SMALLINT UNSIGNED NULL AFTER preferred_radius_miles,
  ADD COLUMN required_terms JSON NULL AFTER maximum_radius_miles,
  ADD COLUMN optional_terms JSON NULL AFTER required_terms,
  ADD COLUMN excluded_terms JSON NULL AFTER optional_terms,
  ADD COLUMN minimum_salary DECIMAL(12,2) NULL AFTER excluded_terms,
  ADD CONSTRAINT saved_queries_latitude_check CHECK (center_latitude IS NULL OR center_latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT saved_queries_longitude_check CHECK (center_longitude IS NULL OR center_longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT saved_queries_preferred_radius_check CHECK (preferred_radius_miles IS NULL OR preferred_radius_miles > 0),
  ADD CONSTRAINT saved_queries_maximum_radius_check CHECK (maximum_radius_miles IS NULL OR maximum_radius_miles > 0),
  ADD CONSTRAINT saved_queries_radius_order_check
    CHECK (preferred_radius_miles IS NULL OR maximum_radius_miles IS NULL OR preferred_radius_miles <= maximum_radius_miles),
  ADD CONSTRAINT saved_queries_minimum_salary_check CHECK (minimum_salary IS NULL OR minimum_salary >= 0);

UPDATE saved_queries
SET optional_terms = CASE WHEN TRIM(keywords) = '' THEN JSON_ARRAY() ELSE JSON_ARRAY(keywords) END;

UPDATE saved_queries
SET center_display_name = NULLIF(TRIM(location), '');

CREATE TABLE IF NOT EXISTS saved_query_role_families (
  query_id CHAR(36) NOT NULL,
  role_family VARCHAR(50) NOT NULL,
  PRIMARY KEY (query_id, role_family),
  CONSTRAINT saved_query_role_families_query_fk FOREIGN KEY (query_id) REFERENCES saved_queries(id) ON DELETE CASCADE,
  CONSTRAINT saved_query_role_families_role_check CHECK (role_family IN (
    'systems-administration', 'it-support', 'network-administration', 'cloud-support',
    'it-operations', 'desktop-support', 'junior-systems-engineering'
  ))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO saved_query_role_families (query_id, role_family)
SELECT id, 'systems-administration' FROM saved_queries WHERE id = '10000000-0000-4000-8000-000000000001';

INSERT IGNORE INTO saved_query_role_families (query_id, role_family)
SELECT id, 'it-support' FROM saved_queries WHERE id = '10000000-0000-4000-8000-000000000002';

INSERT IGNORE INTO saved_query_role_families (query_id, role_family)
SELECT id, 'network-administration' FROM saved_queries WHERE id = '10000000-0000-4000-8000-000000000003';

INSERT IGNORE INTO saved_query_role_families (query_id, role_family)
SELECT sq.id, rf.role_family
FROM saved_queries sq
CROSS JOIN (
  SELECT 'systems-administration' AS role_family
  UNION ALL SELECT 'it-support'
  UNION ALL SELECT 'network-administration'
  UNION ALL SELECT 'cloud-support'
  UNION ALL SELECT 'it-operations'
  UNION ALL SELECT 'desktop-support'
  UNION ALL SELECT 'junior-systems-engineering'
) rf
WHERE sq.id NOT IN (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003'
);

ALTER TABLE listings
  ADD COLUMN latitude DECIMAL(9,6) NULL AFTER url,
  ADD COLUMN longitude DECIMAL(9,6) NULL AFTER latitude,
  ADD COLUMN provider_category VARCHAR(80) NULL AFTER longitude,
  ADD COLUMN contract_time VARCHAR(30) NULL AFTER provider_category,
  ADD COLUMN contract_type VARCHAR(30) NULL AFTER contract_time,
  ADD CONSTRAINT listings_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT listings_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT listings_contract_time_check CHECK (contract_time IS NULL OR contract_time IN ('full_time', 'part_time')),
  ADD CONSTRAINT listings_contract_type_check CHECK (contract_type IS NULL OR contract_type IN ('permanent', 'contract'));

ALTER TABLE listing_queries
  ADD COLUMN distance_miles DECIMAL(7,2) NULL AFTER score,
  ADD COLUMN distance_band VARCHAR(20) NULL AFTER distance_miles,
  ADD COLUMN match_facts JSON NULL AFTER distance_band,
  ADD CONSTRAINT listing_queries_distance_band_check CHECK (distance_band IS NULL OR distance_band IN ('preferred', 'expanded', 'unknown'));

CREATE TABLE IF NOT EXISTS listing_query_role_families (
  listing_id CHAR(36) NOT NULL,
  query_id CHAR(36) NOT NULL,
  role_family VARCHAR(50) NOT NULL,
  PRIMARY KEY (listing_id, query_id, role_family),
  CONSTRAINT listing_query_role_families_lq_fk FOREIGN KEY (listing_id, query_id)
    REFERENCES listing_queries(listing_id, query_id) ON DELETE CASCADE,
  CONSTRAINT listing_query_role_families_role_check CHECK (role_family IN (
    'systems-administration', 'it-support', 'network-administration', 'cloud-support',
    'it-operations', 'desktop-support', 'junior-systems-engineering'
  ))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE scrape_run_queries
  ADD COLUMN provider_result_count INT NOT NULL DEFAULT 0,
  ADD COLUMN pages_requested INT NOT NULL DEFAULT 0,
  ADD COLUMN records_received INT NOT NULL DEFAULT 0,
  ADD COLUMN duplicates INT NOT NULL DEFAULT 0,
  ADD COLUMN previously_saved INT NOT NULL DEFAULT 0,
  ADD COLUMN previously_dismissed INT NOT NULL DEFAULT 0,
  ADD COLUMN rejected_age INT NOT NULL DEFAULT 0,
  ADD COLUMN rejected_distance INT NOT NULL DEFAULT 0,
  ADD COLUMN rejected_terms INT NOT NULL DEFAULT 0,
  ADD COLUMN rejected_salary INT NOT NULL DEFAULT 0,
  ADD COLUMN rejected_remote_only INT NOT NULL DEFAULT 0,
  ADD COLUMN malformed_records INT NOT NULL DEFAULT 0,
  ADD COLUMN unsearched_requests INT NOT NULL DEFAULT 0,
  ADD COLUMN truncated TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS scrape_run_searches (
  id CHAR(36) PRIMARY KEY,
  run_id CHAR(36) NOT NULL,
  query_id CHAR(36) NULL,
  role_family VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  provider_result_count INT NOT NULL DEFAULT 0,
  pages_requested INT NOT NULL DEFAULT 0,
  records_received INT NOT NULL DEFAULT 0,
  accepted_matches INT NOT NULL DEFAULT 0,
  truncated TINYINT(1) NOT NULL DEFAULT 0,
  error_message VARCHAR(500) NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  CONSTRAINT scrape_run_searches_role_check CHECK (role_family IN (
    'systems-administration', 'it-support', 'network-administration', 'cloud-support',
    'it-operations', 'desktop-support', 'junior-systems-engineering'
  )),
  CONSTRAINT scrape_run_searches_status_check CHECK (status IN ('success', 'partial', 'failed')),
  CONSTRAINT scrape_run_searches_run_fk FOREIGN KEY (run_id) REFERENCES scrape_runs(id) ON DELETE CASCADE,
  CONSTRAINT scrape_run_searches_query_fk FOREIGN KEY (query_id) REFERENCES saved_queries(id) ON DELETE SET NULL,
  KEY scrape_run_searches_run_query (run_id, query_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX listings_status_published_at ON listings (status, published_at);
CREATE INDEX listings_status_salary ON listings (status, salary_max, salary_min);
CREATE INDEX listing_queries_query_distance_score ON listing_queries (query_id, distance_band, score);
CREATE INDEX listing_query_role_families_role_query ON listing_query_role_families (role_family, query_id);

INSERT IGNORE INTO saved_queries (
  id, name, keywords, location, max_age_days, enabled,
  center_display_name, center_latitude, center_longitude, geocoder_provider,
  preferred_radius_miles, maximum_radius_miles
) VALUES (
  '10000000-0000-4000-8000-000000000004', 'Auburn IT infrastructure', '', '', 14, 1,
  'Auburn, Cayuga County, New York, United States', 42.931700, -76.566100, 'seeded',
  20, 40
);

INSERT IGNORE INTO saved_query_role_families (query_id, role_family)
SELECT '10000000-0000-4000-8000-000000000004', role_family FROM (
  SELECT 'systems-administration' AS role_family
  UNION ALL SELECT 'it-support'
  UNION ALL SELECT 'network-administration'
  UNION ALL SELECT 'cloud-support'
  UNION ALL SELECT 'it-operations'
  UNION ALL SELECT 'desktop-support'
  UNION ALL SELECT 'junior-systems-engineering'
) rf;

UPDATE saved_queries
SET enabled = 0, updated_at = UTC_TIMESTAMP(3)
WHERE id IN (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003'
) AND updated_at = created_at;
