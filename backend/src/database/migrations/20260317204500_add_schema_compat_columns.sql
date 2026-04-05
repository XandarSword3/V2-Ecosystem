-- Restore legacy compatibility columns required by current backend controllers/services.
BEGIN;

-- menu_categories compatibility
ALTER TABLE IF EXISTS menu_categories
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_fr TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE menu_categories
SET display_order = COALESCE(display_order, sort_order, 0)
WHERE display_order IS NULL;

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

-- Helpful indexes for common module-scoped filters
CREATE INDEX IF NOT EXISTS idx_menu_items_module_id ON menu_items(module_id);
CREATE INDEX IF NOT EXISTS idx_chalet_add_ons_module_id ON chalet_add_ons(module_id);

COMMIT;
