ALTER TABLE saved_query_role_families
  DROP CONSTRAINT saved_query_role_families_role_check,
  ADD CONSTRAINT saved_query_role_families_role_check CHECK (role_family IN (
    'systems-administration', 'it-support', 'network-administration', 'cloud-support',
    'it-operations', 'desktop-support', 'junior-systems-engineering',
    'internet-service-installation'
  ));

ALTER TABLE listing_query_role_families
  DROP CONSTRAINT listing_query_role_families_role_check,
  ADD CONSTRAINT listing_query_role_families_role_check CHECK (role_family IN (
    'systems-administration', 'it-support', 'network-administration', 'cloud-support',
    'it-operations', 'desktop-support', 'junior-systems-engineering',
    'internet-service-installation'
  ));

ALTER TABLE scrape_run_searches
  DROP CONSTRAINT scrape_run_searches_role_check,
  ADD CONSTRAINT scrape_run_searches_role_check CHECK (role_family IN (
    'systems-administration', 'it-support', 'network-administration', 'cloud-support',
    'it-operations', 'desktop-support', 'junior-systems-engineering',
    'internet-service-installation'
  ));
