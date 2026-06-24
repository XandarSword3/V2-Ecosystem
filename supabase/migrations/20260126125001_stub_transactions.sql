-- Stub: create transactions table early enough for 20260126130000 to reference it.
-- The canonical definition lived in 20260506000000_create_transactions_table.sql, which
-- was archived and replaced by 20260522000000_clean_transactions_table.sql. That means
-- every migration between 20260126130000 and 20260522000000 that touches transactions
-- (FK, trigger, index) would fail on a fresh push without this stub.
--
-- Schema is identical to 20260522000000 so that migration becomes a safe no-op
-- (CREATE TABLE IF NOT EXISTS skips; indexes use IF NOT EXISTS; RLS policy uses
-- EXCEPTION WHEN duplicate_object THEN NULL).

CREATE TABLE IF NOT EXISTS transactions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id       UUID            REFERENCES modules(id) ON DELETE SET NULL,
    engine_type     VARCHAR(50)     NOT NULL,
    property_id     UUID,
    status          VARCHAR(50)     NOT NULL DEFAULT 'pending',
    amount          DECIMAL(12,2)   NOT NULL DEFAULT 0,
    tax_amount      DECIMAL(12,2)   NOT NULL DEFAULT 0,
    service_charge  DECIMAL(12,2)   NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2)   NOT NULL DEFAULT 0,
    net_amount      DECIMAL(12,2)   NOT NULL DEFAULT 0,
    currency        VARCHAR(3)      NOT NULL DEFAULT 'USD',
    customer_id     UUID,
    reference_id    UUID,
    reference_table VARCHAR(50),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ              DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    metadata        JSONB                    DEFAULT '{}'
);
