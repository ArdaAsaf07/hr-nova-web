CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    actor_username VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    request_method VARCHAR(10) NOT NULL,
    request_path VARCHAR(500) NOT NULL,
    response_status SMALLINT NOT NULL,
    ip_address VARCHAR(64),
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_user_id_idx
    ON audit_logs(actor_user_id);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
    ON audit_logs(created_at DESC);
