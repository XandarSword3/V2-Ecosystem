-- ============================================================
-- Migration: Add stripe_product_id to plans
--
-- The plans.controller.ts now auto-creates Stripe Products and
-- Prices when a plan is saved, removing the need to paste IDs
-- manually. stripe_product_id is stored so that future edits
-- can update the right Stripe Product, and deletions can archive
-- it (Stripe doesn't allow hard-deleting products that have prices).
--
-- stripe_monthly_price_id and stripe_annual_price_id already exist
-- on the table — they are now written by the backend automatically
-- rather than by the admin UI.
-- ============================================================

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;

COMMENT ON COLUMN plans.stripe_product_id IS
  'Stripe Product ID (prod_...). Created automatically by the backend '
  'on plan create/update. NULL until Stripe is configured and the plan '
  'has been saved at least once with STRIPE_SECRET_KEY set.';
