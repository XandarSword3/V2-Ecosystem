-- ============================================
-- V2 Resort Database Migration Rollback Guide
-- ============================================
--
-- IMPORTANT: This file documents rollback procedures for database migrations.
-- Not all migrations are reversible. Irreversible migrations are marked.
--
-- ============================================
-- ROLLBACK PROCEDURES BY MIGRATION
-- ============================================

-- 001_initial_schema.sql
-- IRREVERSIBLE: Creates core tables (users, roles, permissions)
-- Rollback: Full database restore required
-- Risk: HIGH - Contains user data

-- 002_create_modules_table.sql
-- Rollback: DROP TABLE IF EXISTS modules CASCADE;
-- Risk: MEDIUM - Modules table is referenced by other tables

-- 003_add_missing_tables.sql
-- PARTIALLY REVERSIBLE: Multiple table additions
-- Individual rollbacks documented in migration file

-- 004_add_module_id_to_all.sql
-- Rollback: ALTER TABLE [table_name] DROP COLUMN IF EXISTS module_id;
-- Apply to: menu_items, chalets, pool_sessions, snack_items
-- Risk: LOW - Column removal only

-- 005_update_settings_schema.sql  
-- IRREVERSIBLE: Schema alterations with data transformations
-- Rollback: Full database restore required

-- 006_add_pool_maintenance.sql
-- Rollback: ALTER TABLE pools DROP COLUMN IF EXISTS is_under_maintenance;
-- Risk: LOW

-- 007_add_pool_entry_exit.sql
-- Rollback: 
--   ALTER TABLE pool_tickets DROP COLUMN IF EXISTS entry_time;
--   ALTER TABLE pool_tickets DROP COLUMN IF EXISTS exit_time;
-- Risk: LOW

-- 008_add_served_status.sql
-- Rollback: Update orders set status = 'completed' where status = 'served';
-- Then: ALTER TYPE order_status DROP VALUE 'served'; -- NOT POSSIBLE IN POSTGRES
-- IRREVERSIBLE: Cannot remove enum values in PostgreSQL

-- 009_add_menu_discount.sql
-- Rollback:
--   ALTER TABLE menu_items DROP COLUMN IF EXISTS discount_percentage;
--   ALTER TABLE menu_items DROP COLUMN IF EXISTS discount_valid_until;
-- Risk: LOW

-- 010_add_menu_spicy.sql
-- Rollback: ALTER TABLE menu_items DROP COLUMN IF EXISTS is_spicy;
-- Risk: LOW

-- 011_add_order_served_at.sql
-- Rollback: ALTER TABLE orders DROP COLUMN IF EXISTS served_at;
-- Risk: LOW

-- 012_add_chalet_price_rule.sql
-- Rollback: DROP TABLE IF EXISTS chalet_pricing_rules CASCADE;
-- Risk: MEDIUM - May have active pricing data

-- 013_create_backups_table.sql
-- Rollback: DROP TABLE IF EXISTS backups CASCADE;
-- Risk: LOW - Metadata only

-- 014_add_footer_settings.sql
-- Rollback: DELETE FROM settings WHERE key = 'footer_settings';
-- Risk: LOW

-- 015_add_navbar_settings.sql
-- Rollback: DELETE FROM settings WHERE key = 'navbar_settings';
-- Risk: LOW

-- 016_add_theme_settings.sql
-- Rollback: DELETE FROM settings WHERE key = 'theme_settings';
-- Risk: LOW

-- 017_add_pool_prices.sql
-- Rollback: DROP TABLE IF EXISTS pool_pricing_tiers CASCADE;
-- Risk: MEDIUM - May have active pricing data

-- 018_add_settings_table.sql
-- Rollback: Already exists check in migration - no rollback needed
-- Risk: N/A

-- 019_add_appearance_settings.sql
-- Rollback: DELETE FROM settings WHERE key LIKE 'appearance_%';
-- Risk: LOW

-- 020_add_supported_languages.sql
-- Rollback: ALTER TABLE translations DROP COLUMN IF EXISTS is_active;
-- Risk: LOW

-- 021_add_webhook_idempotency.sql
-- Rollback: DROP TABLE IF EXISTS webhook_events CASCADE;
-- Risk: LOW - Idempotency keys only

-- 022_add_two_factor_auth.sql
-- Rollback: 
--   DROP TABLE IF EXISTS two_factor_secrets CASCADE;
--   DROP TABLE IF EXISTS two_factor_backup_codes CASCADE;
-- Risk: HIGH - Will disable 2FA for all users

-- 023_add_scheduled_reports.sql
-- Rollback: DROP TABLE IF EXISTS scheduled_reports CASCADE;
-- Risk: MEDIUM - Will lose report configurations

-- ============================================
-- EMERGENCY FULL ROLLBACK PROCEDURE
-- ============================================
--
-- For complete database restoration:
--
-- 1. Stop all application instances
-- 2. Create backup of current state:
--    pg_dump -Fc $DATABASE_URL > emergency_backup_$(date +%Y%m%d_%H%M%S).dump
--
-- 3. Restore from last known good backup:
--    pg_restore -c -d $DATABASE_URL backup_file.dump
--
-- 4. Verify data integrity
-- 5. Restart application instances
--
-- ============================================
-- NOTES FOR OPERATIONS TEAM
-- ============================================
--
-- 1. ALWAYS backup before running migrations
-- 2. Migrations adding columns are generally safe to rollback
-- 3. Migrations adding ENUM values are IRREVERSIBLE in PostgreSQL
-- 4. Migrations with CASCADE on DROP will remove dependent data
-- 5. Test rollback procedures in staging before production
--
-- ============================================
-- IRREVERSIBLE MIGRATIONS SUMMARY
-- ============================================
--
-- The following migrations CANNOT be rolled back without a full restore:
-- - 001_initial_schema.sql (core schema)
-- - 005_update_settings_schema.sql (data transformations)
-- - 008_add_served_status.sql (enum value addition)
--
-- All other migrations can be rolled back using the procedures above.
--
