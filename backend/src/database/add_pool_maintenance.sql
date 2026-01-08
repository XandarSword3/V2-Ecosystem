DO $$ BEGIN
  CREATE TYPE maintenance_type AS ENUM ('cleaning', 'chemical_check', 'repair', 'inspection');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS pool_maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES modules(id),
  type maintenance_type NOT NULL,
  readings JSONB, -- For chemical levels etc.
  notes TEXT,
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pool_maintenance_module ON pool_maintenance_logs(module_id);
CREATE INDEX IF NOT EXISTS idx_pool_maintenance_created ON pool_maintenance_logs(created_at);
