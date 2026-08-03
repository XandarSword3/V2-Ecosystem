-- Migration: Backfill tenant/property scope on gift_card_transactions inserts
-- Date: 2026-08-03
--
-- Same bug class as 20260730120000_fix_coupon_usage_tenant_scope.sql, never
-- fixed for gift cards: 20260624010000_audit_isolation_remediation.sql added
-- tenant_id/property_id to gift_card_transactions and set both NOT NULL, but
-- redeem_giftcard_atomic() (20260117180005_giftcard_func.sql) inserts into
-- gift_card_transactions without either column. Confirmed by actually
-- calling it against a replayed copy of this migration history:
--
--   ERROR: null value in column "tenant_id" of relation
--   "gift_card_transactions" violates not-null constraint
--
-- i.e. every gift-card redemption through the pricing pipeline currently
-- fails. The new restore_gift_card_balance() RPC (20260802090000) has the
-- identical gap for the same reason — it was modeled on this insert.
--
-- Fix: same shape as the coupon fix — a BEFORE INSERT trigger that derives
-- tenant_id/property_id from the referenced gift_cards row whenever the
-- caller doesn't supply them. Protects both existing writers
-- (redeem_giftcard_atomic, restore_gift_card_balance) and any future one,
-- without needing to touch either function's SQL.

CREATE OR REPLACE FUNCTION gift_card_transactions_backfill_scope()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL OR NEW.property_id IS NULL THEN
        SELECT
            COALESCE(NEW.tenant_id, g.tenant_id),
            COALESCE(NEW.property_id, g.property_id)
        INTO NEW.tenant_id, NEW.property_id
        FROM gift_cards g
        WHERE g.id = NEW.gift_card_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gift_card_transactions_backfill_scope ON gift_card_transactions;
CREATE TRIGGER trg_gift_card_transactions_backfill_scope
BEFORE INSERT ON gift_card_transactions
FOR EACH ROW EXECUTE FUNCTION gift_card_transactions_backfill_scope();
