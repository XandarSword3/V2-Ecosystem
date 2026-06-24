-- Q158: Add metadata JSONB column to accommodation_units.
-- catalog_items and capacity_windows already have this column (20260523100000).
-- accommodation_units was missing it, blocking engine-layer consistency.
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE accommodation_units
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
