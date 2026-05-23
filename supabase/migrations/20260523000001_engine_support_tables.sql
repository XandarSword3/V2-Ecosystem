-- ============================================================
-- Engine Support Tables + Auth Hardening + Support Ticket Schema
-- MISSING-05: engine_financial_ledger, engine_idempotency_keys,
--             engine_compensation_log
-- MISSING-06: support_inquiries extended for full ticket workflow
-- MISSING-07: sessions.refresh_token index
-- P3:         token_blacklist for individual access token revocation
-- ============================================================

-- -------------------------------------------------------
-- 1. engine_financial_ledger
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS engine_financial_ledger (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID          NOT NULL,
  module_id                UUID          NOT NULL,
  engine_type              TEXT          NOT NULL,
  entity_id                UUID          NOT NULL,
  entity_type              TEXT          NOT NULL,
  transaction_type         TEXT          NOT NULL
    CHECK (transaction_type IN ('charge','refund','adjustment','void','deposit','deposit_release')),
  currency                 TEXT          NOT NULL DEFAULT 'USD',
  subtotal                 NUMERIC(14,4) NOT NULL DEFAULT 0,
  tax_amount               NUMERIC(14,4) NOT NULL DEFAULT 0,
  tax_rate                 NUMERIC(8,6)  NOT NULL DEFAULT 0,
  service_charge           NUMERIC(14,4) NOT NULL DEFAULT 0,
  delivery_fee             NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_discount           NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_amount             NUMERIC(14,4) NOT NULL DEFAULT 0,
  deposit_amount           NUMERIC(14,4) NOT NULL DEFAULT 0,
  discount_breakdown       JSONB         NOT NULL DEFAULT '[]',
  loyalty_points_earned    INTEGER       NOT NULL DEFAULT 0,
  loyalty_points_redeemed  INTEGER       NOT NULL DEFAULT 0,
  payment_method           TEXT,
  payment_reference        TEXT,
  idempotency_key          TEXT,
  actor_type               TEXT          NOT NULL
    CHECK (actor_type IN ('system','staff','customer','admin')),
  actor_id                 UUID,
  entity_state_at_write    TEXT,
  metadata                 JSONB         NOT NULL DEFAULT '{}',
  notes                    TEXT,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Append-only: block UPDATE and DELETE at DB level
CREATE OR REPLACE FUNCTION _engine_ledger_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'engine_financial_ledger is append-only — UPDATE is forbidden';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'engine_financial_ledger is append-only — DELETE is forbidden';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_engine_ledger_immutability ON engine_financial_ledger;
CREATE TRIGGER trg_engine_ledger_immutability
  BEFORE UPDATE OR DELETE ON engine_financial_ledger
  FOR EACH ROW EXECUTE FUNCTION _engine_ledger_immutability();

CREATE INDEX IF NOT EXISTS idx_efl_entity   ON engine_financial_ledger (entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_efl_module   ON engine_financial_ledger (module_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_efl_tenant   ON engine_financial_ledger (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_efl_idem     ON engine_financial_ledger (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE engine_financial_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY efl_read ON engine_financial_ledger FOR SELECT USING (true);

-- -------------------------------------------------------
-- 2. engine_idempotency_keys
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS engine_idempotency_keys (
  key          TEXT        PRIMARY KEY,
  tenant_id    TEXT        NOT NULL,
  engine_type  TEXT        NOT NULL,
  entity_id    TEXT        NOT NULL,
  action       TEXT        NOT NULL,
  status       TEXT        NOT NULL CHECK (status IN ('processing','completed','failed')),
  result_data  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idem_expires ON engine_idempotency_keys (expires_at);
ALTER TABLE engine_idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY idem_all ON engine_idempotency_keys FOR ALL USING (true);

-- -------------------------------------------------------
-- 3. engine_compensation_log
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS engine_compensation_log (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_id                  TEXT        NOT NULL,
  step_name              TEXT        NOT NULL,
  error_message          TEXT        NOT NULL,
  status                 TEXT        NOT NULL DEFAULT 'failed',
  requires_manual_review BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_tx     ON engine_compensation_log (tx_id);
CREATE INDEX IF NOT EXISTS idx_comp_review ON engine_compensation_log (requires_manual_review)
  WHERE requires_manual_review = TRUE;
ALTER TABLE engine_compensation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY comp_log_all ON engine_compensation_log FOR ALL USING (true);

-- -------------------------------------------------------
-- 4. token_blacklist — individual access token revocation (P3)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS token_blacklist (
  jti        TEXT        PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tbl_expires ON token_blacklist (expires_at);
ALTER TABLE token_blacklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY tbl_system ON token_blacklist FOR ALL USING (true);

-- -------------------------------------------------------
-- 5. sessions.refresh_token index (MISSING-07)
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token
  ON sessions (refresh_token)
  WHERE is_active = TRUE;

-- -------------------------------------------------------
-- 6. support_inquiries — extend for full ticket workflow (MISSING-06)
-- -------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE support_inquiries
    ADD COLUMN IF NOT EXISTS priority       TEXT        NOT NULL DEFAULT 'normal'
      CHECK (priority IN ('low','normal','high','urgent')),
    ADD COLUMN IF NOT EXISTS assigned_to    UUID        REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS resolved_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closed_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_due_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tags           TEXT[]      NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS internal_notes JSONB       NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();
EXCEPTION WHEN others THEN
  RAISE NOTICE 'support_inquiries columns already exist or error: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_support_status   ON support_inquiries (status);
CREATE INDEX IF NOT EXISTS idx_support_assigned ON support_inquiries (assigned_to)
  WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_priority ON support_inquiries (priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_sla      ON support_inquiries (sla_due_at)
  WHERE resolved_at IS NULL;
