ALTER TABLE jobs
  ADD COLUMN next_action_at DATETIME(3) NULL AFTER next_action,
  ADD KEY jobs_next_action_at (deleted_at, next_action_at);

CREATE TABLE IF NOT EXISTS job_stage_events (
  id CHAR(36) PRIMARY KEY,
  job_id CHAR(36) NOT NULL,
  from_stage VARCHAR(30) NULL,
  to_stage VARCHAR(30) NOT NULL,
  occurred_at DATETIME(3) NOT NULL,
  CONSTRAINT job_stage_events_from_stage_check
    CHECK (from_stage IS NULL OR from_stage IN ('Saved', 'Applied', 'Interviewing', 'Offer', 'Closed')),
  CONSTRAINT job_stage_events_to_stage_check
    CHECK (to_stage IN ('Saved', 'Applied', 'Interviewing', 'Offer', 'Closed')),
  CONSTRAINT job_stage_events_job_fk
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  KEY job_stage_events_job_time (job_id, occurred_at),
  KEY job_stage_events_time_stage (occurred_at, to_stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO job_stage_events (id, job_id, from_stage, to_stage, occurred_at)
SELECT UUID(), id, NULL, stage, UTC_TIMESTAMP(3)
FROM jobs
WHERE deleted_at IS NULL;
