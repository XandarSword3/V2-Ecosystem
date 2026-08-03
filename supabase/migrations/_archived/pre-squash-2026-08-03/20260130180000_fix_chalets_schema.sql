-- Migration: add deleted_at soft-delete columns to renamed platform tables
-- UP Migration
BEGIN;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accommodation_units') THEN
		ALTER TABLE accommodation_units ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;

	-- Also check other generated tables
	-- unit reservations: soft-delete handled via transactions.status (no standalone table)
	-- capacity access tickets: soft-delete handled via transactions.status (no standalone table)
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'capacity_windows') THEN
		ALTER TABLE capacity_windows ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_categories') THEN
		ALTER TABLE catalog_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'catalog_items') THEN
		ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;
	-- standalone kiosk catalog: demolished; no-op
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_items') THEN
		ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
	END IF;
END $$;

COMMIT;
