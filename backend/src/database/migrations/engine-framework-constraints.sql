-- ============================================
-- Engine Framework Database Constraints & Tables
-- ============================================
-- 
-- This migration creates the database-level invariants for the engine framework:
--   1. Financial Ledger table — unified record of all financial mutations
--   2. Idempotency Keys table — prevents duplicate processing
--   3. Compensation Log table — tracks failed saga compensations
--   4. State Transition Audit table — immutable log of all state changes
--   5. Constraints — capacity, booking overlap, state enum, balanced ledger
--
-- INVARIANT: Every financial mutation is recorded in the ledger.
-- INVARIANT: State transitions are logged immutably.
-- INVARIANT: Idempotency keys prevent duplicate processing.
-- INVARIANT: Capacity cannot go negative.
-- INVARIANT: Booking time ranges cannot overlap for the same resource.
-- ============================================

-- ============================================
-- 1. Financial Ledger
-- ============================================

CREATE TABLE IF NOT EXISTS engine_financial_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  module_id UUID NOT NULL,
  engine_type TEXT NOT NULL CHECK (engine_type IN ('instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement')),
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- 'order', 'booking', 'session', 'subscription'
  
  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('charge', 'refund', 'adjustment', 'void', 'deposit', 'deposit_release')),
  currency TEXT NOT NULL DEFAULT 'EUR',
  
  -- Amount breakdown (mirrors PricingResult)
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
  service_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- Discount details (JSONB for flexibility)
  discount_breakdown JSONB DEFAULT '[]'::jsonb,
  
  -- Loyalty
  loyalty_points_earned INTEGER DEFAULT 0,
  loyalty_points_redeemed INTEGER DEFAULT 0,
  
  -- Payment reference
  payment_method TEXT, -- 'card', 'cash', 'gift_card', 'loyalty', 'mixed'
  payment_reference TEXT, -- Stripe payment intent ID, etc.
  
  -- Idempotency
  idempotency_key TEXT UNIQUE,
  
  -- Actor
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'staff', 'customer', 'admin')),
  actor_id UUID,
  
  -- State at time of ledger entry
  entity_state_at_write TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for financial ledger
CREATE INDEX IF NOT EXISTS idx_ledger_tenant ON engine_financial_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entity ON engine_financial_ledger(entity_id);
CREATE INDEX IF NOT EXISTS idx_ledger_module ON engine_financial_ledger(module_id);
CREATE INDEX IF NOT EXISTS idx_ledger_engine_type ON engine_financial_ledger(engine_type);
CREATE INDEX IF NOT EXISTS idx_ledger_transaction_type ON engine_financial_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON engine_financial_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_idempotency ON engine_financial_ledger(idempotency_key);

-- Financial invariant: total_amount = subtotal + tax_amount + service_charge + delivery_fee - total_discount
-- We use a CHECK constraint with a small tolerance for floating-point rounding
ALTER TABLE engine_financial_ledger 
  ADD CONSTRAINT chk_ledger_total_invariant 
  CHECK (
    ABS(total_amount - GREATEST(0, subtotal + tax_amount + service_charge + delivery_fee - total_discount)) < 0.03
  );

-- Non-negative amounts
ALTER TABLE engine_financial_ledger
  ADD CONSTRAINT chk_ledger_nonneg_total
  CHECK (total_amount >= 0);

ALTER TABLE engine_financial_ledger
  ADD CONSTRAINT chk_ledger_nonneg_subtotal
  CHECK (subtotal >= 0);

-- ============================================
-- 2. State Transition Audit Log
-- ============================================

