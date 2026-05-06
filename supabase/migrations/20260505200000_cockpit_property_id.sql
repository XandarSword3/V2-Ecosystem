-- =============================================
-- Command Center: Add property_id to transactional tables
-- Required for metrics layer queries that filter by property
-- =============================================
BEGIN;

-- restaurant_orders: add property_id, derive from module -> property
ALTER TABLE IF EXISTS restaurant_orders
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

UPDATE restaurant_orders ro
SET property_id = m.property_id
FROM modules m
WHERE ro.module_id = m.id
  AND ro.property_id IS NULL
  AND m.property_id IS NOT NULL;

-- Fallback: assign default property where module has no property_id
UPDATE restaurant_orders
SET property_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE property_id IS NULL
  AND EXISTS (SELECT 1 FROM properties WHERE id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_property_id ON restaurant_orders(property_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_module_id ON restaurant_orders(module_id);

-- chalet_bookings: add property_id
ALTER TABLE IF EXISTS chalet_bookings
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

-- Derive from chalet if it has property_id, otherwise default
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chalets' AND column_name = 'property_id') THEN
    UPDATE chalet_bookings cb
    SET property_id = c.property_id
    FROM chalets c
    WHERE cb.chalet_id = c.id
      AND cb.property_id IS NULL
      AND c.property_id IS NOT NULL;
  END IF;
END $$;

UPDATE chalet_bookings
SET property_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE property_id IS NULL
  AND EXISTS (SELECT 1 FROM properties WHERE id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE INDEX IF NOT EXISTS idx_chalet_bookings_property_id ON chalet_bookings(property_id);

-- pool_tickets: add property_id
ALTER TABLE IF EXISTS pool_tickets
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

UPDATE pool_tickets
SET property_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE property_id IS NULL
  AND EXISTS (SELECT 1 FROM properties WHERE id = '00000000-0000-0000-0000-000000000001'::uuid);

CREATE INDEX IF NOT EXISTS idx_pool_tickets_property_id ON pool_tickets(property_id);

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

-- Seed missing metric definitions into metric_definitions table
INSERT INTO metric_definitions (code, name, description, category, data_type, calculation, targets, alert_thresholds, format)
VALUES
  ('active_transactions', 'Active Transactions', 'Total active orders and check-ins across all engines', 'operational', 'count',
   '{"type": "calculated", "formula": "active_orders + todays_checkins + active_pool_sessions", "source_table": "system_snapshot"}'::jsonb,
   NULL, NULL,
   '{"decimals": 0}'::jsonb),
  ('guests_on_property', 'Guests On Property', 'Currently checked-in guests', 'operational', 'count',
   '{"type": "aggregated", "source_table": "bookings", "source_field": "guest_count", "aggregation": "sum", "filters": [{"field": "status", "operator": "eq", "value": "checked_in"}]}'::jsonb,
   NULL, NULL,
   '{"decimals": 0}'::jsonb),
  ('exceptions_count', 'Exceptions Count', 'Number of active exceptions requiring attention', 'operational', 'count',
   '{"type": "calculated", "formula": "threshold_violations + system_alerts", "source_table": "exceptions"}'::jsonb,
   '{"daily": 0, "monthly": 5}'::jsonb,
   '{"warning": {"max": 5}, "critical": {"max": 10}}'::jsonb,
   '{"decimals": 0}'::jsonb)
ON CONFLICT (code) DO NOTHING;

COMMIT;
