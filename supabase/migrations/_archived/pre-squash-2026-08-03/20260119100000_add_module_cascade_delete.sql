-- Migration: Add ON DELETE CASCADE to module_id foreign keys
-- Safely wrapped to avoid errors if columns are missing

-- Menu Items
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'catalog_items_module_id_fkey') THEN
        ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_items' AND column_name = 'module_id')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modules') THEN
        ALTER TABLE catalog_items ADD CONSTRAINT catalog_items_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Menu Categories
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'catalog_categories_module_id_fkey') THEN
        ALTER TABLE catalog_categories DROP CONSTRAINT IF EXISTS catalog_categories_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_categories' AND column_name = 'module_id')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modules') THEN
        ALTER TABLE catalog_categories ADD CONSTRAINT catalog_categories_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Kiosk items subsumed into catalog_items — no cascade constraint needed
DO $$ BEGIN NULL; END $$;

-- Legacy capacity tickets — removed; engine is transactions table
DO $$ BEGIN NULL; END $$;

-- Capacity Windows
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'capacity_windows_module_id_fkey') THEN
        ALTER TABLE capacity_windows DROP CONSTRAINT IF EXISTS capacity_windows_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'capacity_windows' AND column_name = 'module_id')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modules') THEN
        ALTER TABLE capacity_windows ADD CONSTRAINT capacity_windows_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Accommodation Units
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'accommodation_units_module_id_fkey') THEN
        ALTER TABLE accommodation_units DROP CONSTRAINT IF EXISTS accommodation_units_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accommodation_units' AND column_name = 'module_id')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modules') THEN
        ALTER TABLE accommodation_units ADD CONSTRAINT accommodation_units_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Legacy accommodation bookings — removed; engine is transactions table
DO $$ BEGIN NULL; END $$;

-- Reviews
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_module_id_fkey') THEN
        ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'module_id')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modules') THEN
        ALTER TABLE reviews ADD CONSTRAINT reviews_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Pages
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pages_module_id_fkey') THEN
        ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pages' AND column_name = 'module_id')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modules') THEN
        ALTER TABLE pages ADD CONSTRAINT pages_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Legacy module orders — removed; engine is transactions table
-- Legacy capacity tickets — removed; engine is transactions table
-- Legacy accommodation bookings — removed; engine is transactions table
-- Legacy kiosk orders — removed; engine is transactions table
-- Cascade deletes for all module types are handled via transactions.module_id FK.
DO $$ BEGIN NULL; END $$;
