-- =============================================
-- DROP LEGACY MENU MODIFIER SYSTEM
-- =============================================
-- menu_modifier_groups / menu_modifier_options / menu_item_modifiers were
-- superseded by the unified customization system (customization_groups /
-- customization_options / entity_customizations, see
-- 20260204100000_unified_customization_system.sql) but were never removed.
-- They were only reachable through a frontend fallback path that failed
-- silently (ModifierSelectionModal.tsx), so nothing could ever have been
-- written to them via the app. Dev DB — no data migration needed.
--
-- Drop order: children first (menu_item_modifiers, menu_modifier_options)
-- then the parent (menu_modifier_groups), each guarded so this is safe to
-- run whether or not the tables exist.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'menu_item_modifiers' AND relkind = 'r') THEN
        DROP TABLE menu_item_modifiers CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'menu_modifier_options' AND relkind = 'r') THEN
        DROP TABLE menu_modifier_options CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'menu_modifier_groups' AND relkind = 'r') THEN
        DROP TABLE menu_modifier_groups CASCADE;
    END IF;
END $$;

-- The migration helper RPC only ever read from the tables above; drop it
-- too so nothing can reference the now-gone tables.
DROP FUNCTION IF EXISTS migrate_menu_modifiers_to_unified();

-- NOTE: customization_groups / customization_options / entity_customizations
-- / order_customizations (unified system) are untouched by this migration.

COMMIT;
