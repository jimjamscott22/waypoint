ALTER TABLE scrape_run_queries
  DROP CONSTRAINT scrape_run_queries_status_check,
  ADD CONSTRAINT scrape_run_queries_status_check
    CHECK (status IN ('success', 'partial', 'failed'));
