-- =============================================
-- Command Center: Add property_id to transactions
-- (legacy module tables no longer exist in canonical schema)
-- =============================================
BEGIN;

-- transactions: backfill property_id from module where missing
ALTER TABLE IF EXISTS transactions
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

UPDATE transactions t
SET property_id = m.property_id
FROM modules m
WHERE t.module_id = m.id
  AND t.property_id IS NULL
  AND m.property_id IS NOT NULL;

UPDATE transactions
SET property_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE property_id IS NULL
  AND EXISTS (SELECT 1 FROM properties WHERE id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE INDEX IF NOT EXISTS idx_transactions_property_id ON transactions(property_id);

-- modules: add engine_type column mapping template_type -> engine terminology
ALTER TABLE IF EXISTS modules
  ADD COLUMN IF NOT EXISTS engine_type VARCHAR(50);

UPDATE modules
SET engine_type = CASE template_type
  WHEN 'menu_service' THEN 'instant_transaction'
  WHEN 'multi_day_booking' THEN 'time_exclusive_reservation'
  WHEN 'session_access' THEN 'shared_capacity_access'
  ELSE 'instant_transaction'
END
WHERE engine_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_modules_engine_type ON modules(engine_type);

-- Seed metric definitions
INSERT INTO metric_definitions (code, name, description, category, data_type, calculation, targets, alert_thresholds, format)
VALUES
  ('active_transactions', 'Active Transactions', 'Total active orders and check-ins across all engines', 'operational', 'count',
   '{"type": "calculated", "formula": "active_orders + todays_checkins + active_capacity_sessions", "source_table": "system_snapshot"}'::jsonb,
   NULL, NULL,
   '{"decimals": 0}'::jsonb),
  ('guests_on_property', 'Guests On Property', 'Currently checked-in guests', 'operational', 'count',
   '{"type": "aggregated", "source_table": "transactions", "source_field": "metadata->>guest_count", "aggregation": "sum", "filters": [{"field": "status", "operator": "eq", "value": "checked_in"}]}'::jsonb,
   NULL, NULL,
   '{"decimals": 0}'::jsonb),
  ('exceptions_count', 'Exceptions Count', 'Number of active exceptions requiring attention', 'operational', 'count',
   '{"type": "calculated", "formula": "threshold_violations + system_alerts", "source_table": "exceptions"}'::jsonb,
   '{"daily": 0, "monthly": 5}'::jsonb,
   '{"warning": {"max": 5}, "critical": {"max": 10}}'::jsonb,
   '{"decimals": 0}'::jsonb)
ON CONFLICT (code) DO NOTHING;

COMMIT;
