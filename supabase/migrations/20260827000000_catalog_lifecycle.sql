-- ============================================================
-- Phase 8: Catalog/product lifecycle (Plan Phase 8)
-- ============================================================
-- Adds a canonical lifecycle_status to catalog_items so the catalog
-- supports the full product lifecycle:
--
--   draft → active → temporarily_unavailable → sold_out → archived
--
-- Existing rows default to 'active' (they're already live).
-- The old is_available boolean is NOT removed — it coexists as a
-- quick-flip availability toggle while lifecycle_status provides
-- the richer semantic state the business needs.
-- ============================================================

-- 1. Add the lifecycle_status column with a CHECK constraint.
ALTER TABLE "public"."catalog_items"
  ADD COLUMN IF NOT EXISTS "lifecycle_status" text
    NOT NULL DEFAULT 'active';

ALTER TABLE "public"."catalog_items"
  ADD CONSTRAINT "catalog_items_lifecycle_status_check"
  CHECK ("lifecycle_status" IN (
    'draft',
    'active',
    'temporarily_unavailable',
    'sold_out',
    'archived'
  ));

COMMENT ON COLUMN "public"."catalog_items"."lifecycle_status"
  IS 'Canonical product lifecycle state: draft → active → temporarily_unavailable → sold_out → archived. Phase 8 (Plan).';

-- 2. Backfill any NULLs (shouldn't exist with DEFAULT, but defensive).
UPDATE "public"."catalog_items"
  SET "lifecycle_status" = 'active'
  WHERE "lifecycle_status" IS NULL;

-- 3. Index for the most common query: "show me active products in this module."
CREATE INDEX IF NOT EXISTS "idx_catalog_items_lifecycle"
  ON "public"."catalog_items" ("module_id", "lifecycle_status")
  WHERE "lifecycle_status" = 'active';

-- 4. Composite index for the customer-facing menu query:
--    module_id + lifecycle_status + is_available + deleted_at IS NULL.
CREATE INDEX IF NOT EXISTS "idx_catalog_items_customer_menu"
  ON "public"."catalog_items" ("module_id", "lifecycle_status", "is_available")
  WHERE "deleted_at" IS NULL AND "lifecycle_status" = 'active';
