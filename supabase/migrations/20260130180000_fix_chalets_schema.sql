-- File: supabase/migrations/20260130180000_fix_chalets_schema.sql
-- UP Migration
BEGIN;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chalets') THEN
		ALTER TABLE chalets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;

	-- Also check other generated tables
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chalet_bookings') THEN
		ALTER TABLE chalet_bookings ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pool_tickets') THEN
		ALTER TABLE pool_tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pool_sessions') THEN
		ALTER TABLE pool_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_categories') THEN
		ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_items') THEN
		ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'snack_items') THEN
		ALTER TABLE snack_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_items') THEN
		ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;
END $$;

COMMIT;
