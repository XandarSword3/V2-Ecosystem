-- Restore legacy compatibility columns required by current backend controllers/services.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- menu_categories compatibility
ALTER TABLE IF EXISTS menu_categories
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
      AND table_name = 'menu_categories'
      AND column_name = 'sort_order'
  ) THEN
    UPDATE menu_categories
    SET display_order = COALESCE(display_order, sort_order, 0)
    WHERE display_order IS NULL;
  ELSE
    UPDATE menu_categories
    SET display_order = COALESCE(display_order, 0)
    WHERE display_order IS NULL;
  END IF;
END $$;

UPDATE menu_categories
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- menu_items compatibility
ALTER TABLE IF EXISTS menu_items
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

UPDATE menu_items
SET display_order = COALESCE(display_order, 0)
WHERE display_order IS NULL;

UPDATE menu_items
SET created_at = COALESCE(created_at, now())
WHERE created_at IS NULL;

UPDATE menu_items
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- snack_items compatibility
ALTER TABLE IF EXISTS snack_items
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_fr TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_fr TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE snack_items
SET display_order = COALESCE(display_order, 0)
WHERE display_order IS NULL;

UPDATE snack_items
SET created_at = COALESCE(created_at, now())
WHERE created_at IS NULL;

UPDATE snack_items
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- chalets compatibility
ALTER TABLE IF EXISTS chalets
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

UPDATE chalets
SET display_order = COALESCE(display_order, 0)
WHERE display_order IS NULL;

-- chalet_add_ons compatibility
ALTER TABLE IF EXISTS chalet_add_ons
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_fr TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id);

UPDATE chalet_add_ons
SET updated_at = COALESCE(updated_at, created_at, now())
WHERE updated_at IS NULL;

-- pool_tickets compatibility (legacy date/quantity/total_price -> modern ticket schema)
ALTER TABLE IF EXISTS pool_tickets
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS quantity INTEGER,
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ticket_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES pool_sessions(id),
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id),
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ticket_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS number_of_guests INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS entry_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exit_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS pool_tickets
  ALTER COLUMN user_id DROP NOT NULL;

UPDATE pool_tickets
SET customer_id = COALESCE(customer_id, user_id)
WHERE customer_id IS NULL;

UPDATE pool_tickets
SET ticket_date = COALESCE(ticket_date, date::timestamptz)
WHERE ticket_date IS NULL
  AND date IS NOT NULL;

UPDATE pool_tickets
SET number_of_guests = COALESCE(number_of_guests, NULLIF(quantity, 0), 1)
WHERE number_of_guests IS NULL;

UPDATE pool_tickets
SET total_amount = COALESCE(total_amount, total_price, 0)
WHERE total_amount IS NULL;

UPDATE pool_tickets
SET subtotal = COALESCE(subtotal, total_amount, total_price, 0)
WHERE subtotal IS NULL;

UPDATE pool_tickets
SET tax_amount = COALESCE(tax_amount, 0)
WHERE tax_amount IS NULL;

UPDATE pool_tickets
SET payment_status = CASE
  WHEN status = 'used' THEN 'paid'::payment_status
  ELSE 'pending'::payment_status
END
WHERE payment_status IS NULL;

UPDATE pool_tickets
SET ticket_number = COALESCE(
  ticket_number,
  'LEGACY-' || to_char(COALESCE(created_at, now()), 'YYYYMMDDHH24MISS') || '-' || substr(id::text, 1, 8)
)
WHERE ticket_number IS NULL;

UPDATE pool_tickets pt
SET customer_name = COALESCE(pt.customer_name, u.full_name)
FROM users u
WHERE pt.customer_id = u.id
  AND pt.customer_name IS NULL;

UPDATE pool_tickets pt
SET customer_email = COALESCE(pt.customer_email, u.email)
FROM users u
WHERE pt.customer_id = u.id
  AND pt.customer_email IS NULL;

CREATE OR REPLACE FUNCTION sync_pool_ticket_compat_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NULL THEN
    NEW.customer_id := NEW.user_id;
  END IF;

  IF NEW.user_id IS NULL THEN
    NEW.user_id := NEW.customer_id;
  END IF;

  IF NEW.ticket_date IS NULL AND NEW.date IS NOT NULL THEN
    NEW.ticket_date := NEW.date::timestamptz;
  END IF;

  IF NEW.date IS NULL AND NEW.ticket_date IS NOT NULL THEN
    NEW.date := NEW.ticket_date::date;
  END IF;

  IF NEW.number_of_guests IS NULL AND NEW.quantity IS NOT NULL THEN
    NEW.number_of_guests := NEW.quantity;
  END IF;

  IF NEW.quantity IS NULL AND NEW.number_of_guests IS NOT NULL THEN
    NEW.quantity := NEW.number_of_guests;
  END IF;

  IF NEW.total_amount IS NULL AND NEW.total_price IS NOT NULL THEN
    NEW.total_amount := NEW.total_price;
  END IF;

  IF NEW.total_price IS NULL AND NEW.total_amount IS NOT NULL THEN
    NEW.total_price := NEW.total_amount;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_pool_ticket_compat_fields ON pool_tickets;
CREATE TRIGGER trg_sync_pool_ticket_compat_fields
BEFORE INSERT OR UPDATE ON pool_tickets
FOR EACH ROW
EXECUTE FUNCTION sync_pool_ticket_compat_fields();

