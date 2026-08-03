-- Fix remaining VARCHAR→TEXT cast issues in name columns from JOIN tables

-- Fix revenue_by_module: m.name is varchar on modules table
DROP FUNCTION IF EXISTS get_economics_revenue_by_module(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_economics_revenue_by_module(
  p_from TIMESTAMP WITH TIME ZONE,
  p_to TIMESTAMP WITH TIME ZONE,
  p_property_id UUID DEFAULT NULL,
  p_module_id TEXT DEFAULT NULL,
  p_engine_type TEXT DEFAULT NULL
) RETURNS TABLE (
  module_id TEXT,
  module_name TEXT,
  revenue NUMERIC,
  transaction_count BIGINT,
  refund_count BIGINT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(t.module_id::TEXT, 'unknown') AS module_id,
    COALESCE(m.name::TEXT, t.module_id::TEXT, 'unknown') AS module_name,
    SUM(CASE WHEN t.status NOT IN ('cancelled', 'refunded', 'void') THEN t.amount ELSE 0 END) AS revenue,
    COUNT(*) FILTER (WHERE t.status NOT IN ('cancelled', 'refunded', 'void')) AS transaction_count,
    COUNT(*) FILTER (WHERE t.status = 'refunded') AS refund_count
  FROM transactions t
  LEFT JOIN modules m ON m.id = t.module_id
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
    AND (p_module_id IS NULL OR t.module_id::TEXT = p_module_id)
    AND (p_engine_type IS NULL OR t.engine_type::TEXT = p_engine_type)
  GROUP BY COALESCE(t.module_id::TEXT, 'unknown'), COALESCE(m.name::TEXT, t.module_id::TEXT, 'unknown');
END;
$$;

-- Fix top_customers: u.full_name is varchar on users table
DROP FUNCTION IF EXISTS get_economics_top_customers(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INT, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_economics_top_customers(
  p_from TIMESTAMP WITH TIME ZONE,
  p_to TIMESTAMP WITH TIME ZONE,
  p_limit INT DEFAULT 10,
  p_property_id UUID DEFAULT NULL,
  p_module_id TEXT DEFAULT NULL,
  p_engine_type TEXT DEFAULT NULL
) RETURNS TABLE (
  customer_id UUID,
  customer_name TEXT,
  spend NUMERIC,
  transaction_count BIGINT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.customer_id,
    COALESCE(u.full_name::TEXT, t.customer_id::TEXT) AS customer_name,
    SUM(t.amount) AS spend,
    COUNT(*) AS transaction_count
  FROM transactions t
  LEFT JOIN users u ON u.id = t.customer_id
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND t.status NOT IN ('cancelled', 'refunded', 'void')
    AND t.customer_id IS NOT NULL
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
    AND (p_module_id IS NULL OR t.module_id::TEXT = p_module_id)
    AND (p_engine_type IS NULL OR t.engine_type::TEXT = p_engine_type)
  GROUP BY t.customer_id, COALESCE(u.full_name::TEXT, t.customer_id::TEXT)
  ORDER BY SUM(t.amount) DESC
  LIMIT p_limit;
END;
$$;

-- Fix staff_performance: u.full_name is varchar on users table
DROP FUNCTION IF EXISTS get_economics_staff_performance(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_economics_staff_performance(
  p_from TIMESTAMP WITH TIME ZONE,
  p_to TIMESTAMP WITH TIME ZONE,
  p_property_id UUID DEFAULT NULL,
  p_module_id TEXT DEFAULT NULL,
  p_engine_type TEXT DEFAULT NULL
) RETURNS TABLE (
  staff_id UUID,
  staff_name TEXT,
  revenue NUMERIC,
  transaction_count BIGINT,
  cancellation_count BIGINT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.staff_id,
    COALESCE(u.full_name::TEXT, t.staff_id::TEXT) AS staff_name,
    SUM(CASE WHEN t.status NOT IN ('cancelled', 'refunded', 'void') THEN t.amount ELSE 0 END) AS revenue,
    COUNT(*) FILTER (WHERE t.status NOT IN ('cancelled', 'refunded', 'void')) AS transaction_count,
    COUNT(*) FILTER (WHERE t.status = 'cancelled') AS cancellation_count
  FROM transactions t
  LEFT JOIN users u ON u.id = t.staff_id
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND t.staff_id IS NOT NULL
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
    AND (p_module_id IS NULL OR t.module_id::TEXT = p_module_id)
    AND (p_engine_type IS NULL OR t.engine_type::TEXT = p_engine_type)
  GROUP BY t.staff_id, COALESCE(u.full_name::TEXT, t.staff_id::TEXT);
END;
$$;
