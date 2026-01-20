-- Migration: Add soft-delete columns for critical entities
-- Purpose: Enable safe deletion with recovery option for bookings, users, and staff

-- Add deleted_at column to chalet_bookings if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chalet_bookings' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE chalet_bookings ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_chalet_bookings_deleted_at ON chalet_bookings(deleted_at) WHERE deleted_at IS NULL;
        COMMENT ON COLUMN chalet_bookings.deleted_at IS 'Soft delete timestamp - NULL means not deleted';
    END IF;
END $$;

-- Add deleted_at column to users if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
        COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp - NULL means not deleted';
    END IF;
END $$;

-- Add deleted_at column to restaurant_orders if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'restaurant_orders' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE restaurant_orders ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_restaurant_orders_deleted_at ON restaurant_orders(deleted_at) WHERE deleted_at IS NULL;
        COMMENT ON COLUMN restaurant_orders.deleted_at IS 'Soft delete timestamp - NULL means not deleted';
    END IF;
END $$;

-- Add deleted_at column to pool_tickets if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pool_tickets' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE pool_tickets ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_pool_tickets_deleted_at ON pool_tickets(deleted_at) WHERE deleted_at IS NULL;
        COMMENT ON COLUMN pool_tickets.deleted_at IS 'Soft delete timestamp - NULL means not deleted';
    END IF;
END $$;

-- Add deleted_at column to chalets if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chalets' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE chalets ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_chalets_deleted_at ON chalets(deleted_at) WHERE deleted_at IS NULL;
        COMMENT ON COLUMN chalets.deleted_at IS 'Soft delete timestamp - NULL means not deleted';
    END IF;
END $$;

-- Add deleted_by column to track who performed the soft delete
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chalet_bookings' AND column_name = 'deleted_by'
    ) THEN
        ALTER TABLE chalet_bookings ADD COLUMN deleted_by UUID REFERENCES users(id) DEFAULT NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'deleted_by'
    ) THEN
        ALTER TABLE users ADD COLUMN deleted_by UUID REFERENCES users(id) DEFAULT NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'restaurant_orders' AND column_name = 'deleted_by'
    ) THEN
        ALTER TABLE restaurant_orders ADD COLUMN deleted_by UUID REFERENCES users(id) DEFAULT NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pool_tickets' AND column_name = 'deleted_by'
    ) THEN
        ALTER TABLE pool_tickets ADD COLUMN deleted_by UUID REFERENCES users(id) DEFAULT NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chalets' AND column_name = 'deleted_by'
    ) THEN
        ALTER TABLE chalets ADD COLUMN deleted_by UUID REFERENCES users(id) DEFAULT NULL;
    END IF;
END $$;

-- Create a function for soft delete that can be used by any table
CREATE OR REPLACE FUNCTION soft_delete(
    p_table_name TEXT,
    p_id UUID,
    p_deleted_by UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_result BOOLEAN;
BEGIN
    EXECUTE format(
        'UPDATE %I SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING TRUE',
        p_table_name
    ) INTO v_result USING p_deleted_by, p_id;
    
    RETURN COALESCE(v_result, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function for restoring soft-deleted records
CREATE OR REPLACE FUNCTION restore_soft_delete(
    p_table_name TEXT,
    p_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_result BOOLEAN;
BEGIN
    EXECUTE format(
        'UPDATE %I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING TRUE',
        p_table_name
    ) INTO v_result USING p_id;
    
    RETURN COALESCE(v_result, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION soft_delete(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_soft_delete(TEXT, UUID) TO authenticated;
