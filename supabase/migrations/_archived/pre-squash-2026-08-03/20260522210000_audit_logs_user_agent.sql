-- Ensure audit_logs accepts activityLogger user_agent payload
ALTER TABLE IF EXISTS audit_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT;
