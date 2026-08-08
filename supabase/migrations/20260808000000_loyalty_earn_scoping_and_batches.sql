-- Loyalty: scope earn_loyalty_points_atomic's fallback member-creation by
-- property/tenant, record earned points as expiring batches so
-- loyalty_settings.points_expiry_days is actually enforceable, and add
-- lookup support for a birthday-bonus maintenance job.
--
-- Context (found while reconstructing this migration against the live
-- schema, not carried over from a prior session):
--   1. The current earn_loyalty_points_atomic fallback INSERT into
--      loyalty_members omits tenant_id/property_id, which are NOT NULL
--      columns — any first-time earn for a user with no existing member
--      row currently raises a constraint violation. This migration fixes
--      that by requiring property_id whenever the fallback-create path is
--      taken.
--   2. The current version also never scopes the initial member lookup by
--      property_id, so a user with loyalty rows at multiple properties
--      could have points/tier resolved against the wrong property.
--   3. loyalty_transactions.tenant_id/property_id are NOT NULL but the
--      current function's INSERT never sets them — also fixed here.
--   4. loyalty_members has no birthday field. Added date_of_birth (nullable)
--      so the birthday-bonus job has something to key off; this is new,
--      not a re-application of prior work.
--
-- Backward compatibility: p_tenant_id/p_property_id are optional. Existing
-- callers (payments/loyalty-integration.ts, discount-resolvers.ts) that
-- don't pass them keep today's unscoped lookup behavior. The loyalty
-- controller's direct earn endpoint is updated separately to always pass
-- both.

-- Postgres overloads by parameter list — CREATE OR REPLACE with new
-- parameters would leave the old 4-arg signature callable and ambiguous
-- alongside the new one, so drop it first.
DROP FUNCTION IF EXISTS "public"."earn_loyalty_points_atomic"("p_user_id" "uuid", "p_order_total" numeric, "p_order_id" "uuid", "p_points_per_dollar" integer);

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
    PERFORM pg_advisory_xact_lock(hashtext('loyalty_member_' || p_user_id::text || '_' || COALESCE(p_property_id::text, 'unscoped')));

    IF p_property_id IS NOT NULL THEN
        SELECT * INTO v_member FROM loyalty_members WHERE user_id = p_user_id AND property_id = p_property_id;
    ELSE
        -- Legacy unscoped behavior, preserved for callers that don't pass property_id yet.
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

ALTER FUNCTION "public"."earn_loyalty_points_atomic"("p_user_id" "uuid", "p_order_total" numeric, "p_order_id" "uuid", "p_points_per_dollar" integer, "p_tenant_id" "uuid", "p_property_id" "uuid") OWNER TO "postgres";

-- Birthday bonus support: loyalty_members has no date-of-birth field today.
COMMENT ON TABLE "public"."loyalty_members" IS 'Per-property loyalty program membership. date_of_birth is optional and only used for the birthday-bonus maintenance job.';

ALTER TABLE "public"."loyalty_members" ADD COLUMN IF NOT EXISTS "date_of_birth" "date";

-- Lookup used by the birthday-bonus job — matches by month/day across all
-- years via an expression index, instead of an unbounded per-year date
-- range scan (which would need a new query shape every year).
CREATE INDEX IF NOT EXISTS "idx_loyalty_members_birthday" ON "public"."loyalty_members" USING "btree" ((EXTRACT(MONTH FROM "date_of_birth")), (EXTRACT(DAY FROM "date_of_birth"))) WHERE ("date_of_birth" IS NOT NULL);

CREATE OR REPLACE FUNCTION "public"."get_loyalty_birthday_members"("p_check_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("member_id" "uuid", "user_id" "uuid", "tenant_id" "uuid", "property_id" "uuid")
    LANGUAGE "sql" STABLE
    AS $$
    SELECT id, user_id, tenant_id, property_id
    FROM loyalty_members
    WHERE date_of_birth IS NOT NULL
      AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM p_check_date)
      AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM p_check_date);
$$;

ALTER FUNCTION "public"."get_loyalty_birthday_members"("p_check_date" "date") OWNER TO "postgres";
