-- Fix update_pool_session: remove ::TIME cast that produces 8-char values for VARCHAR(5) columns
CREATE OR REPLACE FUNCTION update_pool_session(
  p_id UUID,
  p_data JSONB
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  UPDATE pool_sessions SET
    name = COALESCE(p_data->>'name', name),
    start_time = COALESCE(p_data->>'start_time', start_time),
    end_time = COALESCE(p_data->>'end_time', end_time),
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
