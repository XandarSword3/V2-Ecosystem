-- Engine D (ongoing_entitlement) support tables
--
-- Pattern mirrors the other engine config tables:
--   Engine A (instant_transaction)      → catalog_items
--   Engine B (shared_capacity_access)   → capacity_windows
--   Engine C (time_exclusive_reservation) → bookable_units (view over accommodation_units)
--   Engine D (ongoing_entitlement)      → membership_plans + memberships  ← this file
--
-- membership_plans: the plan catalog for a given ongoing_entitlement module.
--   A tenant deploying a "gym membership" or "pool club" module creates plans here
--   (e.g. "Monthly – $50", "Annual – $400"). Scoped per module_id.
--
-- memberships: the actual active subscriptions. One row per customer per module.
--   status follows the engine D state machine: pending → active ⇄ paused → expired/cancelled.

-- ─────────────────────────────────────────────────────────────
-- 1. membership_plans
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS membership_plans (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id    UUID          NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name         TEXT          NOT NULL,
  description  TEXT,
  price        DECIMAL(10,2) NOT NULL DEFAULT 0,
  interval     TEXT          NOT NULL DEFAULT 'monthly'
                 CHECK (interval IN ('monthly', 'quarterly', 'annual', 'lifetime')),
  interval_count INTEGER     NOT NULL DEFAULT 1,
  is_active    BOOLEAN       NOT NULL DEFAULT true,
  sort_order   INTEGER       NOT NULL DEFAULT 0,
  metadata     JSONB         NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_membership_plans_module_id
  ON membership_plans (module_id);
CREATE INDEX IF NOT EXISTS idx_membership_plans_active
  ON membership_plans (module_id, is_active);

ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS membership_plans_all ON membership_plans;
CREATE POLICY membership_plans_all ON membership_plans FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────────
-- 2. memberships
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memberships (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   UUID          NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  customer_id UUID          REFERENCES users(id) ON DELETE SET NULL,
  plan_id     UUID          NOT NULL REFERENCES membership_plans(id),
  status      TEXT          NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'active', 'paused', 'expired', 'cancelled')),
  amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  metadata    JSONB         NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memberships_module_id
  ON memberships (module_id);
CREATE INDEX IF NOT EXISTS idx_memberships_customer_id
  ON memberships (customer_id)
  WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memberships_plan_id
  ON memberships (plan_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status
  ON memberships (module_id, status);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS memberships_all ON memberships;
CREATE POLICY memberships_all ON memberships FOR ALL USING (true);
