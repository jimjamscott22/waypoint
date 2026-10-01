CREATE TABLE IF NOT EXISTS job_contacts (
  id CHAR(36) PRIMARY KEY,
  job_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(255) NOT NULL DEFAULT '',
  profile_url TEXT NULL,
  notes TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3),
  CONSTRAINT job_contacts_job_fk FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  KEY job_contacts_job_order (job_id, sort_order, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outreach_entries (
  id CHAR(36) PRIMARY KEY,
  job_id CHAR(36) NOT NULL,
  contact_id CHAR(36) NULL,
  occurred_at DATETIME(3) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  note TEXT NOT NULL,
  next_follow_up_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT UTC_TIMESTAMP(3),
  CONSTRAINT outreach_entries_channel_check CHECK (channel IN ('email', 'linkedin', 'phone', 'in_person', 'other')),
  CONSTRAINT outreach_entries_job_fk FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  CONSTRAINT outreach_entries_contact_fk FOREIGN KEY (contact_id) REFERENCES job_contacts(id) ON DELETE SET NULL,
  KEY outreach_entries_job_occurred (job_id, occurred_at DESC),
  KEY outreach_entries_follow_up (next_follow_up_at, job_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