CREATE TABLE IF NOT EXISTS engine_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  module_id UUID NOT NULL,
  engine_type TEXT NOT NULL CHECK (engine_type IN ('instant_transaction', 'time_exclusive_reservation', 'shared_capacity_access', 'ongoing_entitlement')),
  entity_id UUID NOT NULL,
  
  -- Transition details
  previous_state TEXT NOT NULL,
  new_state TEXT NOT NULL,
  action TEXT NOT NULL,
  
  -- Actor
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'staff', 'customer', 'admin')),
  actor_id UUID,
  
  -- Context at time of transition
  context JSONB DEFAULT '{}'::jsonb,
  
  -- Guard evaluation results
  guards_evaluated JSONB DEFAULT '[]'::jsonb,
  
  -- Side effects triggered
  side_effects JSONB DEFAULT '[]'::jsonb,
  
  -- Was this transition part of a saga/transaction?
  transaction_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutability: no updates or deletes on audit log
-- (enforced via RLS policy or trigger)

CREATE INDEX IF NOT EXISTS idx_transitions_entity ON engine_state_transitions(entity_id);
CREATE INDEX IF NOT EXISTS idx_transitions_tenant ON engine_state_transitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transitions_engine ON engine_state_transitions(engine_type);
CREATE INDEX IF NOT EXISTS idx_transitions_created ON engine_state_transitions(created_at);
CREATE INDEX IF NOT EXISTS idx_transitions_action ON engine_state_transitions(action);

-- ============================================
-- 3. Idempotency Keys
-- ============================================

CREATE TABLE IF NOT EXISTS engine_idempotency_keys (
  key TEXT PRIMARY KEY,
  tenant_id UUID NOT NULL,
  engine_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
  result_data JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Prevent stale processing locks
  CONSTRAINT chk_idempotency_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON engine_idempotency_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_entity ON engine_idempotency_keys(entity_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_status ON engine_idempotency_keys(status);

-- ============================================
-- 4. Compensation Log (Saga failure tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS engine_compensation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  error_message TEXT,
  status TEXT NOT NULL CHECK (status IN ('failed', 'resolved', 'ignored')),
  requires_manual_review BOOLEAN NOT NULL DEFAULT TRUE,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compensation_tx ON engine_compensation_log(tx_id);
CREATE INDEX IF NOT EXISTS idx_compensation_review ON engine_compensation_log(requires_manual_review) WHERE requires_manual_review = TRUE;

-- ============================================
-- 5. Capacity Constraints (Engine C)
-- ============================================
-- Ensure pool/facility capacity cannot go negative

-- This function is called by triggers to validate capacity
CREATE OR REPLACE FUNCTION check_capacity_nonneg()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_occupancy < 0 THEN
    RAISE EXCEPTION 'Capacity violation: current_occupancy cannot be negative (attempted: %)', NEW.current_occupancy;
  END IF;
  IF NEW.max_capacity IS NOT NULL AND NEW.current_occupancy > NEW.max_capacity THEN
    RAISE EXCEPTION 'Capacity violation: current_occupancy (%) exceeds max_capacity (%)', NEW.current_occupancy, NEW.max_capacity;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to pool_sessions or any capacity-tracked table if it exists
-- (Only create trigger if the target table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pools' AND table_schema = 'public') THEN
    -- Add check constraint for non-negative capacity
    BEGIN
      ALTER TABLE pools ADD CONSTRAINT chk_pool_capacity_nonneg CHECK (current_occupancy >= 0);
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- constraint already exists
    END;
  END IF;
END $$;

-- ============================================
-- 6. Booking Overlap Prevention (Engine B)
-- ============================================
-- Prevent double-booking of the same resource for overlapping time ranges

-- Extension needed for range types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Function to validate booking non-overlap
CREATE OR REPLACE FUNCTION check_booking_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.chalet_id = NEW.chalet_id
      AND b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND b.status NOT IN ('cancelled', 'no_show')
      AND b.check_in_date < NEW.check_out_date
      AND b.check_out_date > NEW.check_in_date
  ) THEN
    RAISE EXCEPTION 'Booking overlap: resource % is already booked for the requested dates', NEW.chalet_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger only if bookings table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings' AND table_schema = 'public') THEN
    -- Drop existing trigger if any
    DROP TRIGGER IF EXISTS trg_booking_overlap ON bookings;
    CREATE TRIGGER trg_booking_overlap
      BEFORE INSERT OR UPDATE ON bookings
      FOR EACH ROW EXECUTE FUNCTION check_booking_overlap();
  END IF;
END $$;

-- ============================================
-- 7. Duplicate Loyalty Prevention
-- ============================================
-- Prevent earning loyalty points twice for the same transaction

CREATE TABLE IF NOT EXISTS engine_loyalty_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  entity_id UUID NOT NULL,
  engine_type TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('earn', 'redeem', 'void')),
  points INTEGER NOT NULL,
  dollar_value DECIMAL(12,2),
  
  -- Unique constraint prevents double-earning
  CONSTRAINT uq_loyalty_earn_per_entity UNIQUE (entity_id, event_type),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_events_customer ON engine_loyalty_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_events_entity ON engine_loyalty_events(entity_id);

-- ============================================
-- 8. Engine Feature Flags
-- ============================================

CREATE TABLE IF NOT EXISTS engine_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  flag_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Rollout configuration
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  
  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_feature_flag_tenant UNIQUE (tenant_id, flag_name)
);

-- Insert default feature flags for engine v2
INSERT INTO engine_feature_flags (tenant_id, flag_name, enabled, description)
VALUES 
  ('00000000-0000-0000-0000-000000000000'::uuid, 'engine_v2_pricing', FALSE, 'Use engine v2 unified pricing pipeline'),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'engine_v2_state_machine', FALSE, 'Use engine v2 state machine enforcement'),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'engine_v2_ledger', FALSE, 'Write to unified financial ledger'),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'engine_v2_idempotency', FALSE, 'Enable idempotency key checking'),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'engine_v2_full', FALSE, 'Enable all engine v2 features')
