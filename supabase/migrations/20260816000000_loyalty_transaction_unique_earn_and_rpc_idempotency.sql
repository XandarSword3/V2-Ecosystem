-- Migration: 20260816000000_loyalty_transaction_unique_earn_and_rpc_idempotency.sql
-- Description: Adds partial unique constraint on loyalty_transactions for earn events and enforces in-RPC idempotency under advisory xact lock

-- 1. Create partial unique index on (reference_type, reference_id) for 'earn' transactions
CREATE UNIQUE INDEX IF NOT EXISTS "idx_loyalty_transactions_unique_earn_reference"
ON "public"."loyalty_transactions" ("reference_type", "reference_id")
WHERE "transaction_type" = 'earn' AND "reference_id" IS NOT NULL;

-- 2. Update earn_loyalty_points_atomic function with in-RPC idempotency check under advisory lock
CREATE OR REPLACE FUNCTION "public"."earn_loyalty_points_atomic"(
    "p_user_id" "uuid",
    "p_order_total" numeric,
    "p_order_id" "uuid",
    "p_points_per_dollar" integer DEFAULT 1,
    "p_tenant_id" "uuid" DEFAULT NULL::"uuid",
    "p_property_id" "uuid" DEFAULT NULL::"uuid"
) RETURNS TABLE("success" boolean, "points_earned" integer, "new_balance" integer, "tier_multiplier" numeric, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_member RECORD;
    v_tier RECORD;
    v_base_points INTEGER;
    v_final_points INTEGER;
    v_expiry_days INTEGER;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Advisory xact lock serializes all concurrent awards for this user & property
    PERFORM pg_advisory_xact_lock(hashtext('loyalty_member_' || p_user_id::text || '_' || COALESCE(p_property_id::text, 'unscoped')));

    -- Fetch member account
    IF p_property_id IS NOT NULL THEN
        SELECT * INTO v_member FROM loyalty_members WHERE user_id = p_user_id AND property_id = p_property_id;
    ELSE
        SELECT * INTO v_member FROM loyalty_members WHERE user_id = p_user_id LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        IF p_property_id IS NULL THEN
            RETURN QUERY SELECT false, 0, 0, 1::DECIMAL, 'No loyalty account found for user and no property_id provided to create one'::TEXT;
            RETURN;
        END IF;

        INSERT INTO loyalty_members(user_id, tenant_id, property_id, tier_id, total_points, available_points, lifetime_points)
        SELECT p_user_id, p_tenant_id, p_property_id, id, 0, 0, 0
        FROM loyalty_tiers
        WHERE property_id = p_property_id AND min_points = 0 AND is_active = true
        ORDER BY sort_order
        LIMIT 1
        RETURNING * INTO v_member;

        IF NOT FOUND THEN
            RETURN QUERY SELECT false, 0, 0, 1::DECIMAL, 'No base loyalty tier configured for this property'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- IN-RPC IDEMPOTENCY CHECK (under lock):
    -- If points have already been awarded for this order, return successfully with 0 points earned and no duplicate state changes.
    IF p_order_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM loyalty_transactions 
        WHERE reference_id = p_order_id 
          AND transaction_type = 'earn'
    ) THEN
        SELECT * INTO v_tier FROM loyalty_tiers WHERE id = v_member.tier_id;
        RETURN QUERY SELECT true, 0, v_member.available_points::INTEGER, COALESCE(v_tier.points_multiplier, 1)::DECIMAL, 'Points already awarded for this order'::TEXT;
        RETURN;
    END IF;

    SELECT * INTO v_tier FROM loyalty_tiers WHERE id = v_member.tier_id;
    v_base_points := FLOOR(p_order_total * p_points_per_dollar);
    v_final_points := FLOOR(v_base_points * COALESCE(v_tier.points_multiplier, 1));

    UPDATE loyalty_members
    SET available_points = available_points + v_final_points,
        total_points = total_points + v_final_points,
        lifetime_points = lifetime_points + v_final_points,
        last_activity = NOW(),
        updated_at = NOW()
    WHERE id = v_member.id
    RETURNING available_points INTO v_member.available_points;

    INSERT INTO loyalty_transactions(member_id, transaction_type, points, balance_after, description, reference_type, reference_id, tenant_id, property_id)
    VALUES (v_member.id, 'earn', v_final_points, v_member.available_points, 'Earned ' || v_final_points || ' points from order ' || p_order_id, 'order', p_order_id, v_member.tenant_id, v_member.property_id);

    IF v_final_points > 0 THEN
        SELECT points_expiry_days INTO v_expiry_days
        FROM loyalty_settings
        WHERE property_id = v_member.property_id
        LIMIT 1;

        IF v_expiry_days IS NOT NULL THEN
            v_expires_at := NOW() + (v_expiry_days || ' days')::INTERVAL;
        END IF;

        INSERT INTO loyalty_point_batches(user_id, points, remaining_points, expires_at, source, source_id, tenant_id, property_id)
        VALUES (p_user_id, v_final_points, v_final_points, v_expires_at, 'earn', p_order_id, v_member.tenant_id, v_member.property_id);
    END IF;

    RETURN QUERY SELECT true, v_final_points, v_member.available_points::INTEGER, COALESCE(v_tier.points_multiplier, 1)::DECIMAL, NULL::TEXT;
END;
$$;
