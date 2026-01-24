-- Migration: Add ON DELETE CASCADE to module_id foreign keys
-- Safely wrapped to avoid errors if columns are missing

-- Menu Items
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'menu_items_module_id_fkey') THEN
        ALTER TABLE menu_items DROP CONSTRAINT menu_items_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'module_id') THEN
        ALTER TABLE menu_items ADD CONSTRAINT menu_items_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Menu Categories
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'menu_categories_module_id_fkey') THEN
        ALTER TABLE menu_categories DROP CONSTRAINT menu_categories_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_categories' AND column_name = 'module_id') THEN
        ALTER TABLE menu_categories ADD CONSTRAINT menu_categories_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Snack Items
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'snack_items_module_id_fkey') THEN
        ALTER TABLE snack_items DROP CONSTRAINT snack_items_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'snack_items' AND column_name = 'module_id') THEN
        ALTER TABLE snack_items ADD CONSTRAINT snack_items_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Pool Tickets
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pool_tickets_module_id_fkey') THEN
        ALTER TABLE pool_tickets DROP CONSTRAINT pool_tickets_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pool_tickets' AND column_name = 'module_id') THEN
        ALTER TABLE pool_tickets ADD CONSTRAINT pool_tickets_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Pool Sessions
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pool_sessions_module_id_fkey') THEN
        ALTER TABLE pool_sessions DROP CONSTRAINT pool_sessions_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pool_sessions' AND column_name = 'module_id') THEN
        ALTER TABLE pool_sessions ADD CONSTRAINT pool_sessions_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Chalets
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chalets_module_id_fkey') THEN
        ALTER TABLE chalets DROP CONSTRAINT chalets_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chalets' AND column_name = 'module_id') THEN
        ALTER TABLE chalets ADD CONSTRAINT chalets_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Chalet Bookings
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chalet_bookings_module_id_fkey') THEN
        ALTER TABLE chalet_bookings DROP CONSTRAINT chalet_bookings_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chalet_bookings' AND column_name = 'module_id') THEN
        ALTER TABLE chalet_bookings ADD CONSTRAINT chalet_bookings_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Reviews
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'reviews_module_id_fkey') THEN
        ALTER TABLE reviews DROP CONSTRAINT reviews_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'module_id') THEN
        ALTER TABLE reviews ADD CONSTRAINT reviews_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Pages
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pages_module_id_fkey') THEN
        ALTER TABLE pages DROP CONSTRAINT pages_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pages' AND column_name = 'module_id') THEN
        ALTER TABLE pages ADD CONSTRAINT pages_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Restaurant Orders
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'restaurant_orders_module_id_fkey') THEN
        ALTER TABLE restaurant_orders DROP CONSTRAINT restaurant_orders_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_orders' AND column_name = 'module_id') THEN
        ALTER TABLE restaurant_orders ADD CONSTRAINT restaurant_orders_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Snack Orders
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'snack_orders_module_id_fkey') THEN
        ALTER TABLE snack_orders DROP CONSTRAINT snack_orders_module_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'snack_orders' AND column_name = 'module_id') THEN
        ALTER TABLE snack_orders ADD CONSTRAINT snack_orders_module_id_fkey FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

COMMENT ON CONSTRAINT menu_items_module_id_fkey ON menu_items IS 'Cascade delete menu items when module is deleted';
