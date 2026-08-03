-- ============================================================
-- Migration: service_locations table (Engine A Refit — Phase 3)
--
-- Replaces the dead `restaurant_tables` concept (dropped in the legacy
-- purge, see REFIT_PLAN.md Phase 3). Deliberately NOT a floor-plan /
-- reservation system: no capacity, no time-slot matching — that's
-- demand-matching ahead of time, which belongs to Engine B
-- (time_exclusive_reservation) / Engine C (shared_capacity_access) if
-- ever built. This is a lightweight, module-scoped named location with
-- a QR code, for order-fulfillment routing only.
--
-- "Occupied" is intentionally NOT a stored column. It is derived at
-- read time from whether the location has any transaction in a
-- non-terminal instant_transaction state (see the service routes in
-- dynamic-module.router.ts). A stored boolean would drift from reality
-- the moment a staff member forgets to clear it; a derived value can't.
-- ============================================================

CREATE TABLE IF NOT EXISTS service_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  -- tenant_id is required (dual-isolation scoping, see RLS below).
  -- property_id is nullable: some modules are tenant-scoped only, with
  -- no property_id of their own (see dynamic-module.router.ts
  -- enforceMountedModulePropertyAccess) — a service location under such
  -- a module has no single property to attach to either.
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  qr_code     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_service_locations_module_name UNIQUE (module_id, name)
);

CREATE INDEX IF NOT EXISTS idx_service_locations_module ON service_locations (module_id);
CREATE INDEX IF NOT EXISTS idx_service_locations_tenant ON service_locations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_locations_property ON service_locations (property_id) WHERE property_id IS NOT NULL;

-- Auto-update updated_at on change (same pattern as tenant_integrations)
CREATE OR REPLACE FUNCTION update_service_locations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_locations_updated_at ON service_locations;
CREATE TRIGGER trg_service_locations_updated_at
  BEFORE UPDATE ON service_locations
  FOR EACH ROW EXECUTE FUNCTION update_service_locations_updated_at();

-- ============================================================
-- Link orders to a service location (nullable — most order types,
-- e.g. takeaway/delivery, have no location at all).
-- ON DELETE SET NULL: deleting a location must not delete order history.
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS service_location_id UUID REFERENCES service_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_service_location
  ON transactions (service_location_id)
  WHERE service_location_id IS NOT NULL;

-- ============================================================
-- RLS
--
-- NOTE: apply_dual_isolation() (20260624010000_audit_isolation_remediation.sql)
-- no longer exists — it was a one-shot backfill helper, created and
-- DROP FUNCTION'd within that same migration. Writing the equivalent
-- dual-scoping policy directly here against the underlying
-- user_has_tenant_access() / user_has_property_access() functions,
-- which are still live.
--
-- This is defense-in-depth: getSupabase() in the backend uses the
-- service-role key, which bypasses RLS entirely, so the real gate for
-- API traffic is the Express-layer ownership check in
-- dynamic-module.router.ts. This policy protects any future direct
-- (non-service-role) DB access.
-- ============================================================

ALTER TABLE service_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_locations_isolation ON service_locations;
CREATE POLICY service_locations_isolation ON service_locations
  FOR ALL
  USING (
    user_has_tenant_access(auth.uid(), tenant_id)
    AND (property_id IS NULL OR user_has_property_access(auth.uid(), property_id))
  )
  WITH CHECK (
    user_has_tenant_access(auth.uid(), tenant_id)
    AND (property_id IS NULL OR user_has_property_access(auth.uid(), property_id))
  );

COMMENT ON TABLE service_locations IS
  'Lightweight, module-scoped order-fulfillment locations (e.g. restaurant tables, poolside spots, room-service delivery points). Occupancy is derived from active transactions, not stored. See REFIT_PLAN.md Phase 3.';

COMMENT ON COLUMN service_locations.qr_code IS
  'Pre-generated QR payload/URL for this location, used for scan-to-order. Nullable until generated.';

COMMENT ON COLUMN transactions.service_location_id IS
  'Optional link to the service_locations row this order was placed at/for. NULL for takeaway, delivery, or any order not tied to a physical location.';
