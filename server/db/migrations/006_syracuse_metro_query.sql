-- The Auburn query seeded in 003_discovery_reliability.sql already reaches 40 miles,
-- but Adzuna geocodes `where` against its own location index, and a small town like
-- Auburn does not always resolve with the same result density as a nearby city. Add a
-- second search anchored on Syracuse -- the nearest metro with real job volume, about
-- 23 miles from Auburn -- so postings aren't missed just because the smaller anchor
-- town underperforms in the provider's own geocoding. 25 miles is the commute radius
-- the account holder is willing to accept.
INSERT IGNORE INTO saved_queries (
  id, name, keywords, location, max_age_days, enabled,
  center_display_name, center_latitude, center_longitude, geocoder_provider,
  preferred_radius_miles, maximum_radius_miles
) VALUES (
  '10000000-0000-4000-8000-000000000005', 'Syracuse metro · 25mi', '', '', 14, 1,
  'Syracuse, Onondaga County, New York, United States', 43.048100, -76.147400, 'seeded',
  15, 25
);

INSERT IGNORE INTO saved_query_role_families (query_id, role_family)
SELECT '10000000-0000-4000-8000-000000000005', role_family FROM (
  SELECT 'systems-administration' AS role_family
  UNION ALL SELECT 'it-support'
  UNION ALL SELECT 'network-administration'
  UNION ALL SELECT 'cloud-support'
  UNION ALL SELECT 'it-operations'
  UNION ALL SELECT 'desktop-support'
  UNION ALL SELECT 'junior-systems-engineering'
  UNION ALL SELECT 'internet-service-installation'
) rf;
