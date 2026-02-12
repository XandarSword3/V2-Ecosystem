-- Fix for Bug 1: Module "Alex" not appearing in header
-- This script ensures the module has show_in_main = true and is in navbar links

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
SELECT 
    m.slug,
    m.name, 
    m.is_active,
    m.show_in_main,
    CASE 
        WHEN s.navbar->'links' @> ('[{"moduleSlug": "' || m.slug || '"}]')::jsonb 
        THEN 'YES' 
        ELSE 'NO' 
    END as in_navbar_cms
FROM modules m
CROSS JOIN site_settings s
WHERE m.slug = 'alex' OR LOWER(m.name) = 'alex';
