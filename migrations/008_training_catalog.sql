CREATE TABLE IF NOT EXISTS training_catalog (id BIGSERIAL PRIMARY KEY,name VARCHAR(255) NOT NULL UNIQUE,is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS employee_training_status (id BIGSERIAL PRIMARY KEY,employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,training_catalog_id BIGINT NOT NULL REFERENCES training_catalog(id) ON DELETE RESTRICT,status VARCHAR(30) NOT NULL,completed_at DATE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(employee_id,training_catalog_id),CONSTRAINT employee_training_status_check CHECK(status IN ('Aldı','Almadı')));
INSERT INTO training_catalog(name) VALUES('İş Sağlığı ve Güvenliği Eğitimi') ON CONFLICT(name) DO NOTHING;
INSERT INTO employee_training_status(employee_id,training_catalog_id,status)
SELECT employees.id,training_catalog.id,employees.education_status FROM employees CROSS JOIN training_catalog
WHERE training_catalog.name='İş Sağlığı ve Güvenliği Eğitimi' AND employees.education_status IN('Aldı','Almadı')
ON CONFLICT(employee_id,training_catalog_id) DO UPDATE SET status=EXCLUDED.status,updated_at=NOW();
