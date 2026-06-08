-- App-wide settings (e.g. posts automation toggle)
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value)
VALUES ('posts_automation_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
