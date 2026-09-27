ALTER TABLE saved_queries
  ADD COLUMN exclude_senior_roles TINYINT(1) NOT NULL DEFAULT 0 AFTER minimum_salary;

ALTER TABLE scrape_run_queries
  ADD COLUMN rejected_seniority INT NOT NULL DEFAULT 0 AFTER rejected_remote_only;
