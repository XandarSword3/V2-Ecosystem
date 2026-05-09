-- Fix Phase 2 Economics RPCs
-- Fixes: 42804 (VARCHAR vs TEXT type mismatch), 42702 (ambiguous created_at)

-- 1. Revenue Over Time
DROP FUNCTION IF EXISTS get_economics_revenue_over_time(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_economics_revenue_over_time(
  p_from TIMESTAMP WITH TIME ZONE,
  p_to TIMESTAMP WITH TIME ZONE,
  p_interval TEXT,
  p_property_id UUID DEFAULT NULL,
  p_module_id TEXT DEFAULT NULL,
  p_engine_type TEXT DEFAULT NULL
) RETURNS TABLE (
  bucket TEXT,
  engine_type TEXT,
  revenue NUMERIC
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc(p_interval, t.created_at)::TEXT AS bucket,
    COALESCE(t.engine_type::TEXT, 'unknown') AS engine_type,
    SUM(t.amount) AS revenue
  FROM transactions t
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND t.status NOT IN ('cancelled', 'refunded', 'void')
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
    AND (p_module_id IS NULL OR t.module_id::TEXT = p_module_id)
    AND (p_engine_type IS NULL OR t.engine_type::TEXT = p_engine_type)
  GROUP BY date_trunc(p_interval, t.created_at), COALESCE(t.engine_type::TEXT, 'unknown');
END;
$$;

-- 2. Revenue By Module
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
    COALESCE(m.name, t.module_id::TEXT, 'unknown') AS module_name,
    SUM(CASE WHEN t.status NOT IN ('cancelled', 'refunded', 'void') THEN t.amount ELSE 0 END) AS revenue,
    COUNT(*) FILTER (WHERE t.status NOT IN ('cancelled', 'refunded', 'void')) AS transaction_count,
    COUNT(*) FILTER (WHERE t.status = 'refunded') AS refund_count
  FROM transactions t
  LEFT JOIN modules m ON m.id = t.module_id
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
    AND (p_module_id IS NULL OR t.module_id::TEXT = p_module_id)
    AND (p_engine_type IS NULL OR t.engine_type::TEXT = p_engine_type)
  GROUP BY COALESCE(t.module_id::TEXT, 'unknown'), COALESCE(m.name, t.module_id::TEXT, 'unknown');
END;
$$;

-- 3. Revenue By Engine Type
DROP FUNCTION IF EXISTS get_economics_revenue_by_engine(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_economics_revenue_by_engine(
  p_from TIMESTAMP WITH TIME ZONE,
  p_to TIMESTAMP WITH TIME ZONE,
  p_property_id UUID DEFAULT NULL,
  p_module_id TEXT DEFAULT NULL,
  p_engine_type TEXT DEFAULT NULL
) RETURNS TABLE (
  engine_type TEXT,
  revenue NUMERIC
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(t.engine_type::TEXT, 'unknown') AS engine_type,
    SUM(t.amount) AS revenue
  FROM transactions t
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND t.status NOT IN ('cancelled', 'refunded', 'void')
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
    AND (p_module_id IS NULL OR t.module_id::TEXT = p_module_id)
    AND (p_engine_type IS NULL OR t.engine_type::TEXT = p_engine_type)
  GROUP BY COALESCE(t.engine_type::TEXT, 'unknown');
END;
$$;

-- 4. Gross Vs Net
DROP FUNCTION IF EXISTS get_economics_gross_vs_net(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_economics_gross_vs_net(
  p_from TIMESTAMP WITH TIME ZONE,
  p_to TIMESTAMP WITH TIME ZONE,
  p_property_id UUID DEFAULT NULL,
  p_module_id TEXT DEFAULT NULL,
  p_engine_type TEXT DEFAULT NULL
) RETURNS TABLE (
  gross NUMERIC,
  net NUMERIC,
  discounts NUMERIC,
  refunds NUMERIC
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM(CASE WHEN t.status NOT IN ('cancelled', 'void') THEN t.amount + COALESCE(t.discount_amount, 0) ELSE 0 END) AS gross,
    SUM(CASE WHEN t.status NOT IN ('cancelled', 'refunded', 'void') THEN t.amount ELSE 0 END) AS net,
    SUM(CASE WHEN t.status NOT IN ('cancelled', 'void') THEN COALESCE(t.discount_amount, 0) ELSE 0 END) AS discounts,
    SUM(CASE WHEN t.status = 'refunded' THEN t.amount ELSE 0 END) AS refunds
  FROM transactions t
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
    AND (p_module_id IS NULL OR t.module_id::TEXT = p_module_id)
    AND (p_engine_type IS NULL OR t.engine_type::TEXT = p_engine_type);
END;
$$;

-- 5. Transaction Volume
DROP FUNCTION IF EXISTS get_economics_volume(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_economics_volume(
  p_from TIMESTAMP WITH TIME ZONE,
  p_to TIMESTAMP WITH TIME ZONE,
  p_interval TEXT,
  p_property_id UUID DEFAULT NULL,
  p_module_id TEXT DEFAULT NULL,
  p_engine_type TEXT DEFAULT NULL
) RETURNS TABLE (
  bucket TEXT,
  volume_count BIGINT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc(p_interval, t.created_at)::TEXT AS bucket,
    COUNT(*) AS volume_count
  FROM transactions t
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
    AND (p_module_id IS NULL OR t.module_id::TEXT = p_module_id)
    AND (p_engine_type IS NULL OR t.engine_type::TEXT = p_engine_type)
  GROUP BY date_trunc(p_interval, t.created_at);
END;
$$;

-- 6. Average Transaction Value
DROP FUNCTION IF EXISTS get_economics_avg_value(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_economics_avg_value(
  p_from TIMESTAMP WITH TIME ZONE,
  p_to TIMESTAMP WITH TIME ZONE,
  p_property_id UUID DEFAULT NULL,
  p_module_id TEXT DEFAULT NULL,
  p_engine_type TEXT DEFAULT NULL
) RETURNS TABLE (
  engine_type TEXT,
  average NUMERIC,
  revenue NUMERIC,
  transaction_count BIGINT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(t.engine_type::TEXT, 'unknown') AS engine_type,
    AVG(t.amount) AS average,
    SUM(t.amount) AS revenue,
    COUNT(*) AS transaction_count
  FROM transactions t
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND t.status NOT IN ('cancelled', 'refunded', 'void')
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
    AND (p_module_id IS NULL OR t.module_id::TEXT = p_module_id)
    AND (p_engine_type IS NULL OR t.engine_type::TEXT = p_engine_type)
  GROUP BY COALESCE(t.engine_type::TEXT, 'unknown');
END;
$$;

-- 7. Peak Hours
DROP FUNCTION IF EXISTS get_economics_peak_hours(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_economics_peak_hours(
  p_from TIMESTAMP WITH TIME ZONE,
  p_to TIMESTAMP WITH TIME ZONE,
  p_property_id UUID DEFAULT NULL,
  p_module_id TEXT DEFAULT NULL,
  p_engine_type TEXT DEFAULT NULL
) RETURNS TABLE (
  hour_of_day INT,
  revenue NUMERIC,
  transaction_count BIGINT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(HOUR FROM t.created_at)::INT AS hour_of_day,
    SUM(t.amount) AS revenue,
    COUNT(*) AS transaction_count
  FROM transactions t
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND t.status NOT IN ('cancelled', 'refunded', 'void')
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
    AND (p_module_id IS NULL OR t.module_id::TEXT = p_module_id)
    AND (p_engine_type IS NULL OR t.engine_type::TEXT = p_engine_type)
  GROUP BY EXTRACT(HOUR FROM t.created_at);
END;
$$;

-- 8. Top Customers
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
    COALESCE(u.full_name, t.customer_id::TEXT) AS customer_name,
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
  GROUP BY t.customer_id, COALESCE(u.full_name, t.customer_id::TEXT)
  ORDER BY SUM(t.amount) DESC
  LIMIT p_limit;
END;
$$;

-- 9. Repeat vs New
DROP FUNCTION IF EXISTS get_economics_repeat_vs_new(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_economics_repeat_vs_new(
  p_from TIMESTAMP WITH TIME ZONE,
  p_to TIMESTAMP WITH TIME ZONE,
  p_property_id UUID DEFAULT NULL,
  p_module_id TEXT DEFAULT NULL,
  p_engine_type TEXT DEFAULT NULL
) RETURNS TABLE (
  customer_id UUID,
  transaction_count BIGINT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.customer_id,
    COUNT(*) AS transaction_count
  FROM transactions t
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND t.status NOT IN ('cancelled', 'refunded', 'void')
    AND t.customer_id IS NOT NULL
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
    AND (p_module_id IS NULL OR t.module_id::TEXT = p_module_id)
    AND (p_engine_type IS NULL OR t.engine_type::TEXT = p_engine_type)
  GROUP BY t.customer_id;
END;
$$;

-- 10. Staff Performance
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
    COALESCE(u.full_name, t.staff_id::TEXT) AS staff_name,
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
  GROUP BY t.staff_id, COALESCE(u.full_name, t.staff_id::TEXT);
END;
$$;

-- 11. Promo Effectiveness
DROP FUNCTION IF EXISTS get_economics_promo_effectiveness(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_economics_promo_effectiveness(
  p_from TIMESTAMP WITH TIME ZONE,
  p_to TIMESTAMP WITH TIME ZONE,
  p_property_id UUID DEFAULT NULL,
  p_module_id TEXT DEFAULT NULL,
  p_engine_type TEXT DEFAULT NULL
) RETURNS TABLE (
  has_promo BOOLEAN,
  revenue NUMERIC,
  transaction_count BIGINT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    (t.promo_code_used IS NOT NULL AND t.promo_code_used != '') AS has_promo,
    SUM(t.amount) AS revenue,
    COUNT(*) AS transaction_count
  FROM transactions t
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND t.status NOT IN ('cancelled', 'refunded', 'void')
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
    AND (p_module_id IS NULL OR t.module_id::TEXT = p_module_id)
    AND (p_engine_type IS NULL OR t.engine_type::TEXT = p_engine_type)
  GROUP BY (t.promo_code_used IS NOT NULL AND t.promo_code_used != '');
END;
$$;

-- 12. Cross Module Patterns
DROP FUNCTION IF EXISTS get_economics_cross_module(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, UUID);
CREATE OR REPLACE FUNCTION get_economics_cross_module(
  p_from TIMESTAMP WITH TIME ZONE,
  p_to TIMESTAMP WITH TIME ZONE,
  p_property_id UUID DEFAULT NULL
) RETURNS TABLE (
  customer_id UUID,
  day_date TEXT,
  engine_type TEXT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.customer_id,
    date_trunc('day', t.created_at)::TEXT AS day_date,
    t.engine_type::TEXT AS engine_type
  FROM transactions t
  WHERE t.created_at >= p_from AND t.created_at <= p_to
    AND t.status NOT IN ('cancelled', 'refunded', 'void')
    AND t.customer_id IS NOT NULL
    AND t.engine_type IS NOT NULL
    AND (p_property_id IS NULL OR t.property_id = p_property_id)
  GROUP BY t.customer_id, date_trunc('day', t.created_at), t.engine_type;
END;
$$;
