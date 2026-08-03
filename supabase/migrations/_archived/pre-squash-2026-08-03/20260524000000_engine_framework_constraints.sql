-- Engine Framework: missing tables not covered by 20260523000001_engine_support_tables.sql
-- Creates: engine_state_transitions, engine_loyalty_events, engine_feature_flags
-- Adds:    constraints on engine_financial_ledger (safe — IF NOT EXISTS / exception-wrapped)
-- Adds:    helper RPCs

-- ─────────────────────────────────────────────────────────────
-- engine_state_transitions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engine_state_transitions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL,
  module_id     UUID        NOT NULL,
  engine_type   TEXT        NOT NULL CHECK (engine_type IN (
                              'instant_transaction','time_exclusive_reservation',
                              'shared_capacity_access','ongoing_entitlement')),
  entity_id     UUID        NOT NULL,
  previous_state TEXT       NOT NULL,
  new_state      TEXT       NOT NULL,
  action         TEXT       NOT NULL,
  actor_type     TEXT       NOT NULL CHECK (actor_type IN ('system','staff','customer','admin')),
  actor_id       UUID,
  context        JSONB      NOT NULL DEFAULT '{}',
  guards_evaluated JSONB    NOT NULL DEFAULT '[]',
  side_effects   JSONB      NOT NULL DEFAULT '[]',
  transaction_id TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_est_entity   ON engine_state_transitions (entity_id);
CREATE INDEX IF NOT EXISTS idx_est_tenant   ON engine_state_transitions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_est_engine   ON engine_state_transitions (engine_type);
CREATE INDEX IF NOT EXISTS idx_est_created  ON engine_state_transitions (created_at);
CREATE INDEX IF NOT EXISTS idx_est_action   ON engine_state_transitions (action);

ALTER TABLE engine_state_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS est_all ON engine_state_transitions;
CREATE POLICY est_all ON engine_state_transitions FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────────
-- engine_loyalty_events
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engine_loyalty_events (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID  NOT NULL,
  customer_id  UUID  NOT NULL,
  entity_id    UUID  NOT NULL,
  engine_type  TEXT  NOT NULL,
  event_type   TEXT  NOT NULL CHECK (event_type IN ('earn','redeem','void')),
  points       INTEGER NOT NULL,
  dollar_value DECIMAL(12,2),
  CONSTRAINT uq_loyalty_earn_per_entity UNIQUE (entity_id, event_type),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ele_customer ON engine_loyalty_events (customer_id);
CREATE INDEX IF NOT EXISTS idx_ele_entity   ON engine_loyalty_events (entity_id);

ALTER TABLE engine_loyalty_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ele_all ON engine_loyalty_events;
CREATE POLICY ele_all ON engine_loyalty_events FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────────
-- engine_feature_flags
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS engine_feature_flags (
  id                  UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID     NOT NULL,
  flag_name           TEXT     NOT NULL,
  enabled             BOOLEAN  NOT NULL DEFAULT FALSE,
  rollout_percentage  INTEGER  DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  description         TEXT,
  metadata            JSONB    NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_feature_flag_tenant UNIQUE (tenant_id, flag_name)
);

ALTER TABLE engine_feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS eff_all ON engine_feature_flags;
CREATE POLICY eff_all ON engine_feature_flags FOR ALL USING (true);

-- Seed default flags against the null-tenant sentinel UUID
INSERT INTO engine_feature_flags (tenant_id, flag_name, enabled, description)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'engine_v2_pricing',       FALSE, 'Use engine v2 unified pricing pipeline'),
  ('00000000-0000-0000-0000-000000000000', 'engine_v2_state_machine',  FALSE, 'Use engine v2 state machine enforcement'),
  ('00000000-0000-0000-0000-000000000000', 'engine_v2_ledger',         FALSE, 'Write to unified financial ledger'),
  ('00000000-0000-0000-0000-000000000000', 'engine_v2_idempotency',    FALSE, 'Enable idempotency key checking'),
  ('00000000-0000-0000-0000-000000000000', 'engine_v2_full',           FALSE, 'Enable all engine v2 features')
ON CONFLICT (tenant_id, flag_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Constraints on engine_financial_ledger
-- (table already exists from 20260523000001; wrap in exception handler)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE engine_financial_ledger
    ADD CONSTRAINT chk_ledger_total_invariant
    CHECK (ABS(total_amount - GREATEST(0, subtotal + tax_amount + service_charge + delivery_fee - total_discount)) < 0.03);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE engine_financial_ledger
    ADD CONSTRAINT chk_ledger_nonneg_total CHECK (total_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE engine_financial_ledger
    ADD CONSTRAINT chk_ledger_nonneg_subtotal CHECK (subtotal >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Helper RPCs
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_entity_ledger_balance(p_entity_id UUID)
RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(CASE
    WHEN transaction_type IN ('charge','deposit')           THEN total_amount
    WHEN transaction_type IN ('refund','void','deposit_release') THEN -total_amount
    ELSE 0
  END), 0)
  FROM engine_financial_ledger
  WHERE entity_id = p_entity_id;
$$ LANGUAGE sql STABLE
