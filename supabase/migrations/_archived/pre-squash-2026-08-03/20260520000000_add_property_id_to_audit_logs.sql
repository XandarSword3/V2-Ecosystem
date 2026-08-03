-- Migration: Add property_id to audit_logs and manager_approvals for multi-tenant scoping
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_property_id ON audit_logs(property_id);

ALTER TABLE manager_approvals ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_manager_approvals_property_id ON manager_approvals(property_id);
