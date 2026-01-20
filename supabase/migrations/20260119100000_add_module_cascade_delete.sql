-- Migration: Add ON DELETE CASCADE to module_id foreign keys
-- This fixes the 400 error when trying to hard-delete modules

-- Menu Items - most common dependency
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'menu_items_module_id_fkey') THEN
        ALTER TABLE menu_items DROP CONSTRAINT menu_items_module_id_fkey;
    END IF;
END $$;

ALTER TABLE menu_items 
ADD CONSTRAINT menu_items_module_id_fkey 
FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;

-- Menu Categories
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'menu_categories_module_id_fkey') THEN
        ALTER TABLE menu_categories DROP CONSTRAINT menu_categories_module_id_fkey;
    END IF;
END $$;

ALTER TABLE menu_categories 
ADD CONSTRAINT menu_categories_module_id_fkey 
FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;

-- Snack Items
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'snack_items_module_id_fkey') THEN
        ALTER TABLE snack_items DROP CONSTRAINT snack_items_module_id_fkey;
    END IF;
END $$;

ALTER TABLE snack_items 
ADD CONSTRAINT snack_items_module_id_fkey 
FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;

-- Pool Tickets
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'pool_tickets_module_id_fkey') THEN
        ALTER TABLE pool_tickets DROP CONSTRAINT pool_tickets_module_id_fkey;
    END IF;
END $$;

ALTER TABLE pool_tickets 
ADD CONSTRAINT pool_tickets_module_id_fkey 
FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;

-- Pool Sessions
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'pool_sessions_module_id_fkey') THEN
        ALTER TABLE pool_sessions DROP CONSTRAINT pool_sessions_module_id_fkey;
    END IF;
END $$;

ALTER TABLE pool_sessions 
ADD CONSTRAINT pool_sessions_module_id_fkey 
FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;

-- Chalets
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'chalets_module_id_fkey') THEN
        ALTER TABLE chalets DROP CONSTRAINT chalets_module_id_fkey;
    END IF;
END $$;

ALTER TABLE chalets 
ADD CONSTRAINT chalets_module_id_fkey 
FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;

-- Chalet Bookings
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'chalet_bookings_module_id_fkey') THEN
        ALTER TABLE chalet_bookings DROP CONSTRAINT chalet_bookings_module_id_fkey;
    END IF;
END $$;

ALTER TABLE chalet_bookings 
ADD CONSTRAINT chalet_bookings_module_id_fkey 
FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;

-- Reviews
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'reviews_module_id_fkey') THEN
        ALTER TABLE reviews DROP CONSTRAINT reviews_module_id_fkey;
    END IF;
END $$;

ALTER TABLE reviews 
ADD CONSTRAINT reviews_module_id_fkey 
FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;

-- Pages
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'pages_module_id_fkey') THEN
        ALTER TABLE pages DROP CONSTRAINT pages_module_id_fkey;
    END IF;
END $$;

ALTER TABLE pages 
ADD CONSTRAINT pages_module_id_fkey 
FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;

-- Restaurant Orders (module_id column)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'restaurant_orders_module_id_fkey') THEN
        ALTER TABLE restaurant_orders DROP CONSTRAINT restaurant_orders_module_id_fkey;
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'restaurant_orders' AND column_name = 'module_id') THEN
        ALTER TABLE restaurant_orders 
        ADD CONSTRAINT restaurant_orders_module_id_fkey 
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Snack Orders (module_id column)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'snack_orders_module_id_fkey') THEN
        ALTER TABLE snack_orders DROP CONSTRAINT snack_orders_module_id_fkey;
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'snack_orders' AND column_name = 'module_id') THEN
        ALTER TABLE snack_orders 
        ADD CONSTRAINT snack_orders_module_id_fkey 
        FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
    END IF;
END $$;

COMMENT ON CONSTRAINT menu_items_module_id_fkey ON menu_items IS 'Cascade delete menu items when module is deleted';
