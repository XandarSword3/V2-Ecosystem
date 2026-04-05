-- Migration: Atomic Loyalty Point Adjustment
-- Resolves race conditions in point earmings and redemptions

CREATE OR REPLACE FUNCTION adjust_loyalty_points_atomic(
  p_user_id UUID,
  p_points INTEGER,
  p_type VARCHAR,
  p_description TEXT,
  p_reference_type VARCHAR DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_member_id UUID;
  v_current_available INTEGER;
  v_new_available INTEGER;
  v_txn_id UUID;
BEGIN
  -- 1. Lock the member row
  SELECT id, available_points 
  INTO v_member_id, v_current_available
  FROM loyalty_members
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loyalty member not found for user %', p_user_id;
  END IF;

  -- 2. Validate balance
  v_new_available := v_current_available + p_points;
  IF v_new_available < 0 THEN
    RAISE EXCEPTION 'Insufficient loyalty points. Current: %, Requested: %', v_current_available, ABS(p_points);
  END IF;

  -- 3. Update member
  UPDATE loyalty_members
  SET 
    available_points = v_new_available,
    total_points = total_points + p_points,
    lifetime_points = CASE WHEN p_points > 0 THEN lifetime_points + p_points ELSE lifetime_points END,
    last_activity = NOW(),
    updated_at = NOW()
  WHERE id = v_member_id;

  -- 4. Record transaction
  INSERT INTO loyalty_transactions (
    id,
    member_id,
    transaction_type,
    points,
    balance_after,
    description,
    reference_type,
    reference_id,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_member_id,
    p_type,
    p_points,
    v_new_available,
    p_description,
    p_reference_type,
    p_reference_id,
    NOW()
  ) RETURNING id INTO v_txn_id;

  -- 5. Return results
  RETURN jsonb_build_object(
    'id', v_txn_id,
    'member_id', v_member_id,
    'points', p_points,
    'newBalance', v_new_available,
    'success', true
  );
END;
$$ LANGUAGE plpgsql;
