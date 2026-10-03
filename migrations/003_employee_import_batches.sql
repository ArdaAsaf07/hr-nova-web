CREATE TABLE IF NOT EXISTS employee_import_batches (
    id BIGSERIAL PRIMARY KEY,
    batch_token UUID NOT NULL UNIQUE,
    created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    sheet_name VARCHAR(255) NOT NULL,
    rows_json JSONB NOT NULL,
    total_rows INTEGER NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_import_batches_expires_at_idx
    ON employee_import_batches(expires_at);
