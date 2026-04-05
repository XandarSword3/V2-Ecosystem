-- Migration to create a helper function to inspect constraints
CREATE OR REPLACE FUNCTION get_constraints(t_name TEXT)
RETURNS TABLE(constraint_name TEXT, definition TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT conname::TEXT, pg_get_constraintdef(c.oid)::TEXT
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = t_name;
END;
$$;