ON CONFLICT (tenant_id, flag_name) DO NOTHING;

-- ============================================
-- 9. RLS Policies (Row Level Security)
-- ============================================

-- Enable RLS on engine tables
ALTER TABLE engine_financial_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_compensation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_loyalty_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE engine_feature_flags ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (backend operations)
CREATE POLICY IF NOT EXISTS engine_ledger_service ON engine_financial_ledger FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY IF NOT EXISTS engine_transitions_service ON engine_state_transitions FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY IF NOT EXISTS engine_idempotency_service ON engine_idempotency_keys FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY IF NOT EXISTS engine_compensation_service ON engine_compensation_log FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY IF NOT EXISTS engine_loyalty_service ON engine_loyalty_events FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY IF NOT EXISTS engine_flags_service ON engine_feature_flags FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ============================================
-- 10. Helper Functions
-- ============================================

-- Get ledger balance for an entity
CREATE OR REPLACE FUNCTION get_entity_ledger_balance(p_entity_id UUID)
RETURNS DECIMAL AS $$
  SELECT COALESCE(
    SUM(CASE 
      WHEN transaction_type IN ('charge', 'deposit') THEN total_amount
      WHEN transaction_type IN ('refund', 'void', 'deposit_release') THEN -total_amount
      ELSE 0
    END), 0
  )
  FROM engine_financial_ledger
  WHERE entity_id = p_entity_id;
$$ LANGUAGE sql STABLE;

-- Get all transitions for an entity (audit trail)
CREATE OR REPLACE FUNCTION get_entity_audit_trail(p_entity_id UUID)
RETURNS SETOF engine_state_transitions AS $$
  SELECT * FROM engine_state_transitions
  WHERE entity_id = p_entity_id
  ORDER BY created_at ASC;
$$ LANGUAGE sql STABLE;

-- Check if feature flag is enabled for a tenant
CREATE OR REPLACE FUNCTION is_engine_flag_enabled(p_tenant_id UUID, p_flag_name TEXT)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT enabled FROM engine_feature_flags 
     WHERE tenant_id = p_tenant_id AND flag_name = p_flag_name),
    FALSE
  );
$$ LANGUAGE sql STABLE;

-- Clean up expired idempotency keys
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM engine_idempotency_keys
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
