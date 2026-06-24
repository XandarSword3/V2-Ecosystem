-- Soft-delete columns for critical entities
-- Legacy booking tables removed — now handled via transactions table.
-- Soft-delete on transactions is handled via status field (cancelled/expired).

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

-- Add deleted_at column to accommodation_units if not exists (guard: no-op if table absent)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accommodation_units') THEN
        RETURN;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accommodation_units' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE accommodation_units ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
        CREATE INDEX IF NOT EXISTS idx_accommodation_units_deleted_at ON accommodation_units(deleted_at) WHERE deleted_at IS NULL;
        COMMENT ON COLUMN accommodation_units.deleted_at IS 'Soft delete timestamp - NULL means not deleted';
    END IF;
END $$;

-- Add deleted_by column to track who performed the soft delete
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'deleted_by'
    ) THEN
        ALTER TABLE users ADD COLUMN deleted_by UUID REFERENCES users(id) DEFAULT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accommodation_units')
       AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accommodation_units' AND column_name = 'deleted_by'
    ) THEN
        ALTER TABLE accommodation_units ADD COLUMN deleted_by UUID REFERENCES users(id) DEFAULT NULL;
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
