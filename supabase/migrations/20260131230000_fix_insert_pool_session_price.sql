-- Fix insert_pool_session to also set the legacy 'price' column (NOT NULL constraint)
CREATE OR REPLACE FUNCTION insert_pool_session(
  p_name TEXT,
  p_start_time TEXT,
  p_end_time TEXT,
  p_max_capacity INT,
  p_adult_price DECIMAL,
  p_child_price DECIMAL,
  p_gender_restriction TEXT DEFAULT 'mixed',
  p_module_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  INSERT INTO pool_sessions (name, start_time, end_time, max_capacity, price, adult_price, child_price, gender_restriction, module_id)
  VALUES (p_name, p_start_time, p_end_time, p_max_capacity, p_adult_price, p_adult_price, p_child_price, p_gender_restriction, p_module_id)
  RETURNING to_jsonb(pool_sessions.*) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the update function to keep price in sync
CREATE OR REPLACE FUNCTION update_pool_session(
  p_id UUID,
  p_data JSONB
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  UPDATE pool_sessions SET
    name = COALESCE(p_data->>'name', name),
    start_time = COALESCE(p_data->>'start_time', start_time::TEXT)::TIME,
    end_time = COALESCE(p_data->>'end_time', end_time::TEXT)::TIME,
    max_capacity = COALESCE((p_data->>'max_capacity')::INT, max_capacity),
    price = COALESCE((p_data->>'adult_price')::DECIMAL, (p_data->>'price')::DECIMAL, price),
    adult_price = COALESCE((p_data->>'adult_price')::DECIMAL, adult_price),
    child_price = COALESCE((p_data->>'child_price')::DECIMAL, child_price),
    is_active = COALESCE((p_data->>'is_active')::BOOLEAN, is_active),
    gender_restriction = COALESCE(p_data->>'gender_restriction', gender_restriction),
    updated_at = NOW()
  WHERE id = p_id
  RETURNING to_jsonb(pool_sessions.*) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
