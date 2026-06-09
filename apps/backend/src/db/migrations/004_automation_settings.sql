-- 24/7 automation configuration defaults
INSERT INTO app_settings (key, value) VALUES
  ('automation_master_enabled', 'true'::jsonb),
  ('posts_automation_enabled', 'true'::jsonb),
  ('inbox_automation_enabled', 'true'::jsonb),
  ('listing_refresh_enabled', 'true'::jsonb),
  ('account_health_enabled', 'true'::jsonb),
  ('proxy_health_enabled', 'true'::jsonb),
  ('daily_post_target', '500'::jsonb),
  ('inbox_poll_interval_seconds', '90'::jsonb),
  ('listing_refresh_min_hours', '24'::jsonb),
  ('listing_refresh_max_hours', '48'::jsonb),
  ('posts_per_scheduler_tick', '10'::jsonb),
  ('default_listing_category', '"Services"'::jsonb),
  ('default_listing_condition', '"New"'::jsonb)
ON CONFLICT (key) DO NOTHING;
