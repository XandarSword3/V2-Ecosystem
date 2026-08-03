-- 20260625000001_add_missing_category_2_columns.sql
--
-- Fix: Several earlier migrations used CREATE TABLE IF NOT EXISTS on tables
-- that already existed from the base shim, causing those blocks to silently
-- no-op and leave the columns they defined unborn.
--
-- Affected:
--   capacity_windows.metadata       (20260523100000 no-op)
--   catalog_items.category          (20260523100000 no-op)
--   loyalty_transactions.type       (20260126120000 no-op)
--   site_settings.navbar            (never migrated in; referenced by modules.controller.ts)
--   reviews backfill                (user_id → customer_id, text → content)

-- ─────────────────────────────────────────────────────────────
-- 1. capacity_windows.metadata
-- ─────────────────────────────────────────────────────────────
ALTER TABLE capacity_windows
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────
-- 2. catalog_items.category
-- ─────────────────────────────────────────────────────────────
ALTER TABLE catalog_items
  ADD COLUMN IF NOT EXISTS category TEXT;

-- ─────────────────────────────────────────────────────────────
-- 3. loyalty_transactions.type
-- Added as nullable first; back-filled from sign of points value.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE loyalty_transactions
  ADD COLUMN IF NOT EXISTS type VARCHAR(50);

UPDATE loyalty_transactions
  SET type = CASE
    WHEN points < 0 THEN 'redeem_reward'
    ELSE 'earn_order'
  END
  WHERE type IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. site_settings.navbar
-- Stores navigation link configuration used by the CMS module
-- auto-registration flow in modules.controller.ts.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS navbar JSONB DEFAULT '{}';

-- ─────────────────────────────────────────────────────────────
-- 5. reviews data backfill
-- 20260210000001 added customer_id and content as canonical columns.
-- Back-fill them from the legacy user_id / text columns so that
-- new code querying customer_id / content sees all historical rows.
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Migrate user_id → customer_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'reviews'
      AND column_name  = 'user_id'
  ) THEN
    UPDATE reviews
      SET customer_id = user_id
      WHERE customer_id IS NULL
        AND user_id IS NOT NULL;
  END IF;

  -- Migrate text → content
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'reviews'
      AND column_name  = 'text'
  ) THEN
    UPDATE reviews
      SET content = text
      WHERE content IS NULL
        AND text IS NOT NULL;
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL; -- reviews table doesn't exist yet, skip
END $$;
