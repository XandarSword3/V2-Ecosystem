-- Generic engine configuration tables (Engine Refit: Phase 2)
-- Replaces all module-specific config tables (pool_sessions, menu_items, menu_categories)
-- with white-label generic equivalents that any module can use.

-- ─────────────────────────────────────────────────────────────
-- capacity_windows: replaces pool_sessions
-- Used by all shared_capacity_access modules (pool, gym, cinema, etc.)
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
-- catalog_items: replaces menu_items + menu_categories + snack_items
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
-- Migrate existing pool_sessions data → capacity_windows
-- ─────────────────────────────────────────────────────────────
INSERT INTO capacity_windows (id, module_id, name, start_time, end_time, max_capacity, price, is_active, metadata, created_at, updated_at)
SELECT
  id,
  module_id,
  name,
  start_time,
  end_time,
  COALESCE(max_capacity, 50),
  COALESCE(adult_price, price, 0),
  COALESCE(is_active, true),
  jsonb_build_object(
    'adult_price',  COALESCE(adult_price, price, 0),
    'child_price',  COALESCE(child_price, 0),
    'gender_restriction', COALESCE(gender_restriction, 'mixed')
  ),
  COALESCE(created_at, now()),
  COALESCE(updated_at, now())
FROM pool_sessions
WHERE module_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Migrate menu_items → catalog_items
-- ─────────────────────────────────────────────────────────────
INSERT INTO catalog_items (module_id, name, description, price, category, is_available, metadata, created_at, updated_at)
SELECT
  mi.module_id,
  mi.name,
  mi.description,
  COALESCE(mi.price, 0),
  mc.name,
  COALESCE(mi.is_available, true),
  jsonb_build_object(
    'preparation_time_minutes', mi.preparation_time_minutes,
    'calories', mi.calories,
    'allergens', mi.allergens
  ),
  COALESCE(mi.created_at, now()),
  COALESCE(mi.updated_at, now())
FROM menu_items mi
LEFT JOIN menu_categories mc ON mc.id = mi.category_id
WHERE mi.module_id IS NOT NULL
ON CONFLICT DO NOTHING;

