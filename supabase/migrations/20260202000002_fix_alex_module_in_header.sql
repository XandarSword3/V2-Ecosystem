-- Fix for Bug 1: Module "Alex" not appearing in header
-- This script ensures the module has show_in_main = true and is in navbar links

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'modules'
    ) THEN
        RAISE NOTICE 'modules table does not exist, skipping alex header fix';
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'modules' AND column_name = 'show_in_main'
    ) THEN
        ALTER TABLE modules ADD COLUMN show_in_main BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Step 1: Check and fix the module's show_in_main flag
UPDATE modules 
SET show_in_main = true, is_active = true
WHERE slug = 'alex' OR LOWER(name) = 'alex';

-- Step 2: Add to navbar links if using CMS mode and module isn't there
DO $$
DECLARE
    current_navbar jsonb;
    alex_module record;
    new_link jsonb;
    updated_links jsonb;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'site_settings'
    ) THEN
        RAISE NOTICE 'site_settings table does not exist, skipping navbar update';
        RETURN;
    END IF;

    -- Get the alex module
    SELECT * INTO alex_module FROM modules WHERE slug = 'alex' OR LOWER(name) = 'alex' LIMIT 1;
    
    IF alex_module IS NULL THEN
        RAISE NOTICE 'No module named "alex" found';
        RETURN;
    END IF;
    
    -- Get current navbar config
    SELECT navbar INTO current_navbar FROM site_settings LIMIT 1;
    
    IF current_navbar IS NULL OR current_navbar->'links' IS NULL THEN
        RAISE NOTICE 'Navbar not in CMS mode - module should appear in fallback navigation';
        RETURN;
    END IF;
    
    -- Check if module is already in navbar
    IF current_navbar->'links' @> ('[{"moduleSlug": "' || alex_module.slug || '"}]')::jsonb THEN
        RAISE NOTICE 'Module already in navbar links';
        RETURN;
    END IF;
    
    -- Build new link entry
    new_link := jsonb_build_object(
        'type', 'module',
        'moduleSlug', alex_module.slug,
        'label', alex_module.name,
        'icon', CASE 
            WHEN alex_module.template_type = 'menu_service' THEN 'UtensilsCrossed'
            WHEN alex_module.template_type = 'session_access' THEN 'Waves'
            ELSE 'Home'
        END
    );
    
    -- Append to existing links
    updated_links := current_navbar->'links' || new_link;
    
    -- Update site_settings
    UPDATE site_settings 
    SET navbar = jsonb_set(current_navbar, '{links}', updated_links);
    
    RAISE NOTICE 'Added module "%" to navbar links', alex_module.name;
END $$;

-- Verify the fix
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'modules'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'site_settings'
    ) THEN
        RAISE NOTICE 'Alex module header fix verification completed.';
    ELSE
        RAISE NOTICE 'Alex module header fix verification skipped due to missing tables.';
    END IF;
END $$;
