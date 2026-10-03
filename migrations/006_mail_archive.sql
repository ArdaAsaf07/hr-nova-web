ALTER TABLE mail_history ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS mail_history_archive_idx ON mail_history(archived_at, deleted_at);
