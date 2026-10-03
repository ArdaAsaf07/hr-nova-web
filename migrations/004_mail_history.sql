CREATE TABLE IF NOT EXISTS mail_history (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT REFERENCES employees(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    message_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_message VARCHAR(500),
    sent_by BIGINT NOT NULL REFERENCES users(id),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT mail_history_status_check CHECK (status IN ('sent', 'failed'))
);

CREATE INDEX IF NOT EXISTS mail_history_created_at_idx
    ON mail_history(created_at DESC);
