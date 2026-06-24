-- Generic engine configuration tables (Engine Refit: Phase 2)
-- Replaces all module-specific config tables (capacity_windows, catalog_items, catalog_categories)
-- with white-label generic equivalents that any module can use.

-- ─────────────────────────────────────────────────────────────
-- capacity_windows: replaces pool_sessions
-- Used by all shared_capacity_access modules (gym, cinema, spa, etc.)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capacity_windows (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id    UUID        NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  start_time   TIME        NOT NULL,
  end_time     TIME        NOT NULL,
  max_capacity INTEGER     NOT NULL DEFAULT 50,
  price        DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capacity_windows_module_id ON capacity_windows(module_id);
CREATE INDEX IF NOT EXISTS idx_capacity_windows_active    ON capacity_windows(module_id, is_active);

-- ─────────────────────────────────────────────────────────────
-- catalog_items: replaces catalog_items + catalog_categories + snack_items
-- Used by all instant_transaction modules (restaurant, snack bar, retail, etc.)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id    UUID        NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  description  TEXT,
  price        DECIMAL(10,2) NOT NULL DEFAULT 0,
  category     TEXT,
  is_available BOOLEAN     NOT NULL DEFAULT true,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_module_id ON catalog_items(module_id);
CREATE INDEX IF NOT EXISTS idx_catalog_items_available  ON catalog_items(module_id, is_available);

-- ─────────────────────────────────────────────────────────────
-- Data migration from legacy source table to capacity_windows:
-- already applied; source table no longer exists in canonical DDL.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- Migrate catalog_items → catalog_items
-- No-op: table already exists from base schema; self-referential
-- insert would use non-existent 'category' TEXT column.
-- ─────────────────────────────────────────────────────────────

