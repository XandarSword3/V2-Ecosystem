-- Migration: Auto-populate coupon_usage tenant/property scoping on insert
-- Date: 2026-07-30
--
-- Context: 20260624010000_audit_isolation_remediation.sql added tenant_id and
-- property_id to coupon_usage and set both NOT NULL. apply_coupon_atomic()
-- was last touched 2026-01-18, five months before that migration, and still
-- inserts into coupon_usage without either column. Every coupon redemption
-- now passes validation and then fails at the final INSERT with a not-null
-- constraint violation on tenant_id.
--
-- Fix: a BEFORE INSERT trigger that derives tenant_id/property_id from the
-- referenced coupon row whenever the caller doesn't supply them. This runs
-- before the NOT NULL check fires, so it's a real fix rather than a
-- workaround, and it protects any future writer to this table, not just
-- this one RPC.

CREATE OR REPLACE FUNCTION coupon_usage_backfill_scope()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL OR NEW.property_id IS NULL THEN
        SELECT
            COALESCE(NEW.tenant_id, c.tenant_id),
            COALESCE(NEW.property_id, c.property_id)
        INTO NEW.tenant_id, NEW.property_id
        FROM coupons c
        WHERE c.id = NEW.coupon_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_coupon_usage_backfill_scope ON coupon_usage;
CREATE TRIGGER trg_coupon_usage_backfill_scope
BEFORE INSERT ON coupon_usage
FOR EACH ROW EXECUTE FUNCTION coupon_usage_backfill_scope();
