-- Restore legacy compatibility columns required by current backend controllers/services.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- catalog_categories compatibility
ALTER TABLE IF EXISTS catalog_categories
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_fr TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'catalog_categories'
      AND column_name = 'sort_order'
  ) THEN
    UPDATE catalog_categories
    SET display_order = COALESCE(display_order, sort_order, 0)
    WHERE display_order IS NULL;
  ELSE
    UPDATE catalog_categories
    SET display_order = COALESCE(display_order, 0)
    WHERE display_order IS NULL;
  END IF;
END $$;

UPDATE catalog_categories
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- catalog_items compatibility
ALTER TABLE IF EXISTS catalog_items
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_fr TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_fr TEXT,
  ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS calories INTEGER,
  ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_gluten_free BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_dairy_free BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_halal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergens JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE catalog_items
SET display_order = COALESCE(display_order, 0)
WHERE display_order IS NULL;

UPDATE catalog_items
SET created_at = COALESCE(created_at, now())
WHERE created_at IS NULL;

UPDATE catalog_items
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- kiosk items not in canonical schema — no-op block.
DO $$ BEGIN NULL; END $$;

-- accommodation_units compatibility
ALTER TABLE IF EXISTS accommodation_units
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_fr TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_fr TEXT,
  ADD COLUMN IF NOT EXISTS bedroom_count INTEGER,
  ADD COLUMN IF NOT EXISTS bathroom_count INTEGER,
  ADD COLUMN IF NOT EXISTS size_sqm INTEGER,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE accommodation_units
SET display_order = COALESCE(display_order, 0)
WHERE display_order IS NULL;

-- accommodation_unit_add_ons not in canonical schema — no-op block.
DO $$ BEGIN NULL; END $$;

-- capacity access tickets — no compatibility block needed.
-- Capacity access is stored in transactions (engine_type = 'shared_capacity_access').
-- All fields previously on access tickets now live in transactions.metadata.
DO $$ BEGIN NULL; END $$;

-- deterministic auth compatibility for local/dev E2E credentials
INSERT INTO roles (name, display_name, description, business_unit)
VALUES
  ('super_admin', 'Super Administrator', 'Full system access', 'admin'),
  ('menu_service_staff', 'Menu Service Staff', 'Menu service operations', 'menu_service'),
  ('customer', 'Customer', 'Registered customer', NULL)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY['customer']::TEXT[],
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

INSERT INTO users (
  email,
  password_hash,
  full_name,
  role,
  roles,
  email_verified,
  is_active
)
VALUES
  (
    'admin@v2ecosystem.com',
    extensions.crypt('admin123', extensions.gen_salt('bf')),
    'System Administrator',
    'super_admin',
    ARRAY['super_admin']::TEXT[],
    true,
    true
  ),
  (
    'menu.service.staff@v2ecosystem.com',
    extensions.crypt('staff123', extensions.gen_salt('bf')),
    'Menu Service Staff',
    'menu_service_staff',
    ARRAY['menu_service_staff']::TEXT[],
    true,
    true
  ),
  (
    'e2e.customer@test.com',
    extensions.crypt('TestPass123!', extensions.gen_salt('bf')),
    'Test Customer',
    'customer',
    ARRAY['customer']::TEXT[],
    true,
    true
  )
ON CONFLICT (email) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  roles = EXCLUDED.roles,
  email_verified = true,
  is_active = true,
  updated_at = now();

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'super_admin'
WHERE u.email = 'admin@v2ecosystem.com'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'menu_service_staff'
WHERE u.email = 'menu.service.staff@v2ecosystem.com'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'customer'
WHERE u.email = 'e2e.customer@test.com'
ON CONFLICT DO NOTHING;

-- audit_logs compatibility for current logger payload
ALTER TABLE IF EXISTS audit_logs
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- minimal baseline data for local end-to-end journeys
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'catalog_categories'
      AND column_name = 'sort_order'
  ) THEN
    WITH menu_service_module AS (
      SELECT id FROM modules WHERE slug = 'menu_service' LIMIT 1
    )
    INSERT INTO catalog_categories (
      name,
      description,
      sort_order,
      is_active,
      module_id,
      display_order
    )
    SELECT
      'Main Dishes',
      'Seeded category for local E2E validation',
      1,
      true,
      rm.id,
      1
    FROM menu_service_module rm
    WHERE NOT EXISTS (
      SELECT 1
      FROM catalog_categories mc
      WHERE mc.module_id = rm.id
        AND lower(mc.name) = 'main dishes'
    );
  ELSE
    WITH menu_service_module AS (
      SELECT id FROM modules WHERE slug = 'menu_service' LIMIT 1
    )
    INSERT INTO catalog_categories (
      name,
      description,
      is_active,
      module_id,
      display_order
    )
    SELECT
      'Main Dishes',
      'Seeded category for local E2E validation',
      true,
      rm.id,
      1
    FROM menu_service_module rm
    WHERE NOT EXISTS (
      SELECT 1
      FROM catalog_categories mc
      WHERE mc.module_id = rm.id
        AND lower(mc.name) = 'main dishes'
    );
  END IF;
END $$;

WITH menu_service_module AS (
  SELECT id FROM modules WHERE slug = 'menu_service' LIMIT 1
), category_seed AS (
  SELECT mc.id, mc.module_id
  FROM catalog_categories mc
  JOIN menu_service_module rm ON rm.id = mc.module_id
  ORDER BY mc.created_at NULLS LAST, mc.id
  LIMIT 1
)
INSERT INTO catalog_items (
  category_id,
  name,
  description,
  price,
  is_available,
  module_id,
  display_order
)
SELECT
  cs.id,
  'Grilled Chicken Sandwich',
  'Seeded menu item for journey tests',
  12.50,
  true,
  cs.module_id,
  1
FROM category_seed cs
WHERE NOT EXISTS (
  SELECT 1
  FROM catalog_items mi
  WHERE mi.module_id = cs.module_id
    AND lower(mi.name) = 'grilled chicken sandwich'
);

-- kiosk items not in canonical schema — seed block removed.
DO $$ BEGIN NULL; END $$;

WITH accommodation_module AS (
  SELECT id FROM modules WHERE slug = 'accommodation' LIMIT 1
)
INSERT INTO accommodation_units (
  name,
  description,
  base_price,
  weekend_price,
  capacity,
  bedroom_count,
  bathroom_count,
  size_sqm,
  is_active,
  module_id,
  display_order,
  image_url
)
SELECT
  'Sunset Unit',
  'Seeded accommodation unit for local journey tests',
  180.00,
  220.00,
  4,
  2,
  1,
  65,
  true,
  am.id,
  1,
  'https://example.com/units/sunset.jpg'
FROM accommodation_module am
WHERE NOT EXISTS (
  SELECT 1
  FROM accommodation_units au
  WHERE au.module_id = am.id
    AND lower(au.name) = 'sunset unit'
);

-- capacity_windows seed handled in dedicated capacity_windows migrations.
DO $$ BEGIN NULL; END $$;

-- Helpful indexes for common module-scoped filters
CREATE INDEX IF NOT EXISTS idx_catalog_items_module_id ON catalog_items(module_id);
-- accommodation_unit_add_ons index removed — table not in canonical schema
-- capacity access ticket indexes removed; use transactions table with engine_type filter instead
CREATE INDEX IF NOT EXISTS idx_transactions_shared_capacity ON transactions(engine_type, status)
  WHERE engine_type = 'shared_capacity_access';

COMMIT;
