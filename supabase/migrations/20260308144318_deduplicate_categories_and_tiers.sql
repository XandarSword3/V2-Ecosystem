-- =============================================
-- Deduplicate menu_categories
-- Keep the earliest created category per (name, module_id), reassign items to survivor
-- =============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'menu_categories'
  ) THEN
    ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'loyalty_tiers'
  ) THEN
    ALTER TABLE loyalty_tiers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Step 1: Reassign menu_items to the surviving (earliest) category
UPDATE menu_items mi
SET category_id = survivor.id
FROM menu_categories mc
JOIN (
  SELECT name, module_id, MIN(created_at) AS min_created
  FROM menu_categories
  GROUP BY name, module_id
) earliest ON mc.name = earliest.name AND mc.module_id = earliest.module_id AND mc.created_at = earliest.min_created
JOIN (
  SELECT id, name, module_id, MIN(created_at) OVER (PARTITION BY name, module_id) AS min_created, created_at
  FROM menu_categories
) survivor ON survivor.name = mc.name AND survivor.module_id = mc.module_id AND survivor.created_at = survivor.min_created
WHERE mi.category_id = mc.id
  AND mc.created_at != (
    SELECT MIN(created_at) FROM menu_categories mc2
    WHERE mc2.name = mc.name AND mc2.module_id = mc.module_id
  );

-- Simpler approach: use a CTE
WITH survivors AS (
  SELECT DISTINCT ON (name, module_id) id, name, module_id
  FROM menu_categories
  ORDER BY name, module_id, created_at ASC
),
duplicates AS (
  SELECT mc.id AS dup_id, s.id AS survivor_id
  FROM menu_categories mc
  JOIN survivors s ON mc.name = s.name AND mc.module_id = s.module_id
  WHERE mc.id != s.id
)
UPDATE menu_items
SET category_id = d.survivor_id
FROM duplicates d
WHERE menu_items.category_id = d.dup_id;

-- Step 2: Delete duplicate categories (keep earliest per name+module_id)
DELETE FROM menu_categories
WHERE id NOT IN (
  SELECT DISTINCT ON (name, module_id) id
  FROM menu_categories
  ORDER BY name, module_id, created_at ASC
);

-- =============================================
-- Deduplicate loyalty_tiers
-- Keep the earliest created tier per name, reassign members to survivor
-- =============================================

-- Step 1: Reassign loyalty_members to surviving tier
WITH survivors AS (
  SELECT DISTINCT ON (name) id, name
  FROM loyalty_tiers
  ORDER BY name, created_at ASC
),
duplicates AS (
  SELECT lt.id AS dup_id, s.id AS survivor_id
  FROM loyalty_tiers lt
  JOIN survivors s ON lt.name = s.name
  WHERE lt.id != s.id
)
UPDATE loyalty_members
SET tier_id = d.survivor_id
FROM duplicates d
WHERE loyalty_members.tier_id = d.dup_id;

-- Step 2: Delete duplicate tiers (keep earliest per name)
DELETE FROM loyalty_tiers
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM loyalty_tiers
  ORDER BY name, created_at ASC
);

-- =============================================
-- Add unique constraints to prevent future duplicates
-- =============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_categories_name_module
ON menu_categories (name, module_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_tiers_name
ON loyalty_tiers (name);
