-- Remove the applies_to CHECK constraint entirely.
--
-- Per Issue 17 (backend/src/modules/coupons/coupon.controller.ts), applies_to is now a
-- free-form module slug -- z.string().max(100).default('all') -- so ANY module name
-- (e.g. 'delete') is a valid value. A static allow-list constraint will always drift out
-- of sync with new modules and has no real validation purpose anymore.
--
-- Drops any check constraint on this table that references applies_to, regardless of what
-- name it currently has (prior migrations 20260720130000 / 20260720131000 may have left it
-- under a name other than 'coupons_applies_to_check').

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'coupons'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%applies_to%'
    LOOP
        EXECUTE format('ALTER TABLE coupons DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;