-- deterministic auth compatibility for local/dev E2E credentials
INSERT INTO roles (name, display_name, description, business_unit)
VALUES
  ('super_admin', 'Super Administrator', 'Full system access', 'admin'),
  ('restaurant_staff', 'Restaurant Staff', 'Restaurant operations', 'restaurant'),
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
    'restaurant.staff@v2ecosystem.com',
    extensions.crypt('staff123', extensions.gen_salt('bf')),
    'Restaurant Staff',
    'restaurant_staff',
    ARRAY['restaurant_staff']::TEXT[],
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
JOIN roles r ON r.name = 'restaurant_staff'
WHERE u.email = 'restaurant.staff@v2ecosystem.com'
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
      AND table_name = 'menu_categories'
      AND column_name = 'sort_order'
  ) THEN
    WITH restaurant_module AS (
      SELECT id FROM modules WHERE slug = 'restaurant' LIMIT 1
    )
    INSERT INTO menu_categories (
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
    FROM restaurant_module rm
    WHERE NOT EXISTS (
      SELECT 1
      FROM menu_categories mc
      WHERE mc.module_id = rm.id
        AND lower(mc.name) = 'main dishes'
    );
  ELSE
    WITH restaurant_module AS (
      SELECT id FROM modules WHERE slug = 'restaurant' LIMIT 1
    )
    INSERT INTO menu_categories (
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
    FROM restaurant_module rm
    WHERE NOT EXISTS (
      SELECT 1
      FROM menu_categories mc
      WHERE mc.module_id = rm.id
        AND lower(mc.name) = 'main dishes'
    );
  END IF;
END $$;

WITH restaurant_module AS (
  SELECT id FROM modules WHERE slug = 'restaurant' LIMIT 1
), category_seed AS (
  SELECT mc.id, mc.module_id
  FROM menu_categories mc
  JOIN restaurant_module rm ON rm.id = mc.module_id
  ORDER BY mc.created_at NULLS LAST, mc.id
  LIMIT 1
)
INSERT INTO menu_items (
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
  FROM menu_items mi
  WHERE mi.module_id = cs.module_id
    AND lower(mi.name) = 'grilled chicken sandwich'
);

WITH snack_module AS (
  SELECT id
  FROM modules
  WHERE slug IN ('snack-bar', 'snack_bar')
  ORDER BY created_at NULLS LAST, id
  LIMIT 1
)
INSERT INTO snack_items (
  name,
  description,
  category,
  price,
  stock_quantity,
  is_available,
  module_id,
  display_order
)
SELECT
  'Fresh Orange Juice',
  'Seeded snack item for local E2E validation',
  'drink',
  4.50,
  100,
  true,
  sm.id,
  1
FROM snack_module sm
WHERE NOT EXISTS (
  SELECT 1
  FROM snack_items si
  WHERE si.module_id = sm.id
    AND lower(si.name) = 'fresh orange juice'
);

WITH chalet_module AS (
  SELECT id FROM modules WHERE slug = 'chalets' LIMIT 1
)
INSERT INTO chalets (
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
  'Sunset Chalet',
  'Seeded chalet for local journey tests',
  180.00,
  220.00,
  4,
  2,
  1,
  65,
  true,
  cm.id,
  1,
  'https://example.com/chalets/sunset.jpg'
FROM chalet_module cm
WHERE NOT EXISTS (
  SELECT 1
  FROM chalets c
  WHERE c.module_id = cm.id
    AND lower(c.name) = 'sunset chalet'
);

DO $$
DECLARE
  v_pool_module_id UUID;
BEGIN
  SELECT id
  INTO v_pool_module_id
  FROM modules
  WHERE slug = 'pool'
  LIMIT 1;

  IF v_pool_module_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pool_sessions ps
       WHERE ps.module_id = v_pool_module_id
         AND ps.is_active = true
     ) THEN
    BEGIN
      INSERT INTO pool_sessions (
        name,
        start_time,
        end_time,
        max_capacity,
        price,
        is_active,
        module_id,
        adult_price,
        child_price,
        gender_restriction
      )
      VALUES (
        'Morning Swim Session',
        '09:00:00'::time,
        '12:00:00'::time,
        120,
        25.00,
        true,
        v_pool_module_id,
        25.00,
        15.00,
        'mixed'
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Skipping pool_sessions baseline insert in schema-compat migration: %', SQLERRM;
    END;
  END IF;
END $$;

-- Helpful indexes for common module-scoped filters
CREATE INDEX IF NOT EXISTS idx_menu_items_module_id ON menu_items(module_id);
CREATE INDEX IF NOT EXISTS idx_chalet_add_ons_module_id ON chalet_add_ons(module_id);
CREATE INDEX IF NOT EXISTS idx_pool_tickets_session_id ON pool_tickets(session_id);
CREATE INDEX IF NOT EXISTS idx_pool_tickets_ticket_date ON pool_tickets(ticket_date);
CREATE INDEX IF NOT EXISTS idx_pool_tickets_customer_id ON pool_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_pool_tickets_module_id ON pool_tickets(module_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pool_tickets_ticket_number_unique
  ON pool_tickets(ticket_number)
  WHERE ticket_number IS NOT NULL;

COMMIT;
