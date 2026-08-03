-- =============================================================================
-- BASELINE SCHEMA — squashed from live database state
-- Generated: 2026-08-03
-- Source: `supabase db dump` against the linked remote project
--   (aws-1-ap-northeast-1 pooler, project qxtmesddgwmwspejnbvc)
--
-- This file REPLACES the 203 incremental migrations that previously lived in
-- supabase/migrations/ (now archived at
-- supabase/migrations/_archived/pre-squash-2026-08-03/). Those files spanned
-- Jan 1 - Aug 3, 2026 and had drifted from the live schema in places (dead
-- Drizzle ORM layer, tables referenced in code with no migration, undefined
-- RPCs — see /areas/code-audit.md). This dump reflects what is ACTUALLY
-- deployed right now, not what the migration chain claims should be deployed.
--
-- Do not hand-edit this file. Future schema changes should be new,
-- incrementally-timestamped migrations layered on top of this baseline.
-- =============================================================================




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."billing_status" AS ENUM (
    'trialing',
    'active',
    'past_due',
    'suspended',
    'cancelled'
);


ALTER TYPE "public"."billing_status" OWNER TO "postgres";


CREATE TYPE "public"."booking_status" AS ENUM (
    'pending',
    'confirmed',
    'checked_in',
    'checked_out',
    'cancelled',
    'no_show'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."bounce_type" AS ENUM (
    'hard',
    'soft',
    'complaint',
    'unsubscribe'
);


ALTER TYPE "public"."bounce_type" OWNER TO "postgres";


CREATE TYPE "public"."business_unit" AS ENUM (
    'menu_service',
    'kiosk',
    'accommodation',
    'shared_capacity',
    'admin'
);


ALTER TYPE "public"."business_unit" OWNER TO "postgres";


CREATE TYPE "public"."chargeback_outcome" AS ENUM (
    'won',
    'lost',
    'refunded'
);


ALTER TYPE "public"."chargeback_outcome" OWNER TO "postgres";


CREATE TYPE "public"."chargeback_status" AS ENUM (
    'needs_response',
    'under_review',
    'charge_refunded',
    'won',
    'lost'
);


ALTER TYPE "public"."chargeback_status" OWNER TO "postgres";


CREATE TYPE "public"."customizable_entity_type" AS ENUM (
    'catalog_item',
    'kiosk_item',
    'accommodation_unit',
    'capacity_window',
    'spa_service',
    'activity',
    'rental_item',
    'event_ticket',
    'room',
    'package'
);


ALTER TYPE "public"."customizable_entity_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."customizable_entity_type" IS 'All entity types that support customizations. Use add_customizable_entity_type() to add new types.';



CREATE TYPE "public"."customization_type" AS ENUM (
    'add',
    'remove',
    'swap',
    'upgrade',
    'replace'
);


ALTER TYPE "public"."customization_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."customization_type" IS 'How the customization affects the item: add (include extra), remove (exclude from recipe), swap (replace), upgrade (premium version), replace (full replacement)';



CREATE TYPE "public"."device_platform" AS ENUM (
    'ios',
    'android',
    'web'
);


ALTER TYPE "public"."device_platform" OWNER TO "postgres";


CREATE TYPE "public"."housekeeping_status" AS ENUM (
    'pending',
    'assigned',
    'in_progress',
    'cleaned',
    'inspected',
    'approved'
);


ALTER TYPE "public"."housekeeping_status" OWNER TO "postgres";


CREATE TYPE "public"."kiosk_item_category" AS ENUM (
    'sandwich',
    'drink',
    'savory',
    'ice_cream'
);


ALTER TYPE "public"."kiosk_item_category" OWNER TO "postgres";


CREATE TYPE "public"."module_template_type" AS ENUM (
    'menu_service',
    'multi_day_booking',
    'session_access',
    'subscription',
    'membership_access',
    'class_scheduling',
    'appointment_booking',
    'saas_subscription'
);


ALTER TYPE "public"."module_template_type" OWNER TO "postgres";


CREATE TYPE "public"."notification_channel" AS ENUM (
    'in_app',
    'email',
    'sms',
    'push'
);


ALTER TYPE "public"."notification_channel" OWNER TO "postgres";


CREATE TYPE "public"."notification_priority" AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


ALTER TYPE "public"."notification_priority" OWNER TO "postgres";


CREATE TYPE "public"."notification_target_type" AS ENUM (
    'all',
    'customer',
    'staff',
    'admin',
    'user'
);


ALTER TYPE "public"."notification_target_type" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'info',
    'success',
    'warning',
    'error'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'served',
    'delivered',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."order_type" AS ENUM (
    'dine_in',
    'takeaway',
    'delivery'
);


ALTER TYPE "public"."order_type" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'cash',
    'card',
    'whish',
    'online'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'partial',
    'paid',
    'refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."price_type" AS ENUM (
    'per_night',
    'one_time'
);


ALTER TYPE "public"."price_type" OWNER TO "postgres";


CREATE TYPE "public"."subscription_tier" AS ENUM (
    'starter',
    'growth',
    'enterprise'
);


ALTER TYPE "public"."subscription_tier" OWNER TO "postgres";


CREATE TYPE "public"."suppression_reason" AS ENUM (
    'hard',
    'soft',
    'complaint',
    'unsubscribe',
    'manual'
);


ALTER TYPE "public"."suppression_reason" OWNER TO "postgres";


CREATE TYPE "public"."ticket_status" AS ENUM (
    'valid',
    'active',
    'used',
    'expired',
    'cancelled'
);


ALTER TYPE "public"."ticket_status" OWNER TO "postgres";


CREATE TYPE "public"."translation_status" AS ENUM (
    'draft',
    'approved',
    'published'
);


ALTER TYPE "public"."translation_status" OWNER TO "postgres";


CREATE TYPE "public"."unit_clean_state" AS ENUM (
    'clean',
    'dirty',
    'cleaning',
    'inspected',
    'out_of_service'
);


ALTER TYPE "public"."unit_clean_state" OWNER TO "postgres";


CREATE TYPE "public"."user_scope" AS ENUM (
    'super_admin',
    'platform_admin',
    'tenant_owner',
    'tenant_admin',
    'property_manager',
    'property_staff',
    'customer'
);


ALTER TYPE "public"."user_scope" OWNER TO "postgres";


CREATE TYPE "public"."webhook_source" AS ENUM (
    'stripe',
    'twilio',
    'sendgrid',
    'other'
);


ALTER TYPE "public"."webhook_source" OWNER TO "postgres";


CREATE TYPE "public"."webhook_status" AS ENUM (
    'pending',
    'retrying',
    'resolved',
    'failed',
    'manual_review'
);


ALTER TYPE "public"."webhook_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_engine_ledger_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'engine_financial_ledger is append-only — UPDATE is forbidden';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'engine_financial_ledger is append-only — DELETE is forbidden';
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."_engine_ledger_immutability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_customizable_entity_type"("p_type_name" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    EXECUTE format('ALTER TYPE customizable_entity_type ADD VALUE IF NOT EXISTS %L', p_type_name);
END;
$$;


ALTER FUNCTION "public"."add_customizable_entity_type"("p_type_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adjust_loyalty_points_atomic"("p_user_id" "uuid", "p_points" integer, "p_reason" "text" DEFAULT 'Admin adjustment'::"text", "p_admin_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("success" boolean, "new_balance" integer, "lifetime_points" integer, "adjustment" integer, "tier_name" "text", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_member RECORD;
    v_new_balance INTEGER;
    v_new_lifetime INTEGER;
    v_new_tier RECORD;
    v_new_tier_name TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('loyalty_member_' || p_user_id::text));
    SELECT * INTO v_member FROM loyalty_members WHERE user_id = p_user_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, 0, NULL::TEXT, 'Loyalty account not found'::TEXT;
        RETURN;
    END IF;
    v_new_balance := GREATEST(0, v_member.available_points + p_points);
    v_new_lifetime := CASE WHEN p_points > 0 THEN v_member.lifetime_points + p_points ELSE v_member.lifetime_points END;
    UPDATE loyalty_members SET available_points = v_new_balance, total_points = v_new_balance, lifetime_points = v_new_lifetime, last_activity = NOW(), updated_at = NOW() WHERE id = v_member.id;
    INSERT INTO loyalty_transactions(member_id, transaction_type, points, balance_after, description) VALUES (v_member.id, 'adjust', p_points, v_new_balance, p_reason);
    -- Check for Tier Update
    SELECT * INTO v_new_tier FROM loyalty_tiers WHERE min_points <= v_new_lifetime ORDER BY min_points DESC LIMIT 1;
    IF v_new_tier IS NOT NULL THEN
        v_new_tier_name := v_new_tier.name;
        IF v_new_tier.id != v_member.tier_id THEN
            UPDATE loyalty_members SET tier_id = v_new_tier.id WHERE id = v_member.id;
        END IF;
    ELSE
        SELECT name INTO v_new_tier_name FROM loyalty_tiers WHERE id = v_member.tier_id;
    END IF;
    RETURN QUERY SELECT true, v_new_balance, v_new_lifetime, p_points, v_new_tier_name, NULL::TEXT;
END;
$$;


ALTER FUNCTION "public"."adjust_loyalty_points_atomic"("p_user_id" "uuid", "p_points" integer, "p_reason" "text", "p_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adjust_loyalty_points_by_account_atomic"("p_account_id" "uuid", "p_points" integer, "p_reason" "text" DEFAULT 'Admin adjustment'::"text", "p_admin_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("success" boolean, "new_balance" integer, "lifetime_points" integer, "adjustment" integer, "tier_name" "text", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_member RECORD;
    v_new_balance INTEGER;
    v_new_lifetime INTEGER;
    v_new_tier RECORD;
BEGIN
    SELECT * INTO v_member FROM loyalty_members WHERE id = p_account_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, 0, NULL::TEXT, 'Loyalty account not found'::TEXT;
        RETURN;
    END IF;
    v_new_balance := GREATEST(0, v_member.available_points + p_points);
    v_new_lifetime := CASE WHEN p_points > 0 THEN v_member.lifetime_points + p_points ELSE v_member.lifetime_points END;
    UPDATE loyalty_members SET available_points = v_new_balance, total_points = v_new_balance, lifetime_points = v_new_lifetime, last_activity = NOW(), updated_at = NOW() WHERE id = v_member.id;
    INSERT INTO loyalty_transactions(member_id, transaction_type, points, balance_after, description) VALUES (v_member.id, 'adjust', p_points, v_new_balance, p_reason);
    SELECT * INTO v_new_tier FROM loyalty_tiers WHERE min_points <= v_new_lifetime ORDER BY min_points DESC LIMIT 1;
    IF v_new_tier IS NOT NULL AND v_new_tier.id != v_member.tier_id THEN
        UPDATE loyalty_members SET tier_id = v_new_tier.id WHERE id = v_member.id;
    END IF;
    RETURN QUERY SELECT true, v_new_balance, v_new_lifetime, p_points, v_new_tier.name, NULL::TEXT;
END;
$$;


ALTER FUNCTION "public"."adjust_loyalty_points_by_account_atomic"("p_account_id" "uuid", "p_points" integer, "p_reason" "text", "p_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aggregate_daily_sales"("p_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO report_daily_sales (
        date, total_revenue, net_revenue, total_orders, completed_orders,
        cancelled_orders, average_order_value, total_discounts, total_refunds,
        total_tips, cash_revenue, card_revenue, gift_card_revenue,
        loyalty_redemptions, new_customers, returning_customers
    )
    SELECT
        p_date,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'completed' THEN net_amount ELSE 0 END), 0),
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed'),
        COUNT(*) FILTER (WHERE status = 'cancelled'),
        COALESCE(AVG(CASE WHEN status = 'completed' THEN amount END), 0),
        COALESCE(SUM(discount_amount), 0),
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END), 0),
        0,
        COALESCE(SUM(CASE WHEN (metadata->>'payment_method') = 'cash' AND status = 'completed' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN (metadata->>'payment_method') = 'card' AND status = 'completed' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN (metadata->>'payment_method') = 'gift_card' AND status = 'completed' THEN amount ELSE 0 END), 0),
        0,
        (SELECT COUNT(DISTINCT customer_id) FROM transactions
         WHERE DATE(created_at) = p_date AND customer_id IS NOT NULL AND engine_type = 'instant_transaction'
         AND NOT EXISTS(SELECT 1 FROM transactions t2 WHERE t2.customer_id = transactions.customer_id AND DATE(t2.created_at) < p_date)),
        (SELECT COUNT(DISTINCT customer_id) FROM transactions
         WHERE DATE(created_at) = p_date AND customer_id IS NOT NULL AND engine_type = 'instant_transaction'
         AND EXISTS(SELECT 1 FROM transactions t2 WHERE t2.customer_id = transactions.customer_id AND DATE(t2.created_at) < p_date))
    FROM transactions
    WHERE DATE(created_at) = p_date AND engine_type = 'instant_transaction'
    ON CONFLICT (date) DO UPDATE SET
        total_revenue = EXCLUDED.total_revenue,
        net_revenue = EXCLUDED.net_revenue,
        total_orders = EXCLUDED.total_orders,
        completed_orders = EXCLUDED.completed_orders,
        cancelled_orders = EXCLUDED.cancelled_orders,
        average_order_value = EXCLUDED.average_order_value,
        total_discounts = EXCLUDED.total_discounts,
        total_refunds = EXCLUDED.total_refunds,
        cash_revenue = EXCLUDED.cash_revenue,
        card_revenue = EXCLUDED.card_revenue,
        gift_card_revenue = EXCLUDED.gift_card_revenue,
        loyalty_redemptions = EXCLUDED.loyalty_redemptions,
        new_customers = EXCLUDED.new_customers,
        returning_customers = EXCLUDED.returning_customers,
        updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."aggregate_daily_sales"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."aggregate_kiosk_analytics"("p_date" "date" DEFAULT (CURRENT_DATE - 1)) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT DISTINCT property_id, kiosk_id 
    FROM kiosk_sessions 
    WHERE DATE(started_at) = p_date
  LOOP
    INSERT INTO kiosk_analytics (
      property_id, kiosk_id, date,
      total_sessions, completed_sessions, abandoned_sessions,
      timeout_sessions, error_sessions, transferred_sessions,
      checkins_completed, checkouts_completed, keys_issued, payments_processed,
      avg_session_duration_seconds, avg_checkin_duration_seconds
    )
    SELECT
      r.property_id,
      r.kiosk_id,
      p_date,
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'completed'),
      COUNT(*) FILTER (WHERE status = 'abandoned'),
      COUNT(*) FILTER (WHERE status = 'timeout'),
      COUNT(*) FILTER (WHERE status = 'error'),
      COUNT(*) FILTER (WHERE transferred_to_desk = true),
      COUNT(*) FILTER (WHERE session_type = 'checkin' AND status = 'completed'),
      COUNT(*) FILTER (WHERE session_type = 'checkout' AND status = 'completed'),
      (SELECT COUNT(*) FROM kiosk_transactions t 
       JOIN kiosk_sessions s ON t.session_id = s.id
       WHERE s.kiosk_id = r.kiosk_id AND DATE(t.created_at) = p_date 
       AND t.transaction_type = 'key_encode' AND t.status = 'completed'),
      (SELECT COUNT(*) FROM kiosk_transactions t 
       JOIN kiosk_sessions s ON t.session_id = s.id
       WHERE s.kiosk_id = r.kiosk_id AND DATE(t.created_at) = p_date 
       AND t.transaction_type = 'payment' AND t.status = 'completed'),
      AVG(duration_seconds)::INTEGER,
      AVG(duration_seconds) FILTER (WHERE session_type = 'checkin')::INTEGER
    FROM kiosk_sessions
    WHERE property_id = r.property_id
      AND kiosk_id = r.kiosk_id
      AND DATE(started_at) = p_date
    ON CONFLICT (property_id, kiosk_id, date) 
    DO UPDATE SET
      total_sessions = EXCLUDED.total_sessions,
      completed_sessions = EXCLUDED.completed_sessions,
      abandoned_sessions = EXCLUDED.abandoned_sessions,
      timeout_sessions = EXCLUDED.timeout_sessions,
      error_sessions = EXCLUDED.error_sessions,
      transferred_sessions = EXCLUDED.transferred_sessions,
      checkins_completed = EXCLUDED.checkins_completed,
      checkouts_completed = EXCLUDED.checkouts_completed,
      keys_issued = EXCLUDED.keys_issued,
      payments_processed = EXCLUDED.payments_processed,
      avg_session_duration_seconds = EXCLUDED.avg_session_duration_seconds,
      avg_checkin_duration_seconds = EXCLUDED.avg_checkin_duration_seconds,
      updated_at = NOW();
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."aggregate_kiosk_analytics"("p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_coupon_atomic"("p_code" "text", "p_user_id" "uuid", "p_order_total" numeric, "p_order_id" "uuid", "p_module_type" "text" DEFAULT 'all'::"text") RETURNS TABLE("success" boolean, "discount_amount" numeric, "coupon_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
    v_coupon RECORD;
    v_user_usage_count INTEGER;
    v_calculated_discount DECIMAL;
BEGIN
    SELECT * INTO v_coupon FROM coupons WHERE code = UPPER(p_code) AND is_active = true AND (valid_from IS NULL OR valid_from <= NOW()) AND (valid_until IS NULL OR valid_until > NOW()) FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::DECIMAL, NULL::UUID, 'Coupon not found, inactive, or expired'::TEXT;
        RETURN;
    END IF;
    IF v_coupon.applies_to != 'all' AND v_coupon.applies_to != p_module_type THEN
        RETURN QUERY SELECT false, 0::DECIMAL, v_coupon.id, 'Coupon not valid for this order type'::TEXT;
        RETURN;
    END IF;
    IF v_coupon.min_order_amount IS NOT NULL AND p_order_total < v_coupon.min_order_amount THEN
        RETURN QUERY SELECT false, 0::DECIMAL, v_coupon.id, ('Order total below minimum of $' || v_coupon.min_order_amount::TEXT)::TEXT;
        RETURN;
    END IF;
    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
        RETURN QUERY SELECT false, 0::DECIMAL, v_coupon.id, 'Coupon usage limit reached'::TEXT;
        RETURN;
    END IF;
    IF p_user_id IS NOT NULL AND v_coupon.per_user_limit IS NOT NULL THEN
        -- FIX: Qualified column names to avoid ambiguity with output parameter 'coupon_id'
        SELECT COUNT(*) INTO v_user_usage_count FROM coupon_usage WHERE coupon_usage.coupon_id = v_coupon.id AND coupon_usage.user_id = p_user_id;
        IF v_user_usage_count >= v_coupon.per_user_limit THEN
            RETURN QUERY SELECT false, 0::DECIMAL, v_coupon.id, 'You have already used this coupon the maximum number of times'::TEXT;
            RETURN;
        END IF;
    END IF;
    IF v_coupon.discount_type = 'percentage' THEN
        v_calculated_discount := p_order_total * (v_coupon.discount_value / 100);
        IF v_coupon.max_discount_amount IS NOT NULL THEN
            v_calculated_discount := LEAST(v_calculated_discount, v_coupon.max_discount_amount);
        END IF;
    ELSIF v_coupon.discount_type = 'fixed_amount' THEN
        v_calculated_discount := LEAST(v_coupon.discount_value, p_order_total);
    ELSE
        v_calculated_discount := 0;
    END IF;
    v_calculated_discount := ROUND(v_calculated_discount, 2);
    UPDATE coupons SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = v_coupon.id;
    INSERT INTO coupon_usage(coupon_id, user_id, order_id, discount_applied) VALUES (v_coupon.id, p_user_id, p_order_id, v_calculated_discount);
    RETURN QUERY SELECT true, v_calculated_discount, v_coupon.id, NULL::TEXT;
END;
$_$;


ALTER FUNCTION "public"."apply_coupon_atomic"("p_code" "text", "p_user_id" "uuid", "p_order_total" numeric, "p_order_id" "uuid", "p_module_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bookable_units_view_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO accommodation_units (
            name, description,
            base_price, weekend_price, capacity,
            is_active, module_id
        ) VALUES (
            NEW.name, NEW.description,
            COALESCE(NEW.base_price, NEW.price), NEW.weekend_price, NEW.capacity,
            COALESCE(NEW.is_active, true), NEW.module_id
        ) RETURNING id INTO NEW.id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE accommodation_units SET
            name          = NEW.name,
            description   = NEW.description,
            base_price    = COALESCE(NEW.base_price, NEW.price, OLD.base_price),
            weekend_price = NEW.weekend_price,
            capacity      = NEW.capacity,
            is_active     = NEW.is_active,
            deleted_at    = NEW.deleted_at,
            module_id     = NEW.module_id,
            updated_at    = NOW()
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM accommodation_units WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."bookable_units_view_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_segment_members"("p_segment_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_count INTEGER;
    v_segment RECORD;
BEGIN
    SELECT * INTO v_segment FROM guest_segments WHERE id = p_segment_id;
    
    IF v_segment IS NULL THEN
        RETURN 0;
    END IF;
    
    IF v_segment.segment_type = 'static' THEN
        SELECT COUNT(*) INTO v_count FROM segment_members WHERE segment_id = p_segment_id;
    ELSE
        -- For dynamic segments, count guests matching rules (simplified)
        SELECT COUNT(*) INTO v_count FROM guests WHERE property_id = v_segment.property_id;
    END IF;
    
    -- Update the member count
    UPDATE guest_segments SET member_count = v_count, updated_at = now() WHERE id = p_segment_id;
    
    RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."calculate_segment_members"("p_segment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_session_duration"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status IN ('completed', 'abandoned', 'timeout', 'error') AND NEW.completed_at IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INTEGER;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_session_duration"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_check_in"("p_unit_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_unit RECORD;
  v_pending_count INTEGER;
BEGIN
  SELECT cleaning_status, is_blocked INTO v_unit
  FROM accommodation_units WHERE id = p_unit_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_unit.is_blocked THEN RETURN FALSE; END IF;
  IF v_unit.cleaning_status != 'clean' THEN RETURN FALSE; END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM housekeeping_tasks
  WHERE unit_id = p_unit_id
    AND status IN ('pending', 'in_progress', 'rework_needed');

  RETURN v_pending_count = 0;
END;
$$;


ALTER FUNCTION "public"."can_check_in"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_reconciliation_alerts"() RETURNS TABLE("alert_triggered" boolean, "message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_recent_run RECORD;
    v_alert_threshold INTEGER := 10;
BEGIN
    FOR v_recent_run IN
        SELECT table_name, mismatches_found, mismatches_fixed, run_at
        FROM reconciliation_log
        WHERE run_at > NOW() - INTERVAL '1 hour'
          AND mismatches_found > v_alert_threshold
          AND NOT alert_sent
        ORDER BY run_at DESC
    LOOP
        UPDATE reconciliation_log SET alert_sent = true
        WHERE table_name = v_recent_run.table_name
          AND run_at = v_recent_run.run_at;

        RETURN QUERY SELECT true, format(
            'INTEGRITY ALERT: %s has %s stuck-pending transactions (fixed: %s) at %s',
            v_recent_run.table_name, v_recent_run.mismatches_found,
            v_recent_run.mismatches_fixed, v_recent_run.run_at
        );
    END LOOP;
    RETURN QUERY SELECT false, 'No alerts';
END;
$$;


ALTER FUNCTION "public"."check_reconciliation_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_ref_type_migration_health"() RETURNS TABLE("healthy" boolean, "message" "text", "legacy_count" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_count INTEGER;
    v_threshold INTEGER := 100;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM ref_type_telemetry
    WHERE detected_at > NOW() - INTERVAL '24 hours';
    
    IF v_count > v_threshold THEN
        RETURN QUERY SELECT 
            false,
            format('WARNING: %s legacy reference_type values detected in 24h. Migration incomplete.', v_count),
            v_count;
    ELSE
        RETURN QUERY SELECT 
            true,
            format('OK: %s legacy values in 24h (threshold: %s)', v_count, v_threshold),
            v_count;
    END IF;
END;
$$;


ALTER FUNCTION "public"."check_ref_type_migration_health"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."coupon_usage_backfill_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.tenant_id IS NULL OR NEW.property_id IS NULL THEN
        SELECT
            COALESCE(NEW.tenant_id, c.tenant_id),
            COALESCE(NEW.property_id, c.property_id)
        INTO NEW.tenant_id, NEW.property_id
        FROM coupons c
        WHERE c.id = NEW.coupon_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."coupon_usage_backfill_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_order_customization_snapshot"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid", "p_entity_type" "public"."customizable_entity_type", "p_entity_id" "uuid", "p_selections" "jsonb", "p_base_quantity" integer DEFAULT 1, "p_execute_inventory" boolean DEFAULT true) RETURNS TABLE("success" boolean, "snapshot_id" "uuid", "total_price_adjustment" numeric, "inventory_result" "jsonb", "validation_errors" "text"[], "event_ids" "uuid"[])
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_validation RECORD;
    v_snapshot_ids UUID[] := '{}';
    v_selection JSONB;
    v_snapshot_id UUID;
    v_inv_result RECORD;
    v_total_price DECIMAL(10,2) := 0;
    v_event_ids UUID[] := '{}';
    v_start_time TIMESTAMPTZ;
    v_event_id UUID;
BEGIN
    v_start_time := clock_timestamp();
    
    -- Step 1: Validate selections
    SELECT * INTO v_validation 
    FROM validate_customizations(p_entity_type, p_entity_id, p_selections);
    
    -- Emit validation event
    INSERT INTO customization_events (event_type, entity_type, entity_id, order_type, order_id, order_item_id, payload)
    VALUES (
        CASE WHEN v_validation.is_valid THEN 'price.calculated' ELSE 'validation.failed' END,
        p_entity_type::TEXT,
        p_entity_id,
        p_order_type,
        p_order_id,
        p_order_item_id,
        jsonb_build_object(
            'selections_count', jsonb_array_length(p_selections),
            'total_price_adjustment', v_validation.total_price_adjustment,
            'is_valid', v_validation.is_valid,
            'errors', v_validation.validation_errors,
            'latency_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)
        )
    ) RETURNING id INTO v_event_id;
    v_event_ids := array_append(v_event_ids, v_event_id);
    
    -- Record validation metric
    INSERT INTO customization_metrics (metric_name, metric_value, dimensions)
    VALUES (
        'validation_latency_ms',
        EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time),
        jsonb_build_object('entity_type', p_entity_type, 'selections_count', jsonb_array_length(p_selections))
    );
    
    IF NOT v_validation.is_valid THEN
        RETURN QUERY SELECT 
            false, 
            NULL::UUID, 
            0::DECIMAL(10,2), 
            NULL::JSONB, 
            v_validation.validation_errors,
            v_event_ids;
        RETURN;
    END IF;
    
    v_total_price := v_validation.total_price_adjustment;
    
    -- Step 2: Create snapshots for each validated selection
    FOR v_selection IN SELECT * FROM jsonb_array_elements(v_validation.validated_selections)
    LOOP
        INSERT INTO order_customizations (
            order_type, order_id, order_item_id,
            customization_group_id, customization_option_id,
            group_name, option_name, customization_type, quantity,
            unit_price_adjustment, total_price_adjustment,
            inventory_item_id, inventory_quantity_used, inventory_deducted
        ) VALUES (
            p_order_type, p_order_id, p_order_item_id,
            (v_selection->>'groupId')::UUID,
            (v_selection->>'optionId')::UUID,
            v_selection->>'groupName',
            v_selection->>'optionName',
            v_selection->>'customizationType',
            COALESCE((v_selection->>'quantity')::INT, 1),
            COALESCE((v_selection->>'unitPrice')::DECIMAL, 0),
            COALESCE((v_selection->>'totalPrice')::DECIMAL, 0),
            (v_selection->>'inventoryItemId')::UUID,
            NULL, -- Will be set by inventory processing
            false
        ) RETURNING id INTO v_snapshot_id;
        
        v_snapshot_ids := array_append(v_snapshot_ids, v_snapshot_id);
    END LOOP;
    
    -- Step 3: Execute inventory if requested
    IF p_execute_inventory AND jsonb_array_length(v_validation.validated_selections) > 0 THEN
        v_start_time := clock_timestamp();
        
        SELECT * INTO v_inv_result 
        FROM process_customization_inventory_safe(
            p_order_type,
            p_order_id, 
            p_order_item_id,
            v_validation.validated_selections,
            p_base_quantity
        );
        
        -- Emit inventory execution event
        INSERT INTO customization_events (event_type, order_type, order_id, order_item_id, payload)
        VALUES (
            'inventory.executed',
            p_order_type,
            p_order_id,
            p_order_item_id,
            jsonb_build_object(
                'items_added', v_inv_result.items_added,
                'items_removed', v_inv_result.items_removed,
                'items_swapped', v_inv_result.items_swapped,
                'deduction_log', v_inv_result.deduction_log,
                'latency_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)
            )
        ) RETURNING id INTO v_event_id;
        v_event_ids := array_append(v_event_ids, v_event_id);
        
        -- Record inventory metric
        INSERT INTO customization_metrics (metric_name, metric_value, dimensions)
        VALUES (
            'inventory_processing_ms',
            EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time),
            jsonb_build_object('items_processed', v_inv_result.items_added + v_inv_result.items_swapped)
        );
        
        RETURN QUERY SELECT 
            true,
            v_snapshot_ids[1], -- Return first snapshot ID
            v_total_price,
            jsonb_build_object(
                'items_added', v_inv_result.items_added,
                'items_removed', v_inv_result.items_removed,
                'items_swapped', v_inv_result.items_swapped,
                'deduction_log', v_inv_result.deduction_log
            ),
            '{}'::TEXT[],
            v_event_ids;
    ELSE
        RETURN QUERY SELECT 
            true,
            v_snapshot_ids[1],
            v_total_price,
            '{"items_added": 0, "items_removed": 0, "items_swapped": 0}'::JSONB,
            '{}'::TEXT[],
            v_event_ids;
    END IF;
END;
$$;


ALTER FUNCTION "public"."create_order_customization_snapshot"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid", "p_entity_type" "public"."customizable_entity_type", "p_entity_id" "uuid", "p_selections" "jsonb", "p_base_quantity" integer, "p_execute_inventory" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_order_customization_snapshot"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid", "p_entity_type" "public"."customizable_entity_type", "p_entity_id" "uuid", "p_selections" "jsonb", "p_base_quantity" integer, "p_execute_inventory" boolean) IS 'Transactional function to validate, snapshot, and optionally execute inventory for customizations';



CREATE OR REPLACE FUNCTION "public"."deduct_inventory_for_order"("p_transaction_id" "uuid") RETURNS TABLE("success" boolean, "items_deducted" integer, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_order_item RECORD;
    v_ingredient RECORD;
    v_deduction_count INTEGER := 0;
    v_total_needed DECIMAL;
BEGIN
    FOR v_order_item IN SELECT oi.catalog_item_id, oi.quantity FROM order_items oi WHERE oi.transaction_id = p_transaction_id
    LOOP
        FOR v_ingredient IN SELECT mii.inventory_item_id, mii.quantity_required, ii.name, ii.current_stock FROM menu_item_ingredients mii JOIN inventory_items ii ON ii.id = mii.inventory_item_id WHERE mii.catalog_item_id = v_order_item.catalog_item_id FOR UPDATE OF ii
        LOOP
            v_total_needed := v_ingredient.quantity_required * v_order_item.quantity;
            UPDATE inventory_items SET current_stock = current_stock - v_total_needed, updated_at = NOW() WHERE id = v_ingredient.inventory_item_id;
            INSERT INTO inventory_transactions(item_id, transaction_type, quantity, stock_before, stock_after, reference_type, reference_id, notes) VALUES (v_ingredient.inventory_item_id, 'sale', -v_total_needed, v_ingredient.current_stock, v_ingredient.current_stock - v_total_needed, 'transaction', p_transaction_id, 'Auto-deducted for order');
            v_deduction_count := v_deduction_count + 1;
        END LOOP;
    END LOOP;
    RETURN QUERY SELECT true, v_deduction_count, NULL::TEXT;
END;
$$;


ALTER FUNCTION "public"."deduct_inventory_for_order"("p_transaction_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_stock_fifo"("p_item_id" "uuid", "p_quantity" numeric, "p_reason" "text" DEFAULT 'sale'::"text", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_remaining NUMERIC := p_quantity;
  v_batch RECORD;
  v_deduct NUMERIC;
BEGIN
  -- If negative quantity (receiving stock), skip FIFO
  IF p_quantity <= 0 THEN
    RETURN;
  END IF;

  -- Iterate batches in FIFO order
  FOR v_batch IN
    SELECT id, remaining_quantity
    FROM inventory_batches
    WHERE item_id = p_item_id
      AND status = 'active'
      AND remaining_quantity > 0
    ORDER BY received_date ASC, created_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_deduct := LEAST(v_batch.remaining_quantity, v_remaining);

    UPDATE inventory_batches
    SET remaining_quantity = remaining_quantity - v_deduct,
        status = CASE WHEN remaining_quantity - v_deduct <= 0 THEN 'depleted' ELSE 'active' END
    WHERE id = v_batch.id;

    v_remaining := v_remaining - v_deduct;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."deduct_stock_fifo"("p_item_id" "uuid", "p_quantity" numeric, "p_reason" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_stock_fifo"("p_item_id" "uuid", "p_quantity" numeric, "p_reason" character varying, "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_item           RECORD;
  v_remaining      DECIMAL := p_quantity;
  v_batch          RECORD;
  v_deduct_from_batch DECIMAL;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be greater than zero');
  END IF;

  -- ── Serialization point ──────────────────────────────────────────────────
  -- Lock the inventory_items row FOR UPDATE. All concurrent calls for the
  -- same item will queue here. This prevents the TOCTOU race where two
  -- transactions both read current_stock = 5 and both think they can deduct 5.
  SELECT * INTO v_item
  FROM inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventory item not found');
  END IF;

  -- Quick pre-check: is there enough total stock before touching batches?
  IF v_item.current_stock < p_quantity THEN
    RETURN jsonb_build_object(
      'success',         false,
      'error',           'Insufficient stock',
      'available',       v_item.current_stock,
      'requested',       p_quantity
    );
  END IF;

  -- ── Batch deduction (FIFO) ───────────────────────────────────────────────
  -- FOR UPDATE on the cursor locks each batch row before we read its quantity,
  -- so no concurrent transaction can read the same remaining_quantity.
  FOR v_batch IN
    SELECT *
    FROM   inventory_batches
    WHERE  item_id           = p_item_id
      AND  status            = 'active'
      AND  remaining_quantity > 0
    ORDER BY received_date ASC, created_at ASC
    FOR UPDATE           -- ← the fix: lock each batch row before inspecting it
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_deduct_from_batch := LEAST(v_batch.remaining_quantity, v_remaining);

    UPDATE inventory_batches
    SET
      remaining_quantity = remaining_quantity - v_deduct_from_batch,
      status = CASE
                 WHEN remaining_quantity - v_deduct_from_batch <= 0 THEN 'depleted'
                 ELSE status
               END
    WHERE id = v_batch.id;

    v_remaining := v_remaining - v_deduct_from_batch;
  END LOOP;

  -- ── Update summary stock on parent item ───────────────────────────────────
  -- We already hold the FOR UPDATE lock on this row.
  UPDATE inventory_items
  SET current_stock = GREATEST(0, current_stock - (p_quantity - v_remaining))
  WHERE id = p_item_id;

  IF v_remaining > 0 THEN
    -- Batches ran out before we fulfilled the full quantity.
    -- This should not happen given the pre-check above, but guard defensively.
    RETURN jsonb_build_object(
      'success',           false,
      'error',             'Batch stock exhausted before deduction completed',
      'requested_quantity', p_quantity,
      'unfulfilled',        v_remaining
    );
  END IF;

  RETURN jsonb_build_object(
    'success',            true,
    'requested_quantity', p_quantity,
    'remaining_quantity', 0
  );
END;
$$;


ALTER FUNCTION "public"."deduct_stock_fifo"("p_item_id" "uuid", "p_quantity" numeric, "p_reason" character varying, "p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."deduct_stock_fifo"("p_item_id" "uuid", "p_quantity" numeric, "p_reason" character varying, "p_user_id" "uuid") IS 'FIFO batch stock deduction. Serialized via FOR UPDATE on inventory_items + FOR UPDATE cursor on inventory_batches to prevent double-deduction races. Fixed 2026-04-24 (was missing both locks).';



CREATE OR REPLACE FUNCTION "public"."detect_offline_kiosks"() RETURNS TABLE("kiosk_id" "uuid", "device_name" character varying, "last_seen" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  UPDATE kiosk_devices
  SET status = 'offline', updated_at = NOW()
  WHERE status = 'online'
    AND last_heartbeat < NOW() - INTERVAL '5 minutes'
    AND is_active = true
  RETURNING id, device_name, last_heartbeat;
END;
$$;


ALTER FUNCTION "public"."detect_offline_kiosks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."earn_loyalty_points_atomic"("p_user_id" "uuid", "p_order_total" numeric, "p_order_id" "uuid", "p_points_per_dollar" integer DEFAULT 1) RETURNS TABLE("success" boolean, "points_earned" integer, "new_balance" integer, "tier_multiplier" numeric, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_member RECORD;
    v_tier RECORD;
    v_base_points INTEGER;
    v_final_points INTEGER;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('loyalty_member_' || p_user_id::text));
    SELECT * INTO v_member FROM loyalty_members WHERE user_id = p_user_id;
    IF NOT FOUND THEN
        -- Create new member (safe under lock)
        INSERT INTO loyalty_members(user_id, tier_id, total_points, available_points, lifetime_points)
        SELECT p_user_id, id, 0, 0, 0 FROM loyalty_tiers WHERE min_points = 0 ORDER BY sort_order LIMIT 1
        RETURNING * INTO v_member;
    END IF;
    SELECT * INTO v_tier FROM loyalty_tiers WHERE id = v_member.tier_id;
    v_base_points := FLOOR(p_order_total * p_points_per_dollar);
    v_final_points := FLOOR(v_base_points * COALESCE(v_tier.points_multiplier, 1));
    UPDATE loyalty_members SET available_points = available_points + v_final_points, total_points = total_points + v_final_points, lifetime_points = lifetime_points + v_final_points, last_activity = NOW(), updated_at = NOW() WHERE id = v_member.id
    RETURNING available_points INTO v_member.available_points;
    INSERT INTO loyalty_transactions(member_id, transaction_type, points, balance_after, description) VALUES (v_member.id, 'earn', v_final_points, v_member.available_points, 'Earned ' || v_final_points || ' points from order ' || p_order_id);
    RETURN QUERY SELECT true, v_final_points, v_member.available_points::INTEGER, COALESCE(v_tier.points_multiplier, 1)::DECIMAL, NULL::TEXT;
END;
$$;


ALTER FUNCTION "public"."earn_loyalty_points_atomic"("p_user_id" "uuid", "p_order_total" numeric, "p_order_id" "uuid", "p_points_per_dollar" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_constraints"("t_name" "text") RETURNS TABLE("constraint_name" "text", "definition" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT conname::TEXT, pg_get_constraintdef(c.oid)::TEXT
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = t_name;
END;
$$;


ALTER FUNCTION "public"."get_constraints"("t_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_economics_avg_value"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_module_id" "text" DEFAULT NULL::"text", "p_engine_type" "text" DEFAULT NULL::"text") RETURNS TABLE("engine_type" "text", "average" numeric, "revenue" numeric, "transaction_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_economics_avg_value"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid", "p_module_id" "text", "p_engine_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_economics_cross_module"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("customer_id" "uuid", "day_date" "text", "engine_type" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_economics_cross_module"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_economics_gross_vs_net"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_module_id" "text" DEFAULT NULL::"text", "p_engine_type" "text" DEFAULT NULL::"text") RETURNS TABLE("gross" numeric, "net" numeric, "discounts" numeric, "refunds" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_economics_gross_vs_net"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid", "p_module_id" "text", "p_engine_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_economics_peak_hours"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_module_id" "text" DEFAULT NULL::"text", "p_engine_type" "text" DEFAULT NULL::"text") RETURNS TABLE("hour_of_day" integer, "revenue" numeric, "transaction_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_economics_peak_hours"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid", "p_module_id" "text", "p_engine_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_economics_promo_effectiveness"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_module_id" "text" DEFAULT NULL::"text", "p_engine_type" "text" DEFAULT NULL::"text") RETURNS TABLE("has_promo" boolean, "revenue" numeric, "transaction_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_economics_promo_effectiveness"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid", "p_module_id" "text", "p_engine_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_economics_repeat_vs_new"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_module_id" "text" DEFAULT NULL::"text", "p_engine_type" "text" DEFAULT NULL::"text") RETURNS TABLE("customer_id" "uuid", "transaction_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_economics_repeat_vs_new"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid", "p_module_id" "text", "p_engine_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_economics_revenue_by_engine"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_module_id" "text" DEFAULT NULL::"text", "p_engine_type" "text" DEFAULT NULL::"text") RETURNS TABLE("engine_type" "text", "revenue" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_economics_revenue_by_engine"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid", "p_module_id" "text", "p_engine_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_economics_revenue_by_module"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_module_id" "text" DEFAULT NULL::"text", "p_engine_type" "text" DEFAULT NULL::"text") RETURNS TABLE("module_id" "text", "module_name" "text", "revenue" numeric, "transaction_count" bigint, "refund_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_economics_revenue_by_module"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid", "p_module_id" "text", "p_engine_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_economics_revenue_over_time"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_interval" "text", "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_module_id" "text" DEFAULT NULL::"text", "p_engine_type" "text" DEFAULT NULL::"text") RETURNS TABLE("bucket" "text", "engine_type" "text", "revenue" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_economics_revenue_over_time"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_interval" "text", "p_property_id" "uuid", "p_module_id" "text", "p_engine_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_economics_staff_performance"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_module_id" "text" DEFAULT NULL::"text", "p_engine_type" "text" DEFAULT NULL::"text") RETURNS TABLE("staff_id" "uuid", "staff_name" "text", "revenue" numeric, "transaction_count" bigint, "cancellation_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_economics_staff_performance"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_property_id" "uuid", "p_module_id" "text", "p_engine_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_economics_top_customers"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer DEFAULT 10, "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_module_id" "text" DEFAULT NULL::"text", "p_engine_type" "text" DEFAULT NULL::"text") RETURNS TABLE("customer_id" "uuid", "customer_name" "text", "spend" numeric, "transaction_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_economics_top_customers"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer, "p_property_id" "uuid", "p_module_id" "text", "p_engine_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_economics_volume"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_interval" "text", "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_module_id" "text" DEFAULT NULL::"text", "p_engine_type" "text" DEFAULT NULL::"text") RETURNS TABLE("bucket" "text", "volume_count" bigint)
    LANGUAGE "plpgsql" STABLE
    AS $$
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


ALTER FUNCTION "public"."get_economics_volume"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_interval" "text", "p_property_id" "uuid", "p_module_id" "text", "p_engine_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_entity_customizations"("p_entity_type" "public"."customizable_entity_type", "p_entity_id" "uuid") RETURNS TABLE("group_id" "uuid", "group_name" "text", "group_name_ar" "text", "display_name" "text", "display_name_ar" "text", "selection_mode" "text", "min_selections" integer, "max_selections" integer, "is_required" boolean, "sort_order" integer, "options" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    WITH entity_groups AS (
        -- Get explicitly linked groups
        SELECT 
            cg.id,
            cg.name,
            cg.name_ar,
            cg.display_name,
            cg.display_name_ar,
            cg.selection_mode,
            COALESCE(ec.min_selections_override, cg.min_selections) as min_selections,
            COALESCE(ec.max_selections_override, cg.max_selections) as max_selections,
            COALESCE(ec.is_required_override, cg.is_required) as is_required,
            COALESCE(ec.sort_order, cg.sort_order) as sort_order,
            COALESCE(ec.price_multiplier, 1.0) as price_multiplier
        FROM customization_groups cg
        LEFT JOIN entity_customizations ec ON ec.customization_group_id = cg.id
            AND ec.entity_type = p_entity_type
            AND ec.entity_id = p_entity_id
            AND ec.is_enabled = true
        WHERE cg.deleted_at IS NULL
        AND cg.is_available = true
        AND (
            -- Explicitly linked to this entity
            ec.id IS NOT NULL
            OR 
            -- Global group for this entity type
            (cg.is_global = true AND p_entity_type = ANY(cg.applicable_entity_types))
        )
        -- Time-based availability
        AND (cg.available_from IS NULL OR CURRENT_TIME >= cg.available_from)
        AND (cg.available_until IS NULL OR CURRENT_TIME <= cg.available_until)
        AND (cg.available_days IS NULL OR EXTRACT(DOW FROM CURRENT_DATE)::INTEGER = ANY(cg.available_days))
    )
    SELECT 
        eg.id,
        eg.name,
        eg.name_ar,
        eg.display_name,
        eg.display_name_ar,
        eg.selection_mode,
        eg.min_selections,
        eg.max_selections,
        eg.is_required,
        eg.sort_order,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', co.id,
                    'name', co.name,
                    'name_ar', co.name_ar,
                    'description', co.description,
                    'customizationType', co.customization_type,
                    'priceAdjustment', co.price_adjustment * eg.price_multiplier,
                    'priceType', co.price_type,
                    'maxQuantity', co.max_quantity,
                    'isDefault', co.is_default,
                    'isPopular', co.is_popular,
                    'badgeText', co.badge_text,
                    'imageUrl', co.image_url,
                    'isAvailable', co.is_available AND (co.available_stock IS NULL OR co.available_stock > 0),
                    'inventoryItemId', co.inventory_item_id,
                    'quantityPerSelection', co.quantity_per_selection,
                    'sortOrder', co.sort_order
                ) ORDER BY co.sort_order, co.name
            ) FILTER (WHERE co.id IS NOT NULL),
            '[]'::JSONB
        ) as options
    FROM entity_groups eg
    LEFT JOIN customization_options co ON co.group_id = eg.id
        AND co.deleted_at IS NULL
        AND co.is_available = true
    GROUP BY eg.id, eg.name, eg.name_ar, eg.display_name, eg.display_name_ar,
             eg.selection_mode, eg.min_selections, eg.max_selections, eg.is_required, eg.sort_order
    ORDER BY eg.sort_order, eg.name;
END;
$$;


ALTER FUNCTION "public"."get_entity_customizations"("p_entity_type" "public"."customizable_entity_type", "p_entity_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_entity_customizations"("p_entity_type" "public"."customizable_entity_type", "p_entity_id" "uuid") IS 'Get all available customization groups and options for an entity';



CREATE OR REPLACE FUNCTION "public"."get_entity_ledger_balance"("p_entity_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(SUM(CASE
    WHEN transaction_type IN ('charge','deposit')           THEN total_amount
    WHEN transaction_type IN ('refund','void','deposit_release') THEN -total_amount
    ELSE 0
  END), 0)
  FROM engine_financial_ledger
  WHERE entity_id = p_entity_id;
$$;


ALTER FUNCTION "public"."get_entity_ledger_balance"("p_entity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_order_customizations"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("group_name" "text", "options" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        oc.group_name,
        jsonb_agg(
            jsonb_build_object(
                'name', oc.option_name,
                'type', oc.customization_type,
                'quantity', oc.quantity,
                'priceAdjustment', oc.total_price_adjustment
            ) ORDER BY oc.created_at
        ) as options
    FROM order_customizations oc
    WHERE oc.order_type = p_order_type
    AND oc.order_id = p_order_id
    AND (p_order_item_id IS NULL OR oc.order_item_id = p_order_item_id)
    GROUP BY oc.group_name, oc.customization_group_id
    ORDER BY MIN(oc.created_at);
END;
$$;


ALTER FUNCTION "public"."get_order_customizations"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_order_customizations"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid") IS 'Retrieve customizations for an order (for receipts, staff display)';



CREATE OR REPLACE FUNCTION "public"."get_product_rating"("p_product_id" "uuid") RETURNS TABLE("average_rating" numeric, "review_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(rating)::NUMERIC, 1) as average_rating,
    COUNT(*) as review_count
  FROM product_reviews
  WHERE product_id = p_product_id
  AND is_approved = true;
END;
$$;


ALTER FUNCTION "public"."get_product_rating"("p_product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_reversible_order_customizations"("p_order_type" "text", "p_order_id" "uuid") RETURNS TABLE("snapshot_id" "uuid", "order_item_id" "uuid", "option_name" "text", "quantity" integer, "inventory_deducted" boolean, "inventory_quantity_used" numeric, "created_at" timestamp with time zone, "can_reverse" boolean)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        oc.id,
        oc.order_item_id,
        oc.option_name,
        oc.quantity,
        oc.inventory_deducted,
        oc.inventory_quantity_used,
        oc.created_at,
        (oc.reversed_at IS NULL) as can_reverse
    FROM order_customizations oc
    WHERE oc.order_type = p_order_type
    AND oc.order_id = p_order_id
    ORDER BY oc.created_at;
END;
$$;


ALTER FUNCTION "public"."get_reversible_order_customizations"("p_order_type" "text", "p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_suppression_stats"() RETURNS TABLE("reason" "public"."suppression_reason", "count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT esl.reason, COUNT(*)::BIGINT
  FROM email_suppression_list esl
  GROUP BY esl.reason
  ORDER BY COUNT(*) DESC;
END;
$$;


ALTER FUNCTION "public"."get_suppression_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unit_rating"("p_unit_id" "uuid") RETURNS TABLE("average_rating" numeric, "review_count" bigint, "cleanliness" numeric, "location" numeric, "value" numeric, "service" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(rating)::NUMERIC, 1) as average_rating,
    COUNT(*) as review_count,
    ROUND(AVG(cleanliness_rating)::NUMERIC, 1) as cleanliness,
    ROUND(AVG(location_rating)::NUMERIC, 1) as location,
    ROUND(AVG(value_rating)::NUMERIC, 1) as value,
    ROUND(AVG(service_rating)::NUMERIC, 1) as service
  FROM booking_reviews
  WHERE unit_id = p_unit_id
  AND is_approved = true;
END;
$$;


ALTER FUNCTION "public"."get_unit_rating"("p_unit_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."gift_card_transactions_backfill_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.tenant_id IS NULL OR NEW.property_id IS NULL THEN
        SELECT
            COALESCE(NEW.tenant_id, g.tenant_id),
            COALESCE(NEW.property_id, g.property_id)
        INTO NEW.tenant_id, NEW.property_id
        FROM gift_cards g
        WHERE g.id = NEW.gift_card_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."gift_card_transactions_backfill_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_token_version"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_version INTEGER;
BEGIN
  UPDATE users 
  SET token_version = token_version + 1 
  WHERE id = p_user_id
  RETURNING token_version INTO new_version;
  
  RETURN new_version;
END;
$$;


ALTER FUNCTION "public"."increment_token_version"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_loyalty_account"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO loyalty_members (
        id, user_id, tier_id, total_points, available_points, 
        lifetime_points, member_since, last_activity, created_at, updated_at
    ) VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        NEW.user_id,
        NEW.tier_id,
        COALESCE(NEW.total_points, 0),
        COALESCE(NEW.available_points, 0),
        COALESCE(NEW.lifetime_points, 0),
        COALESCE(NEW.member_since, NOW()),
        COALESCE(NEW.last_activity, NOW()),
        COALESCE(NEW.created_at, NOW()),
        COALESCE(NEW.updated_at, NOW())
    )
    RETURNING * INTO NEW;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."insert_loyalty_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_email_suppressed"("check_email" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM email_suppression_list
    WHERE email = LOWER(check_email)
  );
END;
$$;


ALTER FUNCTION "public"."is_email_suppressed"("check_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_dual_write_comparison"("p_operation" "text", "p_old_result" "jsonb", "p_new_result" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_match BOOLEAN;
    v_discrepancies JSONB := '[]'::JSONB;
    v_log_id UUID;
BEGIN
    -- Simple comparison for now - can be enhanced
    v_match := p_old_result::TEXT = p_new_result::TEXT;
    
    IF NOT v_match THEN
        v_discrepancies := jsonb_build_object(
            'old_keys', jsonb_object_keys(p_old_result),
            'new_keys', jsonb_object_keys(p_new_result)
        );
    END IF;
    
    INSERT INTO customization_dual_write_log (
        operation, old_system_result, new_system_result, results_match, discrepancies
    ) VALUES (
        p_operation, p_old_result, p_new_result, v_match, v_discrepancies
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_dual_write_comparison"("p_operation" "text", "p_old_result" "jsonb", "p_new_result" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_ledger_modification"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'Deleting from payment_ledger is strictly forbidden. Create a reversal entry instead.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'Modifying financial fields in payment_ledger is forbidden. '
      'Record a new corrective row instead. '
      'Attempted UPDATE on ledger row id=%.', OLD.id;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."prevent_ledger_modification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_customization_inventory"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid", "p_selections" "jsonb", "p_base_quantity" integer DEFAULT 1) RETURNS TABLE("items_added" integer, "items_removed" integer, "items_swapped" integer, "deduction_log" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_selection JSONB;
    v_added INT := 0;
    v_removed INT := 0;
    v_swapped INT := 0;
    v_log JSONB := '[]'::JSONB;
    v_inv_item_id UUID;
    v_qty_to_deduct DECIMAL(10,3);
BEGIN
    FOR v_selection IN SELECT * FROM jsonb_array_elements(COALESCE(p_selections, '[]'::JSONB))
    LOOP
        v_inv_item_id := (v_selection->>'inventoryItemId')::UUID;
        
        CASE (v_selection->>'customizationType')
            WHEN 'add', 'upgrade' THEN
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1) 
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;
                    
                    UPDATE inventory_items 
                    SET current_stock = current_stock - v_qty_to_deduct,
                        updated_at = NOW()
                    WHERE id = v_inv_item_id
                    AND current_stock >= v_qty_to_deduct;
                    
                    IF FOUND THEN
                        INSERT INTO inventory_transactions (
                            item_id, transaction_type, quantity, 
                            reference_type, reference_id, notes
                        ) VALUES (
                            v_inv_item_id, 'sale', -v_qty_to_deduct,
                            p_order_type || '_customization', p_order_id,
                            'Customization: ' || (v_selection->>'optionName')
                        );
                        
                        v_added := v_added + 1;
                        v_log := v_log || jsonb_build_object(
                            'action', 'deducted',
                            'inventoryItemId', v_inv_item_id,
                            'optionName', v_selection->>'optionName',
                            'quantity', v_qty_to_deduct
                        );
                    END IF;
                END IF;
                
            WHEN 'swap' THEN
                -- Deduct the new item
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1) 
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;
                    
                    UPDATE inventory_items 
                    SET current_stock = current_stock - v_qty_to_deduct,
                        updated_at = NOW()
                    WHERE id = v_inv_item_id;
                    
                    IF FOUND THEN
                        INSERT INTO inventory_transactions (
                            item_id, transaction_type, quantity, 
                            reference_type, reference_id, notes
                        ) VALUES (
                            v_inv_item_id, 'sale', -v_qty_to_deduct,
                            p_order_type || '_customization', p_order_id,
                            'Swap (added): ' || (v_selection->>'optionName')
                        );
                    END IF;
                END IF;
                
                v_swapped := v_swapped + 1;
                v_log := v_log || jsonb_build_object(
                    'action', 'swapped',
                    'addedItemId', v_inv_item_id,
                    'removedItemId', v_selection->>'replacesInventoryItemId',
                    'optionName', v_selection->>'optionName',
                    'quantity', v_qty_to_deduct
                );
                
            WHEN 'remove' THEN
                -- Just track it, inventory NOT deducted (handled by base recipe processing)
                v_removed := v_removed + 1;
                v_log := v_log || jsonb_build_object(
                    'action', 'skip_deduction',
                    'inventoryItemId', v_selection->>'inventoryItemId',
                    'optionName', v_selection->>'optionName',
                    'reason', 'remove_modifier'
                );
        END CASE;

        -- Store the customization record
        INSERT INTO order_customizations (
            order_type, order_id, order_item_id,
            customization_group_id, customization_option_id,
            group_name, option_name, customization_type, quantity,
            unit_price_adjustment, total_price_adjustment,
            inventory_item_id, inventory_quantity_used, inventory_deducted
        ) VALUES (
            p_order_type, p_order_id, p_order_item_id,
            (v_selection->>'groupId')::UUID,
            (v_selection->>'optionId')::UUID,
            v_selection->>'groupName',
            v_selection->>'optionName',
            v_selection->>'customizationType',
            COALESCE((v_selection->>'quantity')::INT, 1),
            COALESCE((v_selection->>'unitPrice')::DECIMAL, 0),
            COALESCE((v_selection->>'totalPrice')::DECIMAL, 0),
            v_inv_item_id,
            CASE WHEN (v_selection->>'customizationType') IN ('add', 'upgrade', 'swap') 
                 THEN v_qty_to_deduct ELSE NULL END,
            (v_selection->>'customizationType') IN ('add', 'upgrade', 'swap')
        );
    END LOOP;

    RETURN QUERY SELECT v_added, v_removed, v_swapped, v_log;
END;
$$;


ALTER FUNCTION "public"."process_customization_inventory"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid", "p_selections" "jsonb", "p_base_quantity" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_customization_inventory"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid", "p_selections" "jsonb", "p_base_quantity" integer) IS 'Deduct/track inventory for customizations';



CREATE OR REPLACE FUNCTION "public"."process_customization_inventory_safe"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid", "p_selections" "jsonb", "p_base_quantity" integer DEFAULT 1) RETURNS TABLE("items_added" integer, "items_removed" integer, "items_swapped" integer, "deduction_log" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_selection JSONB;
    v_added INT := 0;
    v_removed INT := 0;
    v_swapped INT := 0;
    v_log JSONB := '[]'::JSONB;
    v_inv_item_id UUID;
    v_qty_to_deduct DECIMAL(10,3);
    v_current_stock DECIMAL(10,3);
    v_min_stock DECIMAL(10,3);
    v_item_name TEXT;
BEGIN
    FOR v_selection IN SELECT * FROM jsonb_array_elements(COALESCE(p_selections, '[]'::JSONB))
    LOOP
        v_inv_item_id := (v_selection->>'inventoryItemId')::UUID;
        
        CASE (v_selection->>'customizationType')
            WHEN 'add', 'upgrade' THEN
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1) 
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;
                    
                    -- Get current stock and check for warnings
                    SELECT current_stock, minimum_stock, name INTO v_current_stock, v_min_stock, v_item_name
                    FROM inventory_items WHERE id = v_inv_item_id;
                    
                    -- Check if this would trigger low stock warning
                    IF v_current_stock - v_qty_to_deduct <= COALESCE(v_min_stock, 0) THEN
                        INSERT INTO customization_events (event_type, payload)
                        VALUES (
                            'inventory.warning',
                            jsonb_build_object(
                                'warning_type', 'low_stock',
                                'inventory_item_id', v_inv_item_id,
                                'item_name', v_item_name,
                                'current_stock', v_current_stock,
                                'deduction_amount', v_qty_to_deduct,
                                'remaining_stock', v_current_stock - v_qty_to_deduct,
                                'minimum_stock', v_min_stock
                            )
                        );
                    END IF;
                    
                    -- Perform deduction
                    UPDATE inventory_items 
                    SET current_stock = current_stock - v_qty_to_deduct,
                        updated_at = NOW()
                    WHERE id = v_inv_item_id
                    AND current_stock >= v_qty_to_deduct;
                    
                    IF FOUND THEN
                        INSERT INTO inventory_transactions (
                            item_id, transaction_type, quantity, 
                            reference_type, reference_id, notes
                        ) VALUES (
                            v_inv_item_id, 'sale', -v_qty_to_deduct,
                            p_order_type || '_customization', p_order_id,
                            'Customization: ' || (v_selection->>'optionName')
                        );
                        
                        -- Update the snapshot with actual deduction
                        UPDATE order_customizations
                        SET inventory_quantity_used = v_qty_to_deduct,
                            inventory_deducted = true
                        WHERE order_type = p_order_type
                        AND order_id = p_order_id
                        AND (p_order_item_id IS NULL OR order_item_id = p_order_item_id)
                        AND customization_option_id = (v_selection->>'optionId')::UUID;
                        
                        v_added := v_added + 1;
                        v_log := v_log || jsonb_build_object(
                            'action', 'deducted',
                            'inventoryItemId', v_inv_item_id,
                            'optionName', v_selection->>'optionName',
                            'quantity', v_qty_to_deduct
                        );
                    ELSE
                        -- Insufficient stock - emit warning
                        INSERT INTO customization_events (event_type, payload)
                        VALUES (
                            'inventory.warning',
                            jsonb_build_object(
                                'warning_type', 'insufficient_stock',
                                'inventory_item_id', v_inv_item_id,
                                'item_name', v_item_name,
                                'required', v_qty_to_deduct,
                                'available', v_current_stock
                            )
                        );
                    END IF;
                END IF;
                
            WHEN 'swap' THEN
                IF v_inv_item_id IS NOT NULL THEN
                    v_qty_to_deduct := COALESCE((v_selection->>'quantityPerSelection')::DECIMAL, 1) 
                                     * COALESCE((v_selection->>'quantity')::INT, 1)
                                     * p_base_quantity;
                    
                    UPDATE inventory_items 
                    SET current_stock = current_stock - v_qty_to_deduct,
                        updated_at = NOW()
                    WHERE id = v_inv_item_id;
                    
                    IF FOUND THEN
                        INSERT INTO inventory_transactions (
                            item_id, transaction_type, quantity, 
                            reference_type, reference_id, notes
                        ) VALUES (
                            v_inv_item_id, 'sale', -v_qty_to_deduct,
                            p_order_type || '_customization', p_order_id,
                            'Swap (added): ' || (v_selection->>'optionName')
                        );
                        
                        -- Update the snapshot
                        UPDATE order_customizations
                        SET inventory_quantity_used = v_qty_to_deduct,
                            inventory_deducted = true
                        WHERE order_type = p_order_type
                        AND order_id = p_order_id
                        AND (p_order_item_id IS NULL OR order_item_id = p_order_item_id)
                        AND customization_option_id = (v_selection->>'optionId')::UUID;
                    END IF;
                END IF;
                
                v_swapped := v_swapped + 1;
                v_log := v_log || jsonb_build_object(
                    'action', 'swapped',
                    'addedItemId', v_inv_item_id,
                    'removedItemId', v_selection->>'replacesInventoryItemId',
                    'optionName', v_selection->>'optionName',
                    'quantity', v_qty_to_deduct
                );
                
            WHEN 'remove' THEN
                v_removed := v_removed + 1;
                v_log := v_log || jsonb_build_object(
                    'action', 'skip_deduction',
                    'inventoryItemId', v_selection->>'inventoryItemId',
                    'optionName', v_selection->>'optionName',
                    'reason', 'remove_modifier'
                );
        END CASE;
    END LOOP;

    RETURN QUERY SELECT v_added, v_removed, v_swapped, v_log;
END;
$$;


ALTER FUNCTION "public"."process_customization_inventory_safe"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid", "p_selections" "jsonb", "p_base_quantity" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_customization_inventory_safe"("p_order_type" "text", "p_order_id" "uuid", "p_order_item_id" "uuid", "p_selections" "jsonb", "p_base_quantity" integer) IS 'Safe inventory processing with warning events for low stock';



CREATE OR REPLACE FUNCTION "public"."purchase_shared_capacity_atomic"("p_session_id" "uuid", "p_module_id" "uuid", "p_property_id" "uuid" DEFAULT NULL::"uuid", "p_customer_id" "uuid" DEFAULT NULL::"uuid", "p_quantity" integer DEFAULT 1, "p_ticket_date" "date" DEFAULT CURRENT_DATE, "p_amount" numeric DEFAULT 0, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("success" boolean, "transaction_id" "uuid", "total_amount" numeric, "available_capacity" integer, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_session RECORD;
  v_sold INTEGER;
  v_max_capacity INTEGER;
  v_new_id UUID;
  v_meta JSONB;
  v_module_id UUID;
  v_tenant_id UUID;
  v_property_id UUID;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'quantity must be at least 1'::TEXT;
    RETURN;
  END IF;

  SELECT *
  INTO v_session
  FROM capacity_windows
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session not found'::TEXT;
    RETURN;
  END IF;

  IF COALESCE(v_session.is_active, true) = false THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session is not active'::TEXT;
    RETURN;
  END IF;

  v_max_capacity := COALESCE(v_session.max_capacity, v_session.capacity, 0);
  IF v_max_capacity <= 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Session has no capacity configured'::TEXT;
    RETURN;
  END IF;

  v_module_id := COALESCE(p_module_id, v_session.module_id);

  SELECT tenant_id, property_id INTO v_tenant_id, v_property_id
  FROM modules WHERE id = v_module_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL, 0, 'Module not found'::TEXT;
    RETURN;
  END IF;

  v_property_id := COALESCE(p_property_id, v_property_id);

  SELECT COALESCE(SUM(
    GREATEST(
      COALESCE(NULLIF(t.metadata->>'quantity', '')::INTEGER, 0),
      COALESCE(NULLIF(t.metadata->>'number_of_guests', '')::INTEGER, 0),
      COALESCE(NULLIF(t.metadata->>'adults', '')::INTEGER, 0)
        + COALESCE(NULLIF(t.metadata->>'children', '')::INTEGER, 0),
      1
    )
  ), 0)::INTEGER
  INTO v_sold
  FROM transactions t
  WHERE t.engine_type = 'shared_capacity_access'
    AND (
      t.reference_id = p_session_id
      OR (t.metadata->>'session_id')::UUID = p_session_id
    )
    AND COALESCE(t.metadata->>'ticket_date', t.metadata->>'date', '') = p_ticket_date::TEXT
    AND t.status NOT IN ('cancelled', 'expired', 'no_show');

  IF v_sold + p_quantity > v_max_capacity THEN
    RETURN QUERY SELECT
      false,
      NULL::UUID,
      0::DECIMAL,
      GREATEST(0, v_max_capacity - v_sold),
      'Not enough capacity available'::TEXT;
    RETURN;
  END IF;

  v_meta := COALESCE(p_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'session_id', p_session_id::TEXT,
      'quantity', p_quantity,
      'ticket_date', p_ticket_date::TEXT,
      'date', p_ticket_date::TEXT
    );

  INSERT INTO transactions (
    engine_type,
    module_id,
    tenant_id,
    property_id,
    customer_id,
    status,
    amount,
    net_amount,
    reference_id,
    reference_table,
    metadata
  )
  VALUES (
    'shared_capacity_access',
    v_module_id,
    v_tenant_id,
    v_property_id,
    p_customer_id,
    'confirmed',
    p_amount,
    p_amount,
    p_session_id,
    'capacity_windows',
    v_meta
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT
    true,
    v_new_id,
    p_amount,
    GREATEST(0, v_max_capacity - v_sold - p_quantity),
    NULL::TEXT;
END;
$$;


ALTER FUNCTION "public"."purchase_shared_capacity_atomic"("p_session_id" "uuid", "p_module_id" "uuid", "p_property_id" "uuid", "p_customer_id" "uuid", "p_quantity" integer, "p_ticket_date" "date", "p_amount" numeric, "p_metadata" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."guests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "email" "text",
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "vip_status" "text" DEFAULT 'standard'::"text",
    "total_stays" integer DEFAULT 0,
    "total_spend" numeric(12,2) DEFAULT 0,
    "last_stay_date" "date",
    "marketing_opt_in" boolean DEFAULT true,
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."guests" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."query_guests_by_rules"("p_property_id" "uuid", "p_rules" "jsonb", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS SETOF "public"."guests"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Simplified: return all guests for property
    -- In production, would parse and apply rules dynamically
    RETURN QUERY
    SELECT * FROM guests 
    WHERE property_id = p_property_id
    ORDER BY created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."query_guests_by_rules"("p_property_id" "uuid", "p_rules" "jsonb", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reconcile_transactions"("p_source_table" "text") RETURNS TABLE("mismatches_found" integer, "mismatches_fixed" integer, "details" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_count INTEGER := 0;
    v_fixed INTEGER := 0;
    v_details JSONB := '[]'::JSONB;
    v_engine TEXT;
BEGIN
    -- p_source_table must be an engine_type name:
    -- 'instant_transaction' | 'time_exclusive_reservation' | 'shared_capacity_access'
    v_engine := p_source_table;

    -- Count transactions stuck in 'pending' for >24h
    SELECT COUNT(*) INTO v_count
    FROM transactions
    WHERE engine_type = v_engine
      AND status = 'pending'
      AND created_at < NOW() - INTERVAL '24 hours';

    -- Flag them in details (no automated fix — requires human review)
    IF v_count > 0 THEN
        SELECT jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at, 'engine_type', engine_type))
        INTO v_details
        FROM transactions
        WHERE engine_type = v_engine
          AND status = 'pending'
          AND created_at < NOW() - INTERVAL '24 hours';
    END IF;

    INSERT INTO reconciliation_log (table_name, mismatches_found, mismatches_fixed, details)
    VALUES (v_engine, v_count, 0, COALESCE(v_details, '[]'));

    RETURN QUERY SELECT v_count, 0, COALESCE(v_details, '[]'::JSONB);
END;
$$;


ALTER FUNCTION "public"."reconcile_transactions"("p_source_table" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_booking_price"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Only act on time_exclusive_reservation (accommodation bookings)
    IF NEW.engine_type != 'time_exclusive_reservation' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'confirmed') THEN
        INSERT INTO price_history (
            item_type,
            item_id,
            base_price,
            final_price,
            applied_rules,
            booking_date,
            check_in_date,
            tenant_id,
            property_id
        ) VALUES (
            'accommodation',
            COALESCE((NEW.metadata->>'unit_id')::UUID, NEW.module_id),
            COALESCE((NEW.metadata->>'base_price')::DECIMAL, NEW.amount),
            NEW.amount,
            COALESCE((NEW.metadata->'pricing_rules_applied'), '[]'::jsonb),
            CURRENT_DATE,
            (NEW.metadata->>'check_in_date')::DATE,
            NEW.tenant_id,
            NEW.property_id
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."record_booking_price"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_ref_type_telemetry"("p_raw_value" "text", "p_mapped_to" "text", "p_source" "text", "p_payment_intent_id" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO ref_type_telemetry (raw_value, mapped_to, source, payment_intent_id)
    VALUES (p_raw_value, p_mapped_to, p_source, p_payment_intent_id)
    ON CONFLICT DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."record_ref_type_telemetry"("p_raw_value" "text", "p_mapped_to" "text", "p_source" "text", "p_payment_intent_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_giftcard_atomic"("p_code" "text", "p_amount" numeric, "p_order_id" "uuid") RETURNS TABLE("success" boolean, "amount_redeemed" numeric, "new_balance" numeric, "gift_card_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_card RECORD;
    v_redeem_amount DECIMAL;
BEGIN
    SELECT * INTO v_card FROM gift_cards WHERE code = UPPER(p_code) AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::DECIMAL, 0::DECIMAL, NULL::UUID, 'Gift card not found, inactive, or expired'::TEXT;
        RETURN;
    END IF;
    IF v_card.current_balance <= 0 THEN
        RETURN QUERY SELECT false, 0::DECIMAL, v_card.current_balance, v_card.id, 'Gift card has no balance'::TEXT;
        RETURN;
    END IF;
    v_redeem_amount := LEAST(p_amount, v_card.current_balance);
    UPDATE gift_cards SET current_balance = current_balance - v_redeem_amount, status = CASE WHEN current_balance - v_redeem_amount <= 0 THEN 'redeemed' ELSE 'active' END, redeemed_at = CASE WHEN current_balance - v_redeem_amount <= 0 THEN NOW() ELSE redeemed_at END, updated_at = NOW() WHERE id = v_card.id;
    INSERT INTO gift_card_transactions(gift_card_id, transaction_type, amount, balance_after, order_id, notes) VALUES (v_card.id, 'redemption', -v_redeem_amount, v_card.current_balance - v_redeem_amount, p_order_id, 'Order redemption');
    -- order_gift_card_usage INSERT removed — usage tracked via transactions.metadata
    RETURN QUERY SELECT true, v_redeem_amount, v_card.current_balance - v_redeem_amount, v_card.id, NULL::TEXT;
END;
$$;


ALTER FUNCTION "public"."redeem_giftcard_atomic"("p_code" "text", "p_amount" numeric, "p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_loyalty_points_atomic"("p_user_id" "uuid", "p_points" integer, "p_order_id" "uuid", "p_dollar_value" numeric) RETURNS TABLE("success" boolean, "points_redeemed" integer, "new_balance" integer, "member_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
    v_member RECORD;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('loyalty_member_' || p_user_id::text));
    SELECT * INTO v_member FROM loyalty_members WHERE user_id = p_user_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, NULL::UUID, 'User does not have a loyalty account'::TEXT;
        RETURN;
    END IF;
    IF v_member.available_points < p_points THEN
        RETURN QUERY SELECT false, 0, v_member.available_points::INTEGER, v_member.id, 'Insufficient points balance'::TEXT;
        RETURN;
    END IF;
    UPDATE loyalty_members SET available_points = available_points - p_points, last_activity = NOW(), updated_at = NOW() WHERE id = v_member.id
    RETURNING available_points INTO v_member.available_points;
    INSERT INTO loyalty_transactions(member_id, transaction_type, points, balance_after, description) VALUES (v_member.id, 'redeem', -p_points, v_member.available_points, 'Redeemed ' || p_points || ' points for $' || p_dollar_value || ' discount for order ' || p_order_id);
    RETURN QUERY SELECT true, p_points, v_member.available_points::INTEGER, v_member.id, NULL::TEXT;
END;
$_$;


ALTER FUNCTION "public"."redeem_loyalty_points_atomic"("p_user_id" "uuid", "p_points" integer, "p_order_id" "uuid", "p_dollar_value" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_unit_exclusive_atomic"("p_unit_id" "text", "p_module_id" "uuid", "p_check_in_date" "date", "p_check_out_date" "date", "p_customer_id" "uuid" DEFAULT NULL::"uuid", "p_amount" numeric DEFAULT 0, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb", "p_discount_amount" numeric DEFAULT 0, "p_tax_amount" numeric DEFAULT 0) RETURNS TABLE("success" boolean, "transaction_id" "uuid", "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_new_id        UUID;
  v_overlap_count INTEGER;
  v_tenant_id     UUID;
  v_property_id   UUID;
BEGIN
  IF p_check_in_date >= p_check_out_date THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Check-out must be after check-in'::TEXT;
    RETURN;
  END IF;

  IF p_check_in_date < CURRENT_DATE THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Check-in date must not be in the past'::TEXT;
    RETURN;
  END IF;

  SELECT tenant_id, property_id INTO v_tenant_id, v_property_id
  FROM modules WHERE id = p_module_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Module not found'::TEXT;
    RETURN;
  END IF;

  -- Advisory lock scoped to this transaction: serialises concurrent requests for same unit
  PERFORM pg_advisory_xact_lock(
    hashtext(p_module_id::TEXT || '::' || p_unit_id)
  );

  -- Count overlapping active bookings for this unit
  SELECT COUNT(*) INTO v_overlap_count
  FROM transactions t
  WHERE t.engine_type = 'time_exclusive_reservation'
    AND t.module_id = p_module_id
    AND (t.metadata->>'unit_id') = p_unit_id
    AND t.status NOT IN ('cancelled', 'no_show')
    AND (t.metadata->>'check_in_date')::DATE  < p_check_out_date
    AND (t.metadata->>'check_out_date')::DATE > p_check_in_date;

  IF v_overlap_count > 0 THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Unit is already booked for these dates'::TEXT;
    RETURN;
  END IF;

  INSERT INTO transactions (
    engine_type, module_id, tenant_id, property_id, customer_id,
    status, amount, net_amount, discount_amount, tax_amount, metadata
  ) VALUES (
    'time_exclusive_reservation',
    p_module_id, v_tenant_id, v_property_id, p_customer_id,
    'pending', p_amount, p_amount, p_discount_amount, p_tax_amount,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'unit_id',        p_unit_id,
      'check_in_date',  p_check_in_date::TEXT,
      'check_out_date', p_check_out_date::TEXT
    )
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT true, v_new_id, NULL::TEXT;
END;
$$;


ALTER FUNCTION "public"."reserve_unit_exclusive_atomic"("p_unit_id" "text", "p_module_id" "uuid", "p_check_in_date" "date", "p_check_out_date" "date", "p_customer_id" "uuid", "p_amount" numeric, "p_metadata" "jsonb", "p_discount_amount" numeric, "p_tax_amount" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_setting"("p_property_id" "uuid", "p_setting_key" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    result JSONB;
    v_group_id UUID;
BEGIN
    -- Level 1: Property override
    SELECT setting_value INTO result
    FROM property_settings
    WHERE property_id = p_property_id AND setting_key = p_setting_key;
    
    IF result IS NOT NULL THEN RETURN result; END IF;

    -- Level 2: Group default
    SELECT pg.group_id INTO v_group_id
    FROM property_group_members pg
    WHERE pg.property_id = p_property_id
    LIMIT 1;

    IF v_group_id IS NOT NULL THEN
        SELECT setting_value INTO result
        FROM group_settings
        WHERE group_id = v_group_id AND setting_key = p_setting_key;
        
        IF result IS NOT NULL THEN RETURN result; END IF;
    END IF;

    -- Level 3: System default
    SELECT setting_value INTO result
    FROM system_defaults
    WHERE setting_key = p_setting_key;

    RETURN result; -- NULL if no default exists
END;
$$;


ALTER FUNCTION "public"."resolve_setting"("p_property_id" "uuid", "p_setting_key" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."resolve_setting"("p_property_id" "uuid", "p_setting_key" "text") IS 'Cascading settings resolution: property → group → system';



CREATE OR REPLACE FUNCTION "public"."restore_gift_card_balance"("p_gift_card_id" "uuid", "p_amount" numeric, "p_order_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("success" boolean, "new_balance" numeric, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_card RECORD;
  v_new_balance DECIMAL;
BEGIN
  SELECT * INTO v_card FROM gift_cards WHERE id = p_gift_card_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0::DECIMAL, 'Gift card not found'::TEXT;
    RETURN;
  END IF;

  v_new_balance := v_card.current_balance + p_amount;

  UPDATE gift_cards
  SET current_balance = v_new_balance,
      -- Flip a fully-redeemed card back to active now that it has balance
      -- again; leave any other status (e.g. a separately expired/cancelled
      -- card) alone rather than resurrecting it.
      status = CASE WHEN status = 'redeemed' THEN 'active' ELSE status END,
      redeemed_at = CASE WHEN status = 'redeemed' THEN NULL ELSE redeemed_at END,
      updated_at = NOW()
  WHERE id = p_gift_card_id;

  INSERT INTO gift_card_transactions(gift_card_id, transaction_type, amount, balance_after, order_id, notes)
  VALUES (p_gift_card_id, 'refund', p_amount, v_new_balance, p_order_id, 'Reversal: order creation failed, was cancelled, or was refunded');

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;


ALTER FUNCTION "public"."restore_gift_card_balance"("p_gift_card_id" "uuid", "p_amount" numeric, "p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_soft_delete"("p_table_name" "text", "p_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
    v_result BOOLEAN;
BEGIN
    EXECUTE format(
        'UPDATE %I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING TRUE',
        p_table_name
    ) INTO v_result USING p_id;
    
    RETURN COALESCE(v_result, FALSE);
END;
$_$;


ALTER FUNCTION "public"."restore_soft_delete"("p_table_name" "text", "p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_coupon_usage"("p_coupon_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_order_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Decrement usage count on the coupon (minimum 0)
  UPDATE coupons
  SET usage_count = GREATEST(0, usage_count - 1),
      updated_at = NOW()
  WHERE id = p_coupon_id;

  -- Remove the coupon_usage record for this specific order
  IF p_order_id IS NOT NULL THEN
    DELETE FROM coupon_usage
    WHERE coupon_id = p_coupon_id
      AND order_id = p_order_id;
  ELSIF p_user_id IS NOT NULL THEN
    -- Fallback: delete the most recent usage for this user + coupon
    DELETE FROM coupon_usage
    WHERE id = (
      SELECT id FROM coupon_usage
      WHERE coupon_id = p_coupon_id
        AND user_id = p_user_id
      ORDER BY used_at DESC
      LIMIT 1
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."reverse_coupon_usage"("p_coupon_id" "uuid", "p_user_id" "uuid", "p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_order_item_inventory"("p_snapshot_id" "uuid", "p_reason" "text" DEFAULT 'Refund'::"text", "p_reversed_by" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("success" boolean, "items_reversed" integer, "reversal_log" "jsonb", "error_message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_snapshot RECORD;
    v_reversed INT := 0;
    v_log JSONB := '[]'::JSONB;
    v_event_id UUID;
BEGIN
    -- Get snapshot details
    SELECT * INTO v_snapshot
    FROM order_customizations
    WHERE id = p_snapshot_id;
    
    IF v_snapshot IS NULL THEN
        RETURN QUERY SELECT false, 0, '[]'::JSONB, 'Snapshot not found'::TEXT;
        RETURN;
    END IF;
    
    IF v_snapshot.reversed_at IS NOT NULL THEN
        RETURN QUERY SELECT false, 0, '[]'::JSONB, 'Snapshot already reversed'::TEXT;
        RETURN;
    END IF;
    
    -- Reverse inventory for ALL snapshots in this order item
    FOR v_snapshot IN 
        SELECT * FROM order_customizations
        WHERE order_type = (SELECT order_type FROM order_customizations WHERE id = p_snapshot_id)
        AND order_id = (SELECT order_id FROM order_customizations WHERE id = p_snapshot_id)
        AND (order_item_id = (SELECT order_item_id FROM order_customizations WHERE id = p_snapshot_id)
             OR (order_item_id IS NULL AND (SELECT order_item_id FROM order_customizations WHERE id = p_snapshot_id) IS NULL))
        AND reversed_at IS NULL
    LOOP
        IF v_snapshot.inventory_deducted AND v_snapshot.inventory_item_id IS NOT NULL THEN
            -- Restore inventory
            UPDATE inventory_items 
            SET current_stock = current_stock + v_snapshot.inventory_quantity_used,
                updated_at = NOW()
            WHERE id = v_snapshot.inventory_item_id;
            
            -- Create reversal transaction
            INSERT INTO inventory_transactions (
                item_id, transaction_type, quantity, 
                reference_type, reference_id, notes
            ) VALUES (
                v_snapshot.inventory_item_id, 
                'adjustment', 
                v_snapshot.inventory_quantity_used,
                v_snapshot.order_type || '_customization_reversal', 
                v_snapshot.order_id,
                'Reversal: ' || v_snapshot.option_name || ' - ' || p_reason
            );
            
            v_reversed := v_reversed + 1;
            v_log := v_log || jsonb_build_object(
                'action', 'inventory_restored',
                'snapshot_id', v_snapshot.id,
                'inventory_item_id', v_snapshot.inventory_item_id,
                'quantity_restored', v_snapshot.inventory_quantity_used,
                'option_name', v_snapshot.option_name
            );
        END IF;
        
        -- Mark snapshot as reversed
        UPDATE order_customizations
        SET reversed_at = NOW(),
            reversed_by = p_reversed_by,
            reversal_reason = p_reason,
            inventory_reversed = true
        WHERE id = v_snapshot.id;
    END LOOP;
    
    -- Emit reversal event
    INSERT INTO customization_events (event_type, order_type, order_id, payload)
    VALUES (
        'inventory.reversed',
        v_snapshot.order_type,
        v_snapshot.order_id,
        jsonb_build_object(
            'snapshot_id', p_snapshot_id,
            'items_reversed', v_reversed,
            'reason', p_reason,
            'reversed_by', p_reversed_by,
            'reversal_log', v_log
        )
    ) RETURNING id INTO v_event_id;
    
    RETURN QUERY SELECT true, v_reversed, v_log, NULL::TEXT;
END;
$$;


ALTER FUNCTION "public"."reverse_order_item_inventory"("p_snapshot_id" "uuid", "p_reason" "text", "p_reversed_by" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reverse_order_item_inventory"("p_snapshot_id" "uuid", "p_reason" "text", "p_reversed_by" "uuid") IS 'Reverse inventory deductions for refunds/cancellations - CRITICAL for financial accuracy';



CREATE OR REPLACE FUNCTION "public"."run_daily_reconciliation"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_ro RECORD; v_cb RECORD; v_pt RECORD;
BEGIN
    SELECT * INTO v_ro FROM reconcile_transactions('instant_transaction');
    SELECT * INTO v_cb FROM reconcile_transactions('time_exclusive_reservation');
    SELECT * INTO v_pt FROM reconcile_transactions('shared_capacity_access');
    RETURN jsonb_build_object(
        'instant_transaction',         jsonb_build_object('stuck_pending', v_ro.mismatches_found),
        'time_exclusive_reservation',  jsonb_build_object('stuck_pending', v_cb.mismatches_found),
        'shared_capacity_access',      jsonb_build_object('stuck_pending', v_pt.mismatches_found),
        'run_at', NOW()
    );
END;
$$;


ALTER FUNCTION "public"."run_daily_reconciliation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sessions_view_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO capacity_windows (
            name, date, start_time, end_time, max_capacity,
            adult_price, child_price, gender_restriction, is_active, module_id
        ) VALUES (
            NEW.name, NEW.date, NEW.start_time, NEW.end_time, NEW.max_capacity,
            NEW.adult_price, NEW.child_price, NEW.gender_restriction, NEW.is_active, NEW.module_id
        ) RETURNING id INTO NEW.id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE capacity_windows SET
            name = NEW.name, date = NEW.date,
            start_time = NEW.start_time, end_time = NEW.end_time,
            max_capacity = NEW.max_capacity, adult_price = NEW.adult_price,
            child_price = NEW.child_price, gender_restriction = NEW.gender_restriction,
            is_active = NEW.is_active, module_id = NEW.module_id, updated_at = NOW()
        WHERE id = OLD.id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM capacity_windows WHERE id = OLD.id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sessions_view_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."soft_delete"("p_table_name" "text", "p_id" "uuid", "p_deleted_by" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
    v_result BOOLEAN;
BEGIN
    EXECUTE format(
        'UPDATE %I SET deleted_at = NOW(), deleted_by = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING TRUE',
        p_table_name
    ) INTO v_result USING p_deleted_by, p_id;
    
    RETURN COALESCE(v_result, FALSE);
END;
$_$;


ALTER FUNCTION "public"."soft_delete"("p_table_name" "text", "p_id" "uuid", "p_deleted_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_role_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_role_names TEXT[];
BEGIN
  -- Determine which user was affected
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- Collect all current role names for that user
  SELECT ARRAY_AGG(r.name ORDER BY r.name)
  INTO v_role_names
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = v_user_id;

  v_role_names := COALESCE(v_role_names, ARRAY['customer']::TEXT[]);

  -- Write back to the denormalized columns
  -- roles[] gets the full set; role gets the "primary" role by priority
  UPDATE users
  SET
    roles = v_role_names,
    role  = COALESCE(
      -- Priority order: super_admin > admin > manager > *_admin > *_staff > customer > guest
      (SELECT name FROM unnest(v_role_names) AS name
       ORDER BY
         CASE name
           WHEN 'super_admin' THEN 1
           WHEN 'admin'       THEN 2
           WHEN 'manager'     THEN 3
           ELSE 4
         END,
         name
       LIMIT 1),
      'customer'
    )
  WHERE id = v_user_id;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_user_role_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_checkout_housekeeping"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_new_status TEXT;
  v_old_status TEXT;
  v_unit_id UUID;
  v_booking_id UUID;
BEGIN
  v_new_status := COALESCE(to_jsonb(NEW)->>'status', '');
  v_old_status := COALESCE(to_jsonb(OLD)->>'status', '');
  v_unit_id := COALESCE(
    NULLIF(to_jsonb(NEW)->>'unit_id', '')::UUID,
    NULLIF(to_jsonb(NEW)->>'accommodation_unit_id', '')::UUID
  );
  v_booking_id := NULLIF(to_jsonb(NEW)->>'id', '')::UUID;

  -- Only trigger when booking status changes to 'checked_out'
  IF v_new_status = 'checked_out' AND v_old_status IS DISTINCT FROM 'checked_out' AND v_unit_id IS NOT NULL THEN
    -- Update unit status to dirty
    UPDATE accommodation_units 
    SET cleaning_status = 'dirty', updated_at = NOW()
    WHERE id = v_unit_id;
    
    -- Create turnover task
    INSERT INTO housekeeping_tasks (
      unit_id, task_type, priority, status, 
      notes, booking_id, created_at
    ) VALUES (
      v_unit_id, 'turnover', 'high', 'pending',
      'Auto-generated from checkout', v_booking_id, NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_checkout_housekeeping"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_channel_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_channel_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_currency_last_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.exchange_rate <> OLD.exchange_rate THEN
    NEW.last_updated = NOW();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_currency_last_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_device_tokens_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_device_tokens_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_kiosk_heartbeat"("p_kiosk_id" "uuid", "p_status" character varying DEFAULT 'online'::character varying, "p_error" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE kiosk_devices
  SET 
    status = p_status,
    last_heartbeat = NOW(),
    last_error = COALESCE(p_error, last_error),
    error_count = CASE WHEN p_error IS NOT NULL THEN error_count + 1 ELSE error_count END,
    updated_at = NOW()
  WHERE id = p_kiosk_id;
END;
$$;


ALTER FUNCTION "public"."update_kiosk_heartbeat"("p_kiosk_id" "uuid", "p_status" character varying, "p_error" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_loyalty_account"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE loyalty_members SET
        tier_id = NEW.tier_id,
        total_points = NEW.total_points,
        available_points = NEW.available_points,
        lifetime_points = NEW.lifetime_points,
        last_activity = NEW.last_activity,
        updated_at = NOW()
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_loyalty_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_manager_approvals_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_manager_approvals_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notification_templates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_notification_templates_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_plans_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_plans_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_properties_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_properties_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_review_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_review_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_service_locations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_service_locations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_staff_shifts_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_staff_shifts_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tenant_integrations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tenant_integrations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tenants_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tenants_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_property_access"("user_uuid" "uuid", "property_uuid" "text", "required_level" character varying DEFAULT 'read'::character varying) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN user_has_property_access(user_uuid, property_uuid::UUID, required_level);
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."user_has_property_access"("user_uuid" "uuid", "property_uuid" "text", "required_level" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_property_access"("user_uuid" "uuid", "property_uuid" "uuid", "required_level" character varying DEFAULT 'read'::character varying) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    has_access BOOLEAN;
    u_scope user_scope;
BEGIN
    -- Check user scope (platform admins bypass check)
    SELECT scope INTO u_scope FROM users WHERE id = user_uuid;
    IF u_scope IN ('super_admin', 'platform_admin') THEN
        RETURN TRUE;
    END IF;

    -- Check direct property access
    SELECT EXISTS (
        SELECT 1 FROM user_property_access upa
        WHERE upa.user_id = user_uuid
        AND upa.property_id = property_uuid
        AND (upa.expires_at IS NULL OR upa.expires_at > NOW())
        AND (
            upa.access_level = required_level
            OR upa.access_level = 'admin'
            OR (required_level = 'read' AND upa.access_level IN ('write', 'manage'))
            OR (required_level = 'write' AND upa.access_level = 'manage')
        )
    ) INTO has_access;
    
    IF has_access THEN
        RETURN TRUE;
    END IF;

    -- Check group-level access
    SELECT EXISTS (
        SELECT 1 FROM user_group_access uga
        JOIN properties p ON p.group_id = uga.group_id
        WHERE uga.user_id = user_uuid
        AND p.id = property_uuid
        AND (uga.expires_at IS NULL OR uga.expires_at > NOW())
    ) INTO has_access;

    RETURN has_access;
END;
$$;


ALTER FUNCTION "public"."user_has_property_access"("user_uuid" "uuid", "property_uuid" "uuid", "required_level" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_role"("role_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  check_role text;
BEGIN
  -- Normalise super_admin → admin for legacy callers
  check_role := CASE WHEN role_name = 'super_admin' THEN 'admin' ELSE role_name END;

  -- Fast path: check JWT user_metadata
  IF (auth.jwt() -> 'user_metadata' ->> 'role') IS NOT NULL THEN
    IF (auth.jwt() -> 'user_metadata' ->> 'role') = check_role THEN RETURN true; END IF;
    IF check_role = 'admin' AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin' THEN RETURN true; END IF;
  END IF;

  -- Authoritative path: check user_roles junction table
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND (
        r.name = check_role
        OR (check_role = 'admin' AND r.name = 'super_admin')
      )
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  );
END;
$$;


ALTER FUNCTION "public"."user_has_role"("role_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_has_role"("role_name" "text") IS 'RLS helper — returns true when the calling user holds the given role. Checks auth.jwt() metadata first (fast), then queries user_roles junction table. Updated 2026-04-24: authoritative fallback is now user_roles, not users.role.';



CREATE OR REPLACE FUNCTION "public"."user_has_tenant_access"("user_uuid" "uuid", "tenant_uuid" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN user_has_tenant_access(user_uuid, tenant_uuid::UUID);
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."user_has_tenant_access"("user_uuid" "uuid", "tenant_uuid" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_tenant_access"("user_uuid" "uuid", "tenant_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    u_scope user_scope;
    u_tenant_id UUID;
BEGIN
    -- Get user's scope and tenant_id
    SELECT scope, tenant_id INTO u_scope, u_tenant_id FROM users WHERE id = user_uuid;
    
    -- Platform admins can access any tenant
    IF u_scope IN ('super_admin', 'platform_admin') THEN
        RETURN TRUE;
    END IF;
    
    -- Tenant users can only access their own tenant
    RETURN u_tenant_id = tenant_uuid;
END;
$$;


ALTER FUNCTION "public"."user_has_tenant_access"("user_uuid" "uuid", "tenant_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_coupon_with_stacking"("p_code" character varying, "p_user_id" "uuid", "p_order_subtotal" numeric, "p_existing_coupons" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_coupon RECORD;
    v_usage_count INT;
    v_user_usage INT;
    v_is_first_order BOOLEAN;
BEGIN
    SELECT * INTO v_coupon FROM coupons 
    WHERE UPPER(code) = UPPER(p_code) AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon not found');
    END IF;
    
    IF v_coupon.start_date IS NOT NULL AND NOW() < v_coupon.start_date THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon not yet active');
    END IF;
    IF v_coupon.end_date IS NOT NULL AND NOW() > v_coupon.end_date THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon expired');
    END IF;
    
    SELECT COUNT(*) INTO v_usage_count FROM coupon_usage WHERE coupon_id = v_coupon.id;
    IF v_coupon.usage_limit IS NOT NULL AND v_usage_count >= v_coupon.usage_limit THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Coupon usage limit reached');
    END IF;
    
    IF p_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_user_usage FROM coupon_usage 
        WHERE coupon_id = v_coupon.id AND user_id = p_user_id;
        IF v_coupon.per_user_limit IS NOT NULL AND v_user_usage >= v_coupon.per_user_limit THEN
            RETURN jsonb_build_object('valid', false, 'error', 'You have already used this coupon');
        END IF;
    END IF;
    
    IF v_coupon.min_spend IS NOT NULL AND p_order_subtotal < v_coupon.min_spend THEN
        RETURN jsonb_build_object('valid', false, 'error', 
            format('Minimum spend of %s required', v_coupon.min_spend));
    END IF;
    
    -- First order check uses transactions table
    IF v_coupon.first_order_only AND p_user_id IS NOT NULL THEN
        SELECT NOT EXISTS(
            SELECT 1 FROM transactions
            WHERE customer_id = p_user_id
              AND engine_type = 'instant_transaction'
              AND status = 'completed'
        ) INTO v_is_first_order;
        IF NOT v_is_first_order THEN
            RETURN jsonb_build_object('valid', false, 'error', 'This coupon is for first orders only');
        END IF;
    END IF;
    
    IF array_length(p_existing_coupons, 1) > 0 THEN
        IF NOT v_coupon.stackable THEN
            RETURN jsonb_build_object('valid', false, 'error', 'This coupon cannot be combined with other coupons');
        END IF;
        IF EXISTS(SELECT 1 FROM coupons WHERE id = ANY(p_existing_coupons) AND NOT stackable) THEN
            RETURN jsonb_build_object('valid', false, 'error', 'Cannot add coupon - existing coupon is not stackable');
        END IF;
    END IF;
    
    DECLARE
        v_discount DECIMAL;
    BEGIN
        IF v_coupon.discount_type = 'percentage' THEN
            v_discount := p_order_subtotal * (v_coupon.discount_value / 100);
            IF v_coupon.max_discount IS NOT NULL THEN
                v_discount := LEAST(v_discount, v_coupon.max_discount);
            END IF;
        ELSE
            v_discount := LEAST(v_coupon.discount_value, p_order_subtotal);
        END IF;
        
        RETURN jsonb_build_object(
            'valid', true,
            'coupon_id', v_coupon.id,
            'code', v_coupon.code,
            'discount_type', v_coupon.discount_type,
            'discount_value', v_coupon.discount_value,
            'calculated_discount', v_discount,
            'stackable', v_coupon.stackable,
            'stack_priority', v_coupon.stack_priority
        );
    END;
END;
$$;


ALTER FUNCTION "public"."validate_coupon_with_stacking"("p_code" character varying, "p_user_id" "uuid", "p_order_subtotal" numeric, "p_existing_coupons" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_customizations"("p_entity_type" "public"."customizable_entity_type", "p_entity_id" "uuid", "p_selections" "jsonb") RETURNS TABLE("is_valid" boolean, "total_price_adjustment" numeric, "validated_selections" "jsonb", "validation_errors" "text"[])
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_selection JSONB;
    v_option RECORD;
    v_group RECORD;
    v_total DECIMAL(10,2) := 0;
    v_validated JSONB := '[]'::JSONB;
    v_errors TEXT[] := '{}';
    v_group_counts JSONB := '{}';
    v_price_multiplier DECIMAL(10,4);
    v_is_valid BOOLEAN := true;
BEGIN
    -- Process each selection
    FOR v_selection IN SELECT * FROM jsonb_array_elements(COALESCE(p_selections, '[]'::JSONB))
    LOOP
        -- Get option details with group info
        SELECT 
            co.*,
            cg.name as group_name,
            cg.selection_mode,
            cg.min_selections,
            cg.max_selections,
            cg.is_required,
            COALESCE(ec.price_multiplier, 1.0) as price_multiplier,
            COALESCE(ec.min_selections_override, cg.min_selections) as effective_min,
            COALESCE(ec.max_selections_override, cg.max_selections) as effective_max,
            COALESCE(ec.is_required_override, cg.is_required) as effective_required
        INTO v_option
        FROM customization_options co
        JOIN customization_groups cg ON co.group_id = cg.id
        LEFT JOIN entity_customizations ec ON ec.customization_group_id = cg.id
            AND ec.entity_type = p_entity_type
            AND ec.entity_id = p_entity_id
        WHERE co.id = (v_selection->>'optionId')::UUID
        AND co.is_available = true
        AND co.deleted_at IS NULL
        AND cg.deleted_at IS NULL;

        IF v_option IS NULL THEN
            v_errors := array_append(v_errors, 'Option not found or unavailable: ' || (v_selection->>'optionId'));
            v_is_valid := false;
            CONTINUE;
        END IF;

        -- Check stock availability
        IF v_option.available_stock IS NOT NULL AND v_option.available_stock < COALESCE((v_selection->>'quantity')::INT, 1) THEN
            v_errors := array_append(v_errors, 'Insufficient stock for: ' || v_option.name);
            v_is_valid := false;
            CONTINUE;
        END IF;

        -- Check per-option quantity bounds (NEW: was never enforced server-side)
        IF COALESCE((v_selection->>'quantity')::INT, 1) < 1 THEN
            v_errors := array_append(v_errors, 'Invalid quantity for: ' || v_option.name);
            v_is_valid := false;
            CONTINUE;
        END IF;
        IF COALESCE((v_selection->>'quantity')::INT, 1) > v_option.max_quantity THEN
            v_errors := array_append(v_errors, v_option.name || ' allows at most ' || v_option.max_quantity || ' per selection');
            v_is_valid := false;
            CONTINUE;
        END IF;

        -- Calculate price adjustment based on type
        DECLARE
            v_qty INT := COALESCE((v_selection->>'quantity')::INT, 1);
            v_price DECIMAL(10,2);
        BEGIN
            IF v_option.customization_type IN ('add', 'upgrade', 'swap') THEN
                v_price := v_option.price_adjustment * v_option.price_multiplier * v_qty;
                v_total := v_total + v_price;
            ELSIF v_option.customization_type = 'remove' THEN
                -- Remove type can have negative price (discount) or zero
                v_price := LEAST(v_option.price_adjustment * v_option.price_multiplier, 0) * v_qty;
                v_total := v_total + v_price;
            END IF;
        END;

        -- Build validated selection object
        v_validated := v_validated || jsonb_build_object(
            'groupId', v_option.group_id,
            'groupName', v_option.group_name,
            'optionId', v_option.id,
            'optionName', v_option.name,
            'customizationType', v_option.customization_type,
            'quantity', COALESCE((v_selection->>'quantity')::INT, 1),
            'unitPrice', v_option.price_adjustment * v_option.price_multiplier,
            'totalPrice', v_option.price_adjustment * v_option.price_multiplier * COALESCE((v_selection->>'quantity')::INT, 1),
            'inventoryItemId', v_option.inventory_item_id,
            'quantityPerSelection', v_option.quantity_per_selection,
            'replacesInventoryItemId', v_option.replaces_inventory_item_id
        );

        -- Track group counts for validation
        v_group_counts := jsonb_set(
            v_group_counts,
            ARRAY[v_option.group_id::TEXT],
            to_jsonb(COALESCE((v_group_counts->>v_option.group_id::TEXT)::INT, 0) + COALESCE((v_selection->>'quantity')::INT, 1))
        );
    END LOOP;

    -- Validate group requirements
    FOR v_group IN 
        SELECT DISTINCT
            cg.id,
            cg.name,
            COALESCE(ec.min_selections_override, cg.min_selections) as min_selections,
            COALESCE(ec.max_selections_override, cg.max_selections) as max_selections,
            COALESCE(ec.is_required_override, cg.is_required) as is_required
        FROM customization_groups cg
        LEFT JOIN entity_customizations ec ON ec.customization_group_id = cg.id
            AND ec.entity_type = p_entity_type
            AND ec.entity_id = p_entity_id
            AND ec.is_enabled = true
        WHERE cg.deleted_at IS NULL
        AND cg.is_available = true
        AND (ec.id IS NOT NULL OR (cg.is_global = true AND p_entity_type = ANY(cg.applicable_entity_types)))
    LOOP
        DECLARE
            v_count INT := COALESCE((v_group_counts->>v_group.id::TEXT)::INT, 0);
        BEGIN
            IF v_group.is_required AND v_count = 0 THEN
                v_errors := array_append(v_errors, 'Required selection missing: ' || v_group.name);
                v_is_valid := false;
            ELSIF v_count > 0 AND v_count < v_group.min_selections THEN
                v_errors := array_append(v_errors, v_group.name || ' requires at least ' || v_group.min_selections || ' selection(s)');
                v_is_valid := false;
            ELSIF v_count > v_group.max_selections THEN
                v_errors := array_append(v_errors, v_group.name || ' allows at most ' || v_group.max_selections || ' selection(s)');
                v_is_valid := false;
            END IF;
        END;
    END LOOP;

    RETURN QUERY SELECT v_is_valid, v_total, v_validated, v_errors;
END;
$$;


ALTER FUNCTION "public"."validate_customizations"("p_entity_type" "public"."customizable_entity_type", "p_entity_id" "uuid", "p_selections" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_customizations"("p_entity_type" "public"."customizable_entity_type", "p_entity_id" "uuid", "p_selections" "jsonb") IS 'Validate selections, check availability, calculate prices';



CREATE TABLE IF NOT EXISTS "public"."accommodation_add_ons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid",
    "name" character varying(255) NOT NULL,
    "name_ar" character varying(255),
    "name_fr" character varying(255),
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "price_type" character varying(20) DEFAULT 'one_time'::character varying NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "accommodation_add_ons_price_type_check" CHECK ((("price_type")::"text" = ANY ((ARRAY['one_time'::character varying, 'per_night'::character varying])::"text"[])))
);


ALTER TABLE "public"."accommodation_add_ons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accommodation_unit_price_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "unit_id" "uuid",
    "name" "text",
    "start_date" "date",
    "end_date" "date",
    "price" numeric(10,2),
    "price_multiplier" numeric(3,2),
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "base_price" numeric(10,2),
    "min_guests" integer,
    "max_guests" integer,
    "weekend_price" numeric(10,2),
    "holiday_price" numeric(10,2),
    "per_guest_price" numeric(10,2),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."accommodation_unit_price_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accommodation_units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "price" numeric(10,2),
    "base_price" numeric(10,2),
    "weekend_price" numeric(10,2),
    "capacity" integer DEFAULT 2,
    "size_sqm" numeric(10,2),
    "amenities" "jsonb" DEFAULT '[]'::"jsonb",
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "module_id" "uuid",
    "clean_state" character varying(30) DEFAULT 'clean'::character varying,
    "last_cleaned_at" timestamp with time zone,
    "last_inspected_at" timestamp with time zone,
    "maintenance_notes" "text",
    "cleaning_status" character varying(30) DEFAULT 'clean'::character varying,
    "is_blocked" boolean DEFAULT false,
    "block_reason" "text",
    "blocked_until" "date",
    "last_cleaned" timestamp with time zone,
    "last_inspected" timestamp with time zone,
    "name_ar" "text",
    "name_fr" "text",
    "description_ar" "text",
    "description_fr" "text",
    "bedroom_count" integer,
    "bathroom_count" integer,
    "is_featured" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "image_url" "text",
    "discount_price" numeric(10,2),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "accommodation_units_clean_state_check" CHECK ((("clean_state")::"text" = ANY ((ARRAY['clean'::character varying, 'dirty'::character varying, 'cleaning'::character varying, 'inspected'::character varying, 'out_of_service'::character varying, 'blocked'::character varying])::"text"[])))
);


ALTER TABLE "public"."accommodation_units" OWNER TO "postgres";


COMMENT ON COLUMN "public"."accommodation_units"."deleted_at" IS 'Soft delete timestamp - NULL means not deleted';



CREATE TABLE IF NOT EXISTS "public"."alert_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "alert_type" "text" NOT NULL,
    "kpi_code" "text" NOT NULL,
    "condition" "jsonb" DEFAULT '{"value": 0, "operator": ">"}'::"jsonb" NOT NULL,
    "schedule" "jsonb" DEFAULT '{"frequency": "realtime"}'::"jsonb" NOT NULL,
    "severity" "text" NOT NULL,
    "notification_channels" "jsonb" DEFAULT '[{"type": "in_app", "target": ""}]'::"jsonb" NOT NULL,
    "cooldown_minutes" integer DEFAULT 30 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "alert_definitions_alert_type_check" CHECK (("alert_type" = ANY (ARRAY['threshold'::"text", 'deviation'::"text", 'anomaly'::"text", 'trend'::"text"]))),
    CONSTRAINT "alert_definitions_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."alert_definitions" OWNER TO "postgres";


COMMENT ON TABLE "public"."alert_definitions" IS 'Alert threshold definitions for KPI monitoring';



CREATE TABLE IF NOT EXISTS "public"."alert_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alert_definition_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "triggered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "acknowledged_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "acknowledged_by" "uuid",
    "metric_value" numeric NOT NULL,
    "threshold_value" numeric NOT NULL,
    "context" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "severity" "text" NOT NULL,
    "notifications_sent" "jsonb" DEFAULT '[]'::"jsonb",
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "alert_history_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'critical'::"text"]))),
    CONSTRAINT "alert_history_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'acknowledged'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."alert_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."alert_history" IS 'Historical record of triggered alerts';



CREATE TABLE IF NOT EXISTS "public"."app_permissions" (
    "slug" character varying(255) NOT NULL,
    "description" "text",
    "module_slug" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."app_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_role_permissions" (
    "role_name" character varying(50) NOT NULL,
    "permission_slug" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."app_role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "resource" "text",
    "resource_id" "text",
    "new_value" "jsonb",
    "old_value" "jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "entity_id" "text",
    "entity_type" "text",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "user_agent" "text",
    "property_id" "uuid",
    "tenant_id" "uuid"
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."backups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "filename" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "size_bytes" bigint,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "checksum" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "backups_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "backups_type_check" CHECK (("type" = ANY (ARRAY['manual'::"text", 'scheduled'::"text"])))
);


ALTER TABLE "public"."backups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."billing_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "amount" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'usd'::"text" NOT NULL,
    "status" "text" NOT NULL,
    "stripe_event_id" "text",
    "stripe_invoice_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."billing_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."billing_history" IS 'Append-only ledger of billable Stripe events per tenant, written by saas-webhook.controller.ts. Backs the platform-admin tenant detail "Billing History" card.';



CREATE TABLE IF NOT EXISTS "public"."biometric_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credential_id" "text" NOT NULL,
    "public_key" "text" NOT NULL,
    "counter" bigint DEFAULT 0 NOT NULL,
    "device_type" "text",
    "device_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."biometric_credentials" OWNER TO "postgres";


COMMENT ON TABLE "public"."biometric_credentials" IS 'Stores WebAuthn/passkey credentials for biometric authentication';



COMMENT ON COLUMN "public"."biometric_credentials"."credential_id" IS 'Base64 encoded credential ID from WebAuthn';



COMMENT ON COLUMN "public"."biometric_credentials"."public_key" IS 'Base64 encoded public key from WebAuthn';



COMMENT ON COLUMN "public"."biometric_credentials"."counter" IS 'Signature counter for replay attack prevention';



COMMENT ON COLUMN "public"."biometric_credentials"."device_type" IS 'Type of biometric: face_id, touch_id, fingerprint, security_key';



CREATE OR REPLACE VIEW "public"."bookable_units" AS
 SELECT "id",
    "name",
    "description",
    "base_price",
    "base_price" AS "price",
    "weekend_price",
    "capacity",
    "is_active",
    "deleted_at",
    "module_id",
    "created_at",
    "updated_at"
   FROM "public"."accommodation_units";


ALTER VIEW "public"."bookable_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "unit_id" "uuid",
    "rating" integer NOT NULL,
    "text" "text" NOT NULL,
    "cleanliness_rating" integer,
    "location_rating" integer,
    "value_rating" integer,
    "service_rating" integer,
    "is_approved" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "booking_reviews_cleanliness_rating_check" CHECK ((("cleanliness_rating" >= 1) AND ("cleanliness_rating" <= 5))),
    CONSTRAINT "booking_reviews_location_rating_check" CHECK ((("location_rating" >= 1) AND ("location_rating" <= 5))),
    CONSTRAINT "booking_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "booking_reviews_service_rating_check" CHECK ((("service_rating" >= 1) AND ("service_rating" <= 5))),
    CONSTRAINT "booking_reviews_value_rating_check" CHECK ((("value_rating" >= 1) AND ("value_rating" <= 5)))
);


ALTER TABLE "public"."booking_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_sends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid",
    "journey_id" "uuid",
    "enrollment_id" "uuid",
    "guest_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "email_address" "text" NOT NULL,
    "subject" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "opened_at" timestamp with time zone,
    "clicked_at" timestamp with time zone,
    "bounced_at" timestamp with time zone,
    "bounce_reason" "text",
    "external_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "campaign_sends_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'delivered'::"text", 'opened'::"text", 'clicked'::"text", 'bounced'::"text", 'failed'::"text", 'unsubscribed'::"text"])))
);


ALTER TABLE "public"."campaign_sends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cancellation_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_type" character varying(50) NOT NULL,
    "days_before_checkin" integer NOT NULL,
    "refund_percentage" integer NOT NULL,
    "refund_type" character varying(20) DEFAULT 'FULL'::character varying NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."cancellation_policies" OWNER TO "postgres";


COMMENT ON TABLE "public"."cancellation_policies" IS 'Configurable cancellation and refund policies';



CREATE TABLE IF NOT EXISTS "public"."capacity_windows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255),
    "capacity" integer,
    "price" numeric(10,2),
    "is_active" boolean DEFAULT true,
    "module_id" "uuid",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "max_capacity" integer,
    "adult_price" numeric(10,2),
    "child_price" numeric(10,2),
    "gender_restriction" character varying(20),
    "date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "personal_duration_minutes" integer,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."capacity_windows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cash_drawers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "device_id" "text",
    "opened_by_user_id" "uuid",
    "closed_by_user_id" "uuid",
    "opened_at" timestamp with time zone DEFAULT "now"(),
    "closed_at" timestamp with time zone,
    "starting_balance" numeric(10,2) DEFAULT 0,
    "current_balance" numeric(10,2) DEFAULT 0,
    "ending_balance" numeric(10,2),
    "discrepancy" numeric(10,2),
    "status" "text" DEFAULT 'open'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."cash_drawers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cash_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "drawer_id" "uuid",
    "user_id" "uuid",
    "order_id" "uuid",
    "type" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "reason_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."cash_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "module_id" "uuid",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "name_ar" "text",
    "name_fr" "text",
    "display_order" integer DEFAULT 0,
    "image_url" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."catalog_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "price" numeric(10,2),
    "image_url" "text",
    "is_available" boolean DEFAULT true,
    "is_vegetarian" boolean DEFAULT false,
    "is_spicy" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "name_ar" "text",
    "name_fr" "text",
    "description_ar" "text",
    "description_fr" "text",
    "preparation_time_minutes" integer,
    "calories" integer,
    "is_vegan" boolean DEFAULT false,
    "is_gluten_free" boolean DEFAULT false,
    "is_dairy_free" boolean DEFAULT false,
    "is_halal" boolean DEFAULT false,
    "allergens" "jsonb" DEFAULT '[]'::"jsonb",
    "is_featured" boolean DEFAULT false,
    "discount_price" numeric(10,2),
    "display_order" integer DEFAULT 0,
    "module_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "category" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."catalog_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."catalog_items"."module_id" IS 'Reference to the dynamic module this item belongs to (replaces category_id FK)';



COMMENT ON COLUMN "public"."catalog_items"."tenant_id" IS 'Tenant ownership for multi-tenant isolation';



COMMENT ON COLUMN "public"."catalog_items"."property_id" IS 'Property scoping for property-level access control';



COMMENT ON COLUMN "public"."catalog_items"."metadata" IS 'Flexible JSONB storage for module-specific attributes (e.g., name_ar, description_ar, image_url, is_featured, etc.)';



CREATE TABLE IF NOT EXISTS "public"."channel_availability_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid",
    "room_mapping_id" "uuid",
    "date" "date" NOT NULL,
    "available_units" integer NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."channel_availability_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "channel_code" character varying(50) NOT NULL,
    "channel_name" character varying(100) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "api_key" "text",
    "api_secret" "text",
    "hotel_code" character varying(100),
    "connection_type" character varying(20) DEFAULT 'siteminder'::character varying,
    "siteminder_property_id" character varying(100),
    "last_sync_at" timestamp with time zone,
    "last_error" "text",
    "error_count" integer DEFAULT 0,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."channel_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_rate_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid",
    "rate_plan_id" "uuid",
    "channel_rate_code" character varying(100) NOT NULL,
    "channel_rate_name" character varying(255),
    "is_active" boolean DEFAULT true,
    "markup_type" character varying(20) DEFAULT 'percentage'::character varying,
    "markup_value" numeric(10,2) DEFAULT 0,
    "commission_rate" numeric(5,2),
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."channel_rate_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_rate_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid",
    "rate_mapping_id" "uuid",
    "room_mapping_id" "uuid",
    "date" "date" NOT NULL,
    "rate" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "min_stay" integer,
    "max_stay" integer,
    "closed" boolean DEFAULT false,
    "closed_arrival" boolean DEFAULT false,
    "closed_departure" boolean DEFAULT false,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."channel_rate_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid",
    "reservation_id" "uuid",
    "channel_booking_ref" character varying(100) NOT NULL,
    "channel_guest_id" character varying(100),
    "guest_name" character varying(255),
    "guest_email" character varying(255),
    "guest_phone" character varying(50),
    "check_in" "date" NOT NULL,
    "check_out" "date" NOT NULL,
    "room_mapping_id" "uuid",
    "rate_mapping_id" "uuid",
    "num_adults" integer DEFAULT 1,
    "num_children" integer DEFAULT 0,
    "total_amount" numeric(10,2),
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "commission_amount" numeric(10,2),
    "payment_status" character varying(20),
    "booking_status" character varying(20) NOT NULL,
    "special_requests" "text",
    "raw_data" "jsonb",
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone,
    "error_message" "text",
    "received_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."channel_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_room_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid",
    "room_type_id" "uuid",
    "channel_room_code" character varying(100) NOT NULL,
    "channel_room_name" character varying(255),
    "is_active" boolean DEFAULT true,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."channel_room_mappings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "connection_id" "uuid",
    "sync_type" character varying(50) NOT NULL,
    "direction" character varying(10) NOT NULL,
    "status" character varying(20) NOT NULL,
    "records_processed" integer DEFAULT 0,
    "records_failed" integer DEFAULT 0,
    "duration_ms" integer,
    "error_message" "text",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."channel_sync_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chargebacks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "stripe_dispute_id" "text" NOT NULL,
    "stripe_charge_id" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" character(3) DEFAULT 'EUR'::"bpchar" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "public"."chargeback_status" DEFAULT 'needs_response'::"public"."chargeback_status" NOT NULL,
    "evidence_submitted" "jsonb",
    "due_date" timestamp with time zone NOT NULL,
    "outcome" "public"."chargeback_outcome",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."chargebacks" OWNER TO "postgres";


COMMENT ON TABLE "public"."chargebacks" IS 'Stores Stripe dispute and chargeback records for payment disputes';



CREATE TABLE IF NOT EXISTS "public"."chatbot_intents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "trigger_phrases" "text"[] DEFAULT '{}'::"text"[],
    "response_type" "text" DEFAULT 'text'::"text",
    "response_content" "text",
    "template_id" "uuid",
    "action_type" "text",
    "action_config" "jsonb",
    "priority" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "chatbot_intents_response_type_check" CHECK (("response_type" = ANY (ARRAY['text'::"text", 'template'::"text", 'handoff'::"text", 'action'::"text"])))
);


ALTER TABLE "public"."chatbot_intents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitor_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "competitor_name" "text" NOT NULL,
    "competitor_id" "text",
    "rate_date" "date" NOT NULL,
    "room_type" "text",
    "rate" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text",
    "source" "text",
    "scraped_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."competitor_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "guest_id" "uuid",
    "booking_id" "uuid",
    "channel_type" "text" NOT NULL,
    "external_id" "text",
    "status" "text" DEFAULT 'open'::"text",
    "priority" "text" DEFAULT 'normal'::"text",
    "assigned_to" "uuid",
    "subject" "text",
    "message_count" integer DEFAULT 0,
    "unread_count" integer DEFAULT 0,
    "last_message_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "conversations_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "conversations_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'pending'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coupon_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coupon_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "order_id" "uuid",
    "discount_applied" numeric(10,2) NOT NULL,
    "used_at" timestamp with time zone DEFAULT "now"(),
    "ip_address" "inet",
    "device_fingerprint" character varying(255),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."coupon_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coupons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(50) NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "discount_type" character varying(20) NOT NULL,
    "discount_value" numeric(10,2) NOT NULL,
    "min_order_amount" numeric(10,2) DEFAULT 0,
    "max_discount_amount" numeric(10,2),
    "specific_items" "jsonb" DEFAULT '[]'::"jsonb",
    "usage_limit" integer,
    "usage_count" integer DEFAULT 0,
    "per_user_limit" integer DEFAULT 1,
    "is_active" boolean DEFAULT true,
    "valid_from" timestamp with time zone DEFAULT "now"(),
    "valid_until" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stackable" boolean DEFAULT false,
    "stack_priority" integer DEFAULT 0,
    "first_order_only" boolean DEFAULT false,
    "min_items" integer DEFAULT 1,
    "eligible_tiers" "text"[],
    "excluded_items" "uuid"[],
    "category_scope" "text",
    "service_scope" "text" DEFAULT 'all'::"text",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "applies_to" character varying(50) DEFAULT 'all'::character varying,
    CONSTRAINT "coupons_discount_type_check" CHECK ((("discount_type")::"text" = ANY ((ARRAY['percentage'::character varying, 'fixed_amount'::character varying, 'free_item'::character varying])::"text"[])))
);


ALTER TABLE "public"."coupons" OWNER TO "postgres";


COMMENT ON COLUMN "public"."coupons"."deleted_at" IS 'Soft-delete timestamp. NULL = active record.';



CREATE TABLE IF NOT EXISTS "public"."currencies" (
    "code" character(3) NOT NULL,
    "symbol" character varying(10) NOT NULL,
    "name" character varying(100) NOT NULL,
    "name_ar" character varying(100),
    "name_fr" character varying(100),
    "exchange_rate" numeric(12,6) DEFAULT 1.000000 NOT NULL,
    "decimal_places" integer DEFAULT 2 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."currencies" OWNER TO "postgres";


COMMENT ON TABLE "public"."currencies" IS 'Stores supported currencies and their exchange rates relative to EUR';



CREATE TABLE IF NOT EXISTS "public"."customization_dual_write_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operation" "text" NOT NULL,
    "old_system_result" "jsonb",
    "new_system_result" "jsonb",
    "results_match" boolean,
    "discrepancies" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."customization_dual_write_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."customization_dual_write_log" IS 'Dual-write comparison log for migration validation';



CREATE TABLE IF NOT EXISTS "public"."customization_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "order_type" "text",
    "order_id" "uuid",
    "order_item_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone,
    "processing_error" "text",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."customization_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."customization_events" IS 'Event log for observability - price.calculated, inventory.warning, inventory.executed, inventory.reversed';



CREATE TABLE IF NOT EXISTS "public"."customization_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "name_ar" "text",
    "name_fr" "text",
    "description" "text",
    "description_ar" "text",
    "display_name" "text",
    "display_name_ar" "text",
    "icon" "text",
    "selection_mode" "text" DEFAULT 'single'::"text" NOT NULL,
    "min_selections" integer DEFAULT 0,
    "max_selections" integer DEFAULT 1,
    "is_required" boolean DEFAULT false,
    "applicable_entity_types" "public"."customizable_entity_type"[] DEFAULT '{}'::"public"."customizable_entity_type"[],
    "is_global" boolean DEFAULT false,
    "is_available" boolean DEFAULT true,
    "available_from" time without time zone,
    "available_until" time without time zone,
    "available_days" integer[],
    "display_conditions" "jsonb" DEFAULT '{}'::"jsonb",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "customization_groups_selection_mode_check" CHECK (("selection_mode" = ANY (ARRAY['single'::"text", 'multiple'::"text", 'quantity'::"text"]))),
    CONSTRAINT "valid_selection_range" CHECK (("min_selections" <= "max_selections"))
);


ALTER TABLE "public"."customization_groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."customization_groups" IS 'Unified customization groups for all engine types';



CREATE TABLE IF NOT EXISTS "public"."customization_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "metric_name" "text" NOT NULL,
    "metric_value" numeric(10,3) NOT NULL,
    "dimensions" "jsonb" DEFAULT '{}'::"jsonb",
    "recorded_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."customization_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."customization_metrics" IS 'Performance metrics for monitoring validation and inventory processing latency';



CREATE OR REPLACE VIEW "public"."customization_metrics_summary" AS
 SELECT "metric_name",
    "count"(*) AS "sample_count",
    "avg"("metric_value") AS "avg_value",
    "min"("metric_value") AS "min_value",
    "max"("metric_value") AS "max_value",
    "percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY (("metric_value")::double precision)) AS "p50",
    "percentile_cont"((0.95)::double precision) WITHIN GROUP (ORDER BY (("metric_value")::double precision)) AS "p95",
    "percentile_cont"((0.99)::double precision) WITHIN GROUP (ORDER BY (("metric_value")::double precision)) AS "p99",
    "date_trunc"('hour'::"text", "recorded_at") AS "hour"
   FROM "public"."customization_metrics"
  WHERE ("recorded_at" > ("now"() - '24:00:00'::interval))
  GROUP BY "metric_name", ("date_trunc"('hour'::"text", "recorded_at"))
  ORDER BY ("date_trunc"('hour'::"text", "recorded_at")) DESC, "metric_name";


ALTER VIEW "public"."customization_metrics_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customization_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "name_ar" "text",
    "name_fr" "text",
    "description" "text",
    "description_ar" "text",
    "customization_type" "public"."customization_type" DEFAULT 'add'::"public"."customization_type" NOT NULL,
    "price_adjustment" numeric(10,2) DEFAULT 0,
    "price_type" "text" DEFAULT 'fixed'::"text",
    "inventory_item_id" "uuid",
    "quantity_per_selection" numeric(10,3) DEFAULT 1,
    "inventory_unit" "text" DEFAULT 'pcs'::"text",
    "replaces_inventory_item_id" "uuid",
    "max_quantity" integer DEFAULT 1,
    "quantity_increment" numeric(10,2) DEFAULT 1,
    "is_default" boolean DEFAULT false,
    "is_popular" boolean DEFAULT false,
    "badge_text" "text",
    "badge_color" "text",
    "image_url" "text",
    "is_available" boolean DEFAULT true,
    "available_stock" integer,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "customization_options_price_type_check" CHECK (("price_type" = ANY (ARRAY['fixed'::"text", 'percentage'::"text", 'per_unit'::"text", 'per_night'::"text", 'per_person'::"text"])))
);


ALTER TABLE "public"."customization_options" OWNER TO "postgres";


COMMENT ON TABLE "public"."customization_options" IS 'Individual customization options within groups';



CREATE TABLE IF NOT EXISTS "public"."dashboard_widgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "widget_type" "text" NOT NULL,
    "data_source" "text" NOT NULL,
    "query_config" "jsonb" DEFAULT '{}'::"jsonb",
    "display_config" "jsonb" DEFAULT '{}'::"jsonb",
    "position" "jsonb" DEFAULT '{"h": 3, "w": 4, "x": 0, "y": 0}'::"jsonb",
    "refresh_interval_seconds" integer DEFAULT 300,
    "is_visible" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."dashboard_widgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."demand_forecasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "room_type_id" "uuid",
    "forecast_date" "date" NOT NULL,
    "forecasted_demand" numeric(10,2) NOT NULL,
    "forecasted_occupancy" numeric(5,2),
    "forecasted_adr" numeric(10,2),
    "forecasted_revenue" numeric(12,2),
    "demand_low" numeric(10,2),
    "demand_high" numeric(10,2),
    "factors" "jsonb" DEFAULT '{}'::"jsonb",
    "model_version" "text",
    "actual_demand" integer,
    "actual_occupancy" numeric(5,2),
    "actual_adr" numeric(10,2),
    "actual_revenue" numeric(12,2),
    "forecast_accuracy" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."demand_forecasts" OWNER TO "postgres";


COMMENT ON TABLE "public"."demand_forecasts" IS 'Revenue management demand forecasting';



CREATE TABLE IF NOT EXISTS "public"."device_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_token" "text" NOT NULL,
    "platform" "public"."device_platform" NOT NULL,
    "device_id" "text",
    "device_name" "text",
    "app_version" "text",
    "os_version" "text",
    "is_active" boolean DEFAULT true,
    "last_used_at" timestamp with time zone DEFAULT "now"(),
    "notifications_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."device_tokens" OWNER TO "postgres";


COMMENT ON TABLE "public"."device_tokens" IS 'Stores FCM/APNS device tokens for mobile push notifications';



CREATE TABLE IF NOT EXISTS "public"."digital_signatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "registration_id" "uuid",
    "booking_id" "uuid",
    "guest_id" "uuid",
    "signature_type" "text" NOT NULL,
    "signature_data" "text" NOT NULL,
    "signature_format" "text" DEFAULT 'base64'::"text",
    "document_hash" "text",
    "document_version" "text",
    "ip_address" "text",
    "user_agent" "text",
    "device_info" "jsonb",
    "geolocation" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."digital_signatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_bounces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "bounce_type" "public"."bounce_type" NOT NULL,
    "bounce_subtype" "text",
    "reason" "text" NOT NULL,
    "provider_message_id" "text",
    "bounced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."email_bounces" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_bounces" IS 'Stores email bounce events for tracking and suppression management';



CREATE TABLE IF NOT EXISTS "public"."email_journeys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "trigger_type" "text" NOT NULL,
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb",
    "entry_segment_id" "uuid",
    "is_active" boolean DEFAULT false,
    "stats" "jsonb" DEFAULT '{"exited": 0, "enrolled": 0, "completed": 0}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."email_journeys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_suppression_list" (
    "email" "text" NOT NULL,
    "reason" "public"."suppression_reason" NOT NULL,
    "notes" "text",
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "added_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."email_suppression_list" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_suppression_list" IS 'Stores emails that should not receive marketing or transactional emails';



CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_name" character varying(100) NOT NULL,
    "subject" character varying(255) NOT NULL,
    "subject_ar" character varying(255),
    "subject_fr" character varying(255),
    "html_body" "text" NOT NULL,
    "html_body_ar" "text",
    "html_body_fr" "text",
    "text_body" "text",
    "variables" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_compensation_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tx_id" "text" NOT NULL,
    "step_name" "text" NOT NULL,
    "error_message" "text" NOT NULL,
    "status" "text" DEFAULT 'failed'::"text" NOT NULL,
    "requires_manual_review" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."engine_compensation_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "flag_name" "text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "rollout_percentage" integer DEFAULT 0,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "engine_feature_flags_rollout_percentage_check" CHECK ((("rollout_percentage" >= 0) AND ("rollout_percentage" <= 100)))
);


ALTER TABLE "public"."engine_feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_financial_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "module_id" "uuid" NOT NULL,
    "engine_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "subtotal" numeric(14,4) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(14,4) DEFAULT 0 NOT NULL,
    "tax_rate" numeric(8,6) DEFAULT 0 NOT NULL,
    "service_charge" numeric(14,4) DEFAULT 0 NOT NULL,
    "delivery_fee" numeric(14,4) DEFAULT 0 NOT NULL,
    "total_discount" numeric(14,4) DEFAULT 0 NOT NULL,
    "total_amount" numeric(14,4) DEFAULT 0 NOT NULL,
    "deposit_amount" numeric(14,4) DEFAULT 0 NOT NULL,
    "discount_breakdown" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "loyalty_points_earned" integer DEFAULT 0 NOT NULL,
    "loyalty_points_redeemed" integer DEFAULT 0 NOT NULL,
    "payment_method" "text",
    "payment_reference" "text",
    "idempotency_key" "text",
    "actor_type" "text" NOT NULL,
    "actor_id" "uuid",
    "entity_state_at_write" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "chk_ledger_nonneg_subtotal" CHECK (("subtotal" >= (0)::numeric)),
    CONSTRAINT "chk_ledger_nonneg_total" CHECK (("total_amount" >= (0)::numeric)),
    CONSTRAINT "chk_ledger_total_invariant" CHECK (("abs"(("total_amount" - GREATEST((0)::numeric, (((("subtotal" + "tax_amount") + "service_charge") + "delivery_fee") - "total_discount")))) < 0.03)),
    CONSTRAINT "engine_financial_ledger_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['system'::"text", 'staff'::"text", 'customer'::"text", 'admin'::"text"]))),
    CONSTRAINT "engine_financial_ledger_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['charge'::"text", 'refund'::"text", 'adjustment'::"text", 'void'::"text", 'deposit'::"text", 'deposit_release'::"text"])))
);


ALTER TABLE "public"."engine_financial_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_idempotency_keys" (
    "key" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "engine_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "action" "text" NOT NULL,
    "status" "text" NOT NULL,
    "result_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "engine_idempotency_keys_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."engine_idempotency_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_loyalty_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "engine_type" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "points" integer NOT NULL,
    "dollar_value" numeric(12,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "engine_loyalty_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['earn'::"text", 'redeem'::"text", 'void'::"text"])))
);


ALTER TABLE "public"."engine_loyalty_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."engine_state_transitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "module_id" "uuid" NOT NULL,
    "engine_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "previous_state" "text" NOT NULL,
    "new_state" "text" NOT NULL,
    "action" "text" NOT NULL,
    "actor_type" "text" NOT NULL,
    "actor_id" "uuid",
    "context" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "guards_evaluated" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "side_effects" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "transaction_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "chk_est_engine_type" CHECK (("engine_type" = ANY (ARRAY['instant_transaction'::"text", 'time_exclusive_reservation'::"text", 'shared_capacity_access'::"text", 'ongoing_entitlement'::"text", 'platform_entitlement'::"text"]))),
    CONSTRAINT "engine_state_transitions_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['system'::"text", 'staff'::"text", 'customer'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."engine_state_transitions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entity_customizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "public"."customizable_entity_type" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "customization_group_id" "uuid" NOT NULL,
    "is_required_override" boolean,
    "min_selections_override" integer,
    "max_selections_override" integer,
    "price_multiplier" numeric(10,4) DEFAULT 1.0,
    "is_enabled" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."entity_customizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."entity_customizations" IS 'Links customization groups to specific entities (catalog items, accommodation units, etc.)';



CREATE TABLE IF NOT EXISTS "public"."faqs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "question" "text" NOT NULL,
    "answer" "text" NOT NULL,
    "category" character varying(50),
    "sort_order" integer DEFAULT 0,
    "is_published" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."faqs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gdpr_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "consent_type" "text" NOT NULL,
    "granted" boolean DEFAULT false NOT NULL,
    "granted_at" timestamp with time zone,
    "withdrawn_at" timestamp with time zone,
    "source" "text",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "consent_version" "text",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."gdpr_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gdpr_cookie_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "consent_version" "text" NOT NULL,
    "categories_accepted" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "categories_rejected" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "ip_address_hash" "text",
    "user_agent" "text",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."gdpr_cookie_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gdpr_data_sharing_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "third_party" "text" NOT NULL,
    "purpose" "text",
    "data_shared" "text"[] DEFAULT '{}'::"text"[],
    "legal_basis" "text",
    "shared_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."gdpr_data_sharing_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gdpr_deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reason" "text",
    "rejection_reason" "text",
    "data_categories" "text"[] DEFAULT '{}'::"text"[],
    "retention_exceptions" "text"[] DEFAULT '{}'::"text"[],
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "gdpr_deletion_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'processing'::"text", 'completed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."gdpr_deletion_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gdpr_export_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_email" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "file_path" "text",
    "file_expires_at" timestamp with time zone,
    "error_message" "text",
    "ip_address" "text",
    "user_agent" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "downloaded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "gdpr_export_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'expired'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."gdpr_export_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."gdpr_export_requests" IS 'GDPR data export requests from users';



CREATE TABLE IF NOT EXISTS "public"."gdpr_processing_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "activity_type" "text" NOT NULL,
    "description" "text",
    "data_categories" "text"[] DEFAULT '{}'::"text"[],
    "legal_basis" "text",
    "ip_address" "text",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."gdpr_processing_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gdpr_retention_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data_category" "text" NOT NULL,
    "retention_period_days" integer NOT NULL,
    "legal_basis" "text" NOT NULL,
    "description" "text",
    "auto_delete" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."gdpr_retention_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gift_card_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gift_card_id" "uuid" NOT NULL,
    "entry_type" character varying(30) NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "liability_change" numeric(10,2) NOT NULL,
    "revenue_change" numeric(10,2) DEFAULT 0,
    "balance_after" numeric(10,2) NOT NULL,
    "reference_id" "uuid",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "gift_card_ledger_entry_type_check" CHECK ((("entry_type")::"text" = ANY ((ARRAY['issued'::character varying, 'redeemed'::character varying, 'refund'::character varying, 'expired'::character varying, 'breakage'::character varying, 'adjustment'::character varying])::"text"[])))
);


ALTER TABLE "public"."gift_card_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gift_card_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "image_url" "text",
    "background_color" character varying(7) DEFAULT '#4F46E5'::character varying,
    "text_color" character varying(7) DEFAULT '#FFFFFF'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."gift_card_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gift_card_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gift_card_id" "uuid" NOT NULL,
    "transaction_type" character varying(20) NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "balance_after" numeric(10,2) NOT NULL,
    "order_id" "uuid",
    "notes" "text",
    "performed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "gift_card_transactions_transaction_type_check" CHECK ((("transaction_type")::"text" = ANY ((ARRAY['purchase'::character varying, 'redemption'::character varying, 'refund'::character varying, 'adjustment'::character varying])::"text"[])))
);


ALTER TABLE "public"."gift_card_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gift_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(20) NOT NULL,
    "template_id" "uuid",
    "initial_value" numeric(10,2) NOT NULL,
    "current_balance" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "recipient_email" character varying(255),
    "recipient_name" character varying(255),
    "sender_name" character varying(255),
    "personal_message" "text",
    "purchased_by" "uuid",
    "expires_at" timestamp with time zone,
    "redeemed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "liability_recorded" boolean DEFAULT false,
    "revenue_recognized" numeric(10,2) DEFAULT 0,
    "breakage_recorded" numeric(10,2) DEFAULT 0,
    "is_physical" boolean DEFAULT false,
    "activated_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "gift_cards_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'used'::character varying, 'expired'::character varying, 'disabled'::character varying, 'pending'::character varying, 'redeemed'::character varying])::"text"[])))
);


ALTER TABLE "public"."gift_cards" OWNER TO "postgres";


COMMENT ON COLUMN "public"."gift_cards"."deleted_at" IS 'Soft-delete timestamp. NULL = active record.';



CREATE TABLE IF NOT EXISTS "public"."group_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "activity_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "performed_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."group_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "reservation_id" "uuid",
    "guest_name" "text" NOT NULL,
    "guest_email" "text",
    "guest_phone" "text",
    "room_type_id" "uuid",
    "check_in" "date" NOT NULL,
    "check_out" "date" NOT NULL,
    "special_requests" "text",
    "status" "text" DEFAULT 'confirmed'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "group_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'checked_in'::"text", 'checked_out'::"text", 'cancelled'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."group_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "contract_number" "text" NOT NULL,
    "terms" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "document_url" "text",
    "signed_at" timestamp with time zone,
    "signed_by" "text",
    "signature_data" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "group_contracts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'signed'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."group_contracts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "event_name" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "venue_id" "uuid",
    "venue_name" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "attendees" integer,
    "setup_requirements" "text",
    "equipment_needs" "text"[] DEFAULT '{}'::"text"[],
    "catering_required" boolean DEFAULT false,
    "estimated_cost" numeric(12,2),
    "status" "text" DEFAULT 'planned'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "group_events_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'confirmed'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."group_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "invoice_type" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "subtotal" numeric(12,2) NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0,
    "total_amount" numeric(12,2) NOT NULL,
    "paid_amount" numeric(12,2) DEFAULT 0,
    "due_date" "date" NOT NULL,
    "line_items" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "group_invoices_invoice_type_check" CHECK (("invoice_type" = ANY (ARRAY['deposit'::"text", 'interim'::"text", 'final'::"text", 'adjustment'::"text"]))),
    CONSTRAINT "group_invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'paid'::"text", 'partial'::"text", 'overdue'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."group_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "invoice_id" "uuid",
    "amount" numeric(12,2) NOT NULL,
    "payment_method" "text" NOT NULL,
    "reference_number" "text",
    "status" "text" DEFAULT 'completed'::"text",
    "processed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "group_payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."group_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_rate_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "base_rate_type" character varying(50) DEFAULT 'percentage'::character varying,
    "base_rate_value" numeric(10,2),
    "applies_to_properties" "uuid"[],
    "seasonal_adjustments" "jsonb",
    "day_of_week_adjustments" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."group_rate_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_report_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "report_type" character varying(100) NOT NULL,
    "report_name" character varying(255) NOT NULL,
    "include_properties" "uuid"[],
    "frequency" character varying(50) NOT NULL,
    "schedule_time" time without time zone DEFAULT '08:00:00'::time without time zone,
    "schedule_day_of_week" integer,
    "schedule_day_of_month" integer,
    "recipients" "text"[],
    "format" character varying(20) DEFAULT 'pdf'::character varying,
    "is_active" boolean DEFAULT true,
    "last_run_at" timestamp with time zone,
    "next_run_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."group_report_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "group_name" "text" NOT NULL,
    "group_code" "text" NOT NULL,
    "group_type" "text" NOT NULL,
    "status" "text" DEFAULT 'inquiry'::"text",
    "organizer_name" "text",
    "organizer_email" "text",
    "organizer_phone" "text",
    "company_name" "text",
    "arrival_date" "date" NOT NULL,
    "departure_date" "date" NOT NULL,
    "total_rooms" integer NOT NULL,
    "confirmed_rooms" integer DEFAULT 0,
    "cutoff_date" "date",
    "negotiated_rate" numeric(10,2),
    "contract_terms" "jsonb" DEFAULT '{}'::"jsonb",
    "special_requests" "text",
    "notes" "text",
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "group_reservations_status_check" CHECK (("status" = ANY (ARRAY['inquiry'::"text", 'tentative'::"text", 'definite'::"text", 'cancelled'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."group_reservations" OWNER TO "postgres";


COMMENT ON TABLE "public"."group_reservations" IS 'Group booking and event management';



CREATE TABLE IF NOT EXISTS "public"."group_room_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "room_type_id" "uuid" NOT NULL,
    "block_date" "date" NOT NULL,
    "blocked_count" integer NOT NULL,
    "picked_up" integer DEFAULT 0,
    "released" integer DEFAULT 0,
    "rate" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'held'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "group_room_blocks_status_check" CHECK (("status" = ANY (ARRAY['held'::"text", 'released'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."group_room_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "description" "text",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."group_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."group_settings" IS 'Group-wide setting defaults (medium priority)';



CREATE TABLE IF NOT EXISTS "public"."guest_messaging_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "sms_opt_in" boolean DEFAULT false,
    "whatsapp_opt_in" boolean DEFAULT false,
    "email_opt_in" boolean DEFAULT true,
    "push_opt_in" boolean DEFAULT true,
    "preferred_channel" "text" DEFAULT 'email'::"text",
    "quiet_hours_start" time without time zone,
    "quiet_hours_end" time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."guest_messaging_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_rfm_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "r_score" integer NOT NULL,
    "f_score" integer NOT NULL,
    "m_score" integer NOT NULL,
    "segment" "text" NOT NULL,
    "lifetime_value" numeric DEFAULT 0 NOT NULL,
    "last_calculated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "guest_rfm_scores_f_score_check" CHECK ((("f_score" >= 1) AND ("f_score" <= 5))),
    CONSTRAINT "guest_rfm_scores_m_score_check" CHECK ((("m_score" >= 1) AND ("m_score" <= 5))),
    CONSTRAINT "guest_rfm_scores_r_score_check" CHECK ((("r_score" >= 1) AND ("r_score" <= 5)))
);


ALTER TABLE "public"."guest_rfm_scores" OWNER TO "postgres";


COMMENT ON TABLE "public"."guest_rfm_scores" IS 'RFM segmentation scores for guest analytics';



CREATE TABLE IF NOT EXISTS "public"."guest_segments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "segment_type" "text" DEFAULT 'dynamic'::"text" NOT NULL,
    "rules" "jsonb" DEFAULT '[]'::"jsonb",
    "member_count" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "guest_segments_segment_type_check" CHECK (("segment_type" = ANY (ARRAY['dynamic'::"text", 'static'::"text"])))
);


ALTER TABLE "public"."guest_segments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."housekeeping_inspections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "unit_id" "uuid",
    "inspector_id" "uuid",
    "passed" boolean NOT NULL,
    "score" integer,
    "checklist_results" "jsonb",
    "photos" "jsonb",
    "issues_found" "text",
    "reinspection_required" boolean DEFAULT false,
    "inspected_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "housekeeping_inspections_score_check" CHECK ((("score" >= 0) AND ("score" <= 100)))
);


ALTER TABLE "public"."housekeeping_inspections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."housekeeping_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "action" character varying(50) NOT NULL,
    "old_status" character varying(30),
    "new_status" character varying(30),
    "notes" "text",
    "performed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."housekeeping_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."housekeeping_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_type_id" "uuid",
    "unit_id" "uuid",
    "repeat_pattern" character varying(30) NOT NULL,
    "day_of_week" integer,
    "time_slot" character varying(10) DEFAULT '09:00'::character varying,
    "assigned_to" "uuid",
    "is_active" boolean DEFAULT true,
    "last_generated" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "housekeeping_schedules_repeat_pattern_check" CHECK ((("repeat_pattern")::"text" = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'biweekly'::character varying, 'monthly'::character varying, 'on_checkout'::character varying, 'inventory_check'::character varying, 'checkout'::character varying])::"text"[])))
);


ALTER TABLE "public"."housekeeping_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."housekeeping_sla" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_type" character varying(50) NOT NULL,
    "priority" character varying(20) NOT NULL,
    "max_duration_minutes" integer NOT NULL,
    "warning_threshold_minutes" integer,
    "escalation_after_minutes" integer,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "target_minutes" integer,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."housekeeping_sla" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."housekeeping_supplies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_type" character varying(50) NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "quantity_per_task" numeric(10,3) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."housekeeping_supplies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."housekeeping_task_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "comment" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."housekeeping_task_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."housekeeping_task_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "estimated_duration" integer DEFAULT 30,
    "checklist" "jsonb" DEFAULT '[]'::"jsonb",
    "priority" character varying(20) DEFAULT 'normal'::character varying,
    "applies_to" character varying(50) DEFAULT 'accommodation_unit'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "housekeeping_task_types_applies_to_check" CHECK ((("applies_to")::"text" = ANY ((ARRAY['accommodation_unit'::character varying, 'service_area'::character varying, 'dining_area'::character varying, 'common_area'::character varying, 'other'::character varying])::"text"[]))),
    CONSTRAINT "housekeeping_task_types_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::"text"[])))
);


ALTER TABLE "public"."housekeeping_task_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."housekeeping_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_type_id" "uuid",
    "title" character varying(200) NOT NULL,
    "description" "text",
    "unit_id" "uuid",
    "priority" character varying(20) DEFAULT 'normal'::character varying,
    "status" character varying(30) DEFAULT 'pending'::character varying,
    "assigned_to" "uuid",
    "created_by" "uuid",
    "scheduled_for" timestamp with time zone,
    "due_date" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "checklist_completed" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "text",
    "photos" "jsonb" DEFAULT '[]'::"jsonb",
    "booking_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completion_photos" "jsonb" DEFAULT '[]'::"jsonb",
    "before_photos" "jsonb" DEFAULT '[]'::"jsonb",
    "inspected_by" "uuid",
    "inspected_at" timestamp with time zone,
    "inspection_notes" "text",
    "quality_score" integer,
    "sla_due_at" timestamp with time zone,
    "sla_breached" boolean DEFAULT false,
    "sla_breach_at" timestamp with time zone,
    "escalated_to" "uuid",
    "escalated_at" timestamp with time zone,
    "task_type" character varying(50),
    "sla_due" timestamp with time zone,
    "sla_status" character varying(20),
    "inspection_id" "uuid",
    "inspection_passed" boolean,
    "parent_task_id" "uuid",
    "override_reason" "text",
    "overridden_by" "uuid",
    "overridden_at" timestamp with time zone,
    "photo_urls" "text"[],
    "issues_found" "text",
    "duration_minutes" integer,
    "completion_notes" "text",
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "housekeeping_tasks_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::"text"[]))),
    CONSTRAINT "housekeeping_tasks_quality_score_check" CHECK ((("quality_score" >= 1) AND ("quality_score" <= 5))),
    CONSTRAINT "housekeeping_tasks_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'assigned'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'verified'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."housekeeping_tasks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."housekeeping_tasks"."booking_id" IS 'Reference to accommodation booking if this is a checkout task';



COMMENT ON COLUMN "public"."housekeeping_tasks"."completion_photos" IS 'Array of photo URLs taken after task completion';



COMMENT ON COLUMN "public"."housekeeping_tasks"."before_photos" IS 'Array of photo URLs taken before starting the task';



COMMENT ON COLUMN "public"."housekeeping_tasks"."quality_score" IS 'Quality rating 1-5 given during inspection';



COMMENT ON COLUMN "public"."housekeeping_tasks"."deleted_at" IS 'Soft-delete timestamp. NULL = active record.';



CREATE TABLE IF NOT EXISTS "public"."inventory_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "alert_type" character varying(20) NOT NULL,
    "message" "text" NOT NULL,
    "severity" character varying(20) DEFAULT 'warning'::character varying,
    "is_resolved" boolean DEFAULT false,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "inventory_alerts_alert_type_check" CHECK ((("alert_type")::"text" = ANY ((ARRAY['low_stock'::character varying, 'out_of_stock'::character varying, 'overstock'::character varying, 'expiring'::character varying])::"text"[]))),
    CONSTRAINT "inventory_alerts_severity_check" CHECK ((("severity")::"text" = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'critical'::character varying])::"text"[])))
);


ALTER TABLE "public"."inventory_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "batch_number" character varying(50),
    "quantity" numeric(10,4) NOT NULL,
    "remaining_quantity" numeric(10,4) NOT NULL,
    "cost_per_unit" numeric(10,4),
    "supplier_id" "uuid",
    "purchase_order_id" "uuid",
    "received_date" timestamp with time zone DEFAULT "now"(),
    "expiry_date" timestamp with time zone,
    "location" character varying(100),
    "status" character varying(20) DEFAULT 'active'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "inventory_batches_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'depleted'::character varying, 'expired'::character varying, 'disposed'::character varying])::"text"[])))
);


ALTER TABLE "public"."inventory_batches" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inventory_batches"."deleted_at" IS 'Soft-delete timestamp. NULL = active record.';



CREATE TABLE IF NOT EXISTS "public"."inventory_bom" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "catalog_item_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "quantity" numeric(10,4) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."inventory_bom" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "color" character varying(7) DEFAULT '#6B7280'::character varying,
    "parent_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "module_id" "uuid"
);


ALTER TABLE "public"."inventory_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_consumption" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid",
    "inventory_item_id" "uuid",
    "quantity" numeric(10,2) NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."inventory_consumption" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "sku" character varying(100),
    "description" "text",
    "category_id" "uuid",
    "quantity" numeric(10,2) DEFAULT 0,
    "unit" character varying(50) DEFAULT 'piece'::character varying NOT NULL,
    "current_stock" numeric(10,2) DEFAULT 0,
    "min_stock_level" numeric(10,2) DEFAULT 0,
    "max_stock_level" numeric(10,2),
    "reorder_point" numeric(10,2) DEFAULT 10,
    "cost_per_unit" numeric(10,2),
    "supplier" character varying(255),
    "location" character varying(255),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expiry_date" timestamp with time zone,
    "last_purchase_price" numeric(10,2),
    "deleted_at" timestamp with time zone,
    "created_by" "uuid",
    "deleted_by" "uuid",
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "module_id" "uuid"
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_id" "uuid",
    "item_id" "uuid",
    "quantity_ordered" numeric(10,4) NOT NULL,
    "quantity_received" numeric(10,4) DEFAULT 0,
    "unit_cost" numeric(10,4),
    "total_cost" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."inventory_purchase_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "po_number" character varying(50) NOT NULL,
    "supplier_id" "uuid",
    "status" character varying(20) DEFAULT 'draft'::character varying,
    "total_amount" numeric(10,2),
    "expected_delivery" "date",
    "received_date" "date",
    "notes" "text",
    "created_by" "uuid",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "inventory_purchase_orders_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'submitted'::character varying, 'confirmed'::character varying, 'received'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."inventory_purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_recipe_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipe_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "quantity" numeric(10,3) NOT NULL,
    "unit" character varying(50),
    "is_optional" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."inventory_recipe_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "catalog_item_id" "uuid" NOT NULL,
    "name" character varying(255),
    "yields" integer DEFAULT 1,
    "prep_time_minutes" integer,
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."inventory_recipes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inventory_recipes"."deleted_at" IS 'Soft-delete timestamp. NULL = active record.';



CREATE TABLE IF NOT EXISTS "public"."inventory_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(200) NOT NULL,
    "contact_name" character varying(100),
    "email" character varying(255),
    "phone" character varying(50),
    "address" "text",
    "payment_terms" character varying(100),
    "lead_time_days" integer DEFAULT 3,
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."inventory_suppliers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "transaction_type" character varying(20) NOT NULL,
    "quantity" numeric(10,2) NOT NULL,
    "unit_cost" numeric(10,2),
    "total_cost" numeric(10,2),
    "stock_before" numeric(10,2),
    "stock_after" numeric(10,2),
    "reference_type" character varying(50),
    "reference_id" "uuid",
    "notes" "text",
    "performed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "inventory_transactions_transaction_type_check" CHECK ((("transaction_type")::"text" = ANY ((ARRAY['purchase'::character varying, 'sale'::character varying, 'adjustment'::character varying, 'transfer'::character varying, 'waste'::character varying, 'return'::character varying])::"text"[])))
);


ALTER TABLE "public"."inventory_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_variance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "count_date" "date" NOT NULL,
    "system_quantity" numeric(10,4) NOT NULL,
    "actual_quantity" numeric(10,4) NOT NULL,
    "variance_quantity" numeric(10,4) NOT NULL,
    "variance_percentage" numeric(5,2),
    "variance_cost" numeric(10,2),
    "reason" "text",
    "counted_by" "uuid",
    "approved_by" "uuid",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "inventory_variance_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'investigated'::character varying])::"text"[])))
);


ALTER TABLE "public"."inventory_variance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_wastage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "batch_id" "uuid",
    "quantity" numeric(10,4) NOT NULL,
    "reason" character varying(50) NOT NULL,
    "notes" "text",
    "photo_url" "text",
    "cost_impact" numeric(10,2),
    "reported_by" "uuid",
    "approved_by" "uuid",
    "approval_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "inventory_wastage_approval_status_check" CHECK ((("approval_status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::"text"[]))),
    CONSTRAINT "inventory_wastage_reason_check" CHECK ((("reason")::"text" = ANY ((ARRAY['expired'::character varying, 'spoiled'::character varying, 'damaged'::character varying, 'preparation_error'::character varying, 'theft'::character varying, 'other'::character varying])::"text"[])))
);


ALTER TABLE "public"."inventory_wastage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journey_enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "journey_id" "uuid" NOT NULL,
    "guest_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "current_step" integer DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "entered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "next_step_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "exited_at" timestamp with time zone,
    "exit_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "journey_enrollments_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'completed'::"text", 'exited'::"text"])))
);


ALTER TABLE "public"."journey_enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journey_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "journey_id" "uuid" NOT NULL,
    "step_order" integer NOT NULL,
    "step_type" "text" NOT NULL,
    "name" "text",
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "template_id" "uuid",
    "wait_duration" "text",
    "wait_until_time" "text",
    "condition_rules" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "journey_steps_step_type_check" CHECK (("step_type" = ANY (ARRAY['send_email'::"text", 'wait'::"text", 'condition'::"text", 'split'::"text", 'update_profile'::"text", 'exit'::"text"])))
);


ALTER TABLE "public"."journey_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kiosk_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "kiosk_id" "uuid",
    "date" "date" NOT NULL,
    "total_sessions" integer DEFAULT 0,
    "completed_sessions" integer DEFAULT 0,
    "abandoned_sessions" integer DEFAULT 0,
    "timeout_sessions" integer DEFAULT 0,
    "error_sessions" integer DEFAULT 0,
    "transferred_sessions" integer DEFAULT 0,
    "checkins_completed" integer DEFAULT 0,
    "checkouts_completed" integer DEFAULT 0,
    "keys_issued" integer DEFAULT 0,
    "payments_processed" integer DEFAULT 0,
    "avg_session_duration_seconds" integer,
    "avg_checkin_duration_seconds" integer,
    "peak_hour" integer,
    "hardware_errors" integer DEFAULT 0,
    "payment_failures" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."kiosk_analytics" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiosk_analytics" IS 'Aggregated kiosk performance metrics';



CREATE TABLE IF NOT EXISTS "public"."kiosk_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "device_name" character varying(100) NOT NULL,
    "device_code" character varying(20) NOT NULL,
    "location" character varying(255),
    "device_type" character varying(50) DEFAULT 'standard'::character varying NOT NULL,
    "manufacturer" character varying(100),
    "model" character varying(100),
    "serial_number" character varying(100),
    "has_id_scanner" boolean DEFAULT false,
    "has_card_reader" boolean DEFAULT false,
    "has_key_encoder" boolean DEFAULT false,
    "has_receipt_printer" boolean DEFAULT false,
    "has_signature_pad" boolean DEFAULT false,
    "has_camera" boolean DEFAULT false,
    "has_cash_acceptor" boolean DEFAULT false,
    "has_card_dispenser" boolean DEFAULT false,
    "status" character varying(20) DEFAULT 'offline'::character varying NOT NULL,
    "last_heartbeat" timestamp with time zone,
    "last_error" "text",
    "error_count" integer DEFAULT 0,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "operating_hours" "jsonb",
    "last_maintenance_date" "date",
    "next_maintenance_date" "date",
    "maintenance_notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."kiosk_devices" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiosk_devices" IS 'Registry of self-service kiosk hardware';



CREATE TABLE IF NOT EXISTS "public"."kiosk_hardware_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kiosk_id" "uuid" NOT NULL,
    "event_type" character varying(30) NOT NULL,
    "severity" character varying(20) DEFAULT 'info'::character varying NOT NULL,
    "component" character varying(50),
    "details" "jsonb",
    "resolved" boolean DEFAULT false,
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."kiosk_hardware_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiosk_hardware_events" IS 'Hardware status and error events';



CREATE TABLE IF NOT EXISTS "public"."kiosk_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "price" numeric(10,2),
    "stock_quantity" integer DEFAULT 0,
    "is_available" boolean DEFAULT true,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."kiosk_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kiosk_key_stock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kiosk_id" "uuid" NOT NULL,
    "current_stock" integer DEFAULT 0 NOT NULL,
    "minimum_stock" integer DEFAULT 20 NOT NULL,
    "maximum_stock" integer DEFAULT 200 NOT NULL,
    "last_refill_date" timestamp with time zone,
    "last_refill_quantity" integer,
    "last_refill_by" "uuid",
    "low_stock_alert_sent" boolean DEFAULT false,
    "last_alert_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."kiosk_key_stock" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiosk_key_stock" IS 'Physical key card inventory per kiosk';



CREATE TABLE IF NOT EXISTS "public"."kiosk_screen_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flow_id" "uuid" NOT NULL,
    "step_key" character varying(50) NOT NULL,
    "language" character varying(5) DEFAULT 'en'::character varying NOT NULL,
    "title" character varying(200),
    "subtitle" character varying(300),
    "instructions" "text",
    "button_labels" "jsonb",
    "error_messages" "jsonb",
    "image_url" "text",
    "video_url" "text",
    "animation_type" character varying(30),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."kiosk_screen_content" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiosk_screen_content" IS 'Localized content for kiosk screens';



CREATE TABLE IF NOT EXISTS "public"."kiosk_screen_flows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "flow_type" character varying(30) NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "steps" "jsonb" NOT NULL,
    "default_language" character varying(5) DEFAULT 'en'::character varying,
    "available_languages" character varying(5)[] DEFAULT ARRAY['en'::"text"],
    "timeout_seconds" integer DEFAULT 120,
    "enable_help_button" boolean DEFAULT true,
    "enable_cancel_button" boolean DEFAULT true,
    "enable_language_selector" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "effective_from" "date",
    "effective_until" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."kiosk_screen_flows" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiosk_screen_flows" IS 'Configurable UI flows for kiosk operations';



CREATE TABLE IF NOT EXISTS "public"."kiosk_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kiosk_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "session_type" character varying(30) NOT NULL,
    "booking_id" "uuid",
    "guest_id" "uuid",
    "confirmation_number" character varying(50),
    "status" character varying(20) DEFAULT 'started'::character varying NOT NULL,
    "current_step" character varying(50),
    "steps_completed" "jsonb" DEFAULT '[]'::"jsonb",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "duration_seconds" integer,
    "input_data" "jsonb" DEFAULT '{}'::"jsonb",
    "result_status" character varying(20),
    "result_data" "jsonb",
    "failure_reason" "text",
    "transferred_to_desk" boolean DEFAULT false,
    "transfer_reason" "text",
    "desk_staff_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."kiosk_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiosk_sessions" IS 'Guest interactions with kiosks';



CREATE TABLE IF NOT EXISTS "public"."kiosk_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "kiosk_id" "uuid" NOT NULL,
    "transaction_type" character varying(30) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "request_data" "jsonb",
    "response_data" "jsonb",
    "amount" numeric(10,2),
    "currency" character varying(3),
    "payment_method" character varying(30),
    "payment_reference" character varying(100),
    "error_code" character varying(50),
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."kiosk_transactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."kiosk_transactions" IS 'Individual operations during kiosk sessions';



CREATE TABLE IF NOT EXISTS "public"."loyalty_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tier_id" "uuid",
    "total_points" integer DEFAULT 0,
    "available_points" integer DEFAULT 0,
    "lifetime_points" integer DEFAULT 0,
    "member_since" timestamp with time zone DEFAULT "now"(),
    "last_activity" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "tier_name" character varying(50)
);


ALTER TABLE "public"."loyalty_members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."loyalty_members"."tier_name" IS 'Name of the loyalty tier (e.g., Bronze, Silver, Gold)';



CREATE OR REPLACE VIEW "public"."loyalty_accounts" AS
 SELECT "id",
    "user_id",
    "tier_id",
    "total_points",
    "available_points",
    "lifetime_points",
    "member_since",
    "last_activity",
    "created_at",
    "updated_at",
    "tier_name"
   FROM "public"."loyalty_members";


ALTER VIEW "public"."loyalty_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_fraud_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "flag_type" character varying(50) NOT NULL,
    "severity" character varying(20) DEFAULT 'warning'::character varying,
    "details" "jsonb",
    "resolved" boolean DEFAULT false,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."loyalty_fraud_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_point_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "points" integer NOT NULL,
    "remaining_points" integer NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "source" character varying(50) NOT NULL,
    "source_id" "uuid",
    "is_expired" boolean DEFAULT false,
    "expired_at" timestamp with time zone,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."loyalty_point_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_profiles" (
    "user_id" "uuid" NOT NULL,
    "points_balance" integer DEFAULT 0,
    "tier" character varying(50) DEFAULT 'bronze'::character varying,
    "lifetime_points" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_activity_at" timestamp with time zone,
    "points_expiring_soon" integer DEFAULT 0,
    "next_expiry_date" "date",
    "tier_progress_points" integer DEFAULT 0,
    "tier_qualifying_spend" numeric(10,2) DEFAULT 0,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."loyalty_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "reward_id" "uuid" NOT NULL,
    "points_spent" integer NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "redeemed_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "notes" "text",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "loyalty_redemptions_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'expired'::character varying])::"text"[])))
);


ALTER TABLE "public"."loyalty_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "points_required" integer NOT NULL,
    "reward_type" character varying(50) NOT NULL,
    "reward_value" "jsonb" NOT NULL,
    "image_url" "text",
    "stock" integer,
    "min_tier_id" "uuid",
    "valid_from" timestamp with time zone DEFAULT "now"(),
    "valid_until" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "loyalty_rewards_reward_type_check" CHECK ((("reward_type")::"text" = ANY ((ARRAY['discount'::character varying, 'free_item'::character varying, 'upgrade'::character varying, 'experience'::character varying, 'merchandise'::character varying])::"text"[])))
);


ALTER TABLE "public"."loyalty_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "points_per_dollar" numeric(10,2) DEFAULT 1.0,
    "min_redemption_points" integer DEFAULT 100,
    "points_expiry_days" integer DEFAULT 365,
    "enable_tier_benefits" boolean DEFAULT true,
    "enable_birthday_bonus" boolean DEFAULT true,
    "birthday_bonus_points" integer DEFAULT 100,
    "referral_bonus_points" integer DEFAULT 500,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."loyalty_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "min_points" integer DEFAULT 0 NOT NULL,
    "points_multiplier" numeric(5,2) DEFAULT 1.00,
    "benefits" "jsonb" DEFAULT '[]'::"jsonb",
    "color" character varying(7) DEFAULT '#6B7280'::character varying,
    "icon" character varying(50),
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."loyalty_tiers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."loyalty_tiers"."points_multiplier" IS 'Points multiplier for this tier (e.g., 1.5 = 150% points). Max value 999.99';



CREATE TABLE IF NOT EXISTS "public"."loyalty_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "transaction_type" character varying(20) NOT NULL,
    "points" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "description" "text",
    "reference_type" character varying(50),
    "reference_id" "uuid",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "type" character varying(50),
    CONSTRAINT "loyalty_transactions_transaction_type_check" CHECK ((("transaction_type")::"text" = ANY ((ARRAY['earning'::character varying, 'redemption'::character varying, 'earn'::character varying, 'redeem'::character varying, 'adjust'::character varying, 'penalty'::character varying, 'bonus'::character varying, 'refund'::character varying, 'initial'::character varying])::"text"[])))
);


ALTER TABLE "public"."loyalty_transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."loyalty_transactions"."deleted_at" IS 'Soft-delete timestamp. NULL = active record.';



CREATE TABLE IF NOT EXISTS "public"."manager_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" character varying(50) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "amount" numeric(10,2),
    "original_amount" numeric(10,2),
    "percentage" numeric(5,2),
    "description" "text" NOT NULL,
    "reason" "text",
    "reference_type" character varying(50),
    "reference_id" "uuid",
    "requested_by" "uuid" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '24:00:00'::interval),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "manager_approvals_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'expired'::character varying])::"text"[]))),
    CONSTRAINT "manager_approvals_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['refund'::character varying, 'discount'::character varying, 'void'::character varying, 'override'::character varying, 'price_adjustment'::character varying, 'comp'::character varying])::"text"[])))
);


ALTER TABLE "public"."manager_approvals" OWNER TO "postgres";


COMMENT ON TABLE "public"."manager_approvals" IS 'Stores approval requests for refunds, discounts, voids, and price overrides';



COMMENT ON COLUMN "public"."manager_approvals"."expires_at" IS 'Approval requests expire after 24 hours if not reviewed';



COMMENT ON COLUMN "public"."manager_approvals"."deleted_at" IS 'Soft-delete timestamp. NULL = active record.';



CREATE TABLE IF NOT EXISTS "public"."manager_notification_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "approval_requests" boolean DEFAULT true,
    "approval_responses" boolean DEFAULT true,
    "urgent_orders" boolean DEFAULT true,
    "inventory_alerts" boolean DEFAULT true,
    "staff_alerts" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."manager_notification_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "event_type" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "expected_demand_impact" numeric(5,2),
    "expected_rate_impact" numeric(5,2),
    "location" "text",
    "distance_km" numeric(10,2),
    "expected_attendance" integer,
    "source" "text",
    "is_recurring" boolean DEFAULT false,
    "recurrence_pattern" "jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."market_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "campaign_type" "text" DEFAULT 'one-time'::"text",
    "template_id" "uuid",
    "segment_id" "uuid",
    "custom_audience" "uuid"[] DEFAULT '{}'::"uuid"[],
    "subject_line" "text" NOT NULL,
    "preview_text" "text",
    "from_name" "text",
    "from_email" "text",
    "schedule_type" "text" DEFAULT 'immediate'::"text",
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "status" "text" DEFAULT 'draft'::"text",
    "enable_ab_test" boolean DEFAULT false,
    "ab_variants" "jsonb" DEFAULT '[]'::"jsonb",
    "stats" "jsonb" DEFAULT '{"sent": 0, "opened": 0, "bounced": 0, "clicked": 0, "delivered": 0, "unsubscribed": 0}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "marketing_campaigns_schedule_type_check" CHECK (("schedule_type" = ANY (ARRAY['immediate'::"text", 'scheduled'::"text"]))),
    CONSTRAINT "marketing_campaigns_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'scheduled'::"text", 'sending'::"text", 'sent'::"text", 'cancelled'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."marketing_campaigns" OWNER TO "postgres";


COMMENT ON TABLE "public"."marketing_campaigns" IS 'Email marketing campaigns with segmentation';



CREATE TABLE IF NOT EXISTS "public"."marketing_email_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "preview_text" "text",
    "html_content" "text" NOT NULL,
    "text_content" "text",
    "variables" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."marketing_email_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membership_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) DEFAULT 0 NOT NULL,
    "interval" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "interval_count" integer DEFAULT 1 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "membership_plans_interval_check" CHECK (("interval" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'annual'::"text", 'lifetime'::"text"])))
);


ALTER TABLE "public"."membership_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "plan_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    CONSTRAINT "memberships_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'paused'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."memberships" OWNER TO "postgres";


COMMENT ON COLUMN "public"."memberships"."expires_at" IS 'Expiration date for the membership';



CREATE TABLE IF NOT EXISTS "public"."menu_item_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "catalog_item_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "quantity_required" numeric(10,3) NOT NULL,
    "unit" character varying(30) NOT NULL,
    "is_optional" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."menu_item_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "channel_type" "text" NOT NULL,
    "language" "text" DEFAULT 'en'::"text",
    "category" "text",
    "content" "text" NOT NULL,
    "variables" "text"[] DEFAULT '{}'::"text"[],
    "is_approved" boolean DEFAULT false,
    "external_template_id" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."message_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "direction" "text" NOT NULL,
    "sender_type" "text" NOT NULL,
    "sender_id" "uuid",
    "sender_name" "text",
    "message_type" "text" DEFAULT 'text'::"text",
    "content" "text" NOT NULL,
    "media_url" "text",
    "template_id" "uuid",
    "template_data" "jsonb",
    "status" "text" DEFAULT 'sent'::"text",
    "external_id" "text",
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "messages_direction_check" CHECK (("direction" = ANY (ARRAY['inbound'::"text", 'outbound'::"text"]))),
    CONSTRAINT "messages_message_type_check" CHECK (("message_type" = ANY (ARRAY['text'::"text", 'image'::"text", 'file'::"text", 'location'::"text", 'template'::"text"]))),
    CONSTRAINT "messages_sender_type_check" CHECK (("sender_type" = ANY (ARRAY['guest'::"text", 'staff'::"text", 'system'::"text", 'bot'::"text"]))),
    CONSTRAINT "messages_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'delivered'::"text", 'read'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messaging_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "channel_type" "text" NOT NULL,
    "provider" "text" DEFAULT 'internal'::"text",
    "api_key_encrypted" "text",
    "from_number" "text",
    "webhook_url" "text",
    "enabled" boolean DEFAULT true,
    "chatbot_enabled" boolean DEFAULT false,
    "verified" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "messaging_channels_channel_type_check" CHECK (("channel_type" = ANY (ARRAY['sms'::"text", 'whatsapp'::"text", 'email'::"text", 'push'::"text", 'in_app'::"text"])))
);


ALTER TABLE "public"."messaging_channels" OWNER TO "postgres";


COMMENT ON TABLE "public"."messaging_channels" IS 'SMS/WhatsApp/Email messaging channel configuration';



CREATE TABLE IF NOT EXISTS "public"."metric_definitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "calculation" "jsonb" NOT NULL,
    "targets" "jsonb",
    "alert_thresholds" "jsonb",
    "format" "jsonb" DEFAULT '{"decimals": 0}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "metric_definitions_category_check" CHECK (("category" = ANY (ARRAY['financial'::"text", 'operational'::"text", 'guest'::"text", 'marketing'::"text"]))),
    CONSTRAINT "metric_definitions_data_type_check" CHECK (("data_type" = ANY (ARRAY['currency'::"text", 'number'::"text", 'percent'::"text", 'duration'::"text", 'count'::"text"])))
);


ALTER TABLE "public"."metric_definitions" OWNER TO "postgres";


COMMENT ON TABLE "public"."metric_definitions" IS 'Canonical metric definitions for governed analytics';



CREATE TABLE IF NOT EXISTS "public"."mobile_key_access_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key_id" "uuid" NOT NULL,
    "access_point" "text" NOT NULL,
    "access_result" "text" NOT NULL,
    "denial_reason" "text",
    "device_info" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "mobile_key_access_log_access_result_check" CHECK (("access_result" = ANY (ARRAY['granted'::"text", 'denied'::"text"])))
);


ALTER TABLE "public"."mobile_key_access_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mobile_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "guest_id" "uuid",
    "provider" "text" NOT NULL,
    "device_id" "text" NOT NULL,
    "device_type" "text" NOT NULL,
    "device_model" "text",
    "push_token" "text",
    "key_data" "text",
    "access_areas" "text"[] DEFAULT '{}'::"text"[],
    "pin_hash" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "valid_from" timestamp with time zone,
    "valid_until" timestamp with time zone,
    "last_used_at" timestamp with time zone,
    "use_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "mobile_keys_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'suspended'::"text", 'expired'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."mobile_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."module_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "engine_type" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "thumbnail_url" "text",
    "layout" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "default_settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "seed_data" "jsonb",
    "is_official" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "usage_count" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."module_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."module_templates" IS 'Pre-built module layouts and configurations for rapid module creation';



CREATE TABLE IF NOT EXISTS "public"."modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_type" "public"."module_template_type",
    "name" character varying(100) NOT NULL,
    "name_ar" character varying(100),
    "name_fr" character varying(100),
    "slug" character varying(50) NOT NULL,
    "description" "text",
    "icon" character varying(50) DEFAULT 'Package'::character varying,
    "image_url" "text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp without time zone,
    "settings_version" integer DEFAULT 1,
    "deleted_by" "uuid",
    "property_id" "uuid" NOT NULL,
    "engine_type" character varying(50) NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "show_in_main" boolean DEFAULT true,
    "tax_category" character varying(50) DEFAULT 'all'::character varying,
    CONSTRAINT "chk_modules_engine_type" CHECK ((("engine_type")::"text" = ANY ((ARRAY['instant_transaction'::character varying, 'time_exclusive_reservation'::character varying, 'shared_capacity_access'::character varying, 'ongoing_entitlement'::character varying, 'platform_entitlement'::character varying])::"text"[])))
);


ALTER TABLE "public"."modules" OWNER TO "postgres";


COMMENT ON TABLE "public"."modules" IS 'Includes a module-builder flagship demo (slug=stress-test-stack, revamped by 20260711130000_revamp_stress_test_stack_flagship_demo.sql from its original diagnostic content) -- a fictional coastal-retreat page exercising the stack/document-flow rendering path end to end. Not a real tenant page.';



COMMENT ON COLUMN "public"."modules"."template_type" IS 'FROZEN legacy compat column. Read-only as of the Stage 1 contract freeze -- no new code may read or write it. Resolve engine identity via modules.engine_type only. See docs/architecture/MODULE_ENGINE_CONTRACT.md.';



COMMENT ON COLUMN "public"."modules"."engine_type" IS 'Canonical engine type per Architecture Law. NOT NULL, CHECK-constrained to the 5 engines. See docs/architecture/MODULE_ENGINE_CONTRACT.md.';



COMMENT ON COLUMN "public"."modules"."tax_category" IS 'Default tax category for items in this module. Used for tax rate scoping.';



CREATE TABLE IF NOT EXISTS "public"."notification_broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(200) NOT NULL,
    "message" "text" NOT NULL,
    "type" "public"."notification_type" DEFAULT 'info'::"public"."notification_type",
    "target_type" "public"."notification_target_type" DEFAULT 'all'::"public"."notification_target_type",
    "priority" "public"."notification_priority" DEFAULT 'normal'::"public"."notification_priority",
    "target_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "actions" "jsonb" DEFAULT '[]'::"jsonb",
    "scheduled_for" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "delivery_count" integer DEFAULT 0,
    "read_count" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."notification_broadcasts" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_broadcasts" IS 'Broadcast notifications sent to multiple users';



CREATE TABLE IF NOT EXISTS "public"."notification_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "device_token_id" "uuid",
    "title" "text" NOT NULL,
    "body" "text",
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text",
    "provider" "text",
    "provider_message_id" "text",
    "error_message" "text",
    "notification_type" "text",
    "reference_type" "text",
    "reference_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."notification_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_logs" IS 'Audit log of all push notifications sent';



CREATE TABLE IF NOT EXISTS "public"."notification_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "title" character varying(200) NOT NULL,
    "message" "text" NOT NULL,
    "type" "public"."notification_type" DEFAULT 'info'::"public"."notification_type",
    "target_type" "public"."notification_target_type" DEFAULT 'all'::"public"."notification_target_type",
    "priority" "public"."notification_priority" DEFAULT 'normal'::"public"."notification_priority",
    "actions" "jsonb" DEFAULT '[]'::"jsonb",
    "variables" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."notification_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_templates" IS 'Reusable notification templates';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "title" character varying(200) NOT NULL,
    "message" "text" NOT NULL,
    "type" "public"."notification_type" DEFAULT 'info'::"public"."notification_type",
    "target_type" "public"."notification_target_type" DEFAULT 'user'::"public"."notification_target_type",
    "channel" "public"."notification_channel" DEFAULT 'in_app'::"public"."notification_channel",
    "priority" "public"."notification_priority" DEFAULT 'normal'::"public"."notification_priority",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "actions" "jsonb" DEFAULT '[]'::"jsonb",
    "scheduled_for" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."notifications" IS 'Individual user notifications (in-app)';



CREATE TABLE IF NOT EXISTS "public"."order_customizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_type" "text" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "order_item_id" "uuid",
    "customization_group_id" "uuid",
    "customization_option_id" "uuid",
    "group_name" "text" NOT NULL,
    "option_name" "text" NOT NULL,
    "customization_type" "text" NOT NULL,
    "quantity" integer DEFAULT 1,
    "unit_price_adjustment" numeric(10,2) DEFAULT 0,
    "total_price_adjustment" numeric(10,2) DEFAULT 0,
    "inventory_item_id" "uuid",
    "inventory_quantity_used" numeric(10,3),
    "inventory_deducted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reversed_at" timestamp with time zone,
    "reversed_by" "uuid",
    "reversal_reason" "text",
    "inventory_reversed" boolean DEFAULT false,
    "original_snapshot_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."order_customizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_customizations" IS 'Immutable snapshot of customizations applied to orders/bookings';



CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid",
    "catalog_item_id" "uuid",
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) DEFAULT 0,
    "subtotal" numeric(10,2) DEFAULT 0,
    "special_instructions" "text",
    "status" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_payment_splits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "payment_method" character varying(50) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "stripe_payment_intent_id" character varying(255),
    "gift_card_id" "uuid",
    "loyalty_points_used" integer DEFAULT 0,
    "payer_name" character varying(100),
    "payer_seat" integer,
    "processed_at" timestamp with time zone,
    "processed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "order_payment_splits_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying])::"text"[])))
);


ALTER TABLE "public"."order_payment_splits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "password_hash" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."password_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."password_history" IS 'Password history for preventing password reuse';



CREATE TABLE IF NOT EXISTS "public"."payment_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference_type" character varying(50) NOT NULL,
    "reference_id" "uuid" NOT NULL,
    "event_type" character varying(50) NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" character varying(3) NOT NULL,
    "gateway_reference_id" character varying(100),
    "webhook_id" character varying(100),
    "status" character varying(20) NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."payment_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "status" character varying(50) NOT NULL,
    "stripe_payment_intent_id" character varying(255),
    "transaction_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reference_type" character varying(50),
    "reference_id" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" character varying(100) NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "resource" character varying(100),
    "action" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price_monthly_cents" integer DEFAULT 0 NOT NULL,
    "price_annual_cents" integer DEFAULT 0 NOT NULL,
    "feature_limits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "stripe_monthly_price_id" "text",
    "stripe_annual_price_id" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_product_id" "text"
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."plans" IS 'Database-driven SaaS subscription plans. Replaces the hardcoded subscription_tier enum on tenants. Prices in cents. feature_limits JSONB mirrors module_templates.default_settings. Writable only by platform admins via the Engine E admin dashboard.';



COMMENT ON COLUMN "public"."plans"."stripe_product_id" IS 'Stripe Product ID (prod_...). Created automatically by the backend on plan create/update. NULL until Stripe is configured and the plan has been saved at least once with STRIPE_SECRET_KEY set.';



CREATE TABLE IF NOT EXISTS "public"."pos_reconciliation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_date" "date" NOT NULL,
    "shift_type" character varying(20) DEFAULT 'full_day'::character varying,
    "opened_by" "uuid",
    "closed_by" "uuid",
    "cash_opening" numeric(10,2) DEFAULT 0,
    "cash_closing" numeric(10,2),
    "cash_expected" numeric(10,2),
    "cash_variance" numeric(10,2),
    "total_sales" numeric(10,2) DEFAULT 0,
    "total_cash" numeric(10,2) DEFAULT 0,
    "total_card" numeric(10,2) DEFAULT 0,
    "total_gift_card" numeric(10,2) DEFAULT 0,
    "total_loyalty" numeric(10,2) DEFAULT 0,
    "total_refunds" numeric(10,2) DEFAULT 0,
    "total_discounts" numeric(10,2) DEFAULT 0,
    "total_tips" numeric(10,2) DEFAULT 0,
    "orders_count" integer DEFAULT 0,
    "void_count" integer DEFAULT 0,
    "refund_count" integer DEFAULT 0,
    "status" character varying(20) DEFAULT 'open'::character varying,
    "notes" "text",
    "variance_explanation" "text",
    "opened_at" timestamp with time zone DEFAULT "now"(),
    "closed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "pos_reconciliation_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['open'::character varying, 'pending_review'::character varying, 'closed'::character varying, 'disputed'::character varying])::"text"[])))
);


ALTER TABLE "public"."pos_reconciliation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pre_arrival_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "guest_id" "uuid",
    "email" "text",
    "access_token" "text" NOT NULL,
    "token_expires_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "legal_first_name" "text",
    "legal_last_name" "text",
    "date_of_birth" "date",
    "nationality" "text",
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "state_province" "text",
    "postal_code" "text",
    "country" "text",
    "mobile_phone" "text",
    "arrival_flight" "text",
    "arrival_time" time without time zone,
    "departure_flight" "text",
    "departure_time" time without time zone,
    "purpose_of_visit" "text",
    "has_vehicle" boolean DEFAULT false,
    "vehicle_make" "text",
    "vehicle_model" "text",
    "vehicle_color" "text",
    "vehicle_plate" "text",
    "special_requests" "text",
    "accessibility_needs" "text"[] DEFAULT '{}'::"text"[],
    "dietary_restrictions" "text"[] DEFAULT '{}'::"text"[],
    "registration_completed_at" timestamp with time zone,
    "id_verified" boolean DEFAULT false,
    "id_verified_at" timestamp with time zone,
    "terms_accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "pre_arrival_registrations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."pre_arrival_registrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."pre_arrival_registrations" IS 'Mobile check-in pre-arrival registration';



CREATE TABLE IF NOT EXISTS "public"."price_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_type" character varying(50) NOT NULL,
    "item_id" "uuid" NOT NULL,
    "base_price" numeric(10,2) NOT NULL,
    "final_price" numeric(10,2) NOT NULL,
    "applied_rules" "jsonb" DEFAULT '[]'::"jsonb",
    "booking_date" "date" NOT NULL,
    "check_in_date" "date" NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."price_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "rule_type" "text" NOT NULL,
    "room_type_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "rate_plan_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "conditions" "jsonb" DEFAULT '{}'::"jsonb",
    "adjustment_type" "text" NOT NULL,
    "adjustment_value" numeric(10,2) NOT NULL,
    "min_rate" numeric(10,2),
    "max_rate" numeric(10,2),
    "priority" integer DEFAULT 0,
    "start_date" "date",
    "end_date" "date",
    "days_of_week" integer[] DEFAULT '{0,1,2,3,4,5,6}'::integer[],
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "pricing_rules_adjustment_type_check" CHECK (("adjustment_type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text", 'multiplier'::"text", 'absolute'::"text"])))
);


ALTER TABLE "public"."pricing_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "order_item_id" "uuid",
    "rating" integer NOT NULL,
    "text" "text" NOT NULL,
    "is_approved" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "product_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."product_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "address_line1" "text",
    "address_line2" "text",
    "city" character varying(100),
    "state" character varying(100),
    "country" character varying(100) DEFAULT 'US'::character varying,
    "postal_code" character varying(20),
    "phone" character varying(50),
    "email" character varying(255),
    "website" "text",
    "timezone" character varying(50) DEFAULT 'UTC'::character varying,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "logo_url" "text",
    "cover_image_url" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "group_id" "uuid",
    "property_code" character varying(50),
    "property_type" character varying(50) DEFAULT 'property'::character varying,
    "star_rating" numeric(2,1),
    "chain_brand" character varying(100),
    "gds_codes" "jsonb" DEFAULT '{}'::"jsonb",
    "is_headquarters" boolean DEFAULT false,
    "total_rooms" integer,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "public_slug" character varying(63),
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "properties_public_slug_format" CHECK ((("public_slug" IS NULL) OR (("public_slug")::"text" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'::"text")))
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


COMMENT ON COLUMN "public"."properties"."deleted_at" IS 'Soft-delete timestamp. NULL = active record.';



COMMENT ON COLUMN "public"."properties"."public_slug" IS 'Customer-facing routing identifier for subdomain resolution ({public_slug}.{tenant_subdomain}.v2platform.com). Distinct from property_code, which is reserved for external OTA channel mappings — do not conflate the two.';



CREATE TABLE IF NOT EXISTS "public"."property_benchmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "property_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "metric" character varying(100) NOT NULL,
    "value" numeric(15,2) NOT NULL,
    "group_average" numeric(15,2),
    "group_rank" integer,
    "yoy_change" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."property_benchmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "code" character varying(50),
    "description" "text",
    "logo_url" "text",
    "website_url" "text",
    "contact_email" character varying(255),
    "contact_phone" character varying(50),
    "address_line1" "text",
    "address_line2" "text",
    "city" character varying(100),
    "state" character varying(100),
    "country" character varying(100),
    "postal_code" character varying(20),
    "timezone" character varying(50) DEFAULT 'UTC'::character varying,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."property_groups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."property_groups"."tenant_id" IS 'Owning tenant. NOT NULL as of the Stage 4 contract freeze -- property_groups has no legitimate platform-wide row, unlike users. See docs/architecture/DATA_OWNERSHIP_CONTRACT.md.';



CREATE TABLE IF NOT EXISTS "public"."property_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "description" "text",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."property_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."property_settings" IS 'Per-property setting overrides (highest priority)';



CREATE TABLE IF NOT EXISTS "public"."rate_parity_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "check_id" "uuid",
    "result_id" "uuid",
    "alert_type" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text",
    "channel_code" "text" NOT NULL,
    "channel_name" "text" NOT NULL,
    "room_type_id" "uuid",
    "check_date" "date" NOT NULL,
    "our_rate" numeric(10,2),
    "channel_rate" numeric(10,2),
    "difference_amount" numeric(10,2),
    "difference_percentage" numeric(5,2),
    "status" "text" DEFAULT 'new'::"text",
    "acknowledged_by" "uuid",
    "acknowledged_at" timestamp with time zone,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "rate_parity_alerts_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "rate_parity_alerts_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'acknowledged'::"text", 'resolved'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."rate_parity_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_parity_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "room_type_id" "uuid",
    "check_date" "date" NOT NULL,
    "our_rate" numeric(10,2) NOT NULL,
    "our_currency" "text" DEFAULT 'USD'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "rate_parity_checks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'compliant'::"text", 'violation'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."rate_parity_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_parity_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "check_frequency_hours" integer DEFAULT 24,
    "tolerance_percentage" numeric(5,2) DEFAULT 2.00,
    "tolerance_amount" numeric(10,2) DEFAULT 5.00,
    "channels_to_monitor" "text"[] DEFAULT '{booking.com,expedia,hotels.com}'::"text"[],
    "alert_on_undercut" boolean DEFAULT true,
    "alert_on_overpriced" boolean DEFAULT true,
    "undercut_threshold_percentage" numeric(5,2) DEFAULT 5.00,
    "notification_emails" "text"[] DEFAULT '{}'::"text"[],
    "slack_webhook_url" "text",
    "last_check_at" timestamp with time zone,
    "next_check_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."rate_parity_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."rate_parity_config" IS 'OTA rate parity monitoring configuration';



CREATE TABLE IF NOT EXISTS "public"."rate_parity_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "check_id" "uuid" NOT NULL,
    "channel_code" "text" NOT NULL,
    "channel_name" "text" NOT NULL,
    "channel_rate" numeric(10,2),
    "currency" "text" DEFAULT 'USD'::"text",
    "rate_difference" numeric(10,2),
    "difference_percentage" numeric(5,2),
    "is_parity" boolean DEFAULT true,
    "violation_type" "text",
    "raw_data" "jsonb",
    "scraped_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "rate_parity_results_violation_type_check" CHECK (("violation_type" = ANY (ARRAY['undercut'::"text", 'overpriced'::"text", NULL::"text"])))
);


ALTER TABLE "public"."rate_parity_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "room_type_id" "uuid",
    "recommendation_date" "date" NOT NULL,
    "current_rate" numeric(10,2) NOT NULL,
    "recommended_rate" numeric(10,2) NOT NULL,
    "reason_code" "text" NOT NULL,
    "reasoning" "text",
    "supporting_data" "jsonb" DEFAULT '{}'::"jsonb",
    "estimated_revenue_impact" numeric(12,2),
    "status" "text" DEFAULT 'pending'::"text",
    "accepted_at" timestamp with time zone,
    "accepted_by" "uuid",
    "applied_rate" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "rate_recommendations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."rate_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reconciliation_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "table_name" character varying(50) NOT NULL,
    "mismatches_found" integer DEFAULT 0 NOT NULL,
    "mismatches_fixed" integer DEFAULT 0 NOT NULL,
    "details" "jsonb" DEFAULT '[]'::"jsonb",
    "alert_sent" boolean DEFAULT false,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."reconciliation_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ref_type_telemetry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "detected_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "raw_value" "text" NOT NULL,
    "mapped_to" "text" NOT NULL,
    "source" "text" NOT NULL,
    "payment_intent_id" "text",
    "count" integer DEFAULT 1,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."ref_type_telemetry" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ref_type_migration_status" AS
 SELECT "raw_value",
    "mapped_to",
    "source",
    "count"(*) AS "detection_count",
    "max"("detected_at") AS "last_detected"
   FROM "public"."ref_type_telemetry"
  WHERE ("detected_at" > ("now"() - '30 days'::interval))
  GROUP BY "raw_value", "mapped_to", "source"
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "public"."ref_type_migration_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registration_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "registration_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "document_number" "text",
    "issuing_country" "text",
    "issue_date" "date",
    "expiry_date" "date",
    "file_url" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_size" integer,
    "verification_status" "text" DEFAULT 'pending'::"text",
    "verification_notes" "text",
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "registration_documents_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."registration_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_daily_sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "total_revenue" numeric(12,2) DEFAULT 0,
    "net_revenue" numeric(12,2) DEFAULT 0,
    "total_orders" integer DEFAULT 0,
    "completed_orders" integer DEFAULT 0,
    "cancelled_orders" integer DEFAULT 0,
    "average_order_value" numeric(10,2) DEFAULT 0,
    "total_discounts" numeric(10,2) DEFAULT 0,
    "total_refunds" numeric(10,2) DEFAULT 0,
    "total_tips" numeric(10,2) DEFAULT 0,
    "cash_revenue" numeric(10,2) DEFAULT 0,
    "card_revenue" numeric(10,2) DEFAULT 0,
    "gift_card_revenue" numeric(10,2) DEFAULT 0,
    "loyalty_redemptions" numeric(10,2) DEFAULT 0,
    "new_customers" integer DEFAULT 0,
    "returning_customers" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."report_daily_sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "saved_report_id" "uuid",
    "scheduled_report_id" "uuid",
    "parameters" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'running'::"text",
    "row_count" integer,
    "execution_time_ms" integer,
    "file_path" "text",
    "file_format" "text",
    "error_message" "text",
    "executed_by" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "report_executions_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."report_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_hourly_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "hour" integer NOT NULL,
    "orders_count" integer DEFAULT 0,
    "revenue" numeric(10,2) DEFAULT 0,
    "avg_prep_time_minutes" integer,
    "peak_concurrent_orders" integer DEFAULT 0,
    "staff_on_duty" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "report_hourly_metrics_hour_check" CHECK ((("hour" >= 0) AND ("hour" <= 23)))
);


ALTER TABLE "public"."report_hourly_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_product_performance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "catalog_item_id" "uuid",
    "quantity_sold" integer DEFAULT 0,
    "revenue" numeric(10,2) DEFAULT 0,
    "cost" numeric(10,2) DEFAULT 0,
    "profit" numeric(10,2) DEFAULT 0,
    "margin_percentage" numeric(5,2),
    "waste_quantity" numeric(10,2) DEFAULT 0,
    "waste_cost" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."report_product_performance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_scheduled" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "report_id" "uuid",
    "template_id" "uuid",
    "name" "text" NOT NULL,
    "frequency" "text" NOT NULL,
    "schedule_config" "jsonb" DEFAULT '{}'::"jsonb",
    "recipients" "text"[] DEFAULT '{}'::"text"[],
    "format" "text" DEFAULT 'pdf'::"text",
    "include_charts" boolean DEFAULT true,
    "is_active" boolean DEFAULT true,
    "last_sent_at" timestamp with time zone,
    "next_send_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "report_scheduled_format_check" CHECK (("format" = ANY (ARRAY['pdf'::"text", 'excel'::"text", 'csv'::"text"]))),
    CONSTRAINT "report_scheduled_frequency_check" CHECK (("frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."report_scheduled" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "query_config" "jsonb" NOT NULL,
    "default_params" "jsonb" DEFAULT '{}'::"jsonb",
    "column_config" "jsonb" DEFAULT '[]'::"jsonb",
    "chart_config" "jsonb",
    "allowed_roles" "text"[] DEFAULT '{admin,manager}'::"text"[],
    "is_system" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."report_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."report_templates" IS 'Customizable report templates';



CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "customer_name" character varying(255) NOT NULL,
    "customer_email" character varying(255),
    "module_id" "uuid",
    "rating" integer NOT NULL,
    "title" character varying(255),
    "content" "text",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "is_featured" boolean DEFAULT false,
    "admin_response" "text",
    "responded_at" timestamp without time zone,
    "responded_by" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp without time zone,
    "deleted_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(50) NOT NULL,
    "display_name" character varying(100),
    "description" "text",
    "business_unit" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "permissions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_system" boolean DEFAULT false,
    "slug" character varying(50)
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."roles"."deleted_at" IS 'Soft-delete timestamp. NULL = active record.';



COMMENT ON COLUMN "public"."roles"."is_system" IS 'Indicates if this is a system role that cannot be deleted';



COMMENT ON COLUMN "public"."roles"."slug" IS 'URL-friendly identifier for the role';



CREATE TABLE IF NOT EXISTS "public"."saved_queries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "query_config" "jsonb" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_executed_at" timestamp with time zone,
    "execution_count" integer DEFAULT 0 NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."saved_queries" OWNER TO "postgres";


COMMENT ON TABLE "public"."saved_queries" IS 'User-saved query builder configurations';



CREATE TABLE IF NOT EXISTS "public"."saved_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "parameters" "jsonb" DEFAULT '{}'::"jsonb",
    "filters" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "is_favorite" boolean DEFAULT false,
    "last_run_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."saved_reports" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."seasonal_pricing_analysis" AS
SELECT
    NULL::character varying(100) AS "rule_name",
    NULL::character varying(5) AS "start_date",
    NULL::character varying(5) AS "end_date",
    NULL::numeric(4,2) AS "price_multiplier",
    NULL::"text"[] AS "applicable_to",
    NULL::bigint AS "times_applied",
    NULL::numeric AS "avg_price_adjustment",
    NULL::numeric AS "total_revenue_impact";


ALTER VIEW "public"."seasonal_pricing_analysis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seasonal_pricing_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "start_date" character varying(5) NOT NULL,
    "end_date" character varying(5) NOT NULL,
    "price_multiplier" numeric(4,2) DEFAULT 1.0 NOT NULL,
    "applicable_to" "text"[] DEFAULT ARRAY['accommodation'::"text"] NOT NULL,
    "specific_items" "uuid"[],
    "priority" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."seasonal_pricing_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" character varying(100) NOT NULL,
    "severity" character varying(20) DEFAULT 'INFO'::character varying NOT NULL,
    "user_id" "uuid",
    "target_user_id" "uuid",
    "ip_address" character varying(45),
    "user_agent" "text",
    "description" "text" NOT NULL,
    "metadata" "jsonb",
    "success" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."security_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."security_audit_log" IS 'Security audit log for tracking all security-related events';



CREATE TABLE IF NOT EXISTS "public"."segment_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "segment_id" "uuid" NOT NULL,
    "guest_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."segment_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid",
    "name" character varying(100) NOT NULL,
    "qr_code" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_locations" OWNER TO "postgres";


COMMENT ON TABLE "public"."service_locations" IS 'Lightweight, module-scoped order-fulfillment locations (e.g. restaurant tables, poolside spots, room-service delivery points). Occupancy is derived from active transactions, not stored. See REFIT_PLAN.md Phase 3.';



COMMENT ON COLUMN "public"."service_locations"."qr_code" IS 'Pre-generated QR payload/URL for this location, used for scan-to-order. Nullable until generated.';



CREATE TABLE IF NOT EXISTS "public"."session_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "session_type" character varying(50) NOT NULL,
    "rating" integer NOT NULL,
    "text" "text" NOT NULL,
    "is_approved" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "session_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."session_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" character varying(500),
    "refresh_token" character varying(500),
    "expires_at" timestamp with time zone,
    "ip_address" character varying(45),
    "user_agent" "text",
    "is_active" boolean DEFAULT true,
    "last_activity" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "session_type" "text" DEFAULT 'session'::"text" NOT NULL,
    CONSTRAINT "sessions_session_type_check" CHECK (("session_type" = ANY (ARRAY['session'::"text", 'password_reset'::"text", 'email_verification'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sessions"."deleted_at" IS 'Soft-delete timestamp. NULL = active record.';



CREATE TABLE IF NOT EXISTS "public"."shared_inventory_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "room_type" character varying(100),
    "participating_properties" "uuid"[],
    "allocation_method" character varying(50) DEFAULT 'proportional'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."shared_inventory_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shift_swap_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_shift_id" "uuid" NOT NULL,
    "requesting_staff_id" "uuid" NOT NULL,
    "target_staff_id" "uuid",
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "reason" "text",
    "accepted_by" "uuid",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "shift_swap_requests_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'cancelled'::character varying, 'approved'::character varying])::"text"[])))
);


ALTER TABLE "public"."shift_swap_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."shift_swap_requests" IS 'Staff requests to swap shifts with each other';



CREATE TABLE IF NOT EXISTS "public"."site_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "navbar" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."site_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."site_settings"."updated_by" IS 'User who last updated this setting';



CREATE TABLE IF NOT EXISTS "public"."staff_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "shift_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "break_minutes" integer DEFAULT 0,
    "actual_start" timestamp with time zone,
    "actual_end" timestamp with time zone,
    "actual_break_minutes" integer DEFAULT 0,
    "status" character varying(20) DEFAULT 'scheduled'::character varying,
    "department" character varying(50),
    "notes" "text",
    "late_reason" "text",
    "early_leave_reason" "text",
    "overtime_approved" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "staff_shifts_break_minutes_check" CHECK (("break_minutes" >= 0)),
    CONSTRAINT "staff_shifts_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['scheduled'::character varying, 'active'::character varying, 'completed'::character varying, 'missed'::character varying, 'cancelled'::character varying])::"text"[])))
);


ALTER TABLE "public"."staff_shifts" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_shifts" IS 'Staff work shift schedules with clock in/out tracking';



COMMENT ON COLUMN "public"."staff_shifts"."deleted_at" IS 'Soft-delete timestamp. NULL = active record.';



CREATE TABLE IF NOT EXISTS "public"."support_inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "email" character varying(255) NOT NULL,
    "phone" character varying(50),
    "subject" character varying(200) NOT NULL,
    "message" "text" NOT NULL,
    "status" character varying(20) DEFAULT 'new'::character varying,
    "admin_notes" "text",
    "responded_at" timestamp with time zone,
    "responded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "assigned_to" "uuid",
    "resolved_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "sla_due_at" timestamp with time zone,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "internal_notes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "support_inquiries_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"])))
);


ALTER TABLE "public"."support_inquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supported_languages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(10) NOT NULL,
    "name" character varying(100) NOT NULL,
    "native_name" character varying(100),
    "direction" character varying(3) DEFAULT 'ltr'::character varying NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."supported_languages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_config" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_config" IS 'Global server-level configuration. Not tenant-scoped. Read/written via backend service role only.';



COMMENT ON COLUMN "public"."system_config"."key" IS 'Namespaced config key, e.g. install.machine_id, install.completed_at';



COMMENT ON COLUMN "public"."system_config"."value" IS 'Arbitrary JSON value for the key.';



CREATE TABLE IF NOT EXISTS "public"."system_defaults" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "description" "text",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_defaults" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_defaults" IS 'System-wide setting fallbacks (lowest priority)';



CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" character varying(255) NOT NULL,
    "value" "text" NOT NULL,
    "category" character varying(100) DEFAULT 'general'::character varying NOT NULL,
    "encrypted" boolean DEFAULT false,
    "description" "text",
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "property_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."system_settings" IS 'System-wide configuration settings stored as key-value pairs';



CREATE TABLE IF NOT EXISTS "public"."tenant_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "integration_type" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "credentials_encrypted" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tenant_integrations_integration_type_check" CHECK (("integration_type" = ANY (ARRAY['stripe'::"text", 'smtp'::"text", 'sendgrid'::"text", 'siteminder'::"text", 'door_lock'::"text", 'whatsapp'::"text", 'twilio'::"text", 'salto'::"text", 'openkey'::"text"])))
);


ALTER TABLE "public"."tenant_integrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_integrations" IS 'Per-tenant third-party integration config + encrypted credentials (Stripe, SMTP, SendGrid, SiteMinder, door locks, WhatsApp). Secrets are encrypted at rest via secretsManager.encrypt() (AES-256-GCM, ENCRYPTION_KEY) — never store plaintext here. Service-role access only.';



COMMENT ON COLUMN "public"."tenant_integrations"."integration_type" IS 'Supported integration types: stripe, smtp, sendgrid, siteminder, door_lock, whatsapp, twilio, salto, openkey. Add new types here + extend the IntegrationType union in backend/src/modules/platform/tenant-integrations.service.ts.';



COMMENT ON COLUMN "public"."tenant_integrations"."credentials_encrypted" IS 'Ciphertext from secretsManager.encrypt(). Decrypt with secretsManager.decrypt() before use; never log or return this column to clients.';



CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subdomain" "text" NOT NULL,
    "property_group_id" "uuid",
    "subscription_tier" "text" DEFAULT 'starter'::"public"."subscription_tier" NOT NULL,
    "billing_status" "public"."billing_status" DEFAULT 'trialing'::"public"."billing_status" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "feature_limits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_platform_root" boolean DEFAULT false NOT NULL,
    "plan_id" "uuid"
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tenants"."subscription_tier" IS 'Tier code from plans table - no longer a hardcoded enum';



COMMENT ON COLUMN "public"."tenants"."plan_id" IS 'FK to plans.id — the live source of truth for this tenant''s feature_limits (resolved by tenantAccess.middleware.ts on every tenant lookup). NULL means no matching plan row was found (legacy tenant); falls back to the snapshot in tenants.feature_limits in that case. Set at provisioning time by provisioning.service.ts and refreshed on tier change by ProvisioningService.updateBillingStatus().';



CREATE TABLE IF NOT EXISTS "public"."terminology_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_type" character varying(50) NOT NULL,
    "term_key" character varying(100) NOT NULL,
    "term_value" character varying(200) NOT NULL,
    "language" character varying(5) DEFAULT 'en'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."terminology_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_clock_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "adjustment_type" character varying(20) NOT NULL,
    "original_time" timestamp with time zone,
    "adjusted_time" timestamp with time zone NOT NULL,
    "reason" "text" NOT NULL,
    "adjusted_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    CONSTRAINT "time_clock_adjustments_adjustment_type_check" CHECK ((("adjustment_type")::"text" = ANY ((ARRAY['clock_in'::character varying, 'clock_out'::character varying, 'break_start'::character varying, 'break_end'::character varying, 'manual'::character varying])::"text"[])))
);


ALTER TABLE "public"."time_clock_adjustments" OWNER TO "postgres";


COMMENT ON TABLE "public"."time_clock_adjustments" IS 'Manual adjustments to clock in/out times by managers';



CREATE TABLE IF NOT EXISTS "public"."token_blacklist" (
    "jti" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "revoked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."token_blacklist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid",
    "engine_type" character varying(50) NOT NULL,
    "property_id" "uuid" NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "service_charge" numeric(12,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "net_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "customer_id" "uuid",
    "reference_id" "uuid",
    "reference_table" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "staff_id" "uuid",
    "cancellation_reason" "text",
    "promo_code_used" character varying(50),
    "refund_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "refund_reason" "text",
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "service_location_id" "uuid"
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."transactions"."staff_id" IS 'Staff member who processed the transaction (for performance tracking)';



COMMENT ON COLUMN "public"."transactions"."cancellation_reason" IS 'Reason for transaction cancellation (for cancellation analysis)';



COMMENT ON COLUMN "public"."transactions"."promo_code_used" IS 'Promotional code applied to transaction (for promo effectiveness tracking)';



COMMENT ON COLUMN "public"."transactions"."refund_amount" IS 'Amount refunded (for refund analysis)';



COMMENT ON COLUMN "public"."transactions"."refund_reason" IS 'Reason for refund (for refund analysis)';



COMMENT ON COLUMN "public"."transactions"."service_location_id" IS 'Optional link to the service_locations row this order was placed at/for. NULL for takeaway, delivery, or any order not tied to a physical location.';



CREATE TABLE IF NOT EXISTS "public"."translation_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key_path" "text" NOT NULL,
    "context" "text" NOT NULL,
    "default_value" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."translation_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."translations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "namespace" character varying(100) DEFAULT 'common'::character varying NOT NULL,
    "key" character varying(255) NOT NULL,
    "locale" character varying(10) NOT NULL,
    "value" "text" NOT NULL,
    "status" "public"."translation_status" DEFAULT 'draft'::"public"."translation_status",
    "context" "text",
    "created_by" "uuid",
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "translation_key" character varying(255),
    "language" character varying(10),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."translations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."two_factor_auth" (
    "user_id" "uuid" NOT NULL,
    "secret" "text" NOT NULL,
    "backup_codes" "jsonb",
    "enabled_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."two_factor_auth" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."two_factor_pending" (
    "user_id" "uuid" NOT NULL,
    "secret" "text" NOT NULL,
    "backup_codes" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."two_factor_pending" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "type" character varying(50),
    "source_booking_id" "uuid",
    "expires_at" timestamp with time zone,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_credits" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_credits" IS 'User account credits from cancellations and promotions';



CREATE TABLE IF NOT EXISTS "public"."user_group_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "group_id" "uuid",
    "access_level" character varying(50) DEFAULT 'read'::character varying NOT NULL,
    "role_in_group" character varying(50),
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_group_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_permissions" (
    "user_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "is_granted" boolean DEFAULT true NOT NULL,
    "granted_by" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_property_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "property_id" "uuid" NOT NULL,
    "access_level" character varying(50) DEFAULT 'read'::character varying NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "is_primary" boolean DEFAULT false,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_property_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255),
    "phone" character varying(20),
    "password_hash" character varying(255),
    "full_name" character varying(255),
    "profile_image_url" "text",
    "preferred_language" character varying(10) DEFAULT 'en'::character varying,
    "role" character varying(50) DEFAULT 'customer'::character varying,
    "roles" "text"[] DEFAULT ARRAY['customer'::"text"],
    "token_version" integer DEFAULT 0 NOT NULL,
    "email_verified" boolean DEFAULT false,
    "phone_verified" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "last_login_at" timestamp with time zone,
    "oauth_provider" character varying(50),
    "oauth_provider_id" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "two_factor_enabled" boolean DEFAULT false,
    "two_factor_secret" "text",
    "backup_codes" "jsonb",
    "last_password_change" timestamp with time zone DEFAULT "now"(),
    "two_factor_required" boolean DEFAULT false,
    "failed_login_attempts" integer DEFAULT 0,
    "locked_until" timestamp with time zone,
    "last_failed_login" timestamp with time zone,
    "tenant_id" "uuid",
    "is_platform_admin" boolean DEFAULT false NOT NULL,
    "must_change_password" boolean DEFAULT false NOT NULL,
    "scope" "public"."user_scope" DEFAULT 'customer'::"public"."user_scope" NOT NULL,
    CONSTRAINT "chk_scope_tenant" CHECK ((("scope" = ANY (ARRAY['super_admin'::"public"."user_scope", 'platform_admin'::"public"."user_scope"])) OR ("tenant_id" IS NOT NULL)))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."token_version" IS 'Incremented on logout-all-devices to invalidate all existing tokens';



CREATE OR REPLACE VIEW "public"."v_tenant_overview" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"text" AS "subdomain",
    NULL::"text" AS "subscription_tier",
    NULL::"public"."billing_status" AS "billing_status",
    NULL::"text" AS "stripe_customer_id",
    NULL::"text" AS "stripe_subscription_id",
    NULL::timestamp with time zone AS "trial_ends_at",
    NULL::timestamp with time zone AS "created_at",
    NULL::character varying(255) AS "group_name",
    NULL::bigint AS "property_count";


ALTER VIEW "public"."v_tenant_overview" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_tenant_overview" IS 'Aggregated tenant view for the control plane dashboard. Service role only.';



CREATE TABLE IF NOT EXISTS "public"."waitlist_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "module_id" "uuid",
    "customer_name" "text" NOT NULL,
    "party_size" integer NOT NULL,
    "phone_number" "text",
    "notes" "text",
    "status" "text" DEFAULT 'waiting'::"text",
    "estimated_wait_minutes" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "seated_at" timestamp with time zone,
    "type" "text" DEFAULT 'menu_service'::"text",
    "notified_at" timestamp with time zone,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."waitlist_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_failures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "source" "public"."webhook_source" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "error_message" "text" NOT NULL,
    "error_stack" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "max_retries" integer DEFAULT 5 NOT NULL,
    "next_retry_at" timestamp with time zone,
    "status" "public"."webhook_status" DEFAULT 'pending'::"public"."webhook_status" NOT NULL,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL
);


ALTER TABLE "public"."webhook_failures" OWNER TO "postgres";


COMMENT ON TABLE "public"."webhook_failures" IS 'Stores failed webhook events for retry processing with exponential backoff';



ALTER TABLE ONLY "public"."accommodation_add_ons"
    ADD CONSTRAINT "accommodation_add_ons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."accommodation_unit_price_rules"
    ADD CONSTRAINT "accommodation_unit_price_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."accommodation_units"
    ADD CONSTRAINT "accommodation_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alert_definitions"
    ADD CONSTRAINT "alert_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alert_history"
    ADD CONSTRAINT "alert_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_permissions"
    ADD CONSTRAINT "app_permissions_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."app_role_permissions"
    ADD CONSTRAINT "app_role_permissions_pkey" PRIMARY KEY ("role_name", "permission_slug");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."backups"
    ADD CONSTRAINT "backups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."billing_history"
    ADD CONSTRAINT "billing_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."biometric_credentials"
    ADD CONSTRAINT "biometric_credentials_credential_id_key" UNIQUE ("credential_id");



ALTER TABLE ONLY "public"."biometric_credentials"
    ADD CONSTRAINT "biometric_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_reviews"
    ADD CONSTRAINT "booking_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_reviews"
    ADD CONSTRAINT "booking_reviews_user_id_booking_id_key" UNIQUE ("user_id", "booking_id");



ALTER TABLE ONLY "public"."campaign_sends"
    ADD CONSTRAINT "campaign_sends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cancellation_policies"
    ADD CONSTRAINT "cancellation_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."capacity_windows"
    ADD CONSTRAINT "capacity_windows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cash_drawers"
    ADD CONSTRAINT "cash_drawers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cash_transactions"
    ADD CONSTRAINT "cash_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalog_categories"
    ADD CONSTRAINT "catalog_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_availability_updates"
    ADD CONSTRAINT "channel_availability_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_connections"
    ADD CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_connections"
    ADD CONSTRAINT "channel_connections_property_id_channel_code_key" UNIQUE ("property_id", "channel_code");



ALTER TABLE ONLY "public"."channel_rate_mappings"
    ADD CONSTRAINT "channel_rate_mappings_connection_id_rate_plan_id_key" UNIQUE ("connection_id", "rate_plan_id");



ALTER TABLE ONLY "public"."channel_rate_mappings"
    ADD CONSTRAINT "channel_rate_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_rate_updates"
    ADD CONSTRAINT "channel_rate_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_reservations"
    ADD CONSTRAINT "channel_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_room_mappings"
    ADD CONSTRAINT "channel_room_mappings_connection_id_room_type_id_key" UNIQUE ("connection_id", "room_type_id");



ALTER TABLE ONLY "public"."channel_room_mappings"
    ADD CONSTRAINT "channel_room_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_sync_log"
    ADD CONSTRAINT "channel_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chargebacks"
    ADD CONSTRAINT "chargebacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chargebacks"
    ADD CONSTRAINT "chargebacks_stripe_dispute_id_key" UNIQUE ("stripe_dispute_id");



ALTER TABLE ONLY "public"."chatbot_intents"
    ADD CONSTRAINT "chatbot_intents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitor_rates"
    ADD CONSTRAINT "competitor_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coupon_usage"
    ADD CONSTRAINT "coupon_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."currencies"
    ADD CONSTRAINT "currencies_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."customization_dual_write_log"
    ADD CONSTRAINT "customization_dual_write_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customization_events"
    ADD CONSTRAINT "customization_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customization_groups"
    ADD CONSTRAINT "customization_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customization_metrics"
    ADD CONSTRAINT "customization_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customization_options"
    ADD CONSTRAINT "customization_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_widgets"
    ADD CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demand_forecasts"
    ADD CONSTRAINT "demand_forecasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demand_forecasts"
    ADD CONSTRAINT "demand_forecasts_property_id_room_type_id_forecast_date_key" UNIQUE ("property_id", "room_type_id", "forecast_date");



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_user_id_device_token_key" UNIQUE ("user_id", "device_token");



ALTER TABLE ONLY "public"."digital_signatures"
    ADD CONSTRAINT "digital_signatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_bounces"
    ADD CONSTRAINT "email_bounces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_journeys"
    ADD CONSTRAINT "email_journeys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_suppression_list"
    ADD CONSTRAINT "email_suppression_list_pkey" PRIMARY KEY ("email");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_template_name_key" UNIQUE ("template_name");



ALTER TABLE ONLY "public"."engine_compensation_log"
    ADD CONSTRAINT "engine_compensation_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_feature_flags"
    ADD CONSTRAINT "engine_feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_financial_ledger"
    ADD CONSTRAINT "engine_financial_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_idempotency_keys"
    ADD CONSTRAINT "engine_idempotency_keys_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."engine_loyalty_events"
    ADD CONSTRAINT "engine_loyalty_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."engine_state_transitions"
    ADD CONSTRAINT "engine_state_transitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entity_customizations"
    ADD CONSTRAINT "entity_customizations_entity_type_entity_id_customization_g_key" UNIQUE ("entity_type", "entity_id", "customization_group_id");



ALTER TABLE ONLY "public"."entity_customizations"
    ADD CONSTRAINT "entity_customizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faqs"
    ADD CONSTRAINT "faqs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gdpr_consents"
    ADD CONSTRAINT "gdpr_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gdpr_consents"
    ADD CONSTRAINT "gdpr_consents_user_id_consent_type_key" UNIQUE ("user_id", "consent_type");



ALTER TABLE ONLY "public"."gdpr_cookie_consents"
    ADD CONSTRAINT "gdpr_cookie_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gdpr_data_sharing_log"
    ADD CONSTRAINT "gdpr_data_sharing_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gdpr_deletion_requests"
    ADD CONSTRAINT "gdpr_deletion_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gdpr_export_requests"
    ADD CONSTRAINT "gdpr_export_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gdpr_processing_activities"
    ADD CONSTRAINT "gdpr_processing_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gdpr_retention_policies"
    ADD CONSTRAINT "gdpr_retention_policies_data_category_key" UNIQUE ("data_category");



ALTER TABLE ONLY "public"."gdpr_retention_policies"
    ADD CONSTRAINT "gdpr_retention_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gift_card_ledger"
    ADD CONSTRAINT "gift_card_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gift_card_templates"
    ADD CONSTRAINT "gift_card_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gift_card_transactions"
    ADD CONSTRAINT "gift_card_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gift_cards"
    ADD CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_activities"
    ADD CONSTRAINT "group_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_bookings"
    ADD CONSTRAINT "group_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_contracts"
    ADD CONSTRAINT "group_contracts_contract_number_key" UNIQUE ("contract_number");



ALTER TABLE ONLY "public"."group_contracts"
    ADD CONSTRAINT "group_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_events"
    ADD CONSTRAINT "group_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_invoices"
    ADD CONSTRAINT "group_invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."group_invoices"
    ADD CONSTRAINT "group_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_payments"
    ADD CONSTRAINT "group_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_rate_templates"
    ADD CONSTRAINT "group_rate_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_report_schedules"
    ADD CONSTRAINT "group_report_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_reservations"
    ADD CONSTRAINT "group_reservations_group_code_key" UNIQUE ("group_code");



ALTER TABLE ONLY "public"."group_reservations"
    ADD CONSTRAINT "group_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_room_blocks"
    ADD CONSTRAINT "group_room_blocks_group_id_room_type_id_block_date_key" UNIQUE ("group_id", "room_type_id", "block_date");



ALTER TABLE ONLY "public"."group_room_blocks"
    ADD CONSTRAINT "group_room_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_settings"
    ADD CONSTRAINT "group_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_messaging_preferences"
    ADD CONSTRAINT "guest_messaging_preferences_guest_id_property_id_key" UNIQUE ("guest_id", "property_id");



ALTER TABLE ONLY "public"."guest_messaging_preferences"
    ADD CONSTRAINT "guest_messaging_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_rfm_scores"
    ADD CONSTRAINT "guest_rfm_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_rfm_scores"
    ADD CONSTRAINT "guest_rfm_scores_property_id_user_id_key" UNIQUE ("property_id", "user_id");



ALTER TABLE ONLY "public"."guest_segments"
    ADD CONSTRAINT "guest_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."housekeeping_inspections"
    ADD CONSTRAINT "housekeeping_inspections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."housekeeping_logs"
    ADD CONSTRAINT "housekeeping_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."housekeeping_schedules"
    ADD CONSTRAINT "housekeeping_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."housekeeping_sla"
    ADD CONSTRAINT "housekeeping_sla_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."housekeeping_supplies"
    ADD CONSTRAINT "housekeeping_supplies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."housekeeping_supplies"
    ADD CONSTRAINT "housekeeping_supplies_task_type_inventory_item_id_key" UNIQUE ("task_type", "inventory_item_id");



ALTER TABLE ONLY "public"."housekeeping_task_comments"
    ADD CONSTRAINT "housekeeping_task_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."housekeeping_task_types"
    ADD CONSTRAINT "housekeeping_task_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."housekeeping_tasks"
    ADD CONSTRAINT "housekeeping_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_batches"
    ADD CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_bom"
    ADD CONSTRAINT "inventory_bom_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_consumption"
    ADD CONSTRAINT "inventory_consumption_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_purchase_order_items"
    ADD CONSTRAINT "inventory_purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_purchase_orders"
    ADD CONSTRAINT "inventory_purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_purchase_orders"
    ADD CONSTRAINT "inventory_purchase_orders_po_number_key" UNIQUE ("po_number");



ALTER TABLE ONLY "public"."inventory_recipe_ingredients"
    ADD CONSTRAINT "inventory_recipe_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_recipes"
    ADD CONSTRAINT "inventory_recipes_catalog_item_id_key" UNIQUE ("catalog_item_id");



ALTER TABLE ONLY "public"."inventory_recipes"
    ADD CONSTRAINT "inventory_recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_suppliers"
    ADD CONSTRAINT "inventory_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_variance"
    ADD CONSTRAINT "inventory_variance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_wastage"
    ADD CONSTRAINT "inventory_wastage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journey_enrollments"
    ADD CONSTRAINT "journey_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journey_steps"
    ADD CONSTRAINT "journey_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_analytics"
    ADD CONSTRAINT "kiosk_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_analytics"
    ADD CONSTRAINT "kiosk_analytics_property_id_kiosk_id_date_key" UNIQUE ("property_id", "kiosk_id", "date");



ALTER TABLE ONLY "public"."kiosk_devices"
    ADD CONSTRAINT "kiosk_devices_device_code_key" UNIQUE ("device_code");



ALTER TABLE ONLY "public"."kiosk_devices"
    ADD CONSTRAINT "kiosk_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_hardware_events"
    ADD CONSTRAINT "kiosk_hardware_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_items"
    ADD CONSTRAINT "kiosk_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_key_stock"
    ADD CONSTRAINT "kiosk_key_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_screen_content"
    ADD CONSTRAINT "kiosk_screen_content_flow_id_step_key_language_key" UNIQUE ("flow_id", "step_key", "language");



ALTER TABLE ONLY "public"."kiosk_screen_content"
    ADD CONSTRAINT "kiosk_screen_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_screen_flows"
    ADD CONSTRAINT "kiosk_screen_flows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_sessions"
    ADD CONSTRAINT "kiosk_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kiosk_transactions"
    ADD CONSTRAINT "kiosk_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_fraud_flags"
    ADD CONSTRAINT "loyalty_fraud_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_members"
    ADD CONSTRAINT "loyalty_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_members"
    ADD CONSTRAINT "loyalty_members_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."loyalty_point_batches"
    ADD CONSTRAINT "loyalty_point_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_profiles"
    ADD CONSTRAINT "loyalty_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_settings"
    ADD CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_tiers"
    ADD CONSTRAINT "loyalty_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manager_approvals"
    ADD CONSTRAINT "manager_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manager_notification_settings"
    ADD CONSTRAINT "manager_notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manager_notification_settings"
    ADD CONSTRAINT "manager_notification_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."market_events"
    ADD CONSTRAINT "market_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_campaigns"
    ADD CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_email_templates"
    ADD CONSTRAINT "marketing_email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membership_plans"
    ADD CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_item_ingredients"
    ADD CONSTRAINT "menu_item_ingredients_catalog_item_id_inventory_item_id_key" UNIQUE ("catalog_item_id", "inventory_item_id");



ALTER TABLE ONLY "public"."menu_item_ingredients"
    ADD CONSTRAINT "menu_item_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messaging_channels"
    ADD CONSTRAINT "messaging_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messaging_channels"
    ADD CONSTRAINT "messaging_channels_property_id_channel_type_key" UNIQUE ("property_id", "channel_type");



ALTER TABLE ONLY "public"."metric_definitions"
    ADD CONSTRAINT "metric_definitions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."metric_definitions"
    ADD CONSTRAINT "metric_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mobile_key_access_log"
    ADD CONSTRAINT "mobile_key_access_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mobile_keys"
    ADD CONSTRAINT "mobile_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."module_templates"
    ADD CONSTRAINT "module_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_broadcasts"
    ADD CONSTRAINT "notification_broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_customizations"
    ADD CONSTRAINT "order_customizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_payment_splits"
    ADD CONSTRAINT "order_payment_splits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_history"
    ADD CONSTRAINT "password_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_ledger"
    ADD CONSTRAINT "payment_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pos_reconciliation"
    ADD CONSTRAINT "pos_reconciliation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pre_arrival_registrations"
    ADD CONSTRAINT "pre_arrival_registrations_access_token_key" UNIQUE ("access_token");



ALTER TABLE ONLY "public"."pre_arrival_registrations"
    ADD CONSTRAINT "pre_arrival_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_user_id_product_id_key" UNIQUE ("user_id", "product_id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_benchmarks"
    ADD CONSTRAINT "property_benchmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_benchmarks"
    ADD CONSTRAINT "property_benchmarks_property_id_period_start_period_end_met_key" UNIQUE ("property_id", "period_start", "period_end", "metric");



ALTER TABLE ONLY "public"."property_groups"
    ADD CONSTRAINT "property_groups_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."property_groups"
    ADD CONSTRAINT "property_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_settings"
    ADD CONSTRAINT "property_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_parity_alerts"
    ADD CONSTRAINT "rate_parity_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_parity_checks"
    ADD CONSTRAINT "rate_parity_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_parity_config"
    ADD CONSTRAINT "rate_parity_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_parity_config"
    ADD CONSTRAINT "rate_parity_config_property_id_key" UNIQUE ("property_id");



ALTER TABLE ONLY "public"."rate_parity_results"
    ADD CONSTRAINT "rate_parity_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_recommendations"
    ADD CONSTRAINT "rate_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reconciliation_log"
    ADD CONSTRAINT "reconciliation_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ref_type_telemetry"
    ADD CONSTRAINT "ref_type_telemetry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registration_documents"
    ADD CONSTRAINT "registration_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_daily_sales"
    ADD CONSTRAINT "report_daily_sales_date_key" UNIQUE ("date");



ALTER TABLE ONLY "public"."report_daily_sales"
    ADD CONSTRAINT "report_daily_sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_executions"
    ADD CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_hourly_metrics"
    ADD CONSTRAINT "report_hourly_metrics_date_hour_key" UNIQUE ("date", "hour");



ALTER TABLE ONLY "public"."report_hourly_metrics"
    ADD CONSTRAINT "report_hourly_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_product_performance"
    ADD CONSTRAINT "report_product_performance_date_catalog_item_id_key" UNIQUE ("date", "catalog_item_id");



ALTER TABLE ONLY "public"."report_product_performance"
    ADD CONSTRAINT "report_product_performance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_scheduled"
    ADD CONSTRAINT "report_scheduled_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_templates"
    ADD CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_queries"
    ADD CONSTRAINT "saved_queries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_reports"
    ADD CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seasonal_pricing_rules"
    ADD CONSTRAINT "seasonal_pricing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."segment_members"
    ADD CONSTRAINT "segment_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."segment_members"
    ADD CONSTRAINT "segment_members_segment_id_guest_id_key" UNIQUE ("segment_id", "guest_id");



ALTER TABLE ONLY "public"."service_locations"
    ADD CONSTRAINT "service_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_reviews"
    ADD CONSTRAINT "session_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_reviews"
    ADD CONSTRAINT "session_reviews_user_id_session_id_key" UNIQUE ("user_id", "session_id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."shared_inventory_allocations"
    ADD CONSTRAINT "shared_inventory_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."staff_shifts"
    ADD CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_inquiries"
    ADD CONSTRAINT "support_inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supported_languages"
    ADD CONSTRAINT "supported_languages_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."supported_languages"
    ADD CONSTRAINT "supported_languages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_config"
    ADD CONSTRAINT "system_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."system_defaults"
    ADD CONSTRAINT "system_defaults_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_defaults"
    ADD CONSTRAINT "system_defaults_setting_key_key" UNIQUE ("setting_key");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_integrations"
    ADD CONSTRAINT "tenant_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_subdomain_key" UNIQUE ("subdomain");



ALTER TABLE ONLY "public"."terminology_overrides"
    ADD CONSTRAINT "terminology_overrides_business_type_term_key_language_key" UNIQUE ("business_type", "term_key", "language");



ALTER TABLE ONLY "public"."terminology_overrides"
    ADD CONSTRAINT "terminology_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_clock_adjustments"
    ADD CONSTRAINT "time_clock_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."token_blacklist"
    ADD CONSTRAINT "token_blacklist_pkey" PRIMARY KEY ("jti");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."translation_keys"
    ADD CONSTRAINT "translation_keys_key_path_key" UNIQUE ("key_path");



ALTER TABLE ONLY "public"."translation_keys"
    ADD CONSTRAINT "translation_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."translations"
    ADD CONSTRAINT "translations_namespace_key_locale_key" UNIQUE ("namespace", "key", "locale");



ALTER TABLE ONLY "public"."translations"
    ADD CONSTRAINT "translations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."two_factor_auth"
    ADD CONSTRAINT "two_factor_auth_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."two_factor_pending"
    ADD CONSTRAINT "two_factor_pending_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."engine_feature_flags"
    ADD CONSTRAINT "uq_feature_flag_tenant" UNIQUE ("tenant_id", "flag_name");



ALTER TABLE ONLY "public"."group_settings"
    ADD CONSTRAINT "uq_group_setting" UNIQUE ("group_id", "setting_key");



ALTER TABLE ONLY "public"."engine_loyalty_events"
    ADD CONSTRAINT "uq_loyalty_earn_per_entity" UNIQUE ("entity_id", "event_type");



ALTER TABLE ONLY "public"."payment_ledger"
    ADD CONSTRAINT "uq_payment_ledger_webhook" UNIQUE ("webhook_id");



ALTER TABLE ONLY "public"."property_settings"
    ADD CONSTRAINT "uq_property_setting" UNIQUE ("property_id", "setting_key");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "uq_roles_tenant_name" UNIQUE ("tenant_id", "name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "uq_roles_tenant_slug" UNIQUE ("tenant_id", "slug");



ALTER TABLE ONLY "public"."service_locations"
    ADD CONSTRAINT "uq_service_locations_module_name" UNIQUE ("module_id", "name");



ALTER TABLE ONLY "public"."tenant_integrations"
    ADD CONSTRAINT "uq_tenant_integrations_tenant_type" UNIQUE ("tenant_id", "integration_type");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "uq_user_roles_user_role" UNIQUE ("user_id", "role_id");



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_group_access"
    ADD CONSTRAINT "user_group_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_group_access"
    ADD CONSTRAINT "user_group_access_user_id_group_id_key" UNIQUE ("user_id", "group_id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_id", "permission_id");



ALTER TABLE ONLY "public"."user_property_access"
    ADD CONSTRAINT "user_property_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_property_access"
    ADD CONSTRAINT "user_property_access_user_id_property_id_key" UNIQUE ("user_id", "property_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_failures"
    ADD CONSTRAINT "webhook_failures_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_accommodation_add_ons_module_id" ON "public"."accommodation_add_ons" USING "btree" ("module_id");



CREATE INDEX "idx_accommodation_units_cleaning_status" ON "public"."accommodation_units" USING "btree" ("cleaning_status");



CREATE INDEX "idx_accommodation_units_deleted_at" ON "public"."accommodation_units" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_accommodation_units_module" ON "public"."accommodation_units" USING "btree" ("module_id");



CREATE INDEX "idx_accommodation_units_module_id" ON "public"."accommodation_units" USING "btree" ("module_id");



CREATE INDEX "idx_alert_definitions_active" ON "public"."alert_definitions" USING "btree" ("property_id", "is_active");



CREATE INDEX "idx_alert_definitions_property" ON "public"."alert_definitions" USING "btree" ("property_id");



CREATE INDEX "idx_alert_history_active" ON "public"."alert_history" USING "btree" ("property_id", "status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_alert_history_property" ON "public"."alert_history" USING "btree" ("property_id");



CREATE INDEX "idx_alert_history_triggered" ON "public"."alert_history" USING "btree" ("triggered_at" DESC);



CREATE INDEX "idx_app_role_permissions_role" ON "public"."app_role_permissions" USING "btree" ("role_name");



CREATE INDEX "idx_audit_logs_property_id" ON "public"."audit_logs" USING "btree" ("property_id");



CREATE INDEX "idx_audit_logs_resource" ON "public"."audit_logs" USING "btree" ("resource", "resource_id");



CREATE INDEX "idx_audit_logs_user" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_backups_created_at" ON "public"."backups" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_batches_expiry" ON "public"."inventory_batches" USING "btree" ("expiry_date");



CREATE INDEX "idx_batches_item" ON "public"."inventory_batches" USING "btree" ("item_id");



CREATE INDEX "idx_batches_item_status" ON "public"."inventory_batches" USING "btree" ("item_id", "status");



CREATE INDEX "idx_benchmarks_period" ON "public"."property_benchmarks" USING "btree" ("period_start", "period_end");



CREATE INDEX "idx_benchmarks_property" ON "public"."property_benchmarks" USING "btree" ("property_id");



CREATE INDEX "idx_billing_history_tenant" ON "public"."billing_history" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_biometric_credentials_active" ON "public"."biometric_credentials" USING "btree" ("user_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_biometric_credentials_credential_id" ON "public"."biometric_credentials" USING "btree" ("credential_id");



CREATE INDEX "idx_biometric_credentials_user_id" ON "public"."biometric_credentials" USING "btree" ("user_id");



CREATE INDEX "idx_booking_reviews_approved" ON "public"."booking_reviews" USING "btree" ("is_approved");



CREATE INDEX "idx_booking_reviews_booking" ON "public"."booking_reviews" USING "btree" ("booking_id");



CREATE INDEX "idx_booking_reviews_unit" ON "public"."booking_reviews" USING "btree" ("unit_id");



CREATE INDEX "idx_booking_reviews_user" ON "public"."booking_reviews" USING "btree" ("user_id");



CREATE INDEX "idx_broadcasts_created_at" ON "public"."notification_broadcasts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_broadcasts_scheduled" ON "public"."notification_broadcasts" USING "btree" ("scheduled_for") WHERE (("scheduled_for" IS NOT NULL) AND ("sent_at" IS NULL));



CREATE INDEX "idx_broadcasts_target_type" ON "public"."notification_broadcasts" USING "btree" ("target_type");



CREATE INDEX "idx_campaign_sends_campaign" ON "public"."campaign_sends" USING "btree" ("campaign_id");



CREATE INDEX "idx_campaign_sends_guest" ON "public"."campaign_sends" USING "btree" ("guest_id");



CREATE INDEX "idx_campaigns_property" ON "public"."marketing_campaigns" USING "btree" ("property_id");



CREATE INDEX "idx_campaigns_status" ON "public"."marketing_campaigns" USING "btree" ("status");



CREATE INDEX "idx_cancellation_policies_type" ON "public"."cancellation_policies" USING "btree" ("booking_type", "days_before_checkin" DESC);



CREATE INDEX "idx_capacity_windows_active" ON "public"."capacity_windows" USING "btree" ("module_id", "is_active");



CREATE INDEX "idx_capacity_windows_module" ON "public"."capacity_windows" USING "btree" ("module_id");



CREATE INDEX "idx_capacity_windows_module_id" ON "public"."capacity_windows" USING "btree" ("module_id");



CREATE INDEX "idx_catalog_categories_module" ON "public"."catalog_categories" USING "btree" ("module_id");



CREATE UNIQUE INDEX "idx_catalog_categories_name_module" ON "public"."catalog_categories" USING "btree" ("name", "module_id");



CREATE INDEX "idx_catalog_items_available" ON "public"."catalog_items" USING "btree" ("module_id", "is_available");



CREATE INDEX "idx_catalog_items_module_id" ON "public"."catalog_items" USING "btree" ("module_id");



CREATE INDEX "idx_catalog_items_property_id" ON "public"."catalog_items" USING "btree" ("property_id");



CREATE INDEX "idx_catalog_items_tenant_id" ON "public"."catalog_items" USING "btree" ("tenant_id");



CREATE INDEX "idx_channel_avail_date" ON "public"."channel_availability_updates" USING "btree" ("date");



CREATE INDEX "idx_channel_avail_status" ON "public"."channel_availability_updates" USING "btree" ("status");



CREATE INDEX "idx_channel_conn_property" ON "public"."channel_connections" USING "btree" ("property_id");



CREATE INDEX "idx_channel_conn_status" ON "public"."channel_connections" USING "btree" ("status");



CREATE INDEX "idx_channel_rate_date" ON "public"."channel_rate_updates" USING "btree" ("date");



CREATE INDEX "idx_channel_rate_map_conn" ON "public"."channel_rate_mappings" USING "btree" ("connection_id");



CREATE INDEX "idx_channel_res_booking" ON "public"."channel_reservations" USING "btree" ("channel_booking_ref");



CREATE INDEX "idx_channel_res_checkin" ON "public"."channel_reservations" USING "btree" ("check_in");



CREATE INDEX "idx_channel_room_map_conn" ON "public"."channel_room_mappings" USING "btree" ("connection_id");



CREATE INDEX "idx_channel_sync_conn" ON "public"."channel_sync_log" USING "btree" ("connection_id");



CREATE INDEX "idx_channel_sync_type" ON "public"."channel_sync_log" USING "btree" ("sync_type");



CREATE INDEX "idx_chargebacks_created_at" ON "public"."chargebacks" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_chargebacks_due_date" ON "public"."chargebacks" USING "btree" ("due_date") WHERE ("status" = 'needs_response'::"public"."chargeback_status");



CREATE INDEX "idx_chargebacks_payment_id" ON "public"."chargebacks" USING "btree" ("payment_id");



CREATE INDEX "idx_chargebacks_status" ON "public"."chargebacks" USING "btree" ("status");



CREATE INDEX "idx_chargebacks_stripe_dispute_id" ON "public"."chargebacks" USING "btree" ("stripe_dispute_id");



CREATE INDEX "idx_comp_review" ON "public"."engine_compensation_log" USING "btree" ("requires_manual_review") WHERE ("requires_manual_review" = true);



CREATE INDEX "idx_comp_tx" ON "public"."engine_compensation_log" USING "btree" ("tx_id");



CREATE INDEX "idx_competitor_rates_property_date" ON "public"."competitor_rates" USING "btree" ("property_id", "rate_date");



CREATE INDEX "idx_conversations_guest" ON "public"."conversations" USING "btree" ("guest_id");



CREATE INDEX "idx_conversations_property" ON "public"."conversations" USING "btree" ("property_id");



CREATE INDEX "idx_conversations_status" ON "public"."conversations" USING "btree" ("status");



CREATE INDEX "idx_coupon_usage_coupon" ON "public"."coupon_usage" USING "btree" ("coupon_id");



CREATE INDEX "idx_coupon_usage_ip" ON "public"."coupon_usage" USING "btree" ("coupon_id", "ip_address");



CREATE INDEX "idx_coupon_usage_user" ON "public"."coupon_usage" USING "btree" ("user_id");



CREATE INDEX "idx_coupons_code" ON "public"."coupons" USING "btree" ("code");



CREATE UNIQUE INDEX "idx_coupons_code_prop" ON "public"."coupons" USING "btree" ("property_id", "code");



CREATE INDEX "idx_coupons_deleted_at" ON "public"."coupons" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_coupons_status" ON "public"."coupons" USING "btree" ("is_active", "valid_from", "valid_until");



CREATE INDEX "idx_currencies_is_active" ON "public"."currencies" USING "btree" ("is_active");



CREATE INDEX "idx_currencies_is_default" ON "public"."currencies" USING "btree" ("is_default") WHERE ("is_default" = true);



CREATE UNIQUE INDEX "idx_currencies_single_default" ON "public"."currencies" USING "btree" ("is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_customization_events_created" ON "public"."customization_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_customization_events_order" ON "public"."customization_events" USING "btree" ("order_type", "order_id");



CREATE INDEX "idx_customization_events_type" ON "public"."customization_events" USING "btree" ("event_type");



CREATE INDEX "idx_customization_groups_entity_types" ON "public"."customization_groups" USING "gin" ("applicable_entity_types") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_customization_metrics_name" ON "public"."customization_metrics" USING "btree" ("metric_name", "recorded_at" DESC);



CREATE INDEX "idx_customization_options_group" ON "public"."customization_options" USING "btree" ("group_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_customization_options_inventory" ON "public"."customization_options" USING "btree" ("inventory_item_id") WHERE ("inventory_item_id" IS NOT NULL);



CREATE INDEX "idx_demand_forecasts_property_date" ON "public"."demand_forecasts" USING "btree" ("property_id", "forecast_date");



CREATE INDEX "idx_device_tokens_active" ON "public"."device_tokens" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_device_tokens_platform" ON "public"."device_tokens" USING "btree" ("platform");



CREATE INDEX "idx_device_tokens_token" ON "public"."device_tokens" USING "btree" ("device_token");



CREATE INDEX "idx_device_tokens_user_id" ON "public"."device_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_dual_write_log_match" ON "public"."customization_dual_write_log" USING "btree" ("results_match", "created_at" DESC);



CREATE INDEX "idx_efl_entity" ON "public"."engine_financial_ledger" USING "btree" ("entity_id", "created_at" DESC);



CREATE INDEX "idx_efl_idem" ON "public"."engine_financial_ledger" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_efl_module" ON "public"."engine_financial_ledger" USING "btree" ("module_id", "created_at" DESC);



CREATE INDEX "idx_efl_tenant" ON "public"."engine_financial_ledger" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_ele_customer" ON "public"."engine_loyalty_events" USING "btree" ("customer_id");



CREATE INDEX "idx_ele_entity" ON "public"."engine_loyalty_events" USING "btree" ("entity_id");



CREATE INDEX "idx_email_bounces_bounced_at" ON "public"."email_bounces" USING "btree" ("bounced_at" DESC);



CREATE INDEX "idx_email_bounces_email" ON "public"."email_bounces" USING "btree" ("email");



CREATE INDEX "idx_email_bounces_soft_recent" ON "public"."email_bounces" USING "btree" ("email", "bounced_at") WHERE ("bounce_type" = 'soft'::"public"."bounce_type");



CREATE INDEX "idx_email_bounces_type" ON "public"."email_bounces" USING "btree" ("bounce_type");



CREATE INDEX "idx_email_templates_name" ON "public"."email_templates" USING "btree" ("template_name");



CREATE INDEX "idx_enrollments_guest" ON "public"."journey_enrollments" USING "btree" ("guest_id");



CREATE INDEX "idx_enrollments_journey" ON "public"."journey_enrollments" USING "btree" ("journey_id");



CREATE INDEX "idx_entity_customizations_group" ON "public"."entity_customizations" USING "btree" ("customization_group_id");



CREATE INDEX "idx_entity_customizations_lookup" ON "public"."entity_customizations" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_est_action" ON "public"."engine_state_transitions" USING "btree" ("action");



CREATE INDEX "idx_est_created" ON "public"."engine_state_transitions" USING "btree" ("created_at");



CREATE INDEX "idx_est_engine" ON "public"."engine_state_transitions" USING "btree" ("engine_type");



CREATE INDEX "idx_est_entity" ON "public"."engine_state_transitions" USING "btree" ("entity_id");



CREATE INDEX "idx_est_tenant" ON "public"."engine_state_transitions" USING "btree" ("tenant_id");



CREATE INDEX "idx_gdpr_consents_user" ON "public"."gdpr_consents" USING "btree" ("user_id");



CREATE INDEX "idx_gdpr_cookie_consents_user" ON "public"."gdpr_cookie_consents" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_gdpr_cookie_consents_version" ON "public"."gdpr_cookie_consents" USING "btree" ("consent_version");



CREATE INDEX "idx_gdpr_deletion_user" ON "public"."gdpr_deletion_requests" USING "btree" ("user_id");



CREATE INDEX "idx_gdpr_export_status" ON "public"."gdpr_export_requests" USING "btree" ("status");



CREATE INDEX "idx_gdpr_export_user" ON "public"."gdpr_export_requests" USING "btree" ("user_id");



CREATE INDEX "idx_gift_card_transactions_gift_card" ON "public"."gift_card_transactions" USING "btree" ("gift_card_id");



CREATE INDEX "idx_gift_cards_code" ON "public"."gift_cards" USING "btree" ("code");



CREATE UNIQUE INDEX "idx_gift_cards_code_prop" ON "public"."gift_cards" USING "btree" ("property_id", "code");



CREATE INDEX "idx_gift_cards_deleted_at" ON "public"."gift_cards" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_gift_cards_status" ON "public"."gift_cards" USING "btree" ("status");



CREATE INDEX "idx_group_bookings_group" ON "public"."group_bookings" USING "btree" ("group_id");



CREATE INDEX "idx_group_events_group" ON "public"."group_events" USING "btree" ("group_id");



CREATE INDEX "idx_group_reservations_dates" ON "public"."group_reservations" USING "btree" ("arrival_date", "departure_date");



CREATE INDEX "idx_group_reservations_property" ON "public"."group_reservations" USING "btree" ("property_id");



CREATE INDEX "idx_group_room_blocks_group" ON "public"."group_room_blocks" USING "btree" ("group_id");



CREATE INDEX "idx_group_settings_group" ON "public"."group_settings" USING "btree" ("group_id");



CREATE INDEX "idx_group_settings_key" ON "public"."group_settings" USING "btree" ("setting_key");



CREATE INDEX "idx_guest_rfm_property" ON "public"."guest_rfm_scores" USING "btree" ("property_id");



CREATE INDEX "idx_guest_rfm_scores" ON "public"."guest_rfm_scores" USING "btree" ("property_id", "r_score", "f_score", "m_score");



CREATE INDEX "idx_guest_rfm_segment" ON "public"."guest_rfm_scores" USING "btree" ("property_id", "segment");



CREATE INDEX "idx_guests_email" ON "public"."guests" USING "btree" ("email");



CREATE INDEX "idx_guests_property" ON "public"."guests" USING "btree" ("property_id");



CREATE INDEX "idx_hk_inspections_task" ON "public"."housekeeping_inspections" USING "btree" ("task_id");



CREATE INDEX "idx_hk_supplies_type" ON "public"."housekeeping_supplies" USING "btree" ("task_type");



CREATE INDEX "idx_housekeeping_logs_task" ON "public"."housekeeping_logs" USING "btree" ("task_id");



CREATE INDEX "idx_housekeeping_tasks_assigned" ON "public"."housekeeping_tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_housekeeping_tasks_booking_id" ON "public"."housekeeping_tasks" USING "btree" ("booking_id");



CREATE INDEX "idx_housekeeping_tasks_deleted_at" ON "public"."housekeeping_tasks" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_housekeeping_tasks_inspected_at" ON "public"."housekeeping_tasks" USING "btree" ("inspected_at") WHERE ("inspected_at" IS NOT NULL);



CREATE INDEX "idx_housekeeping_tasks_scheduled" ON "public"."housekeeping_tasks" USING "btree" ("scheduled_for");



CREATE INDEX "idx_housekeeping_tasks_status" ON "public"."housekeeping_tasks" USING "btree" ("status");



CREATE INDEX "idx_housekeeping_tasks_unit" ON "public"."housekeeping_tasks" USING "btree" ("unit_id");



CREATE INDEX "idx_idem_expires" ON "public"."engine_idempotency_keys" USING "btree" ("expires_at");



CREATE INDEX "idx_inspections_task" ON "public"."housekeeping_inspections" USING "btree" ("task_id");



CREATE INDEX "idx_inspections_unit" ON "public"."housekeeping_inspections" USING "btree" ("unit_id");



CREATE INDEX "idx_inventory_alerts_item" ON "public"."inventory_alerts" USING "btree" ("item_id", "is_resolved");



CREATE INDEX "idx_inventory_batches_deleted_at" ON "public"."inventory_batches" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_inventory_batches_item" ON "public"."inventory_batches" USING "btree" ("item_id");



CREATE INDEX "idx_inventory_items_category" ON "public"."inventory_items" USING "btree" ("category_id");



CREATE INDEX "idx_inventory_items_sku" ON "public"."inventory_items" USING "btree" ("sku");



CREATE UNIQUE INDEX "idx_inventory_items_sku_prop" ON "public"."inventory_items" USING "btree" ("property_id", "sku");



CREATE INDEX "idx_inventory_items_stock" ON "public"."inventory_items" USING "btree" ("current_stock", "min_stock_level");



CREATE INDEX "idx_inventory_po_items_po" ON "public"."inventory_purchase_order_items" USING "btree" ("purchase_order_id");



CREATE INDEX "idx_inventory_recipe_ingredients_recipe" ON "public"."inventory_recipe_ingredients" USING "btree" ("recipe_id");



CREATE INDEX "idx_inventory_recipes_deleted_at" ON "public"."inventory_recipes" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_inventory_recipes_menu_item" ON "public"."inventory_recipes" USING "btree" ("catalog_item_id");



CREATE INDEX "idx_inventory_transactions_item" ON "public"."inventory_transactions" USING "btree" ("item_id");



CREATE INDEX "idx_inventory_variance_item" ON "public"."inventory_variance" USING "btree" ("item_id");



CREATE INDEX "idx_inventory_wastage_item" ON "public"."inventory_wastage" USING "btree" ("item_id");



CREATE INDEX "idx_journeys_property" ON "public"."email_journeys" USING "btree" ("property_id");



CREATE INDEX "idx_kiosk_analytics_date" ON "public"."kiosk_analytics" USING "btree" ("property_id", "date");



CREATE INDEX "idx_kiosk_devices_property" ON "public"."kiosk_devices" USING "btree" ("property_id");



CREATE INDEX "idx_kiosk_devices_status" ON "public"."kiosk_devices" USING "btree" ("status");



CREATE INDEX "idx_kiosk_hardware_events_kiosk" ON "public"."kiosk_hardware_events" USING "btree" ("kiosk_id");



CREATE INDEX "idx_kiosk_hardware_events_resolved" ON "public"."kiosk_hardware_events" USING "btree" ("resolved");



CREATE INDEX "idx_kiosk_sessions_booking" ON "public"."kiosk_sessions" USING "btree" ("booking_id");



CREATE INDEX "idx_kiosk_sessions_kiosk" ON "public"."kiosk_sessions" USING "btree" ("kiosk_id");



CREATE INDEX "idx_kiosk_sessions_started" ON "public"."kiosk_sessions" USING "btree" ("started_at");



CREATE INDEX "idx_kiosk_sessions_status" ON "public"."kiosk_sessions" USING "btree" ("status");



CREATE INDEX "idx_kiosk_transactions_session" ON "public"."kiosk_transactions" USING "btree" ("session_id");



CREATE INDEX "idx_loyalty_batches_user" ON "public"."loyalty_point_batches" USING "btree" ("user_id", "is_expired");



CREATE INDEX "idx_loyalty_members_property_id" ON "public"."loyalty_members" USING "btree" ("property_id");



CREATE INDEX "idx_loyalty_members_tenant_id" ON "public"."loyalty_members" USING "btree" ("tenant_id");



CREATE INDEX "idx_loyalty_members_tier" ON "public"."loyalty_members" USING "btree" ("tier_id");



CREATE INDEX "idx_loyalty_members_user" ON "public"."loyalty_members" USING "btree" ("user_id");



CREATE INDEX "idx_loyalty_rewards_active" ON "public"."loyalty_rewards" USING "btree" ("is_active", "valid_from", "valid_until");



CREATE UNIQUE INDEX "idx_loyalty_tiers_name" ON "public"."loyalty_tiers" USING "btree" ("name");



CREATE INDEX "idx_loyalty_transactions_deleted_at" ON "public"."loyalty_transactions" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_loyalty_transactions_member" ON "public"."loyalty_transactions" USING "btree" ("member_id");



CREATE INDEX "idx_manager_approvals_created_at" ON "public"."manager_approvals" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_manager_approvals_deleted_at" ON "public"."manager_approvals" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_manager_approvals_pending" ON "public"."manager_approvals" USING "btree" ("status", "created_at") WHERE (("status")::"text" = 'pending'::"text");



CREATE INDEX "idx_manager_approvals_property_id" ON "public"."manager_approvals" USING "btree" ("property_id");



CREATE INDEX "idx_manager_approvals_requested_by" ON "public"."manager_approvals" USING "btree" ("requested_by");



CREATE INDEX "idx_manager_approvals_reviewed_by" ON "public"."manager_approvals" USING "btree" ("reviewed_by");



CREATE INDEX "idx_manager_approvals_status" ON "public"."manager_approvals" USING "btree" ("status");



CREATE INDEX "idx_manager_approvals_type" ON "public"."manager_approvals" USING "btree" ("type");



CREATE INDEX "idx_market_events_property_dates" ON "public"."market_events" USING "btree" ("property_id", "start_date", "end_date");



CREATE INDEX "idx_membership_plans_active" ON "public"."membership_plans" USING "btree" ("module_id", "is_active");



CREATE INDEX "idx_membership_plans_module_id" ON "public"."membership_plans" USING "btree" ("module_id");



CREATE INDEX "idx_memberships_customer_id" ON "public"."memberships" USING "btree" ("customer_id") WHERE ("customer_id" IS NOT NULL);



CREATE INDEX "idx_memberships_expires_at" ON "public"."memberships" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_memberships_module_id" ON "public"."memberships" USING "btree" ("module_id");



CREATE INDEX "idx_memberships_plan_id" ON "public"."memberships" USING "btree" ("plan_id");



CREATE INDEX "idx_memberships_status" ON "public"."memberships" USING "btree" ("module_id", "status");



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_mobile_keys_booking" ON "public"."mobile_keys" USING "btree" ("booking_id");



CREATE INDEX "idx_mobile_keys_property" ON "public"."mobile_keys" USING "btree" ("property_id");



CREATE INDEX "idx_module_templates_active" ON "public"."module_templates" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_module_templates_category" ON "public"."module_templates" USING "btree" ("category");



CREATE INDEX "idx_module_templates_engine" ON "public"."module_templates" USING "btree" ("engine_type");



CREATE INDEX "idx_modules_active" ON "public"."modules" USING "btree" ("is_active");



CREATE INDEX "idx_modules_engine_type" ON "public"."modules" USING "btree" ("engine_type");



CREATE INDEX "idx_modules_property_id" ON "public"."modules" USING "btree" ("property_id");



CREATE INDEX "idx_modules_slug" ON "public"."modules" USING "btree" ("slug");



CREATE UNIQUE INDEX "idx_modules_slug_tenant" ON "public"."modules" USING "btree" ("slug", "tenant_id");



CREATE INDEX "idx_modules_sort" ON "public"."modules" USING "btree" ("sort_order");



CREATE INDEX "idx_notification_broadcasts_property_id" ON "public"."notification_broadcasts" USING "btree" ("property_id");



CREATE INDEX "idx_notification_logs_created_at" ON "public"."notification_logs" USING "btree" ("created_at");



CREATE INDEX "idx_notification_logs_status" ON "public"."notification_logs" USING "btree" ("status");



CREATE INDEX "idx_notification_logs_type" ON "public"."notification_logs" USING "btree" ("notification_type");



CREATE INDEX "idx_notification_logs_user_id" ON "public"."notification_logs" USING "btree" ("user_id");



CREATE INDEX "idx_notification_templates_property_id" ON "public"."notification_templates" USING "btree" ("property_id");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_is_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_property_id" ON "public"."notifications" USING "btree" ("property_id");



CREATE INDEX "idx_notifications_scheduled" ON "public"."notifications" USING "btree" ("scheduled_for") WHERE (("scheduled_for" IS NOT NULL) AND ("sent_at" IS NULL));



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_order_customizations_item" ON "public"."order_customizations" USING "btree" ("order_item_id") WHERE ("order_item_id" IS NOT NULL);



CREATE INDEX "idx_order_customizations_order" ON "public"."order_customizations" USING "btree" ("order_type", "order_id");



CREATE INDEX "idx_parity_alerts_property" ON "public"."rate_parity_alerts" USING "btree" ("property_id");



CREATE INDEX "idx_parity_alerts_status" ON "public"."rate_parity_alerts" USING "btree" ("status");



CREATE INDEX "idx_parity_checks_date" ON "public"."rate_parity_checks" USING "btree" ("check_date");



CREATE INDEX "idx_parity_checks_property" ON "public"."rate_parity_checks" USING "btree" ("property_id");



CREATE INDEX "idx_parity_config_property" ON "public"."rate_parity_config" USING "btree" ("property_id");



CREATE INDEX "idx_password_history_user" ON "public"."password_history" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_payment_ledger_gateway_ref" ON "public"."payment_ledger" USING "btree" ("gateway_reference_id");



CREATE INDEX "idx_payment_ledger_webhook" ON "public"."payment_ledger" USING "btree" ("webhook_id");



CREATE INDEX "idx_payments_reference" ON "public"."payments" USING "btree" ("reference_type", "reference_id");



CREATE INDEX "idx_plans_active" ON "public"."plans" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_plans_code" ON "public"."plans" USING "btree" ("code");



CREATE INDEX "idx_plans_sort" ON "public"."plans" USING "btree" ("sort_order");



CREATE INDEX "idx_po_status" ON "public"."inventory_purchase_orders" USING "btree" ("status");



CREATE INDEX "idx_po_supplier" ON "public"."inventory_purchase_orders" USING "btree" ("supplier_id");



CREATE INDEX "idx_price_history_dates" ON "public"."price_history" USING "btree" ("check_in_date");



CREATE INDEX "idx_price_history_item" ON "public"."price_history" USING "btree" ("item_type", "item_id");



CREATE INDEX "idx_price_history_recorded" ON "public"."price_history" USING "btree" ("recorded_at");



CREATE INDEX "idx_pricing_rules_property" ON "public"."pricing_rules" USING "btree" ("property_id");



CREATE INDEX "idx_product_reviews_approved" ON "public"."product_reviews" USING "btree" ("is_approved");



CREATE INDEX "idx_product_reviews_product" ON "public"."product_reviews" USING "btree" ("product_id");



CREATE INDEX "idx_product_reviews_user" ON "public"."product_reviews" USING "btree" ("user_id");



CREATE INDEX "idx_properties_active" ON "public"."properties" USING "btree" ("is_active");



CREATE INDEX "idx_properties_code" ON "public"."properties" USING "btree" ("property_code");



CREATE INDEX "idx_properties_deleted_at" ON "public"."properties" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_properties_group" ON "public"."properties" USING "btree" ("group_id");



CREATE INDEX "idx_properties_name" ON "public"."properties" USING "btree" ("name");



CREATE UNIQUE INDEX "idx_properties_tenant_public_slug" ON "public"."properties" USING "btree" ("group_id", "public_slug") WHERE ("public_slug" IS NOT NULL);



CREATE INDEX "idx_property_groups_tenant" ON "public"."property_groups" USING "btree" ("tenant_id") WHERE ("tenant_id" IS NOT NULL);



CREATE INDEX "idx_property_settings_category" ON "public"."property_settings" USING "btree" ("category");



CREATE INDEX "idx_property_settings_key" ON "public"."property_settings" USING "btree" ("setting_key");



CREATE INDEX "idx_property_settings_property" ON "public"."property_settings" USING "btree" ("property_id");



CREATE INDEX "idx_rate_recommendations_property_date" ON "public"."rate_recommendations" USING "btree" ("property_id", "recommendation_date");



CREATE INDEX "idx_recipe_ingredients_item" ON "public"."inventory_recipe_ingredients" USING "btree" ("inventory_item_id");



CREATE INDEX "idx_recipe_ingredients_recipe" ON "public"."inventory_recipe_ingredients" USING "btree" ("recipe_id");



CREATE INDEX "idx_recipes_menu_item" ON "public"."inventory_recipes" USING "btree" ("catalog_item_id");



CREATE INDEX "idx_ref_type_telemetry_detected" ON "public"."ref_type_telemetry" USING "btree" ("detected_at" DESC);



CREATE INDEX "idx_ref_type_telemetry_raw" ON "public"."ref_type_telemetry" USING "btree" ("raw_value");



CREATE INDEX "idx_registrations_booking" ON "public"."pre_arrival_registrations" USING "btree" ("booking_id");



CREATE INDEX "idx_registrations_property" ON "public"."pre_arrival_registrations" USING "btree" ("property_id");



CREATE INDEX "idx_registrations_token" ON "public"."pre_arrival_registrations" USING "btree" ("access_token");



CREATE INDEX "idx_report_executions_property" ON "public"."report_executions" USING "btree" ("property_id");



CREATE INDEX "idx_report_scheduled_property" ON "public"."report_scheduled" USING "btree" ("property_id");



CREATE INDEX "idx_report_templates_property" ON "public"."report_templates" USING "btree" ("property_id");



CREATE INDEX "idx_reviews_module" ON "public"."reviews" USING "btree" ("module_id");



CREATE INDEX "idx_reviews_rating" ON "public"."reviews" USING "btree" ("rating");



CREATE INDEX "idx_reviews_status" ON "public"."reviews" USING "btree" ("status");



CREATE INDEX "idx_roles_deleted_at" ON "public"."roles" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_saved_queries_property" ON "public"."saved_queries" USING "btree" ("property_id");



CREATE INDEX "idx_saved_queries_user" ON "public"."saved_queries" USING "btree" ("created_by");



CREATE INDEX "idx_saved_reports_property" ON "public"."saved_reports" USING "btree" ("property_id");



CREATE INDEX "idx_seasonal_pricing_active" ON "public"."seasonal_pricing_rules" USING "btree" ("is_active");



CREATE INDEX "idx_seasonal_pricing_dates" ON "public"."seasonal_pricing_rules" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_seasonal_pricing_priority" ON "public"."seasonal_pricing_rules" USING "btree" ("priority" DESC);



CREATE INDEX "idx_security_audit_composite" ON "public"."security_audit_log" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "idx_security_audit_created_at" ON "public"."security_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_security_audit_event_type" ON "public"."security_audit_log" USING "btree" ("event_type");



CREATE INDEX "idx_security_audit_ip_address" ON "public"."security_audit_log" USING "btree" ("ip_address");



CREATE INDEX "idx_security_audit_severity" ON "public"."security_audit_log" USING "btree" ("severity");



CREATE INDEX "idx_security_audit_target_user" ON "public"."security_audit_log" USING "btree" ("target_user_id");



CREATE INDEX "idx_security_audit_user_id" ON "public"."security_audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_segments_property" ON "public"."guest_segments" USING "btree" ("property_id");



CREATE INDEX "idx_service_locations_module" ON "public"."service_locations" USING "btree" ("module_id");



CREATE INDEX "idx_service_locations_property" ON "public"."service_locations" USING "btree" ("property_id") WHERE ("property_id" IS NOT NULL);



CREATE INDEX "idx_service_locations_tenant" ON "public"."service_locations" USING "btree" ("tenant_id");



CREATE INDEX "idx_session_reviews_approved" ON "public"."session_reviews" USING "btree" ("is_approved");



CREATE INDEX "idx_session_reviews_session" ON "public"."session_reviews" USING "btree" ("session_id");



CREATE INDEX "idx_session_reviews_type" ON "public"."session_reviews" USING "btree" ("session_type");



CREATE INDEX "idx_session_reviews_user" ON "public"."session_reviews" USING "btree" ("user_id");



CREATE INDEX "idx_sessions_deleted_at" ON "public"."sessions" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_sessions_expires_at" ON "public"."sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_sessions_refresh_token" ON "public"."sessions" USING "btree" ("refresh_token");



CREATE INDEX "idx_sessions_user_id_is_active" ON "public"."sessions" USING "btree" ("user_id", "is_active");



CREATE INDEX "idx_sessions_user_type" ON "public"."sessions" USING "btree" ("user_id", "session_type") WHERE ("is_active" = true);



CREATE INDEX "idx_shift_swaps_requesting" ON "public"."shift_swap_requests" USING "btree" ("requesting_staff_id");



CREATE INDEX "idx_shift_swaps_status" ON "public"."shift_swap_requests" USING "btree" ("status");



CREATE INDEX "idx_shift_swaps_target" ON "public"."shift_swap_requests" USING "btree" ("target_staff_id");



CREATE INDEX "idx_staff_shifts_date" ON "public"."staff_shifts" USING "btree" ("shift_date");



CREATE INDEX "idx_staff_shifts_deleted_at" ON "public"."staff_shifts" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_staff_shifts_department" ON "public"."staff_shifts" USING "btree" ("department");



CREATE INDEX "idx_staff_shifts_staff_id" ON "public"."staff_shifts" USING "btree" ("staff_id");



CREATE INDEX "idx_staff_shifts_status" ON "public"."staff_shifts" USING "btree" ("status");



CREATE INDEX "idx_staff_shifts_upcoming" ON "public"."staff_shifts" USING "btree" ("shift_date", "start_time") WHERE (("status")::"text" = 'scheduled'::"text");



CREATE INDEX "idx_supplies_task_type" ON "public"."housekeeping_supplies" USING "btree" ("task_type");



CREATE INDEX "idx_support_assigned" ON "public"."support_inquiries" USING "btree" ("assigned_to") WHERE ("assigned_to" IS NOT NULL);



CREATE INDEX "idx_support_priority" ON "public"."support_inquiries" USING "btree" ("priority", "created_at" DESC);



CREATE INDEX "idx_support_sla" ON "public"."support_inquiries" USING "btree" ("sla_due_at") WHERE ("resolved_at" IS NULL);



CREATE INDEX "idx_support_status" ON "public"."support_inquiries" USING "btree" ("status");



CREATE INDEX "idx_suppression_list_added_at" ON "public"."email_suppression_list" USING "btree" ("added_at" DESC);



CREATE INDEX "idx_suppression_list_reason" ON "public"."email_suppression_list" USING "btree" ("reason");



CREATE INDEX "idx_system_defaults_key" ON "public"."system_defaults" USING "btree" ("setting_key");



CREATE INDEX "idx_system_settings_category" ON "public"."system_settings" USING "btree" ("category");



CREATE INDEX "idx_system_settings_key" ON "public"."system_settings" USING "btree" ("key");



CREATE INDEX "idx_tasks_booking" ON "public"."housekeeping_tasks" USING "btree" ("booking_id");



CREATE INDEX "idx_tasks_parent" ON "public"."housekeeping_tasks" USING "btree" ("parent_task_id") WHERE ("parent_task_id" IS NOT NULL);



CREATE INDEX "idx_tasks_sla" ON "public"."housekeeping_tasks" USING "btree" ("sla_due") WHERE ("sla_due" IS NOT NULL);



CREATE INDEX "idx_tasks_unit_status" ON "public"."housekeeping_tasks" USING "btree" ("unit_id", "status");



CREATE INDEX "idx_tbl_expires" ON "public"."token_blacklist" USING "btree" ("expires_at");



CREATE INDEX "idx_templates_is_active" ON "public"."notification_templates" USING "btree" ("is_active");



CREATE INDEX "idx_templates_name" ON "public"."notification_templates" USING "btree" ("name");



CREATE INDEX "idx_tenant_integrations_tenant" ON "public"."tenant_integrations" USING "btree" ("tenant_id");



CREATE INDEX "idx_tenant_integrations_type" ON "public"."tenant_integrations" USING "btree" ("integration_type");



CREATE INDEX "idx_tenants_billing_status" ON "public"."tenants" USING "btree" ("billing_status");



CREATE INDEX "idx_tenants_plan_id" ON "public"."tenants" USING "btree" ("plan_id") WHERE ("plan_id" IS NOT NULL);



CREATE INDEX "idx_tenants_stripe_subscription" ON "public"."tenants" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);



CREATE INDEX "idx_tenants_subdomain" ON "public"."tenants" USING "btree" ("subdomain");



CREATE INDEX "idx_terminology_lookup" ON "public"."terminology_overrides" USING "btree" ("business_type", "language");



CREATE INDEX "idx_time_adjustments_shift" ON "public"."time_clock_adjustments" USING "btree" ("shift_id");



CREATE INDEX "idx_transactions_created_at" ON "public"."transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_transactions_created_date" ON "public"."transactions" USING "btree" ("created_at");



CREATE INDEX "idx_transactions_customer_id" ON "public"."transactions" USING "btree" ("customer_id");



CREATE INDEX "idx_transactions_engine_status_created" ON "public"."transactions" USING "btree" ("engine_type", "status", "created_at" DESC);



CREATE INDEX "idx_transactions_engine_type" ON "public"."transactions" USING "btree" ("engine_type");



CREATE INDEX "idx_transactions_instant_active" ON "public"."transactions" USING "btree" ("status", "created_at" DESC) WHERE (("engine_type")::"text" = 'instant_transaction'::"text");



CREATE INDEX "idx_transactions_module_id" ON "public"."transactions" USING "btree" ("module_id");



CREATE INDEX "idx_transactions_module_status" ON "public"."transactions" USING "btree" ("module_id", "status");



CREATE INDEX "idx_transactions_promo_code" ON "public"."transactions" USING "btree" ("promo_code_used");



CREATE INDEX "idx_transactions_property_date" ON "public"."transactions" USING "btree" ("property_id", "created_at");



CREATE INDEX "idx_transactions_property_engine" ON "public"."transactions" USING "btree" ("property_id", "engine_type");



CREATE INDEX "idx_transactions_property_engine_date" ON "public"."transactions" USING "btree" ("property_id", "engine_type", "created_at");



CREATE INDEX "idx_transactions_property_id" ON "public"."transactions" USING "btree" ("property_id");



CREATE INDEX "idx_transactions_reference" ON "public"."transactions" USING "btree" ("reference_table", "reference_id");



CREATE INDEX "idx_transactions_refund_amount" ON "public"."transactions" USING "btree" ("refund_amount") WHERE ("refund_amount" > (0)::numeric);



CREATE INDEX "idx_transactions_service_location" ON "public"."transactions" USING "btree" ("service_location_id") WHERE ("service_location_id" IS NOT NULL);



CREATE INDEX "idx_transactions_session_id" ON "public"."transactions" USING "btree" ((("metadata" ->> 'session_id'::"text"))) WHERE (("engine_type")::"text" = 'shared_capacity_access'::"text");



CREATE INDEX "idx_transactions_shared_capacity" ON "public"."transactions" USING "btree" ("engine_type", "status") WHERE (("engine_type")::"text" = 'shared_capacity_access'::"text");



CREATE INDEX "idx_transactions_shared_capacity_date" ON "public"."transactions" USING "btree" ((("metadata" ->> 'date'::"text"))) WHERE (("engine_type")::"text" = 'shared_capacity_access'::"text");



CREATE INDEX "idx_transactions_shared_customer" ON "public"."transactions" USING "btree" ("customer_id") WHERE (("engine_type")::"text" = 'shared_capacity_access'::"text");



CREATE INDEX "idx_transactions_staff_id" ON "public"."transactions" USING "btree" ("staff_id");



CREATE INDEX "idx_transactions_status" ON "public"."transactions" USING "btree" ("status");



CREATE INDEX "idx_transactions_time_exclusive_checkin" ON "public"."transactions" USING "btree" ((("metadata" ->> 'check_in_date'::"text"))) WHERE (("engine_type")::"text" = 'time_exclusive_reservation'::"text");



CREATE INDEX "idx_transactions_user_id" ON "public"."transactions" USING "btree" ("user_id");



CREATE INDEX "idx_translation_keys_context" ON "public"."translation_keys" USING "btree" ("context");



CREATE INDEX "idx_translation_keys_is_active" ON "public"."translation_keys" USING "btree" ("is_active");



CREATE INDEX "idx_translation_keys_key_path" ON "public"."translation_keys" USING "btree" ("key_path");



CREATE INDEX "idx_translations_key" ON "public"."translations" USING "btree" ("translation_key");



CREATE INDEX "idx_translations_lookup" ON "public"."translations" USING "btree" ("locale", "namespace");



CREATE INDEX "idx_user_credits_available" ON "public"."user_credits" USING "btree" ("user_id", "used_at") WHERE ("used_at" IS NULL);



CREATE INDEX "idx_user_credits_expires" ON "public"."user_credits" USING "btree" ("expires_at");



CREATE INDEX "idx_user_credits_user" ON "public"."user_credits" USING "btree" ("user_id");



CREATE INDEX "idx_user_group_group" ON "public"."user_group_access" USING "btree" ("group_id");



CREATE INDEX "idx_user_group_user" ON "public"."user_group_access" USING "btree" ("user_id");



CREATE INDEX "idx_user_permissions_user" ON "public"."user_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_user_property_property" ON "public"."user_property_access" USING "btree" ("property_id");



CREATE INDEX "idx_user_property_user" ON "public"."user_property_access" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_role_id" ON "public"."user_roles" USING "btree" ("role_id");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_users_platform_admin" ON "public"."users" USING "btree" ("is_platform_admin") WHERE ("is_platform_admin" = true);



CREATE INDEX "idx_users_scope" ON "public"."users" USING "btree" ("scope");



CREATE INDEX "idx_users_tenant" ON "public"."users" USING "btree" ("tenant_id") WHERE ("tenant_id" IS NOT NULL);



CREATE INDEX "idx_users_token_version" ON "public"."users" USING "btree" ("id", "token_version");



CREATE INDEX "idx_variance_item" ON "public"."inventory_variance" USING "btree" ("item_id");



CREATE INDEX "idx_waitlist_module_status" ON "public"."waitlist_entries" USING "btree" ("module_id", "status");



CREATE INDEX "idx_waitlist_type" ON "public"."waitlist_entries" USING "btree" ("type");



CREATE INDEX "idx_wastage_item" ON "public"."inventory_wastage" USING "btree" ("item_id");



CREATE INDEX "idx_wastage_status" ON "public"."inventory_wastage" USING "btree" ("approval_status");



CREATE INDEX "idx_webhook_failures_created_at" ON "public"."webhook_failures" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_webhook_failures_event_type" ON "public"."webhook_failures" USING "btree" ("event_type");



CREATE UNIQUE INDEX "idx_webhook_failures_event_unique" ON "public"."webhook_failures" USING "btree" ("source", "event_id");



CREATE INDEX "idx_webhook_failures_next_retry_at" ON "public"."webhook_failures" USING "btree" ("next_retry_at") WHERE ("status" = ANY (ARRAY['pending'::"public"."webhook_status", 'retrying'::"public"."webhook_status"]));



CREATE INDEX "idx_webhook_failures_source" ON "public"."webhook_failures" USING "btree" ("source");



CREATE INDEX "idx_webhook_failures_status" ON "public"."webhook_failures" USING "btree" ("status");



CREATE UNIQUE INDEX "uq_billing_history_stripe_event" ON "public"."billing_history" USING "btree" ("stripe_event_id") WHERE ("stripe_event_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_tenants_single_platform_root" ON "public"."tenants" USING "btree" ("is_platform_root") WHERE ("is_platform_root" = true);



CREATE UNIQUE INDEX "uq_users_platform_email" ON "public"."users" USING "btree" ("email") WHERE ("tenant_id" IS NULL);



COMMENT ON INDEX "public"."uq_users_platform_email" IS 'Platform-level accounts (super_admin/platform_admin, tenant_id IS NULL) still need a globally unique email among themselves.';



CREATE UNIQUE INDEX "uq_users_tenant_email" ON "public"."users" USING "btree" ("tenant_id", "email") WHERE ("tenant_id" IS NOT NULL);



COMMENT ON INDEX "public"."uq_users_tenant_email" IS 'Email must be unique within a tenant, not across the whole platform -- the same person can be a customer of one tenant and the owner of another.';



CREATE OR REPLACE VIEW "public"."seasonal_pricing_analysis" AS
 SELECT "spr"."name" AS "rule_name",
    "spr"."start_date",
    "spr"."end_date",
    "spr"."price_multiplier",
    "spr"."applicable_to",
    "count"("ph"."id") AS "times_applied",
    "avg"(("ph"."final_price" - "ph"."base_price")) AS "avg_price_adjustment",
    "sum"(("ph"."final_price" - "ph"."base_price")) AS "total_revenue_impact"
   FROM ("public"."seasonal_pricing_rules" "spr"
     LEFT JOIN "public"."price_history" "ph" ON (((("ph"."applied_rules")::"text" ~~ (('%'::"text" || ("spr"."name")::"text") || '%'::"text")) AND ("ph"."recorded_at" >= ("now"() - '90 days'::interval)))))
  WHERE ("spr"."is_active" = true)
  GROUP BY "spr"."id", "spr"."name", "spr"."start_date", "spr"."end_date", "spr"."price_multiplier", "spr"."applicable_to"
  ORDER BY "spr"."priority" DESC;



CREATE OR REPLACE VIEW "public"."v_tenant_overview" AS
 SELECT "t"."id",
    "t"."subdomain",
    "t"."subscription_tier",
    "t"."billing_status",
    "t"."stripe_customer_id",
    "t"."stripe_subscription_id",
    "t"."trial_ends_at",
    "t"."created_at",
    "pg"."name" AS "group_name",
    "count"(DISTINCT "p"."id") AS "property_count"
   FROM (("public"."tenants" "t"
     LEFT JOIN "public"."property_groups" "pg" ON (("pg"."id" = "t"."property_group_id")))
     LEFT JOIN "public"."properties" "p" ON (("p"."group_id" = "pg"."id")))
  GROUP BY "t"."id", "pg"."name";



CREATE RULE "audit_log_no_delete" AS
    ON DELETE TO "public"."audit_logs" DO INSTEAD NOTHING;



CREATE RULE "audit_log_no_update" AS
    ON UPDATE TO "public"."audit_logs" DO INSTEAD NOTHING;



CREATE OR REPLACE TRIGGER "bookable_units_view_trigger" INSTEAD OF INSERT OR DELETE OR UPDATE ON "public"."bookable_units" FOR EACH ROW EXECUTE FUNCTION "public"."bookable_units_view_trigger"();



CREATE OR REPLACE TRIGGER "booking_checkout_housekeeping" AFTER UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_checkout_housekeeping"();



CREATE OR REPLACE TRIGGER "booking_reviews_updated_at" BEFORE UPDATE ON "public"."booking_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_review_updated_at"();



CREATE OR REPLACE TRIGGER "inventory_recipes_updated_at" BEFORE UPDATE ON "public"."inventory_recipes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "loyalty_accounts_insert_trigger" INSTEAD OF INSERT ON "public"."loyalty_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."insert_loyalty_account"();



CREATE OR REPLACE TRIGGER "loyalty_accounts_update_trigger" INSTEAD OF UPDATE ON "public"."loyalty_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_loyalty_account"();



CREATE OR REPLACE TRIGGER "product_reviews_updated_at" BEFORE UPDATE ON "public"."product_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_review_updated_at"();



CREATE OR REPLACE TRIGGER "session_reviews_updated_at" BEFORE UPDATE ON "public"."session_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_review_updated_at"();



CREATE OR REPLACE TRIGGER "set_chargebacks_updated_at" BEFORE UPDATE ON "public"."chargebacks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_currency_last_updated" BEFORE UPDATE ON "public"."currencies" FOR EACH ROW EXECUTE FUNCTION "public"."update_currency_last_updated"();



CREATE OR REPLACE TRIGGER "set_webhook_failures_updated_at" BEFORE UPDATE ON "public"."webhook_failures" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "tr_kiosk_session_duration" BEFORE UPDATE ON "public"."kiosk_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_session_duration"();



CREATE OR REPLACE TRIGGER "trg_checkout_housekeeping" AFTER UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_checkout_housekeeping"();



CREATE OR REPLACE TRIGGER "trg_coupon_usage_backfill_scope" BEFORE INSERT ON "public"."coupon_usage" FOR EACH ROW EXECUTE FUNCTION "public"."coupon_usage_backfill_scope"();



CREATE OR REPLACE TRIGGER "trg_engine_ledger_immutability" BEFORE DELETE OR UPDATE ON "public"."engine_financial_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."_engine_ledger_immutability"();



CREATE OR REPLACE TRIGGER "trg_gift_card_transactions_backfill_scope" BEFORE INSERT ON "public"."gift_card_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."gift_card_transactions_backfill_scope"();



CREATE OR REPLACE TRIGGER "trg_payment_ledger_immutable" BEFORE DELETE OR UPDATE ON "public"."payment_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_ledger_modification"();



COMMENT ON TRIGGER "trg_payment_ledger_immutable" ON "public"."payment_ledger" IS 'Enforces full immutability: no UPDATE or DELETE on any column is permitted. All corrections must be new reversal rows.';



CREATE OR REPLACE TRIGGER "trg_plans_updated_at" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_plans_updated_at"();



CREATE OR REPLACE TRIGGER "trg_service_locations_updated_at" BEFORE UPDATE ON "public"."service_locations" FOR EACH ROW EXECUTE FUNCTION "public"."update_service_locations_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_user_role_columns" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_role_columns"();



COMMENT ON TRIGGER "trg_sync_user_role_columns" ON "public"."user_roles" IS 'Keeps users.role and users.roles in sync with the user_roles junction table. These columns are deprecated and will be removed in a future migration once all application code reads directly from user_roles.';



CREATE OR REPLACE TRIGGER "trg_tenant_integrations_updated_at" BEFORE UPDATE ON "public"."tenant_integrations" FOR EACH ROW EXECUTE FUNCTION "public"."update_tenant_integrations_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tenants_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."update_tenants_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_device_tokens_updated_at" BEFORE UPDATE ON "public"."device_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_device_tokens_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_manager_approvals_updated_at" BEFORE UPDATE ON "public"."manager_approvals" FOR EACH ROW EXECUTE FUNCTION "public"."update_manager_approvals_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_notification_templates_updated_at" BEFORE UPDATE ON "public"."notification_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_notification_templates_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_record_booking_price" AFTER INSERT OR UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."record_booking_price"();



CREATE OR REPLACE TRIGGER "trigger_shift_swaps_updated_at" BEFORE UPDATE ON "public"."shift_swap_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_staff_shifts_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_staff_shifts_updated_at" BEFORE UPDATE ON "public"."staff_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."update_staff_shifts_updated_at"();



CREATE OR REPLACE TRIGGER "update_alert_definitions_updated_at" BEFORE UPDATE ON "public"."alert_definitions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_channel_connections_timestamp" BEFORE UPDATE ON "public"."channel_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_channel_updated_at"();



CREATE OR REPLACE TRIGGER "update_channel_rate_mappings_timestamp" BEFORE UPDATE ON "public"."channel_rate_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_channel_updated_at"();



CREATE OR REPLACE TRIGGER "update_channel_room_mappings_timestamp" BEFORE UPDATE ON "public"."channel_room_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_channel_updated_at"();



CREATE OR REPLACE TRIGGER "update_group_rate_templates_timestamp" BEFORE UPDATE ON "public"."group_rate_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_channel_updated_at"();



CREATE OR REPLACE TRIGGER "update_metric_definitions_updated_at" BEFORE UPDATE ON "public"."metric_definitions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_properties_timestamp" BEFORE UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."update_properties_updated_at"();



CREATE OR REPLACE TRIGGER "update_property_groups_timestamp" BEFORE UPDATE ON "public"."property_groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_channel_updated_at"();



CREATE OR REPLACE TRIGGER "update_shared_inventory_timestamp" BEFORE UPDATE ON "public"."shared_inventory_allocations" FOR EACH ROW EXECUTE FUNCTION "public"."update_channel_updated_at"();



ALTER TABLE ONLY "public"."accommodation_add_ons"
    ADD CONSTRAINT "accommodation_add_ons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accommodation_unit_price_rules"
    ADD CONSTRAINT "accommodation_unit_price_rules_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accommodation_unit_price_rules"
    ADD CONSTRAINT "accommodation_unit_price_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accommodation_units"
    ADD CONSTRAINT "accommodation_units_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."accommodation_units"
    ADD CONSTRAINT "accommodation_units_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id");



ALTER TABLE ONLY "public"."accommodation_units"
    ADD CONSTRAINT "accommodation_units_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accommodation_units"
    ADD CONSTRAINT "accommodation_units_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_definitions"
    ADD CONSTRAINT "alert_definitions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."alert_definitions"
    ADD CONSTRAINT "alert_definitions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_definitions"
    ADD CONSTRAINT "alert_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_history"
    ADD CONSTRAINT "alert_history_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."alert_history"
    ADD CONSTRAINT "alert_history_alert_definition_id_fkey" FOREIGN KEY ("alert_definition_id") REFERENCES "public"."alert_definitions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_history"
    ADD CONSTRAINT "alert_history_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alert_history"
    ADD CONSTRAINT "alert_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_permissions"
    ADD CONSTRAINT "app_permissions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_permissions"
    ADD CONSTRAINT "app_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_role_permissions"
    ADD CONSTRAINT "app_role_permissions_permission_slug_fkey" FOREIGN KEY ("permission_slug") REFERENCES "public"."app_permissions"("slug") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_role_permissions"
    ADD CONSTRAINT "app_role_permissions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_role_permissions"
    ADD CONSTRAINT "app_role_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."backups"
    ADD CONSTRAINT "backups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."backups"
    ADD CONSTRAINT "backups_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."backups"
    ADD CONSTRAINT "backups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."billing_history"
    ADD CONSTRAINT "billing_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biometric_credentials"
    ADD CONSTRAINT "biometric_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biometric_credentials"
    ADD CONSTRAINT "biometric_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_reviews"
    ADD CONSTRAINT "booking_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_reviews"
    ADD CONSTRAINT "booking_reviews_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_reviews"
    ADD CONSTRAINT "booking_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_reviews"
    ADD CONSTRAINT "booking_reviews_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."accommodation_units"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_reviews"
    ADD CONSTRAINT "booking_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_sends"
    ADD CONSTRAINT "campaign_sends_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_sends"
    ADD CONSTRAINT "campaign_sends_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."journey_enrollments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_sends"
    ADD CONSTRAINT "campaign_sends_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_sends"
    ADD CONSTRAINT "campaign_sends_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "public"."email_journeys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_sends"
    ADD CONSTRAINT "campaign_sends_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_sends"
    ADD CONSTRAINT "campaign_sends_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."marketing_email_templates"("id");



ALTER TABLE ONLY "public"."campaign_sends"
    ADD CONSTRAINT "campaign_sends_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cancellation_policies"
    ADD CONSTRAINT "cancellation_policies_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cancellation_policies"
    ADD CONSTRAINT "cancellation_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."capacity_windows"
    ADD CONSTRAINT "capacity_windows_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."capacity_windows"
    ADD CONSTRAINT "capacity_windows_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id");



ALTER TABLE ONLY "public"."capacity_windows"
    ADD CONSTRAINT "capacity_windows_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."capacity_windows"
    ADD CONSTRAINT "capacity_windows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cash_drawers"
    ADD CONSTRAINT "cash_drawers_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."cash_drawers"
    ADD CONSTRAINT "cash_drawers_opened_by_user_id_fkey" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."cash_drawers"
    ADD CONSTRAINT "cash_drawers_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cash_drawers"
    ADD CONSTRAINT "cash_drawers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cash_transactions"
    ADD CONSTRAINT "cash_transactions_drawer_id_fkey" FOREIGN KEY ("drawer_id") REFERENCES "public"."cash_drawers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cash_transactions"
    ADD CONSTRAINT "cash_transactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cash_transactions"
    ADD CONSTRAINT "cash_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cash_transactions"
    ADD CONSTRAINT "cash_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."catalog_categories"
    ADD CONSTRAINT "catalog_categories_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."catalog_categories"
    ADD CONSTRAINT "catalog_categories_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id");



ALTER TABLE ONLY "public"."catalog_categories"
    ADD CONSTRAINT "catalog_categories_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_categories"
    ADD CONSTRAINT "catalog_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."catalog_categories"("id");



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id");



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_availability_updates"
    ADD CONSTRAINT "channel_availability_updates_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."channel_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_availability_updates"
    ADD CONSTRAINT "channel_availability_updates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_availability_updates"
    ADD CONSTRAINT "channel_availability_updates_room_mapping_id_fkey" FOREIGN KEY ("room_mapping_id") REFERENCES "public"."channel_room_mappings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_availability_updates"
    ADD CONSTRAINT "channel_availability_updates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_connections"
    ADD CONSTRAINT "channel_connections_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_connections"
    ADD CONSTRAINT "channel_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_rate_mappings"
    ADD CONSTRAINT "channel_rate_mappings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."channel_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_rate_mappings"
    ADD CONSTRAINT "channel_rate_mappings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_rate_mappings"
    ADD CONSTRAINT "channel_rate_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_rate_updates"
    ADD CONSTRAINT "channel_rate_updates_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."channel_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_rate_updates"
    ADD CONSTRAINT "channel_rate_updates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_rate_updates"
    ADD CONSTRAINT "channel_rate_updates_rate_mapping_id_fkey" FOREIGN KEY ("rate_mapping_id") REFERENCES "public"."channel_rate_mappings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_rate_updates"
    ADD CONSTRAINT "channel_rate_updates_room_mapping_id_fkey" FOREIGN KEY ("room_mapping_id") REFERENCES "public"."channel_room_mappings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_rate_updates"
    ADD CONSTRAINT "channel_rate_updates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_reservations"
    ADD CONSTRAINT "channel_reservations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."channel_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_reservations"
    ADD CONSTRAINT "channel_reservations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_reservations"
    ADD CONSTRAINT "channel_reservations_rate_mapping_id_fkey" FOREIGN KEY ("rate_mapping_id") REFERENCES "public"."channel_rate_mappings"("id");



ALTER TABLE ONLY "public"."channel_reservations"
    ADD CONSTRAINT "channel_reservations_room_mapping_id_fkey" FOREIGN KEY ("room_mapping_id") REFERENCES "public"."channel_room_mappings"("id");



ALTER TABLE ONLY "public"."channel_reservations"
    ADD CONSTRAINT "channel_reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_room_mappings"
    ADD CONSTRAINT "channel_room_mappings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."channel_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_room_mappings"
    ADD CONSTRAINT "channel_room_mappings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_room_mappings"
    ADD CONSTRAINT "channel_room_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_sync_log"
    ADD CONSTRAINT "channel_sync_log_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."channel_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_sync_log"
    ADD CONSTRAINT "channel_sync_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_sync_log"
    ADD CONSTRAINT "channel_sync_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chargebacks"
    ADD CONSTRAINT "chargebacks_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payment_ledger"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."chargebacks"
    ADD CONSTRAINT "chargebacks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chargebacks"
    ADD CONSTRAINT "chargebacks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chatbot_intents"
    ADD CONSTRAINT "chatbot_intents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chatbot_intents"
    ADD CONSTRAINT "chatbot_intents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."message_templates"("id");



ALTER TABLE ONLY "public"."chatbot_intents"
    ADD CONSTRAINT "chatbot_intents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competitor_rates"
    ADD CONSTRAINT "competitor_rates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competitor_rates"
    ADD CONSTRAINT "competitor_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coupon_usage"
    ADD CONSTRAINT "coupon_usage_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coupon_usage"
    ADD CONSTRAINT "coupon_usage_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coupon_usage"
    ADD CONSTRAINT "coupon_usage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coupon_usage"
    ADD CONSTRAINT "coupon_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coupons"
    ADD CONSTRAINT "coupons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customization_dual_write_log"
    ADD CONSTRAINT "customization_dual_write_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customization_dual_write_log"
    ADD CONSTRAINT "customization_dual_write_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customization_events"
    ADD CONSTRAINT "customization_events_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customization_events"
    ADD CONSTRAINT "customization_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customization_groups"
    ADD CONSTRAINT "customization_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."customization_groups"
    ADD CONSTRAINT "customization_groups_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customization_groups"
    ADD CONSTRAINT "customization_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customization_metrics"
    ADD CONSTRAINT "customization_metrics_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customization_metrics"
    ADD CONSTRAINT "customization_metrics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customization_options"
    ADD CONSTRAINT "customization_options_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."customization_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customization_options"
    ADD CONSTRAINT "customization_options_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customization_options"
    ADD CONSTRAINT "customization_options_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customization_options"
    ADD CONSTRAINT "customization_options_replaces_inventory_item_id_fkey" FOREIGN KEY ("replaces_inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customization_options"
    ADD CONSTRAINT "customization_options_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboard_widgets"
    ADD CONSTRAINT "dashboard_widgets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboard_widgets"
    ADD CONSTRAINT "dashboard_widgets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboard_widgets"
    ADD CONSTRAINT "dashboard_widgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demand_forecasts"
    ADD CONSTRAINT "demand_forecasts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demand_forecasts"
    ADD CONSTRAINT "demand_forecasts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."digital_signatures"
    ADD CONSTRAINT "digital_signatures_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."digital_signatures"
    ADD CONSTRAINT "digital_signatures_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."pre_arrival_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."digital_signatures"
    ADD CONSTRAINT "digital_signatures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_bounces"
    ADD CONSTRAINT "email_bounces_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_bounces"
    ADD CONSTRAINT "email_bounces_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_journeys"
    ADD CONSTRAINT "email_journeys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."email_journeys"
    ADD CONSTRAINT "email_journeys_entry_segment_id_fkey" FOREIGN KEY ("entry_segment_id") REFERENCES "public"."guest_segments"("id");



ALTER TABLE ONLY "public"."email_journeys"
    ADD CONSTRAINT "email_journeys_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_journeys"
    ADD CONSTRAINT "email_journeys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_suppression_list"
    ADD CONSTRAINT "email_suppression_list_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."email_suppression_list"
    ADD CONSTRAINT "email_suppression_list_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_suppression_list"
    ADD CONSTRAINT "email_suppression_list_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."engine_compensation_log"
    ADD CONSTRAINT "engine_compensation_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_compensation_log"
    ADD CONSTRAINT "engine_compensation_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_feature_flags"
    ADD CONSTRAINT "engine_feature_flags_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_financial_ledger"
    ADD CONSTRAINT "engine_financial_ledger_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_idempotency_keys"
    ADD CONSTRAINT "engine_idempotency_keys_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_loyalty_events"
    ADD CONSTRAINT "engine_loyalty_events_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."engine_state_transitions"
    ADD CONSTRAINT "engine_state_transitions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_customizations"
    ADD CONSTRAINT "entity_customizations_customization_group_id_fkey" FOREIGN KEY ("customization_group_id") REFERENCES "public"."customization_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_customizations"
    ADD CONSTRAINT "entity_customizations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entity_customizations"
    ADD CONSTRAINT "entity_customizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faqs"
    ADD CONSTRAINT "faqs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faqs"
    ADD CONSTRAINT "faqs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_bom"
    ADD CONSTRAINT "fk_inventory_bom_menu_item" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inventory_purchase_orders"
    ADD CONSTRAINT "fk_po_created_by" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_variance"
    ADD CONSTRAINT "fk_variance_counted_by" FOREIGN KEY ("counted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_wastage"
    ADD CONSTRAINT "fk_wastage_approved_by" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_wastage"
    ADD CONSTRAINT "fk_wastage_batch" FOREIGN KEY ("batch_id") REFERENCES "public"."inventory_batches"("id");



ALTER TABLE ONLY "public"."inventory_wastage"
    ADD CONSTRAINT "fk_wastage_reported_by" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."gdpr_consents"
    ADD CONSTRAINT "gdpr_consents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_consents"
    ADD CONSTRAINT "gdpr_consents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_consents"
    ADD CONSTRAINT "gdpr_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_cookie_consents"
    ADD CONSTRAINT "gdpr_cookie_consents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_cookie_consents"
    ADD CONSTRAINT "gdpr_cookie_consents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_data_sharing_log"
    ADD CONSTRAINT "gdpr_data_sharing_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_data_sharing_log"
    ADD CONSTRAINT "gdpr_data_sharing_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_data_sharing_log"
    ADD CONSTRAINT "gdpr_data_sharing_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gdpr_deletion_requests"
    ADD CONSTRAINT "gdpr_deletion_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gdpr_deletion_requests"
    ADD CONSTRAINT "gdpr_deletion_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_deletion_requests"
    ADD CONSTRAINT "gdpr_deletion_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_deletion_requests"
    ADD CONSTRAINT "gdpr_deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_export_requests"
    ADD CONSTRAINT "gdpr_export_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_export_requests"
    ADD CONSTRAINT "gdpr_export_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_export_requests"
    ADD CONSTRAINT "gdpr_export_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_processing_activities"
    ADD CONSTRAINT "gdpr_processing_activities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_processing_activities"
    ADD CONSTRAINT "gdpr_processing_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_processing_activities"
    ADD CONSTRAINT "gdpr_processing_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gdpr_retention_policies"
    ADD CONSTRAINT "gdpr_retention_policies_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gdpr_retention_policies"
    ADD CONSTRAINT "gdpr_retention_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gift_card_ledger"
    ADD CONSTRAINT "gift_card_ledger_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."gift_card_ledger"
    ADD CONSTRAINT "gift_card_ledger_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id");



ALTER TABLE ONLY "public"."gift_card_ledger"
    ADD CONSTRAINT "gift_card_ledger_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gift_card_ledger"
    ADD CONSTRAINT "gift_card_ledger_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gift_card_templates"
    ADD CONSTRAINT "gift_card_templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gift_card_templates"
    ADD CONSTRAINT "gift_card_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gift_card_transactions"
    ADD CONSTRAINT "gift_card_transactions_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gift_card_transactions"
    ADD CONSTRAINT "gift_card_transactions_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gift_card_transactions"
    ADD CONSTRAINT "gift_card_transactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gift_card_transactions"
    ADD CONSTRAINT "gift_card_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gift_cards"
    ADD CONSTRAINT "gift_cards_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."gift_cards"
    ADD CONSTRAINT "gift_cards_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gift_cards"
    ADD CONSTRAINT "gift_cards_purchased_by_fkey" FOREIGN KEY ("purchased_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gift_cards"
    ADD CONSTRAINT "gift_cards_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."gift_card_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gift_cards"
    ADD CONSTRAINT "gift_cards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_activities"
    ADD CONSTRAINT "group_activities_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group_reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_activities"
    ADD CONSTRAINT "group_activities_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."group_activities"
    ADD CONSTRAINT "group_activities_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_activities"
    ADD CONSTRAINT "group_activities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_bookings"
    ADD CONSTRAINT "group_bookings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group_reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_bookings"
    ADD CONSTRAINT "group_bookings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_bookings"
    ADD CONSTRAINT "group_bookings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_contracts"
    ADD CONSTRAINT "group_contracts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group_reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_contracts"
    ADD CONSTRAINT "group_contracts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_contracts"
    ADD CONSTRAINT "group_contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_events"
    ADD CONSTRAINT "group_events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group_reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_events"
    ADD CONSTRAINT "group_events_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_events"
    ADD CONSTRAINT "group_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_invoices"
    ADD CONSTRAINT "group_invoices_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group_reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_invoices"
    ADD CONSTRAINT "group_invoices_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_invoices"
    ADD CONSTRAINT "group_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_payments"
    ADD CONSTRAINT "group_payments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group_reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_payments"
    ADD CONSTRAINT "group_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."group_invoices"("id");



ALTER TABLE ONLY "public"."group_payments"
    ADD CONSTRAINT "group_payments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_payments"
    ADD CONSTRAINT "group_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_rate_templates"
    ADD CONSTRAINT "group_rate_templates_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_rate_templates"
    ADD CONSTRAINT "group_rate_templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_rate_templates"
    ADD CONSTRAINT "group_rate_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_report_schedules"
    ADD CONSTRAINT "group_report_schedules_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_report_schedules"
    ADD CONSTRAINT "group_report_schedules_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_report_schedules"
    ADD CONSTRAINT "group_report_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_reservations"
    ADD CONSTRAINT "group_reservations_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."group_reservations"
    ADD CONSTRAINT "group_reservations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_reservations"
    ADD CONSTRAINT "group_reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_room_blocks"
    ADD CONSTRAINT "group_room_blocks_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."group_reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_room_blocks"
    ADD CONSTRAINT "group_room_blocks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_room_blocks"
    ADD CONSTRAINT "group_room_blocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_settings"
    ADD CONSTRAINT "group_settings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_settings"
    ADD CONSTRAINT "group_settings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_settings"
    ADD CONSTRAINT "group_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_settings"
    ADD CONSTRAINT "group_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."guest_messaging_preferences"
    ADD CONSTRAINT "guest_messaging_preferences_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_messaging_preferences"
    ADD CONSTRAINT "guest_messaging_preferences_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_messaging_preferences"
    ADD CONSTRAINT "guest_messaging_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_rfm_scores"
    ADD CONSTRAINT "guest_rfm_scores_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_rfm_scores"
    ADD CONSTRAINT "guest_rfm_scores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_rfm_scores"
    ADD CONSTRAINT "guest_rfm_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_segments"
    ADD CONSTRAINT "guest_segments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guest_segments"
    ADD CONSTRAINT "guest_segments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_inspections"
    ADD CONSTRAINT "housekeeping_inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."housekeeping_inspections"
    ADD CONSTRAINT "housekeeping_inspections_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_inspections"
    ADD CONSTRAINT "housekeeping_inspections_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."housekeeping_tasks"("id");



ALTER TABLE ONLY "public"."housekeeping_inspections"
    ADD CONSTRAINT "housekeeping_inspections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_inspections"
    ADD CONSTRAINT "housekeeping_inspections_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."accommodation_units"("id");



ALTER TABLE ONLY "public"."housekeeping_logs"
    ADD CONSTRAINT "housekeeping_logs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_logs"
    ADD CONSTRAINT "housekeeping_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."housekeeping_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_logs"
    ADD CONSTRAINT "housekeeping_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_schedules"
    ADD CONSTRAINT "housekeeping_schedules_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_schedules"
    ADD CONSTRAINT "housekeeping_schedules_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "public"."housekeeping_task_types"("id");



ALTER TABLE ONLY "public"."housekeeping_schedules"
    ADD CONSTRAINT "housekeeping_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_sla"
    ADD CONSTRAINT "housekeeping_sla_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_sla"
    ADD CONSTRAINT "housekeeping_sla_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_supplies"
    ADD CONSTRAINT "housekeeping_supplies_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_supplies"
    ADD CONSTRAINT "housekeeping_supplies_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_supplies"
    ADD CONSTRAINT "housekeeping_supplies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_task_comments"
    ADD CONSTRAINT "housekeeping_task_comments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_task_comments"
    ADD CONSTRAINT "housekeeping_task_comments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_task_comments"
    ADD CONSTRAINT "housekeeping_task_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."housekeeping_task_types"
    ADD CONSTRAINT "housekeeping_task_types_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_task_types"
    ADD CONSTRAINT "housekeeping_task_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_tasks"
    ADD CONSTRAINT "housekeeping_tasks_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."housekeeping_tasks"
    ADD CONSTRAINT "housekeeping_tasks_escalated_to_fkey" FOREIGN KEY ("escalated_to") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."housekeeping_tasks"
    ADD CONSTRAINT "housekeeping_tasks_overridden_by_fkey" FOREIGN KEY ("overridden_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."housekeeping_tasks"
    ADD CONSTRAINT "housekeeping_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."housekeeping_tasks"("id");



ALTER TABLE ONLY "public"."housekeeping_tasks"
    ADD CONSTRAINT "housekeeping_tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_tasks"
    ADD CONSTRAINT "housekeeping_tasks_task_type_id_fkey" FOREIGN KEY ("task_type_id") REFERENCES "public"."housekeeping_task_types"("id");



ALTER TABLE ONLY "public"."housekeeping_tasks"
    ADD CONSTRAINT "housekeeping_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_tasks"
    ADD CONSTRAINT "housekeeping_tasks_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."accommodation_units"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_alerts"
    ADD CONSTRAINT "inventory_alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_batches"
    ADD CONSTRAINT "inventory_batches_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_batches"
    ADD CONSTRAINT "inventory_batches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_batches"
    ADD CONSTRAINT "inventory_batches_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_batches"
    ADD CONSTRAINT "inventory_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_bom"
    ADD CONSTRAINT "inventory_bom_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_bom"
    ADD CONSTRAINT "inventory_bom_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_bom"
    ADD CONSTRAINT "inventory_bom_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."inventory_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_categories"
    ADD CONSTRAINT "inventory_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_consumption"
    ADD CONSTRAINT "inventory_consumption_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_consumption"
    ADD CONSTRAINT "inventory_consumption_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_consumption"
    ADD CONSTRAINT "inventory_consumption_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."housekeeping_tasks"("id");



ALTER TABLE ONLY "public"."inventory_consumption"
    ADD CONSTRAINT "inventory_consumption_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_purchase_order_items"
    ADD CONSTRAINT "inventory_purchase_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_purchase_order_items"
    ADD CONSTRAINT "inventory_purchase_order_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_purchase_order_items"
    ADD CONSTRAINT "inventory_purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."inventory_purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_purchase_order_items"
    ADD CONSTRAINT "inventory_purchase_order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_purchase_orders"
    ADD CONSTRAINT "inventory_purchase_orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_purchase_orders"
    ADD CONSTRAINT "inventory_purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_purchase_orders"
    ADD CONSTRAINT "inventory_purchase_orders_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."inventory_purchase_orders"
    ADD CONSTRAINT "inventory_purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."inventory_suppliers"("id");



ALTER TABLE ONLY "public"."inventory_purchase_orders"
    ADD CONSTRAINT "inventory_purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_recipe_ingredients"
    ADD CONSTRAINT "inventory_recipe_ingredients_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_recipe_ingredients"
    ADD CONSTRAINT "inventory_recipe_ingredients_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_recipe_ingredients"
    ADD CONSTRAINT "inventory_recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "public"."inventory_recipes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_recipe_ingredients"
    ADD CONSTRAINT "inventory_recipe_ingredients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_recipes"
    ADD CONSTRAINT "inventory_recipes_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_recipes"
    ADD CONSTRAINT "inventory_recipes_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_recipes"
    ADD CONSTRAINT "inventory_recipes_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."inventory_recipes"
    ADD CONSTRAINT "inventory_recipes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_suppliers"
    ADD CONSTRAINT "inventory_suppliers_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."inventory_suppliers"
    ADD CONSTRAINT "inventory_suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_variance"
    ADD CONSTRAINT "inventory_variance_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_variance"
    ADD CONSTRAINT "inventory_variance_counted_by_fkey" FOREIGN KEY ("counted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_variance"
    ADD CONSTRAINT "inventory_variance_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_variance"
    ADD CONSTRAINT "inventory_variance_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_variance"
    ADD CONSTRAINT "inventory_variance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_wastage"
    ADD CONSTRAINT "inventory_wastage_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_wastage"
    ADD CONSTRAINT "inventory_wastage_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."inventory_batches"("id");



ALTER TABLE ONLY "public"."inventory_wastage"
    ADD CONSTRAINT "inventory_wastage_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_wastage"
    ADD CONSTRAINT "inventory_wastage_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_wastage"
    ADD CONSTRAINT "inventory_wastage_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_wastage"
    ADD CONSTRAINT "inventory_wastage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journey_enrollments"
    ADD CONSTRAINT "journey_enrollments_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journey_enrollments"
    ADD CONSTRAINT "journey_enrollments_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "public"."email_journeys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journey_enrollments"
    ADD CONSTRAINT "journey_enrollments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journey_enrollments"
    ADD CONSTRAINT "journey_enrollments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journey_steps"
    ADD CONSTRAINT "journey_steps_journey_id_fkey" FOREIGN KEY ("journey_id") REFERENCES "public"."email_journeys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journey_steps"
    ADD CONSTRAINT "journey_steps_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journey_steps"
    ADD CONSTRAINT "journey_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."marketing_email_templates"("id");



ALTER TABLE ONLY "public"."journey_steps"
    ADD CONSTRAINT "journey_steps_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_analytics"
    ADD CONSTRAINT "kiosk_analytics_kiosk_id_fkey" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosk_devices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kiosk_analytics"
    ADD CONSTRAINT "kiosk_analytics_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_analytics"
    ADD CONSTRAINT "kiosk_analytics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_devices"
    ADD CONSTRAINT "kiosk_devices_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_devices"
    ADD CONSTRAINT "kiosk_devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_hardware_events"
    ADD CONSTRAINT "kiosk_hardware_events_kiosk_id_fkey" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosk_devices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_hardware_events"
    ADD CONSTRAINT "kiosk_hardware_events_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_hardware_events"
    ADD CONSTRAINT "kiosk_hardware_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_items"
    ADD CONSTRAINT "kiosk_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_items"
    ADD CONSTRAINT "kiosk_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_key_stock"
    ADD CONSTRAINT "kiosk_key_stock_kiosk_id_fkey" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosk_devices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_key_stock"
    ADD CONSTRAINT "kiosk_key_stock_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_key_stock"
    ADD CONSTRAINT "kiosk_key_stock_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_screen_content"
    ADD CONSTRAINT "kiosk_screen_content_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."kiosk_screen_flows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_screen_content"
    ADD CONSTRAINT "kiosk_screen_content_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_screen_content"
    ADD CONSTRAINT "kiosk_screen_content_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_screen_flows"
    ADD CONSTRAINT "kiosk_screen_flows_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_screen_flows"
    ADD CONSTRAINT "kiosk_screen_flows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_sessions"
    ADD CONSTRAINT "kiosk_sessions_kiosk_id_fkey" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosk_devices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_sessions"
    ADD CONSTRAINT "kiosk_sessions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_sessions"
    ADD CONSTRAINT "kiosk_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_transactions"
    ADD CONSTRAINT "kiosk_transactions_kiosk_id_fkey" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosk_devices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_transactions"
    ADD CONSTRAINT "kiosk_transactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_transactions"
    ADD CONSTRAINT "kiosk_transactions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."kiosk_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kiosk_transactions"
    ADD CONSTRAINT "kiosk_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_fraud_flags"
    ADD CONSTRAINT "loyalty_fraud_flags_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_fraud_flags"
    ADD CONSTRAINT "loyalty_fraud_flags_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."loyalty_fraud_flags"
    ADD CONSTRAINT "loyalty_fraud_flags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_fraud_flags"
    ADD CONSTRAINT "loyalty_fraud_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."loyalty_members"
    ADD CONSTRAINT "loyalty_members_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_members"
    ADD CONSTRAINT "loyalty_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_members"
    ADD CONSTRAINT "loyalty_members_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "public"."loyalty_tiers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_members"
    ADD CONSTRAINT "loyalty_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_point_batches"
    ADD CONSTRAINT "loyalty_point_batches_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_point_batches"
    ADD CONSTRAINT "loyalty_point_batches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_point_batches"
    ADD CONSTRAINT "loyalty_point_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."loyalty_profiles"
    ADD CONSTRAINT "loyalty_profiles_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_profiles"
    ADD CONSTRAINT "loyalty_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_profiles"
    ADD CONSTRAINT "loyalty_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."loyalty_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_rewards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_min_tier_id_fkey" FOREIGN KEY ("min_tier_id") REFERENCES "public"."loyalty_tiers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_settings"
    ADD CONSTRAINT "loyalty_settings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_settings"
    ADD CONSTRAINT "loyalty_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_tiers"
    ADD CONSTRAINT "loyalty_tiers_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_tiers"
    ADD CONSTRAINT "loyalty_tiers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."loyalty_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_approvals"
    ADD CONSTRAINT "manager_approvals_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."manager_approvals"
    ADD CONSTRAINT "manager_approvals_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."manager_approvals"
    ADD CONSTRAINT "manager_approvals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_notification_settings"
    ADD CONSTRAINT "manager_notification_settings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."manager_notification_settings"
    ADD CONSTRAINT "manager_notification_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_events"
    ADD CONSTRAINT "market_events_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_events"
    ADD CONSTRAINT "market_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_campaigns"
    ADD CONSTRAINT "marketing_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."marketing_campaigns"
    ADD CONSTRAINT "marketing_campaigns_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_campaigns"
    ADD CONSTRAINT "marketing_campaigns_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."guest_segments"("id");



ALTER TABLE ONLY "public"."marketing_campaigns"
    ADD CONSTRAINT "marketing_campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."marketing_email_templates"("id");



ALTER TABLE ONLY "public"."marketing_campaigns"
    ADD CONSTRAINT "marketing_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_email_templates"
    ADD CONSTRAINT "marketing_email_templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketing_email_templates"
    ADD CONSTRAINT "marketing_email_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membership_plans"
    ADD CONSTRAINT "membership_plans_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."memberships"
    ADD CONSTRAINT "memberships_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id");



ALTER TABLE ONLY "public"."menu_item_ingredients"
    ADD CONSTRAINT "menu_item_ingredients_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_item_ingredients"
    ADD CONSTRAINT "menu_item_ingredients_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_item_ingredients"
    ADD CONSTRAINT "menu_item_ingredients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messaging_channels"
    ADD CONSTRAINT "messaging_channels_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messaging_channels"
    ADD CONSTRAINT "messaging_channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."metric_definitions"
    ADD CONSTRAINT "metric_definitions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."metric_definitions"
    ADD CONSTRAINT "metric_definitions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."metric_definitions"
    ADD CONSTRAINT "metric_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mobile_key_access_log"
    ADD CONSTRAINT "mobile_key_access_log_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "public"."mobile_keys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mobile_key_access_log"
    ADD CONSTRAINT "mobile_key_access_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mobile_key_access_log"
    ADD CONSTRAINT "mobile_key_access_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mobile_keys"
    ADD CONSTRAINT "mobile_keys_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mobile_keys"
    ADD CONSTRAINT "mobile_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."module_templates"
    ADD CONSTRAINT "module_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."module_templates"
    ADD CONSTRAINT "module_templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."module_templates"
    ADD CONSTRAINT "module_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_broadcasts"
    ADD CONSTRAINT "notification_broadcasts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."notification_broadcasts"
    ADD CONSTRAINT "notification_broadcasts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_broadcasts"
    ADD CONSTRAINT "notification_broadcasts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_device_token_id_fkey" FOREIGN KEY ("device_token_id") REFERENCES "public"."device_tokens"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_templates"
    ADD CONSTRAINT "notification_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_customizations"
    ADD CONSTRAINT "order_customizations_customization_group_id_fkey" FOREIGN KEY ("customization_group_id") REFERENCES "public"."customization_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_customizations"
    ADD CONSTRAINT "order_customizations_customization_option_id_fkey" FOREIGN KEY ("customization_option_id") REFERENCES "public"."customization_options"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_customizations"
    ADD CONSTRAINT "order_customizations_original_snapshot_id_fkey" FOREIGN KEY ("original_snapshot_id") REFERENCES "public"."order_customizations"("id");



ALTER TABLE ONLY "public"."order_customizations"
    ADD CONSTRAINT "order_customizations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_customizations"
    ADD CONSTRAINT "order_customizations_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."order_customizations"
    ADD CONSTRAINT "order_customizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_payment_splits"
    ADD CONSTRAINT "order_payment_splits_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id");



ALTER TABLE ONLY "public"."order_payment_splits"
    ADD CONSTRAINT "order_payment_splits_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."order_payment_splits"
    ADD CONSTRAINT "order_payment_splits_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_payment_splits"
    ADD CONSTRAINT "order_payment_splits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_payment_splits"
    ADD CONSTRAINT "order_payment_splits_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id");



ALTER TABLE ONLY "public"."password_history"
    ADD CONSTRAINT "password_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_history"
    ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_ledger"
    ADD CONSTRAINT "payment_ledger_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_ledger"
    ADD CONSTRAINT "payment_ledger_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pos_reconciliation"
    ADD CONSTRAINT "pos_reconciliation_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pos_reconciliation"
    ADD CONSTRAINT "pos_reconciliation_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pos_reconciliation"
    ADD CONSTRAINT "pos_reconciliation_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pos_reconciliation"
    ADD CONSTRAINT "pos_reconciliation_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pre_arrival_registrations"
    ADD CONSTRAINT "pre_arrival_registrations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pre_arrival_registrations"
    ADD CONSTRAINT "pre_arrival_registrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_history"
    ADD CONSTRAINT "price_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."catalog_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_reviews"
    ADD CONSTRAINT "product_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."property_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_benchmarks"
    ADD CONSTRAINT "property_benchmarks_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_benchmarks"
    ADD CONSTRAINT "property_benchmarks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_benchmarks"
    ADD CONSTRAINT "property_benchmarks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_groups"
    ADD CONSTRAINT "property_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."property_settings"
    ADD CONSTRAINT "property_settings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_settings"
    ADD CONSTRAINT "property_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_settings"
    ADD CONSTRAINT "property_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."rate_parity_alerts"
    ADD CONSTRAINT "rate_parity_alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."rate_parity_alerts"
    ADD CONSTRAINT "rate_parity_alerts_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "public"."rate_parity_checks"("id");



ALTER TABLE ONLY "public"."rate_parity_alerts"
    ADD CONSTRAINT "rate_parity_alerts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_parity_alerts"
    ADD CONSTRAINT "rate_parity_alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."rate_parity_alerts"
    ADD CONSTRAINT "rate_parity_alerts_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "public"."rate_parity_results"("id");



ALTER TABLE ONLY "public"."rate_parity_alerts"
    ADD CONSTRAINT "rate_parity_alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_parity_checks"
    ADD CONSTRAINT "rate_parity_checks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_parity_checks"
    ADD CONSTRAINT "rate_parity_checks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_parity_config"
    ADD CONSTRAINT "rate_parity_config_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_parity_config"
    ADD CONSTRAINT "rate_parity_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_parity_results"
    ADD CONSTRAINT "rate_parity_results_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "public"."rate_parity_checks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_parity_results"
    ADD CONSTRAINT "rate_parity_results_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_parity_results"
    ADD CONSTRAINT "rate_parity_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_recommendations"
    ADD CONSTRAINT "rate_recommendations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."rate_recommendations"
    ADD CONSTRAINT "rate_recommendations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_recommendations"
    ADD CONSTRAINT "rate_recommendations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reconciliation_log"
    ADD CONSTRAINT "reconciliation_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reconciliation_log"
    ADD CONSTRAINT "reconciliation_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ref_type_telemetry"
    ADD CONSTRAINT "ref_type_telemetry_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ref_type_telemetry"
    ADD CONSTRAINT "ref_type_telemetry_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_documents"
    ADD CONSTRAINT "registration_documents_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_documents"
    ADD CONSTRAINT "registration_documents_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."pre_arrival_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_documents"
    ADD CONSTRAINT "registration_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registration_documents"
    ADD CONSTRAINT "registration_documents_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."report_daily_sales"
    ADD CONSTRAINT "report_daily_sales_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_daily_sales"
    ADD CONSTRAINT "report_daily_sales_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_executions"
    ADD CONSTRAINT "report_executions_executed_by_fkey" FOREIGN KEY ("executed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."report_executions"
    ADD CONSTRAINT "report_executions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_executions"
    ADD CONSTRAINT "report_executions_saved_report_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "public"."saved_reports"("id");



ALTER TABLE ONLY "public"."report_executions"
    ADD CONSTRAINT "report_executions_scheduled_report_id_fkey" FOREIGN KEY ("scheduled_report_id") REFERENCES "public"."report_scheduled"("id");



ALTER TABLE ONLY "public"."report_executions"
    ADD CONSTRAINT "report_executions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id");



ALTER TABLE ONLY "public"."report_executions"
    ADD CONSTRAINT "report_executions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_hourly_metrics"
    ADD CONSTRAINT "report_hourly_metrics_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_hourly_metrics"
    ADD CONSTRAINT "report_hourly_metrics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_product_performance"
    ADD CONSTRAINT "report_product_performance_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id");



ALTER TABLE ONLY "public"."report_product_performance"
    ADD CONSTRAINT "report_product_performance_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_product_performance"
    ADD CONSTRAINT "report_product_performance_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_scheduled"
    ADD CONSTRAINT "report_scheduled_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."report_scheduled"
    ADD CONSTRAINT "report_scheduled_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_scheduled"
    ADD CONSTRAINT "report_scheduled_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."saved_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_scheduled"
    ADD CONSTRAINT "report_scheduled_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_scheduled"
    ADD CONSTRAINT "report_scheduled_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_templates"
    ADD CONSTRAINT "report_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."report_templates"
    ADD CONSTRAINT "report_templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_templates"
    ADD CONSTRAINT "report_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_queries"
    ADD CONSTRAINT "saved_queries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."saved_queries"
    ADD CONSTRAINT "saved_queries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_queries"
    ADD CONSTRAINT "saved_queries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_reports"
    ADD CONSTRAINT "saved_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."saved_reports"
    ADD CONSTRAINT "saved_reports_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_reports"
    ADD CONSTRAINT "saved_reports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."report_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."saved_reports"
    ADD CONSTRAINT "saved_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seasonal_pricing_rules"
    ADD CONSTRAINT "seasonal_pricing_rules_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seasonal_pricing_rules"
    ADD CONSTRAINT "seasonal_pricing_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_audit_log"
    ADD CONSTRAINT "security_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."segment_members"
    ADD CONSTRAINT "segment_members_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."segment_members"
    ADD CONSTRAINT "segment_members_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."segment_members"
    ADD CONSTRAINT "segment_members_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."guest_segments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."segment_members"
    ADD CONSTRAINT "segment_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_locations"
    ADD CONSTRAINT "service_locations_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_locations"
    ADD CONSTRAINT "service_locations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_locations"
    ADD CONSTRAINT "service_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_reviews"
    ADD CONSTRAINT "session_reviews_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_reviews"
    ADD CONSTRAINT "session_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_reviews"
    ADD CONSTRAINT "session_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_inventory_allocations"
    ADD CONSTRAINT "shared_inventory_allocations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_inventory_allocations"
    ADD CONSTRAINT "shared_inventory_allocations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_inventory_allocations"
    ADD CONSTRAINT "shared_inventory_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_original_shift_id_fkey" FOREIGN KEY ("original_shift_id") REFERENCES "public"."staff_shifts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_requesting_staff_id_fkey" FOREIGN KEY ("requesting_staff_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_target_staff_id_fkey" FOREIGN KEY ("target_staff_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_shifts"
    ADD CONSTRAINT "staff_shifts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_shifts"
    ADD CONSTRAINT "staff_shifts_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."staff_shifts"
    ADD CONSTRAINT "staff_shifts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_shifts"
    ADD CONSTRAINT "staff_shifts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_shifts"
    ADD CONSTRAINT "staff_shifts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_inquiries"
    ADD CONSTRAINT "support_inquiries_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_inquiries"
    ADD CONSTRAINT "support_inquiries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_inquiries"
    ADD CONSTRAINT "support_inquiries_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."support_inquiries"
    ADD CONSTRAINT "support_inquiries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_defaults"
    ADD CONSTRAINT "system_defaults_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenant_integrations"
    ADD CONSTRAINT "tenant_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_property_group_id_fkey" FOREIGN KEY ("property_group_id") REFERENCES "public"."property_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."terminology_overrides"
    ADD CONSTRAINT "terminology_overrides_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."terminology_overrides"
    ADD CONSTRAINT "terminology_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_clock_adjustments"
    ADD CONSTRAINT "time_clock_adjustments_adjusted_by_fkey" FOREIGN KEY ("adjusted_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_clock_adjustments"
    ADD CONSTRAINT "time_clock_adjustments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_clock_adjustments"
    ADD CONSTRAINT "time_clock_adjustments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."staff_shifts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."time_clock_adjustments"
    ADD CONSTRAINT "time_clock_adjustments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."token_blacklist"
    ADD CONSTRAINT "token_blacklist_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."token_blacklist"
    ADD CONSTRAINT "token_blacklist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_service_location_id_fkey" FOREIGN KEY ("service_location_id") REFERENCES "public"."service_locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."translations"
    ADD CONSTRAINT "translations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."translations"
    ADD CONSTRAINT "translations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."translations"
    ADD CONSTRAINT "translations_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."translations"
    ADD CONSTRAINT "translations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."two_factor_auth"
    ADD CONSTRAINT "two_factor_auth_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."two_factor_auth"
    ADD CONSTRAINT "two_factor_auth_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."two_factor_auth"
    ADD CONSTRAINT "two_factor_auth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."two_factor_pending"
    ADD CONSTRAINT "two_factor_pending_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."two_factor_pending"
    ADD CONSTRAINT "two_factor_pending_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_group_access"
    ADD CONSTRAINT "user_group_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_group_access"
    ADD CONSTRAINT "user_group_access_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."property_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_group_access"
    ADD CONSTRAINT "user_group_access_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_group_access"
    ADD CONSTRAINT "user_group_access_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_group_access"
    ADD CONSTRAINT "user_group_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_property_access"
    ADD CONSTRAINT "user_property_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_property_access"
    ADD CONSTRAINT "user_property_access_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_property_access"
    ADD CONSTRAINT "user_property_access_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_property_access"
    ADD CONSTRAINT "user_property_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id");



ALTER TABLE ONLY "public"."waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_failures"
    ADD CONSTRAINT "webhook_failures_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_failures"
    ADD CONSTRAINT "webhook_failures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



CREATE POLICY "Admin access to group rate templates" ON "public"."group_rate_templates" USING ((EXISTS ( SELECT 1
   FROM "public"."user_group_access" "uga"
  WHERE (("uga"."user_id" = "auth"."uid"()) AND ("uga"."group_id" = "group_rate_templates"."group_id") AND (("uga"."access_level")::"text" = ANY ((ARRAY['manage'::character varying, 'admin'::character varying])::"text"[]))))));



CREATE POLICY "Admin access to shared inventory allocations" ON "public"."shared_inventory_allocations" USING ((EXISTS ( SELECT 1
   FROM "public"."user_group_access" "uga"
  WHERE (("uga"."user_id" = "auth"."uid"()) AND ("uga"."group_id" = "shared_inventory_allocations"."group_id") AND (("uga"."access_level")::"text" = ANY ((ARRAY['manage'::character varying, 'admin'::character varying])::"text"[]))))));



CREATE POLICY "Admin can manage property access" ON "public"."user_property_access" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to channel_availability_updates" ON "public"."channel_availability_updates" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to channel_connections" ON "public"."channel_connections" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to channel_rate_mappings" ON "public"."channel_rate_mappings" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to channel_rate_updates" ON "public"."channel_rate_updates" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to channel_reservations" ON "public"."channel_reservations" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to channel_room_mappings" ON "public"."channel_room_mappings" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to channel_sync_log" ON "public"."channel_sync_log" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to kiosk_analytics" ON "public"."kiosk_analytics" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to kiosk_devices" ON "public"."kiosk_devices" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to kiosk_hardware_events" ON "public"."kiosk_hardware_events" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to kiosk_key_stock" ON "public"."kiosk_key_stock" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to kiosk_screen_content" ON "public"."kiosk_screen_content" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to kiosk_screen_flows" ON "public"."kiosk_screen_flows" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to kiosk_sessions" ON "public"."kiosk_sessions" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Admin full access to kiosk_transactions" ON "public"."kiosk_transactions" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Admins and managers can manage POS reconciliation" ON "public"."pos_reconciliation" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Admins and managers can view reconciliation log" ON "public"."reconciliation_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Admins can insert chargebacks" ON "public"."chargebacks" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage app permissions" ON "public"."app_permissions" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage app role permissions" ON "public"."app_role_permissions" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage backups" ON "public"."backups" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage cancellation policies" ON "public"."cancellation_policies" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage currencies" ON "public"."currencies" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can manage email templates" ON "public"."email_templates" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage inventory BOM" ON "public"."inventory_bom" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage inventory purchase order items" ON "public"."inventory_purchase_order_items" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage loyalty fraud flags" ON "public"."loyalty_fraud_flags" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage menu item ingredients" ON "public"."menu_item_ingredients" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage metric definitions" ON "public"."metric_definitions" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage permissions" ON "public"."permissions" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage role permissions" ON "public"."role_permissions" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage roles" ON "public"."roles" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage seasonal pricing rules" ON "public"."seasonal_pricing_rules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can manage site settings" ON "public"."site_settings" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage suppression list" ON "public"."email_suppression_list" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage unit price rules" ON "public"."accommodation_unit_price_rules" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage user permissions" ON "public"."user_permissions" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage user roles" ON "public"."user_roles" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can update chargebacks" ON "public"."chargebacks" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can update loyalty settings" ON "public"."loyalty_settings" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can update webhook failures" ON "public"."webhook_failures" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view all chargebacks" ON "public"."chargebacks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view all manager notification settings" ON "public"."manager_notification_settings" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view all password history" ON "public"."password_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view audit logs" ON "public"."audit_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view biometric credentials" ON "public"."biometric_credentials" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view customization dual write log" ON "public"."customization_dual_write_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view email bounces" ON "public"."email_bounces" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view ref type telemetry" ON "public"."ref_type_telemetry" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view security audit log" ON "public"."security_audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view suppression list" ON "public"."email_suppression_list" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Admins can view webhook failures" ON "public"."webhook_failures" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Admins manage translations" ON "public"."translations" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = 'super_admin'::"text")))));



CREATE POLICY "Anyone can view active currencies" ON "public"."currencies" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Managers can manage all shift swap requests" ON "public"."shift_swap_requests" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Managers can manage all shifts" ON "public"."staff_shifts" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Managers can manage all time clock adjustments" ON "public"."time_clock_adjustments" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Managers can manage approvals" ON "public"."manager_approvals" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Managers can manage housekeeping schedules" ON "public"."housekeeping_schedules" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Managers can manage their own notification settings" ON "public"."manager_notification_settings" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Public can view active currencies" ON "public"."currencies" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "Public can view active menu categories" ON "public"."catalog_categories" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view active menu items" ON "public"."catalog_items" FOR SELECT USING (("is_available" = true));



CREATE POLICY "Public can view cancellation policies" ON "public"."cancellation_policies" FOR SELECT USING (true);



CREATE POLICY "Public can view capacity windows" ON "public"."capacity_windows" FOR SELECT USING (true);



CREATE POLICY "Public can view gift card templates" ON "public"."gift_card_templates" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view loyalty rewards" ON "public"."loyalty_rewards" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view loyalty tiers" ON "public"."loyalty_tiers" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view site settings" ON "public"."site_settings" FOR SELECT USING (true);



CREATE POLICY "Public read published translations" ON "public"."translations" FOR SELECT USING (("status" = 'published'::"public"."translation_status"));



CREATE POLICY "Service role has full access to chargebacks" ON "public"."chargebacks" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to currencies" ON "public"."currencies" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to email_bounces" ON "public"."email_bounces" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to suppression_list" ON "public"."email_suppression_list" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to webhook_failures" ON "public"."webhook_failures" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Staff can manage capacity windows" ON "public"."capacity_windows" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage coupons" ON "public"."coupons" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage gift card ledger" ON "public"."gift_card_ledger" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage gift cards" ON "public"."gift_cards" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage housekeeping logs" ON "public"."housekeeping_logs" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage inventory" ON "public"."inventory_items" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage inventory alerts" ON "public"."inventory_alerts" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage inventory categories" ON "public"."inventory_categories" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage loyalty members" ON "public"."loyalty_members" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage loyalty point batches" ON "public"."loyalty_point_batches" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage loyalty profiles" ON "public"."loyalty_profiles" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage menu categories" ON "public"."catalog_categories" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage menu items" ON "public"."catalog_items" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage sessions" ON "public"."sessions" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can manage user credits" ON "public"."user_credits" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Staff can read all translations" ON "public"."translations" FOR SELECT USING (("auth"."role"() = ANY (ARRAY['authenticated'::"text", 'service_role'::"text"])));



CREATE POLICY "Staff can view app permissions" ON "public"."app_permissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view app role permissions" ON "public"."app_role_permissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view approvals relevant to them" ON "public"."manager_approvals" FOR SELECT USING ((("requested_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'manager'::character varying])::"text"[])))))));



CREATE POLICY "Staff can view daily sales reports" ON "public"."report_daily_sales" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view email templates" ON "public"."email_templates" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view hourly metrics reports" ON "public"."report_hourly_metrics" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view housekeeping schedules" ON "public"."housekeeping_schedules" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view inventory BOM" ON "public"."inventory_bom" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view inventory consumption" ON "public"."inventory_consumption" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view inventory purchase order items" ON "public"."inventory_purchase_order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view inventory transactions" ON "public"."inventory_transactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view menu item ingredients" ON "public"."menu_item_ingredients" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view metric definitions" ON "public"."metric_definitions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view permissions" ON "public"."permissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view price history" ON "public"."price_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'staff'::character varying, 'receptionist'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view product performance reports" ON "public"."report_product_performance" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view role permissions" ON "public"."role_permissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view roles" ON "public"."roles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view seasonal pricing rules" ON "public"."seasonal_pricing_rules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'staff'::character varying, 'receptionist'::character varying])::"text"[]))))));



CREATE POLICY "Staff can view shift swap requests they are part of" ON "public"."shift_swap_requests" FOR SELECT USING ((("requesting_staff_id" = "auth"."uid"()) OR ("target_staff_id" = "auth"."uid"())));



CREATE POLICY "Staff can view their own shifts" ON "public"."staff_shifts" FOR SELECT USING (("staff_id" = "auth"."uid"()));



CREATE POLICY "Staff can view their own time clock adjustments" ON "public"."time_clock_adjustments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."staff_shifts"
  WHERE (("staff_shifts"."id" = "time_clock_adjustments"."shift_id") AND ("staff_shifts"."staff_id" = "auth"."uid"())))));



CREATE POLICY "Staff can view unit price rules" ON "public"."accommodation_unit_price_rules" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "System can insert audit logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert customization dual write log" ON "public"."customization_dual_write_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert daily sales reports" ON "public"."report_daily_sales" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert hourly metrics reports" ON "public"."report_hourly_metrics" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert inventory consumption" ON "public"."inventory_consumption" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert password history" ON "public"."password_history" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "System can insert price history" ON "public"."price_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert product performance reports" ON "public"."report_product_performance" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert reconciliation log" ON "public"."reconciliation_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert ref type telemetry" ON "public"."ref_type_telemetry" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert security audit log" ON "public"."security_audit_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can access authorized properties" ON "public"."properties" FOR SELECT USING (("public"."user_has_property_access"("auth"."uid"(), "id", 'read'::character varying) OR (NOT (EXISTS ( SELECT 1
   FROM "public"."user_property_access")))));



CREATE POLICY "Users can access property groups they belong to" ON "public"."property_groups" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."user_group_access" "uga"
  WHERE (("uga"."user_id" = "auth"."uid"()) AND ("uga"."group_id" = "property_groups"."id")))) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = 'super_admin'::"text"))))));



CREATE POLICY "Users can manage their own 2FA pending" ON "public"."two_factor_pending" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own biometric credentials" ON "public"."biometric_credentials" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their loyalty membership" ON "public"."loyalty_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their loyalty transactions" ON "public"."loyalty_transactions" FOR SELECT USING (("member_id" IN ( SELECT "loyalty_members"."id"
   FROM "public"."loyalty_members"
  WHERE ("loyalty_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own credits" ON "public"."user_credits" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own gift card ledger" ON "public"."gift_card_ledger" FOR SELECT USING (("gift_card_id" IN ( SELECT "gift_cards"."id"
   FROM "public"."gift_cards"
  WHERE (("gift_cards"."purchased_by" = "auth"."uid"()) OR (("gift_cards"."recipient_email")::"text" = (( SELECT "users"."email"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"())))::"text")))));



CREATE POLICY "Users can view their own gift cards" ON "public"."gift_cards" FOR SELECT USING ((("purchased_by" = "auth"."uid"()) OR (("recipient_email")::"text" = (( SELECT "users"."email"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text")));



CREATE POLICY "Users can view their own loyalty point batches" ON "public"."loyalty_point_batches" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own loyalty profile" ON "public"."loyalty_profiles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own password history" ON "public"."password_history" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own permissions" ON "public"."user_permissions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own property access" ON "public"."user_property_access" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own roles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own sessions" ON "public"."sessions" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."accommodation_unit_price_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "accommodation_unit_price_rules_isolation" ON "public"."accommodation_unit_price_rules" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."accommodation_units" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "accommodation_units_isolation" ON "public"."accommodation_units" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "admin_manage_2fa" ON "public"."two_factor_auth" TO "authenticated" USING ("public"."user_has_role"('admin'::"text")) WITH CHECK ("public"."user_has_role"('admin'::"text"));



CREATE POLICY "admin_manage_campaign_sends" ON "public"."campaign_sends" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_campaigns" ON "public"."marketing_campaigns" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_chatbot_intents" ON "public"."chatbot_intents" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_competitor_rates" ON "public"."competitor_rates" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_conversations" ON "public"."conversations" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('staff'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('staff'::"text")));



CREATE POLICY "admin_manage_dashboard_widgets" ON "public"."dashboard_widgets" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_demand_forecasts" ON "public"."demand_forecasts" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_digital_signatures" ON "public"."digital_signatures" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_email_templates" ON "public"."marketing_email_templates" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_enrollments" ON "public"."journey_enrollments" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_faqs" ON "public"."faqs" TO "authenticated" USING ("public"."user_has_role"('admin'::"text")) WITH CHECK ("public"."user_has_role"('admin'::"text"));



CREATE POLICY "admin_manage_gdpr_processing" ON "public"."gdpr_processing_activities" TO "authenticated" USING ("public"."user_has_role"('admin'::"text")) WITH CHECK ("public"."user_has_role"('admin'::"text"));



CREATE POLICY "admin_manage_gdpr_retention" ON "public"."gdpr_retention_policies" TO "authenticated" USING ("public"."user_has_role"('admin'::"text")) WITH CHECK ("public"."user_has_role"('admin'::"text"));



CREATE POLICY "admin_manage_group_activities" ON "public"."group_activities" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_group_bookings" ON "public"."group_bookings" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_group_contracts" ON "public"."group_contracts" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_group_events" ON "public"."group_events" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_group_invoices" ON "public"."group_invoices" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_group_payments" ON "public"."group_payments" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_group_reservations" ON "public"."group_reservations" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_group_room_blocks" ON "public"."group_room_blocks" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_guest_msg_prefs" ON "public"."guest_messaging_preferences" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_guest_segments" ON "public"."guest_segments" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_guests" ON "public"."guests" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_journey_steps" ON "public"."journey_steps" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_journeys" ON "public"."email_journeys" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_market_events" ON "public"."market_events" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_message_templates" ON "public"."message_templates" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_messages" ON "public"."messages" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('staff'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('staff'::"text")));



CREATE POLICY "admin_manage_messaging_channels" ON "public"."messaging_channels" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_mobile_key_log" ON "public"."mobile_key_access_log" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_mobile_keys" ON "public"."mobile_keys" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_parity_alerts" ON "public"."rate_parity_alerts" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_parity_checks" ON "public"."rate_parity_checks" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_parity_config" ON "public"."rate_parity_config" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_parity_results" ON "public"."rate_parity_results" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_pricing_rules" ON "public"."pricing_rules" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_rate_recommendations" ON "public"."rate_recommendations" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_reg_documents" ON "public"."registration_documents" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_registrations" ON "public"."pre_arrival_registrations" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_report_executions" ON "public"."report_executions" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_report_templates" ON "public"."report_templates" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_saved_reports" ON "public"."saved_reports" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_scheduled_reports" ON "public"."report_scheduled" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_segment_members" ON "public"."segment_members" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "admin_manage_terminology" ON "public"."terminology_overrides" TO "authenticated" USING (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text"))) WITH CHECK (("public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



ALTER TABLE "public"."alert_definitions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alert_definitions_isolation" ON "public"."alert_definitions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."alert_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alert_history_isolation" ON "public"."alert_history" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."app_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_permissions_isolation" ON "public"."app_permissions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."app_role_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_role_permissions_isolation" ON "public"."app_role_permissions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_isolation" ON "public"."audit_logs" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."backups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "backups_isolation" ON "public"."backups" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."billing_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "billing_history_service_role_all" ON "public"."billing_history" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."biometric_credentials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "biometric_credentials_isolation" ON "public"."biometric_credentials" USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));



ALTER TABLE "public"."booking_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_reviews_admin" ON "public"."booking_reviews" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "booking_reviews_insert" ON "public"."booking_reviews" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "booking_reviews_isolation" ON "public"."booking_reviews" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "booking_reviews_select_approved" ON "public"."booking_reviews" FOR SELECT TO "authenticated" USING ((("is_approved" = true) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "broadcasts_admin_all" ON "public"."notification_broadcasts" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "broadcasts_staff_select" ON "public"."notification_broadcasts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['staff'::character varying, 'admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



ALTER TABLE "public"."campaign_sends" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_sends_isolation" ON "public"."campaign_sends" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."cancellation_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cancellation_policies_isolation" ON "public"."cancellation_policies" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."capacity_windows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "capacity_windows_isolation" ON "public"."capacity_windows" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."cash_drawers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cash_drawers_isolation" ON "public"."cash_drawers" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."cash_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cash_transactions_isolation" ON "public"."cash_transactions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."catalog_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "catalog_categories_isolation" ON "public"."catalog_categories" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."catalog_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "catalog_items_isolation" ON "public"."catalog_items" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."channel_availability_updates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channel_availability_updates_isolation" ON "public"."channel_availability_updates" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."channel_connections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channel_connections_isolation" ON "public"."channel_connections" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."channel_rate_mappings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channel_rate_mappings_isolation" ON "public"."channel_rate_mappings" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."channel_rate_updates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channel_rate_updates_isolation" ON "public"."channel_rate_updates" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."channel_reservations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channel_reservations_isolation" ON "public"."channel_reservations" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."channel_room_mappings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channel_room_mappings_isolation" ON "public"."channel_room_mappings" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."channel_sync_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "channel_sync_log_isolation" ON "public"."channel_sync_log" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."chargebacks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chargebacks_isolation" ON "public"."chargebacks" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."chatbot_intents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chatbot_intents_isolation" ON "public"."chatbot_intents" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "comp_log_all" ON "public"."engine_compensation_log" USING (true);



ALTER TABLE "public"."competitor_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "competitor_rates_isolation" ON "public"."competitor_rates" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_isolation" ON "public"."conversations" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."coupon_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coupon_usage_isolation" ON "public"."coupon_usage" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."coupons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coupons_isolation" ON "public"."coupons" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."currencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customization_dual_write_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customization_dual_write_log_isolation" ON "public"."customization_dual_write_log" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."customization_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customization_events_insert" ON "public"."customization_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "customization_events_isolation" ON "public"."customization_events" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "customization_events_read" ON "public"."customization_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[]))))));



ALTER TABLE "public"."customization_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customization_groups_delete" ON "public"."customization_groups" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "customization_groups_insert" ON "public"."customization_groups" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "customization_groups_isolation" ON "public"."customization_groups" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "customization_groups_update" ON "public"."customization_groups" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[]))))));



ALTER TABLE "public"."customization_metrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customization_metrics_insert" ON "public"."customization_metrics" FOR INSERT WITH CHECK (true);



CREATE POLICY "customization_metrics_isolation" ON "public"."customization_metrics" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "customization_metrics_read" ON "public"."customization_metrics" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[]))))));



ALTER TABLE "public"."customization_options" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customization_options_delete" ON "public"."customization_options" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "customization_options_insert" ON "public"."customization_options" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "customization_options_isolation" ON "public"."customization_options" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "customization_options_update" ON "public"."customization_options" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[]))))));



ALTER TABLE "public"."dashboard_widgets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dashboard_widgets_isolation" ON "public"."dashboard_widgets" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."demand_forecasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "demand_forecasts_isolation" ON "public"."demand_forecasts" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."device_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "device_tokens_admin_policy" ON "public"."device_tokens" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = 'admin'::"text")))));



CREATE POLICY "device_tokens_isolation" ON "public"."device_tokens" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "device_tokens_user_policy" ON "public"."device_tokens" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."digital_signatures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "digital_signatures_isolation" ON "public"."digital_signatures" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "eff_all" ON "public"."engine_feature_flags" USING (true);



CREATE POLICY "efl_read" ON "public"."engine_financial_ledger" FOR SELECT USING (true);



CREATE POLICY "ele_all" ON "public"."engine_loyalty_events" USING (true);



ALTER TABLE "public"."email_bounces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_bounces_isolation" ON "public"."email_bounces" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."email_journeys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_journeys_isolation" ON "public"."email_journeys" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."email_suppression_list" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_suppression_list_isolation" ON "public"."email_suppression_list" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_templates_isolation" ON "public"."email_templates" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."engine_compensation_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engine_compensation_log_isolation" ON "public"."engine_compensation_log" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."engine_feature_flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engine_feature_flags_isolation" ON "public"."engine_feature_flags" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."engine_financial_ledger" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engine_financial_ledger_isolation" ON "public"."engine_financial_ledger" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."engine_idempotency_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engine_idempotency_keys_isolation" ON "public"."engine_idempotency_keys" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."engine_loyalty_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engine_loyalty_events_isolation" ON "public"."engine_loyalty_events" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."engine_state_transitions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "engine_state_transitions_isolation" ON "public"."engine_state_transitions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."entity_customizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "entity_customizations_delete" ON "public"."entity_customizations" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying])::"text"[]))))));



CREATE POLICY "entity_customizations_insert" ON "public"."entity_customizations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "entity_customizations_isolation" ON "public"."entity_customizations" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "entity_customizations_update" ON "public"."entity_customizations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'staff'::character varying])::"text"[]))))));



CREATE POLICY "est_all" ON "public"."engine_state_transitions" USING (true);



ALTER TABLE "public"."faqs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "faqs_isolation" ON "public"."faqs" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."gdpr_consents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gdpr_consents_isolation" ON "public"."gdpr_consents" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "gdpr_consents_own" ON "public"."gdpr_consents" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."gdpr_cookie_consents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gdpr_cookie_consents_admin_read" ON "public"."gdpr_cookie_consents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "gdpr_cookie_consents_insert" ON "public"."gdpr_cookie_consents" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "gdpr_cookie_consents_isolation" ON "public"."gdpr_cookie_consents" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "gdpr_cookie_consents_read_own" ON "public"."gdpr_cookie_consents" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."gdpr_data_sharing_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gdpr_data_sharing_log_insert" ON "public"."gdpr_data_sharing_log" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "gdpr_data_sharing_log_isolation" ON "public"."gdpr_data_sharing_log" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "gdpr_data_sharing_log_read" ON "public"."gdpr_data_sharing_log" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[])))))));



CREATE POLICY "gdpr_deletion_own" ON "public"."gdpr_deletion_requests" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."gdpr_deletion_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gdpr_deletion_requests_isolation" ON "public"."gdpr_deletion_requests" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "gdpr_export_own" ON "public"."gdpr_export_requests" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."gdpr_export_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gdpr_export_requests_isolation" ON "public"."gdpr_export_requests" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."gdpr_processing_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gdpr_processing_activities_isolation" ON "public"."gdpr_processing_activities" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."gdpr_retention_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gdpr_retention_policies_isolation" ON "public"."gdpr_retention_policies" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."gift_card_ledger" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gift_card_ledger_isolation" ON "public"."gift_card_ledger" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."gift_card_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gift_card_templates_isolation" ON "public"."gift_card_templates" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."gift_card_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gift_card_transactions_isolation" ON "public"."gift_card_transactions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."gift_cards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gift_cards_isolation" ON "public"."gift_cards" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."group_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_activities_isolation" ON "public"."group_activities" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."group_bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_bookings_isolation" ON "public"."group_bookings" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."group_contracts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_contracts_isolation" ON "public"."group_contracts" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."group_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_events_isolation" ON "public"."group_events" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."group_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_invoices_isolation" ON "public"."group_invoices" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."group_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_payments_isolation" ON "public"."group_payments" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."group_rate_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_rate_templates_isolation" ON "public"."group_rate_templates" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."group_report_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_report_schedules_isolation" ON "public"."group_report_schedules" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."group_reservations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_reservations_isolation" ON "public"."group_reservations" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."group_room_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_room_blocks_isolation" ON "public"."group_room_blocks" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."group_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_settings_isolation" ON "public"."group_settings" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "group_settings_read" ON "public"."group_settings" FOR SELECT USING (true);



CREATE POLICY "group_settings_write" ON "public"."group_settings" USING ((EXISTS ( SELECT 1
   FROM "public"."user_group_access"
  WHERE (("user_group_access"."user_id" = "auth"."uid"()) AND ("user_group_access"."group_id" = "group_settings"."group_id") AND (("user_group_access"."access_level")::"text" = ANY ((ARRAY['admin'::character varying, 'manage'::character varying])::"text"[]))))));



ALTER TABLE "public"."guest_messaging_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guest_messaging_preferences_isolation" ON "public"."guest_messaging_preferences" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "guest_rfm_property_isolation" ON "public"."guest_rfm_scores" USING (("property_id" IN ( SELECT "user_property_access"."property_id"
   FROM "public"."user_property_access"
  WHERE ("user_property_access"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."guest_rfm_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guest_rfm_scores_isolation" ON "public"."guest_rfm_scores" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."guest_segments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guest_segments_isolation" ON "public"."guest_segments" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."guests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guests_isolation" ON "public"."guests" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "hardened_2fa_self_manage" ON "public"."two_factor_auth" TO "authenticated" USING ((("auth"."uid"() = "user_id") OR "public"."user_has_role"('admin'::"text"))) WITH CHECK ((("auth"."uid"() = "user_id") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "hardened_cash_drawers_manage" ON "public"."cash_drawers" TO "authenticated" USING (("public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text"))) WITH CHECK (("public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "hardened_cash_tx_manage" ON "public"."cash_transactions" TO "authenticated" USING (("public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text"))) WITH CHECK (("public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "hardened_gdpr_retention_admin" ON "public"."gdpr_retention_policies" TO "authenticated" USING ("public"."user_has_role"('admin'::"text")) WITH CHECK ("public"."user_has_role"('admin'::"text"));



CREATE POLICY "hardened_guests_admin_manage" ON "public"."guests" TO "authenticated" USING (("public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text"))) WITH CHECK (("public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "hardened_waitlist_staff_manage" ON "public"."waitlist_entries" TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text"))) WITH CHECK (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



ALTER TABLE "public"."housekeeping_inspections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "housekeeping_inspections_isolation" ON "public"."housekeeping_inspections" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "housekeeping_inspections_modify" ON "public"."housekeeping_inspections" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



ALTER TABLE "public"."housekeeping_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "housekeeping_logs_isolation" ON "public"."housekeeping_logs" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."housekeeping_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "housekeeping_schedules_isolation" ON "public"."housekeeping_schedules" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."housekeeping_sla" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "housekeeping_sla_isolation" ON "public"."housekeeping_sla" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "housekeeping_sla_modify" ON "public"."housekeeping_sla" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



ALTER TABLE "public"."housekeeping_supplies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "housekeeping_supplies_isolation" ON "public"."housekeeping_supplies" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "housekeeping_supplies_modify" ON "public"."housekeeping_supplies" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



ALTER TABLE "public"."housekeeping_task_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "housekeeping_task_comments_isolation" ON "public"."housekeeping_task_comments" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."housekeeping_task_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "housekeeping_task_types_isolation" ON "public"."housekeeping_task_types" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."housekeeping_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "housekeeping_tasks_isolation" ON "public"."housekeeping_tasks" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "idem_all" ON "public"."engine_idempotency_keys" USING (true);



ALTER TABLE "public"."inventory_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_alerts_isolation" ON "public"."inventory_alerts" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."inventory_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_batches_isolation" ON "public"."inventory_batches" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "inventory_batches_modify" ON "public"."inventory_batches" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



ALTER TABLE "public"."inventory_bom" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_bom_isolation" ON "public"."inventory_bom" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."inventory_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_categories_isolation" ON "public"."inventory_categories" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."inventory_consumption" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_consumption_isolation" ON "public"."inventory_consumption" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "inventory_ingredients_modify" ON "public"."inventory_recipe_ingredients" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_items_isolation" ON "public"."inventory_items" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "inventory_po_modify" ON "public"."inventory_purchase_orders" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



ALTER TABLE "public"."inventory_purchase_order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_purchase_order_items_isolation" ON "public"."inventory_purchase_order_items" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."inventory_purchase_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_purchase_orders_isolation" ON "public"."inventory_purchase_orders" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."inventory_recipe_ingredients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_recipe_ingredients_isolation" ON "public"."inventory_recipe_ingredients" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."inventory_recipes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_recipes_isolation" ON "public"."inventory_recipes" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "inventory_recipes_modify" ON "public"."inventory_recipes" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



ALTER TABLE "public"."inventory_suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_suppliers_isolation" ON "public"."inventory_suppliers" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "inventory_suppliers_modify" ON "public"."inventory_suppliers" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



ALTER TABLE "public"."inventory_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_transactions_isolation" ON "public"."inventory_transactions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."inventory_variance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_variance_isolation" ON "public"."inventory_variance" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "inventory_variance_modify" ON "public"."inventory_variance" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



ALTER TABLE "public"."inventory_wastage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_wastage_isolation" ON "public"."inventory_wastage" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "inventory_wastage_modify" ON "public"."inventory_wastage" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying, 'staff'::character varying])::"text"[]))))));



ALTER TABLE "public"."journey_enrollments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journey_enrollments_isolation" ON "public"."journey_enrollments" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."journey_steps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journey_steps_isolation" ON "public"."journey_steps" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."kiosk_analytics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiosk_analytics_isolation" ON "public"."kiosk_analytics" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."kiosk_devices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiosk_devices_isolation" ON "public"."kiosk_devices" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."kiosk_hardware_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiosk_hardware_events_isolation" ON "public"."kiosk_hardware_events" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."kiosk_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiosk_items_isolation" ON "public"."kiosk_items" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."kiosk_key_stock" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiosk_key_stock_isolation" ON "public"."kiosk_key_stock" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."kiosk_screen_content" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiosk_screen_content_isolation" ON "public"."kiosk_screen_content" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."kiosk_screen_flows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiosk_screen_flows_isolation" ON "public"."kiosk_screen_flows" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."kiosk_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiosk_sessions_isolation" ON "public"."kiosk_sessions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."kiosk_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kiosk_transactions_isolation" ON "public"."kiosk_transactions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."loyalty_fraud_flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_fraud_flags_isolation" ON "public"."loyalty_fraud_flags" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."loyalty_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_members_isolation" ON "public"."loyalty_members" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."loyalty_point_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_point_batches_isolation" ON "public"."loyalty_point_batches" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."loyalty_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_profiles_isolation" ON "public"."loyalty_profiles" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."loyalty_redemptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_redemptions_isolation" ON "public"."loyalty_redemptions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."loyalty_rewards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_rewards_isolation" ON "public"."loyalty_rewards" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."loyalty_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_settings_isolation" ON "public"."loyalty_settings" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."loyalty_tiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_tiers_isolation" ON "public"."loyalty_tiers" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."loyalty_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "loyalty_transactions_isolation" ON "public"."loyalty_transactions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "manager_admin_manage_cash_transactions" ON "public"."cash_transactions" TO "authenticated" USING (("public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text"))) WITH CHECK (("public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



ALTER TABLE "public"."manager_approvals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manager_approvals_isolation" ON "public"."manager_approvals" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."manager_notification_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manager_notification_settings_isolation" ON "public"."manager_notification_settings" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."market_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "market_events_isolation" ON "public"."market_events" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."marketing_campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_campaigns_isolation" ON "public"."marketing_campaigns" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."marketing_email_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "marketing_email_templates_isolation" ON "public"."marketing_email_templates" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."membership_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "membership_plans_all" ON "public"."membership_plans" USING (true);



ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "memberships_all" ON "public"."memberships" USING (true);



ALTER TABLE "public"."menu_item_ingredients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_item_ingredients_isolation" ON "public"."menu_item_ingredients" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."message_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message_templates_isolation" ON "public"."message_templates" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_isolation" ON "public"."messages" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."messaging_channels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messaging_channels_isolation" ON "public"."messaging_channels" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."metric_definitions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "metric_definitions_isolation" ON "public"."metric_definitions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."mobile_key_access_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mobile_key_access_log_isolation" ON "public"."mobile_key_access_log" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."mobile_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mobile_keys_isolation" ON "public"."mobile_keys" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."module_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "module_templates_admin_write" ON "public"."module_templates" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "module_templates_isolation" ON "public"."module_templates" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "module_templates_read" ON "public"."module_templates" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."modules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modules_isolation" ON "public"."modules" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."notification_broadcasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_broadcasts_isolation" ON "public"."notification_broadcasts" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_logs_admin_policy" ON "public"."notification_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = 'admin'::"text")))));



CREATE POLICY "notification_logs_isolation" ON "public"."notification_logs" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "notification_logs_user_policy" ON "public"."notification_logs" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."notification_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_templates_isolation" ON "public"."notification_templates" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_admin_all" ON "public"."notifications" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "notifications_isolation" ON "public"."notifications" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "notifications_user_select" ON "public"."notifications" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));



CREATE POLICY "notifications_user_update" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."order_customizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_customizations_insert" ON "public"."order_customizations" FOR INSERT WITH CHECK (((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'staff'::character varying])::"text"[])))))));



CREATE POLICY "order_customizations_isolation" ON "public"."order_customizations" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "order_customizations_read" ON "public"."order_customizations" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'manager'::character varying, 'staff'::character varying])::"text"[]))))) OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "order_customizations_update" ON "public"."order_customizations" FOR UPDATE USING (((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND (("users"."role")::"text" = 'admin'::"text"))))));



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_items_isolation" ON "public"."order_items" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."order_payment_splits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_payment_splits_isolation" ON "public"."order_payment_splits" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."password_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "password_history_isolation" ON "public"."password_history" USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));



ALTER TABLE "public"."payment_ledger" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_ledger_isolation" ON "public"."payment_ledger" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_admin_write" ON "public"."payments" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "payments_isolation" ON "public"."payments" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "payments_staff_read" ON "public"."payments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['staff'::character varying, 'manager'::character varying, 'admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "permissions_isolation" ON "public"."permissions" USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));



ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plans_platform_admin_write" ON "public"."plans" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = (("auth"."uid"())::"text")::"uuid") AND ("u"."is_platform_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = (("auth"."uid"())::"text")::"uuid") AND ("u"."is_platform_admin" = true)))));



CREATE POLICY "plans_public_read" ON "public"."plans" FOR SELECT USING (("is_active" = true));



CREATE POLICY "plans_service_role_all" ON "public"."plans" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."pos_reconciliation" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pos_reconciliation_isolation" ON "public"."pos_reconciliation" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."pre_arrival_registrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pre_arrival_registrations_isolation" ON "public"."pre_arrival_registrations" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."price_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "price_history_isolation" ON "public"."price_history" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."pricing_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing_rules_isolation" ON "public"."pricing_rules" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."product_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_reviews_admin" ON "public"."product_reviews" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "product_reviews_insert" ON "public"."product_reviews" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "product_reviews_isolation" ON "public"."product_reviews" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "product_reviews_select_approved" ON "public"."product_reviews" FOR SELECT TO "authenticated" USING ((("is_approved" = true) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "properties_admin_all" ON "public"."properties" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "properties_isolation" ON "public"."properties" USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));



CREATE POLICY "properties_select_policy" ON "public"."properties" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."property_benchmarks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "property_benchmarks_isolation" ON "public"."property_benchmarks" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."property_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "property_groups_isolation" ON "public"."property_groups" USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));



ALTER TABLE "public"."property_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "property_settings_isolation" ON "public"."property_settings" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "property_settings_read" ON "public"."property_settings" FOR SELECT USING (true);



CREATE POLICY "property_settings_write" ON "public"."property_settings" USING ((EXISTS ( SELECT 1
   FROM "public"."user_property_access"
  WHERE (("user_property_access"."user_id" = "auth"."uid"()) AND ("user_property_access"."property_id" = "property_settings"."property_id") AND (("user_property_access"."access_level")::"text" = ANY ((ARRAY['admin'::character varying, 'manage'::character varying])::"text"[]))))));



CREATE POLICY "public_insert_support" ON "public"."support_inquiries" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "public_read_customization_groups" ON "public"."customization_groups" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public_read_customization_options" ON "public"."customization_options" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public_read_entity_customizations" ON "public"."entity_customizations" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public_read_faqs" ON "public"."faqs" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public_read_loyalty_settings" ON "public"."loyalty_settings" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "public_read_terminology" ON "public"."terminology_overrides" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."rate_parity_alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rate_parity_alerts_isolation" ON "public"."rate_parity_alerts" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."rate_parity_checks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rate_parity_checks_isolation" ON "public"."rate_parity_checks" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."rate_parity_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rate_parity_config_isolation" ON "public"."rate_parity_config" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."rate_parity_results" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rate_parity_results_isolation" ON "public"."rate_parity_results" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."rate_recommendations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rate_recommendations_isolation" ON "public"."rate_recommendations" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."reconciliation_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reconciliation_log_isolation" ON "public"."reconciliation_log" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."ref_type_telemetry" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ref_type_telemetry_isolation" ON "public"."ref_type_telemetry" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."registration_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "registration_documents_isolation" ON "public"."registration_documents" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."report_daily_sales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_daily_sales_isolation" ON "public"."report_daily_sales" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."report_executions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_executions_isolation" ON "public"."report_executions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."report_hourly_metrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_hourly_metrics_isolation" ON "public"."report_hourly_metrics" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."report_product_performance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_product_performance_isolation" ON "public"."report_product_performance" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."report_scheduled" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_scheduled_isolation" ON "public"."report_scheduled" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."report_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "report_templates_isolation" ON "public"."report_templates" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_admin_manage" ON "public"."reviews" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "reviews_isolation" ON "public"."reviews" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "reviews_owner_write" ON "public"."reviews" FOR INSERT WITH CHECK (("customer_id" = "auth"."uid"()));



CREATE POLICY "reviews_public_read" ON "public"."reviews" FOR SELECT USING (((("status")::"text" = 'approved'::"text") OR ("customer_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['staff'::character varying, 'manager'::character varying, 'admin'::character varying, 'super_admin'::character varying])::"text"[])))))));



ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "role_permissions_isolation" ON "public"."role_permissions" USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_isolation" ON "public"."roles" USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));



ALTER TABLE "public"."saved_queries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_queries_isolation" ON "public"."saved_queries" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."saved_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_reports_isolation" ON "public"."saved_reports" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."seasonal_pricing_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seasonal_pricing_rules_isolation" ON "public"."seasonal_pricing_rules" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."security_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "security_audit_log_isolation" ON "public"."security_audit_log" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."segment_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "segment_members_isolation" ON "public"."segment_members" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."service_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_locations_isolation" ON "public"."service_locations" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND (("property_id" IS NULL) OR "public"."user_has_property_access"("auth"."uid"(), "property_id")))) WITH CHECK (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND (("property_id" IS NULL) OR "public"."user_has_property_access"("auth"."uid"(), "property_id"))));



CREATE POLICY "service_role_all_notification_broadcasts" ON "public"."notification_broadcasts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_notification_templates" ON "public"."notification_templates" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."session_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_reviews_admin" ON "public"."session_reviews" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



CREATE POLICY "session_reviews_insert" ON "public"."session_reviews" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "session_reviews_isolation" ON "public"."session_reviews" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "session_reviews_select_approved" ON "public"."session_reviews" FOR SELECT TO "authenticated" USING ((("is_approved" = true) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions_isolation" ON "public"."sessions" USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));



ALTER TABLE "public"."shared_inventory_allocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shared_inventory_allocations_isolation" ON "public"."shared_inventory_allocations" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."shift_swap_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shift_swap_requests_isolation" ON "public"."shift_swap_requests" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "site_settings_isolation" ON "public"."site_settings" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "site_settings_onboarding_access" ON "public"."site_settings" TO "authenticated" USING (("key" = 'onboarding_state'::"text")) WITH CHECK (("key" = 'onboarding_state'::"text"));



CREATE POLICY "staff_admin_manage_waitlist" ON "public"."waitlist_entries" TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text"))) WITH CHECK (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_manage_cash_drawers" ON "public"."cash_drawers" TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text"))) WITH CHECK (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_manage_cash_transactions" ON "public"."cash_transactions" TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text"))) WITH CHECK (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_manage_order_customizations" ON "public"."order_customizations" TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text"))) WITH CHECK (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_manage_support" ON "public"."support_inquiries" FOR UPDATE TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



CREATE POLICY "staff_manage_waitlist" ON "public"."waitlist_entries" TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text"))) WITH CHECK (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_read_housekeeping_inspections" ON "public"."housekeeping_inspections" FOR SELECT TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_read_housekeeping_sla" ON "public"."housekeeping_sla" FOR SELECT TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_read_housekeeping_supplies" ON "public"."housekeeping_supplies" FOR SELECT TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_read_inventory_batches" ON "public"."inventory_batches" FOR SELECT TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_read_inventory_ingredients" ON "public"."inventory_recipe_ingredients" FOR SELECT TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_read_inventory_po" ON "public"."inventory_purchase_orders" FOR SELECT TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_read_inventory_recipes" ON "public"."inventory_recipes" FOR SELECT TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_read_inventory_suppliers" ON "public"."inventory_suppliers" FOR SELECT TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_read_inventory_variance" ON "public"."inventory_variance" FOR SELECT TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_read_inventory_wastage" ON "public"."inventory_wastage" FOR SELECT TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('manager'::"text") OR "public"."user_has_role"('admin'::"text")));



CREATE POLICY "staff_read_support" ON "public"."support_inquiries" FOR SELECT TO "authenticated" USING (("public"."user_has_role"('staff'::"text") OR "public"."user_has_role"('admin'::"text") OR "public"."user_has_role"('manager'::"text")));



ALTER TABLE "public"."staff_shifts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_shifts_isolation" ON "public"."staff_shifts" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."support_inquiries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_inquiries_isolation" ON "public"."support_inquiries" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."supported_languages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supported_languages_read" ON "public"."supported_languages" FOR SELECT USING (true);



CREATE POLICY "supported_languages_write" ON "public"."supported_languages" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."system_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_config_read" ON "public"."system_config" FOR SELECT USING (true);



CREATE POLICY "system_config_write" ON "public"."system_config" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."system_defaults" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_defaults_read" ON "public"."system_defaults" FOR SELECT USING (true);



CREATE POLICY "system_defaults_write" ON "public"."system_defaults" USING (("auth"."uid"() IN ( SELECT "users"."id"
   FROM "public"."users"
  WHERE (("users"."role")::"text" = 'super_admin'::"text"))));



ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_settings_isolation" ON "public"."system_settings" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



CREATE POLICY "tbl_system" ON "public"."token_blacklist" USING (true);



CREATE POLICY "templates_admin_all" ON "public"."notification_templates" USING ((EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND (("r"."name")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[]))))));



ALTER TABLE "public"."tenant_integrations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_integrations_service_role_all" ON "public"."tenant_integrations" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenants_platform_admin_read" ON "public"."tenants" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = (("auth"."uid"())::"text")::"uuid") AND ("u"."is_platform_admin" = true)))));



CREATE POLICY "tenants_service_role_all" ON "public"."tenants" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."terminology_overrides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "terminology_overrides_isolation" ON "public"."terminology_overrides" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."time_clock_adjustments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "time_clock_adjustments_isolation" ON "public"."time_clock_adjustments" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."token_blacklist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "token_blacklist_isolation" ON "public"."token_blacklist" USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_allow_all" ON "public"."transactions" USING (true);



CREATE POLICY "transactions_isolation" ON "public"."transactions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."translations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "translations_isolation" ON "public"."translations" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."two_factor_auth" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "two_factor_auth_isolation" ON "public"."two_factor_auth" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."two_factor_pending" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "two_factor_pending_isolation" ON "public"."two_factor_pending" USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));



ALTER TABLE "public"."user_credits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_credits_isolation" ON "public"."user_credits" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."user_group_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_group_access_isolation" ON "public"."user_group_access" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."user_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_permissions_isolation" ON "public"."user_permissions" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."user_property_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_property_access_isolation" ON "public"."user_property_access" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_isolation" ON "public"."user_roles" USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_admin_write" ON "public"."users" USING ((("id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[])))))));



COMMENT ON POLICY "users_admin_write" ON "public"."users" IS 'GDPR: Only admin+ or self can modify user records';



CREATE POLICY "users_isolation" ON "public"."users" USING ("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id"));



CREATE POLICY "users_self_read" ON "public"."users" FOR SELECT USING ((("id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."role")::"text" = ANY ((ARRAY['staff'::character varying, 'manager'::character varying, 'admin'::character varying, 'super_admin'::character varying])::"text"[])))))));



COMMENT ON POLICY "users_self_read" ON "public"."users" IS 'GDPR: Users can read own data; staff+ can read all';



ALTER TABLE "public"."waitlist_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "waitlist_entries_isolation" ON "public"."waitlist_entries" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));



ALTER TABLE "public"."webhook_failures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "webhook_failures_isolation" ON "public"."webhook_failures" USING (("public"."user_has_tenant_access"("auth"."uid"(), "tenant_id") AND "public"."user_has_property_access"("auth"."uid"(), "property_id")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";






















































































































































GRANT ALL ON FUNCTION "public"."deduct_inventory_for_order"("p_transaction_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."guests" TO "service_role";
GRANT SELECT ON TABLE "public"."guests" TO "anon";
GRANT SELECT ON TABLE "public"."guests" TO "authenticated";



GRANT ALL ON FUNCTION "public"."restore_soft_delete"("p_table_name" "text", "p_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."soft_delete"("p_table_name" "text", "p_id" "uuid", "p_deleted_by" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."user_has_role"("role_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_role"("role_name" "text") TO "authenticated";


















GRANT SELECT ON TABLE "public"."accommodation_add_ons" TO "anon";
GRANT SELECT ON TABLE "public"."accommodation_add_ons" TO "authenticated";
GRANT ALL ON TABLE "public"."accommodation_add_ons" TO "service_role";



GRANT ALL ON TABLE "public"."accommodation_unit_price_rules" TO "service_role";
GRANT SELECT ON TABLE "public"."accommodation_unit_price_rules" TO "anon";
GRANT SELECT ON TABLE "public"."accommodation_unit_price_rules" TO "authenticated";



GRANT ALL ON TABLE "public"."accommodation_units" TO "service_role";
GRANT SELECT ON TABLE "public"."accommodation_units" TO "anon";
GRANT SELECT ON TABLE "public"."accommodation_units" TO "authenticated";



GRANT ALL ON TABLE "public"."alert_definitions" TO "service_role";
GRANT SELECT ON TABLE "public"."alert_definitions" TO "anon";
GRANT SELECT ON TABLE "public"."alert_definitions" TO "authenticated";



GRANT ALL ON TABLE "public"."alert_history" TO "service_role";
GRANT SELECT ON TABLE "public"."alert_history" TO "anon";
GRANT SELECT ON TABLE "public"."alert_history" TO "authenticated";



GRANT ALL ON TABLE "public"."app_permissions" TO "service_role";
GRANT SELECT ON TABLE "public"."app_permissions" TO "anon";
GRANT SELECT ON TABLE "public"."app_permissions" TO "authenticated";



GRANT ALL ON TABLE "public"."app_role_permissions" TO "service_role";
GRANT SELECT ON TABLE "public"."app_role_permissions" TO "anon";
GRANT SELECT ON TABLE "public"."app_role_permissions" TO "authenticated";



GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."audit_logs" TO "anon";
GRANT SELECT ON TABLE "public"."audit_logs" TO "authenticated";



GRANT ALL ON TABLE "public"."backups" TO "service_role";
GRANT SELECT ON TABLE "public"."backups" TO "anon";
GRANT SELECT ON TABLE "public"."backups" TO "authenticated";



GRANT SELECT ON TABLE "public"."billing_history" TO "anon";
GRANT SELECT ON TABLE "public"."billing_history" TO "authenticated";
GRANT ALL ON TABLE "public"."billing_history" TO "service_role";



GRANT ALL ON TABLE "public"."biometric_credentials" TO "service_role";
GRANT SELECT ON TABLE "public"."biometric_credentials" TO "anon";
GRANT SELECT ON TABLE "public"."biometric_credentials" TO "authenticated";



GRANT ALL ON TABLE "public"."bookable_units" TO "service_role";
GRANT SELECT ON TABLE "public"."bookable_units" TO "anon";
GRANT SELECT ON TABLE "public"."bookable_units" TO "authenticated";



GRANT ALL ON TABLE "public"."booking_reviews" TO "service_role";
GRANT SELECT ON TABLE "public"."booking_reviews" TO "anon";
GRANT SELECT ON TABLE "public"."booking_reviews" TO "authenticated";



GRANT ALL ON TABLE "public"."campaign_sends" TO "service_role";
GRANT SELECT ON TABLE "public"."campaign_sends" TO "anon";
GRANT SELECT ON TABLE "public"."campaign_sends" TO "authenticated";



GRANT ALL ON TABLE "public"."cancellation_policies" TO "service_role";
GRANT SELECT ON TABLE "public"."cancellation_policies" TO "anon";
GRANT SELECT ON TABLE "public"."cancellation_policies" TO "authenticated";



GRANT ALL ON TABLE "public"."capacity_windows" TO "service_role";
GRANT SELECT ON TABLE "public"."capacity_windows" TO "anon";
GRANT SELECT ON TABLE "public"."capacity_windows" TO "authenticated";



GRANT ALL ON TABLE "public"."cash_drawers" TO "service_role";
GRANT SELECT ON TABLE "public"."cash_drawers" TO "anon";
GRANT SELECT ON TABLE "public"."cash_drawers" TO "authenticated";



GRANT ALL ON TABLE "public"."cash_transactions" TO "service_role";
GRANT SELECT ON TABLE "public"."cash_transactions" TO "anon";
GRANT SELECT ON TABLE "public"."cash_transactions" TO "authenticated";



GRANT ALL ON TABLE "public"."catalog_categories" TO "service_role";
GRANT SELECT ON TABLE "public"."catalog_categories" TO "anon";
GRANT SELECT ON TABLE "public"."catalog_categories" TO "authenticated";



GRANT ALL ON TABLE "public"."catalog_items" TO "service_role";
GRANT SELECT ON TABLE "public"."catalog_items" TO "anon";
GRANT SELECT ON TABLE "public"."catalog_items" TO "authenticated";



GRANT ALL ON TABLE "public"."channel_availability_updates" TO "service_role";
GRANT SELECT ON TABLE "public"."channel_availability_updates" TO "anon";
GRANT SELECT ON TABLE "public"."channel_availability_updates" TO "authenticated";



GRANT ALL ON TABLE "public"."channel_connections" TO "service_role";
GRANT SELECT ON TABLE "public"."channel_connections" TO "anon";
GRANT SELECT ON TABLE "public"."channel_connections" TO "authenticated";



GRANT ALL ON TABLE "public"."channel_rate_mappings" TO "service_role";
GRANT SELECT ON TABLE "public"."channel_rate_mappings" TO "anon";
GRANT SELECT ON TABLE "public"."channel_rate_mappings" TO "authenticated";



GRANT ALL ON TABLE "public"."channel_rate_updates" TO "service_role";
GRANT SELECT ON TABLE "public"."channel_rate_updates" TO "anon";
GRANT SELECT ON TABLE "public"."channel_rate_updates" TO "authenticated";



GRANT ALL ON TABLE "public"."channel_reservations" TO "service_role";
GRANT SELECT ON TABLE "public"."channel_reservations" TO "anon";
GRANT SELECT ON TABLE "public"."channel_reservations" TO "authenticated";



GRANT ALL ON TABLE "public"."channel_room_mappings" TO "service_role";
GRANT SELECT ON TABLE "public"."channel_room_mappings" TO "anon";
GRANT SELECT ON TABLE "public"."channel_room_mappings" TO "authenticated";



GRANT ALL ON TABLE "public"."channel_sync_log" TO "service_role";
GRANT SELECT ON TABLE "public"."channel_sync_log" TO "anon";
GRANT SELECT ON TABLE "public"."channel_sync_log" TO "authenticated";



GRANT ALL ON TABLE "public"."chargebacks" TO "service_role";
GRANT SELECT ON TABLE "public"."chargebacks" TO "anon";
GRANT SELECT ON TABLE "public"."chargebacks" TO "authenticated";



GRANT ALL ON TABLE "public"."chatbot_intents" TO "service_role";
GRANT SELECT ON TABLE "public"."chatbot_intents" TO "anon";
GRANT SELECT ON TABLE "public"."chatbot_intents" TO "authenticated";



GRANT ALL ON TABLE "public"."competitor_rates" TO "service_role";
GRANT SELECT ON TABLE "public"."competitor_rates" TO "anon";
GRANT SELECT ON TABLE "public"."competitor_rates" TO "authenticated";



GRANT ALL ON TABLE "public"."conversations" TO "service_role";
GRANT SELECT ON TABLE "public"."conversations" TO "anon";
GRANT SELECT ON TABLE "public"."conversations" TO "authenticated";



GRANT ALL ON TABLE "public"."coupon_usage" TO "service_role";
GRANT SELECT ON TABLE "public"."coupon_usage" TO "anon";
GRANT SELECT ON TABLE "public"."coupon_usage" TO "authenticated";



GRANT ALL ON TABLE "public"."coupons" TO "service_role";
GRANT SELECT ON TABLE "public"."coupons" TO "anon";
GRANT SELECT ON TABLE "public"."coupons" TO "authenticated";



GRANT ALL ON TABLE "public"."currencies" TO "service_role";
GRANT SELECT ON TABLE "public"."currencies" TO "anon";
GRANT SELECT ON TABLE "public"."currencies" TO "authenticated";



GRANT ALL ON TABLE "public"."customization_dual_write_log" TO "service_role";
GRANT SELECT ON TABLE "public"."customization_dual_write_log" TO "anon";
GRANT SELECT ON TABLE "public"."customization_dual_write_log" TO "authenticated";



GRANT ALL ON TABLE "public"."customization_events" TO "service_role";
GRANT SELECT ON TABLE "public"."customization_events" TO "anon";
GRANT SELECT ON TABLE "public"."customization_events" TO "authenticated";



GRANT ALL ON TABLE "public"."customization_groups" TO "service_role";
GRANT SELECT ON TABLE "public"."customization_groups" TO "anon";
GRANT SELECT ON TABLE "public"."customization_groups" TO "authenticated";



GRANT ALL ON TABLE "public"."customization_metrics" TO "service_role";
GRANT SELECT ON TABLE "public"."customization_metrics" TO "anon";
GRANT SELECT ON TABLE "public"."customization_metrics" TO "authenticated";



GRANT ALL ON TABLE "public"."customization_metrics_summary" TO "service_role";
GRANT SELECT ON TABLE "public"."customization_metrics_summary" TO "anon";
GRANT SELECT ON TABLE "public"."customization_metrics_summary" TO "authenticated";



GRANT ALL ON TABLE "public"."customization_options" TO "service_role";
GRANT SELECT ON TABLE "public"."customization_options" TO "anon";
GRANT SELECT ON TABLE "public"."customization_options" TO "authenticated";



GRANT ALL ON TABLE "public"."dashboard_widgets" TO "service_role";
GRANT SELECT ON TABLE "public"."dashboard_widgets" TO "anon";
GRANT SELECT ON TABLE "public"."dashboard_widgets" TO "authenticated";



GRANT ALL ON TABLE "public"."demand_forecasts" TO "service_role";
GRANT SELECT ON TABLE "public"."demand_forecasts" TO "anon";
GRANT SELECT ON TABLE "public"."demand_forecasts" TO "authenticated";



GRANT ALL ON TABLE "public"."device_tokens" TO "service_role";
GRANT SELECT ON TABLE "public"."device_tokens" TO "anon";
GRANT SELECT ON TABLE "public"."device_tokens" TO "authenticated";



GRANT ALL ON TABLE "public"."digital_signatures" TO "service_role";
GRANT SELECT ON TABLE "public"."digital_signatures" TO "anon";
GRANT SELECT ON TABLE "public"."digital_signatures" TO "authenticated";



GRANT ALL ON TABLE "public"."email_bounces" TO "service_role";
GRANT SELECT ON TABLE "public"."email_bounces" TO "anon";
GRANT SELECT ON TABLE "public"."email_bounces" TO "authenticated";



GRANT ALL ON TABLE "public"."email_journeys" TO "service_role";
GRANT SELECT ON TABLE "public"."email_journeys" TO "anon";
GRANT SELECT ON TABLE "public"."email_journeys" TO "authenticated";



GRANT ALL ON TABLE "public"."email_suppression_list" TO "service_role";
GRANT SELECT ON TABLE "public"."email_suppression_list" TO "anon";
GRANT SELECT ON TABLE "public"."email_suppression_list" TO "authenticated";



GRANT ALL ON TABLE "public"."email_templates" TO "service_role";
GRANT SELECT ON TABLE "public"."email_templates" TO "anon";
GRANT SELECT ON TABLE "public"."email_templates" TO "authenticated";



GRANT ALL ON TABLE "public"."engine_compensation_log" TO "service_role";
GRANT SELECT ON TABLE "public"."engine_compensation_log" TO "anon";
GRANT SELECT ON TABLE "public"."engine_compensation_log" TO "authenticated";



GRANT ALL ON TABLE "public"."engine_feature_flags" TO "service_role";
GRANT SELECT ON TABLE "public"."engine_feature_flags" TO "anon";
GRANT SELECT ON TABLE "public"."engine_feature_flags" TO "authenticated";



GRANT ALL ON TABLE "public"."engine_financial_ledger" TO "service_role";
GRANT SELECT ON TABLE "public"."engine_financial_ledger" TO "anon";
GRANT SELECT ON TABLE "public"."engine_financial_ledger" TO "authenticated";



GRANT ALL ON TABLE "public"."engine_idempotency_keys" TO "service_role";
GRANT SELECT ON TABLE "public"."engine_idempotency_keys" TO "anon";
GRANT SELECT ON TABLE "public"."engine_idempotency_keys" TO "authenticated";



GRANT ALL ON TABLE "public"."engine_loyalty_events" TO "service_role";
GRANT SELECT ON TABLE "public"."engine_loyalty_events" TO "anon";
GRANT SELECT ON TABLE "public"."engine_loyalty_events" TO "authenticated";



GRANT ALL ON TABLE "public"."engine_state_transitions" TO "service_role";
GRANT SELECT ON TABLE "public"."engine_state_transitions" TO "anon";
GRANT SELECT ON TABLE "public"."engine_state_transitions" TO "authenticated";



GRANT ALL ON TABLE "public"."entity_customizations" TO "service_role";
GRANT SELECT ON TABLE "public"."entity_customizations" TO "anon";
GRANT SELECT ON TABLE "public"."entity_customizations" TO "authenticated";



GRANT ALL ON TABLE "public"."faqs" TO "service_role";
GRANT SELECT ON TABLE "public"."faqs" TO "anon";
GRANT SELECT ON TABLE "public"."faqs" TO "authenticated";



GRANT ALL ON TABLE "public"."gdpr_consents" TO "service_role";
GRANT SELECT ON TABLE "public"."gdpr_consents" TO "anon";
GRANT SELECT ON TABLE "public"."gdpr_consents" TO "authenticated";



GRANT ALL ON TABLE "public"."gdpr_cookie_consents" TO "service_role";
GRANT SELECT ON TABLE "public"."gdpr_cookie_consents" TO "anon";
GRANT SELECT ON TABLE "public"."gdpr_cookie_consents" TO "authenticated";



GRANT ALL ON TABLE "public"."gdpr_data_sharing_log" TO "service_role";
GRANT SELECT ON TABLE "public"."gdpr_data_sharing_log" TO "anon";
GRANT SELECT ON TABLE "public"."gdpr_data_sharing_log" TO "authenticated";



GRANT ALL ON TABLE "public"."gdpr_deletion_requests" TO "service_role";
GRANT SELECT ON TABLE "public"."gdpr_deletion_requests" TO "anon";
GRANT SELECT ON TABLE "public"."gdpr_deletion_requests" TO "authenticated";



GRANT ALL ON TABLE "public"."gdpr_export_requests" TO "service_role";
GRANT SELECT ON TABLE "public"."gdpr_export_requests" TO "anon";
GRANT SELECT ON TABLE "public"."gdpr_export_requests" TO "authenticated";



GRANT ALL ON TABLE "public"."gdpr_processing_activities" TO "service_role";
GRANT SELECT ON TABLE "public"."gdpr_processing_activities" TO "anon";
GRANT SELECT ON TABLE "public"."gdpr_processing_activities" TO "authenticated";



GRANT ALL ON TABLE "public"."gdpr_retention_policies" TO "service_role";
GRANT SELECT ON TABLE "public"."gdpr_retention_policies" TO "anon";
GRANT SELECT ON TABLE "public"."gdpr_retention_policies" TO "authenticated";



GRANT ALL ON TABLE "public"."gift_card_ledger" TO "service_role";
GRANT SELECT ON TABLE "public"."gift_card_ledger" TO "anon";
GRANT SELECT ON TABLE "public"."gift_card_ledger" TO "authenticated";



GRANT ALL ON TABLE "public"."gift_card_templates" TO "service_role";
GRANT SELECT ON TABLE "public"."gift_card_templates" TO "anon";
GRANT SELECT ON TABLE "public"."gift_card_templates" TO "authenticated";



GRANT ALL ON TABLE "public"."gift_card_transactions" TO "service_role";
GRANT SELECT ON TABLE "public"."gift_card_transactions" TO "anon";
GRANT SELECT ON TABLE "public"."gift_card_transactions" TO "authenticated";



GRANT ALL ON TABLE "public"."gift_cards" TO "service_role";
GRANT SELECT ON TABLE "public"."gift_cards" TO "anon";
GRANT SELECT ON TABLE "public"."gift_cards" TO "authenticated";



GRANT ALL ON TABLE "public"."group_activities" TO "service_role";
GRANT SELECT ON TABLE "public"."group_activities" TO "anon";
GRANT SELECT ON TABLE "public"."group_activities" TO "authenticated";



GRANT ALL ON TABLE "public"."group_bookings" TO "service_role";
GRANT SELECT ON TABLE "public"."group_bookings" TO "anon";
GRANT SELECT ON TABLE "public"."group_bookings" TO "authenticated";



GRANT ALL ON TABLE "public"."group_contracts" TO "service_role";
GRANT SELECT ON TABLE "public"."group_contracts" TO "anon";
GRANT SELECT ON TABLE "public"."group_contracts" TO "authenticated";



GRANT ALL ON TABLE "public"."group_events" TO "service_role";
GRANT SELECT ON TABLE "public"."group_events" TO "anon";
GRANT SELECT ON TABLE "public"."group_events" TO "authenticated";



GRANT ALL ON TABLE "public"."group_invoices" TO "service_role";
GRANT SELECT ON TABLE "public"."group_invoices" TO "anon";
GRANT SELECT ON TABLE "public"."group_invoices" TO "authenticated";



GRANT ALL ON TABLE "public"."group_payments" TO "service_role";
GRANT SELECT ON TABLE "public"."group_payments" TO "anon";
GRANT SELECT ON TABLE "public"."group_payments" TO "authenticated";



GRANT ALL ON TABLE "public"."group_rate_templates" TO "service_role";
GRANT SELECT ON TABLE "public"."group_rate_templates" TO "anon";
GRANT SELECT ON TABLE "public"."group_rate_templates" TO "authenticated";



GRANT ALL ON TABLE "public"."group_report_schedules" TO "service_role";
GRANT SELECT ON TABLE "public"."group_report_schedules" TO "anon";
GRANT SELECT ON TABLE "public"."group_report_schedules" TO "authenticated";



GRANT ALL ON TABLE "public"."group_reservations" TO "service_role";
GRANT SELECT ON TABLE "public"."group_reservations" TO "anon";
GRANT SELECT ON TABLE "public"."group_reservations" TO "authenticated";



GRANT ALL ON TABLE "public"."group_room_blocks" TO "service_role";
GRANT SELECT ON TABLE "public"."group_room_blocks" TO "anon";
GRANT SELECT ON TABLE "public"."group_room_blocks" TO "authenticated";



GRANT ALL ON TABLE "public"."group_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."group_settings" TO "anon";
GRANT SELECT ON TABLE "public"."group_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."guest_messaging_preferences" TO "service_role";
GRANT SELECT ON TABLE "public"."guest_messaging_preferences" TO "anon";
GRANT SELECT ON TABLE "public"."guest_messaging_preferences" TO "authenticated";



GRANT ALL ON TABLE "public"."guest_rfm_scores" TO "service_role";
GRANT SELECT ON TABLE "public"."guest_rfm_scores" TO "anon";
GRANT SELECT ON TABLE "public"."guest_rfm_scores" TO "authenticated";



GRANT ALL ON TABLE "public"."guest_segments" TO "service_role";
GRANT SELECT ON TABLE "public"."guest_segments" TO "anon";
GRANT SELECT ON TABLE "public"."guest_segments" TO "authenticated";



GRANT ALL ON TABLE "public"."housekeeping_inspections" TO "service_role";
GRANT SELECT ON TABLE "public"."housekeeping_inspections" TO "anon";
GRANT SELECT ON TABLE "public"."housekeeping_inspections" TO "authenticated";



GRANT ALL ON TABLE "public"."housekeeping_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."housekeeping_logs" TO "anon";
GRANT SELECT ON TABLE "public"."housekeeping_logs" TO "authenticated";



GRANT ALL ON TABLE "public"."housekeeping_schedules" TO "service_role";
GRANT SELECT ON TABLE "public"."housekeeping_schedules" TO "anon";
GRANT SELECT ON TABLE "public"."housekeeping_schedules" TO "authenticated";



GRANT ALL ON TABLE "public"."housekeeping_sla" TO "service_role";
GRANT SELECT ON TABLE "public"."housekeeping_sla" TO "anon";
GRANT SELECT ON TABLE "public"."housekeeping_sla" TO "authenticated";



GRANT ALL ON TABLE "public"."housekeeping_supplies" TO "service_role";
GRANT SELECT ON TABLE "public"."housekeeping_supplies" TO "anon";
GRANT SELECT ON TABLE "public"."housekeeping_supplies" TO "authenticated";



GRANT ALL ON TABLE "public"."housekeeping_task_comments" TO "service_role";
GRANT SELECT ON TABLE "public"."housekeeping_task_comments" TO "anon";
GRANT SELECT ON TABLE "public"."housekeeping_task_comments" TO "authenticated";



GRANT ALL ON TABLE "public"."housekeeping_task_types" TO "service_role";
GRANT SELECT ON TABLE "public"."housekeeping_task_types" TO "anon";
GRANT SELECT ON TABLE "public"."housekeeping_task_types" TO "authenticated";



GRANT ALL ON TABLE "public"."housekeeping_tasks" TO "service_role";
GRANT SELECT ON TABLE "public"."housekeeping_tasks" TO "anon";
GRANT SELECT ON TABLE "public"."housekeeping_tasks" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."inventory_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_alerts" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_alerts" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."inventory_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_batches" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_batches" TO "anon";



GRANT ALL ON TABLE "public"."inventory_bom" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_bom" TO "anon";
GRANT SELECT ON TABLE "public"."inventory_bom" TO "authenticated";



GRANT ALL ON TABLE "public"."inventory_categories" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_categories" TO "anon";
GRANT SELECT ON TABLE "public"."inventory_categories" TO "authenticated";



GRANT ALL ON TABLE "public"."inventory_consumption" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_consumption" TO "anon";
GRANT SELECT ON TABLE "public"."inventory_consumption" TO "authenticated";



GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_items" TO "anon";
GRANT SELECT ON TABLE "public"."inventory_items" TO "authenticated";



GRANT ALL ON TABLE "public"."inventory_purchase_order_items" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_purchase_order_items" TO "anon";
GRANT SELECT ON TABLE "public"."inventory_purchase_order_items" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."inventory_purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_purchase_orders" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_purchase_orders" TO "anon";



GRANT ALL ON TABLE "public"."inventory_recipe_ingredients" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_recipe_ingredients" TO "anon";
GRANT SELECT ON TABLE "public"."inventory_recipe_ingredients" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."inventory_recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_recipes" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_recipes" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."inventory_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_suppliers" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_suppliers" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."inventory_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_transactions" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."inventory_variance" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_variance" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_variance" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."inventory_wastage" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_wastage" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_wastage" TO "anon";



GRANT ALL ON TABLE "public"."journey_enrollments" TO "service_role";
GRANT SELECT ON TABLE "public"."journey_enrollments" TO "anon";
GRANT SELECT ON TABLE "public"."journey_enrollments" TO "authenticated";



GRANT ALL ON TABLE "public"."journey_steps" TO "service_role";
GRANT SELECT ON TABLE "public"."journey_steps" TO "anon";
GRANT SELECT ON TABLE "public"."journey_steps" TO "authenticated";



GRANT ALL ON TABLE "public"."kiosk_analytics" TO "service_role";
GRANT SELECT ON TABLE "public"."kiosk_analytics" TO "anon";
GRANT SELECT ON TABLE "public"."kiosk_analytics" TO "authenticated";



GRANT ALL ON TABLE "public"."kiosk_devices" TO "service_role";
GRANT SELECT ON TABLE "public"."kiosk_devices" TO "anon";
GRANT SELECT ON TABLE "public"."kiosk_devices" TO "authenticated";



GRANT ALL ON TABLE "public"."kiosk_hardware_events" TO "service_role";
GRANT SELECT ON TABLE "public"."kiosk_hardware_events" TO "anon";
GRANT SELECT ON TABLE "public"."kiosk_hardware_events" TO "authenticated";



GRANT ALL ON TABLE "public"."kiosk_items" TO "service_role";
GRANT SELECT ON TABLE "public"."kiosk_items" TO "anon";
GRANT SELECT ON TABLE "public"."kiosk_items" TO "authenticated";



GRANT ALL ON TABLE "public"."kiosk_key_stock" TO "service_role";
GRANT SELECT ON TABLE "public"."kiosk_key_stock" TO "anon";
GRANT SELECT ON TABLE "public"."kiosk_key_stock" TO "authenticated";



GRANT ALL ON TABLE "public"."kiosk_screen_content" TO "service_role";
GRANT SELECT ON TABLE "public"."kiosk_screen_content" TO "anon";
GRANT SELECT ON TABLE "public"."kiosk_screen_content" TO "authenticated";



GRANT ALL ON TABLE "public"."kiosk_screen_flows" TO "service_role";
GRANT SELECT ON TABLE "public"."kiosk_screen_flows" TO "anon";
GRANT SELECT ON TABLE "public"."kiosk_screen_flows" TO "authenticated";



GRANT ALL ON TABLE "public"."kiosk_sessions" TO "service_role";
GRANT SELECT ON TABLE "public"."kiosk_sessions" TO "anon";
GRANT SELECT ON TABLE "public"."kiosk_sessions" TO "authenticated";



GRANT ALL ON TABLE "public"."kiosk_transactions" TO "service_role";
GRANT SELECT ON TABLE "public"."kiosk_transactions" TO "anon";
GRANT SELECT ON TABLE "public"."kiosk_transactions" TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_members" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_members" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_members" TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_accounts" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_accounts" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_accounts" TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_fraud_flags" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_fraud_flags" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_fraud_flags" TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_point_batches" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_point_batches" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_point_batches" TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_profiles" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_redemptions" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_redemptions" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_redemptions" TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_rewards" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_rewards" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_rewards" TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_settings" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_tiers" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_tiers" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_tiers" TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_transactions" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_transactions" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_transactions" TO "authenticated";



GRANT ALL ON TABLE "public"."manager_approvals" TO "service_role";
GRANT SELECT ON TABLE "public"."manager_approvals" TO "anon";
GRANT SELECT ON TABLE "public"."manager_approvals" TO "authenticated";



GRANT ALL ON TABLE "public"."manager_notification_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."manager_notification_settings" TO "anon";
GRANT SELECT ON TABLE "public"."manager_notification_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."market_events" TO "service_role";
GRANT SELECT ON TABLE "public"."market_events" TO "anon";
GRANT SELECT ON TABLE "public"."market_events" TO "authenticated";



GRANT ALL ON TABLE "public"."marketing_campaigns" TO "service_role";
GRANT SELECT ON TABLE "public"."marketing_campaigns" TO "anon";
GRANT SELECT ON TABLE "public"."marketing_campaigns" TO "authenticated";



GRANT ALL ON TABLE "public"."marketing_email_templates" TO "service_role";
GRANT SELECT ON TABLE "public"."marketing_email_templates" TO "anon";
GRANT SELECT ON TABLE "public"."marketing_email_templates" TO "authenticated";



GRANT SELECT ON TABLE "public"."membership_plans" TO "anon";
GRANT SELECT ON TABLE "public"."membership_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."membership_plans" TO "service_role";



GRANT SELECT ON TABLE "public"."memberships" TO "anon";
GRANT SELECT ON TABLE "public"."memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."memberships" TO "service_role";



GRANT ALL ON TABLE "public"."menu_item_ingredients" TO "service_role";
GRANT SELECT ON TABLE "public"."menu_item_ingredients" TO "anon";
GRANT SELECT ON TABLE "public"."menu_item_ingredients" TO "authenticated";



GRANT ALL ON TABLE "public"."message_templates" TO "service_role";
GRANT SELECT ON TABLE "public"."message_templates" TO "anon";
GRANT SELECT ON TABLE "public"."message_templates" TO "authenticated";



GRANT ALL ON TABLE "public"."messages" TO "service_role";
GRANT SELECT ON TABLE "public"."messages" TO "anon";
GRANT SELECT ON TABLE "public"."messages" TO "authenticated";



GRANT ALL ON TABLE "public"."messaging_channels" TO "service_role";
GRANT SELECT ON TABLE "public"."messaging_channels" TO "anon";
GRANT SELECT ON TABLE "public"."messaging_channels" TO "authenticated";



GRANT ALL ON TABLE "public"."metric_definitions" TO "service_role";
GRANT SELECT ON TABLE "public"."metric_definitions" TO "anon";
GRANT SELECT ON TABLE "public"."metric_definitions" TO "authenticated";



GRANT ALL ON TABLE "public"."mobile_key_access_log" TO "service_role";
GRANT SELECT ON TABLE "public"."mobile_key_access_log" TO "anon";
GRANT SELECT ON TABLE "public"."mobile_key_access_log" TO "authenticated";



GRANT ALL ON TABLE "public"."mobile_keys" TO "service_role";
GRANT SELECT ON TABLE "public"."mobile_keys" TO "anon";
GRANT SELECT ON TABLE "public"."mobile_keys" TO "authenticated";



GRANT ALL ON TABLE "public"."module_templates" TO "service_role";
GRANT SELECT ON TABLE "public"."module_templates" TO "anon";
GRANT SELECT ON TABLE "public"."module_templates" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."modules" TO "authenticated";
GRANT ALL ON TABLE "public"."modules" TO "service_role";
GRANT SELECT ON TABLE "public"."modules" TO "anon";



GRANT ALL ON TABLE "public"."notification_broadcasts" TO "service_role";
GRANT SELECT ON TABLE "public"."notification_broadcasts" TO "anon";
GRANT SELECT ON TABLE "public"."notification_broadcasts" TO "authenticated";



GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";
GRANT SELECT ON TABLE "public"."notification_logs" TO "anon";
GRANT SELECT ON TABLE "public"."notification_logs" TO "authenticated";



GRANT ALL ON TABLE "public"."notification_templates" TO "service_role";
GRANT SELECT ON TABLE "public"."notification_templates" TO "anon";
GRANT SELECT ON TABLE "public"."notification_templates" TO "authenticated";



GRANT ALL ON TABLE "public"."notifications" TO "service_role";
GRANT SELECT ON TABLE "public"."notifications" TO "anon";
GRANT SELECT ON TABLE "public"."notifications" TO "authenticated";



GRANT ALL ON TABLE "public"."order_customizations" TO "service_role";
GRANT SELECT ON TABLE "public"."order_customizations" TO "anon";
GRANT SELECT ON TABLE "public"."order_customizations" TO "authenticated";



GRANT ALL ON TABLE "public"."order_items" TO "service_role";
GRANT SELECT ON TABLE "public"."order_items" TO "anon";
GRANT SELECT ON TABLE "public"."order_items" TO "authenticated";



GRANT ALL ON TABLE "public"."order_payment_splits" TO "service_role";
GRANT SELECT ON TABLE "public"."order_payment_splits" TO "anon";
GRANT SELECT ON TABLE "public"."order_payment_splits" TO "authenticated";



GRANT ALL ON TABLE "public"."password_history" TO "service_role";
GRANT SELECT ON TABLE "public"."password_history" TO "anon";
GRANT SELECT ON TABLE "public"."password_history" TO "authenticated";



GRANT ALL ON TABLE "public"."payment_ledger" TO "service_role";
GRANT SELECT ON TABLE "public"."payment_ledger" TO "anon";
GRANT SELECT ON TABLE "public"."payment_ledger" TO "authenticated";



GRANT ALL ON TABLE "public"."payments" TO "service_role";
GRANT SELECT ON TABLE "public"."payments" TO "anon";
GRANT SELECT ON TABLE "public"."payments" TO "authenticated";



GRANT ALL ON TABLE "public"."permissions" TO "service_role";
GRANT SELECT ON TABLE "public"."permissions" TO "anon";
GRANT SELECT ON TABLE "public"."permissions" TO "authenticated";



GRANT ALL ON TABLE "public"."plans" TO "service_role";
GRANT SELECT ON TABLE "public"."plans" TO "anon";
GRANT SELECT ON TABLE "public"."plans" TO "authenticated";



GRANT ALL ON TABLE "public"."pos_reconciliation" TO "service_role";
GRANT SELECT ON TABLE "public"."pos_reconciliation" TO "anon";
GRANT SELECT ON TABLE "public"."pos_reconciliation" TO "authenticated";



GRANT ALL ON TABLE "public"."pre_arrival_registrations" TO "service_role";
GRANT SELECT ON TABLE "public"."pre_arrival_registrations" TO "anon";
GRANT SELECT ON TABLE "public"."pre_arrival_registrations" TO "authenticated";



GRANT ALL ON TABLE "public"."price_history" TO "service_role";
GRANT SELECT ON TABLE "public"."price_history" TO "anon";
GRANT SELECT ON TABLE "public"."price_history" TO "authenticated";



GRANT ALL ON TABLE "public"."pricing_rules" TO "service_role";
GRANT SELECT ON TABLE "public"."pricing_rules" TO "anon";
GRANT SELECT ON TABLE "public"."pricing_rules" TO "authenticated";



GRANT ALL ON TABLE "public"."product_reviews" TO "service_role";
GRANT SELECT ON TABLE "public"."product_reviews" TO "anon";
GRANT SELECT ON TABLE "public"."product_reviews" TO "authenticated";



GRANT ALL ON TABLE "public"."properties" TO "service_role";
GRANT SELECT ON TABLE "public"."properties" TO "anon";
GRANT SELECT ON TABLE "public"."properties" TO "authenticated";



GRANT ALL ON TABLE "public"."property_benchmarks" TO "service_role";
GRANT SELECT ON TABLE "public"."property_benchmarks" TO "anon";
GRANT SELECT ON TABLE "public"."property_benchmarks" TO "authenticated";



GRANT ALL ON TABLE "public"."property_groups" TO "service_role";
GRANT SELECT ON TABLE "public"."property_groups" TO "anon";
GRANT SELECT ON TABLE "public"."property_groups" TO "authenticated";



GRANT ALL ON TABLE "public"."property_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."property_settings" TO "anon";
GRANT SELECT ON TABLE "public"."property_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."rate_parity_alerts" TO "service_role";
GRANT SELECT ON TABLE "public"."rate_parity_alerts" TO "anon";
GRANT SELECT ON TABLE "public"."rate_parity_alerts" TO "authenticated";



GRANT ALL ON TABLE "public"."rate_parity_checks" TO "service_role";
GRANT SELECT ON TABLE "public"."rate_parity_checks" TO "anon";
GRANT SELECT ON TABLE "public"."rate_parity_checks" TO "authenticated";



GRANT ALL ON TABLE "public"."rate_parity_config" TO "service_role";
GRANT SELECT ON TABLE "public"."rate_parity_config" TO "anon";
GRANT SELECT ON TABLE "public"."rate_parity_config" TO "authenticated";



GRANT ALL ON TABLE "public"."rate_parity_results" TO "service_role";
GRANT SELECT ON TABLE "public"."rate_parity_results" TO "anon";
GRANT SELECT ON TABLE "public"."rate_parity_results" TO "authenticated";



GRANT ALL ON TABLE "public"."rate_recommendations" TO "service_role";
GRANT SELECT ON TABLE "public"."rate_recommendations" TO "anon";
GRANT SELECT ON TABLE "public"."rate_recommendations" TO "authenticated";



GRANT ALL ON TABLE "public"."reconciliation_log" TO "service_role";
GRANT SELECT ON TABLE "public"."reconciliation_log" TO "anon";
GRANT SELECT ON TABLE "public"."reconciliation_log" TO "authenticated";



GRANT ALL ON TABLE "public"."ref_type_telemetry" TO "service_role";
GRANT SELECT ON TABLE "public"."ref_type_telemetry" TO "anon";
GRANT SELECT ON TABLE "public"."ref_type_telemetry" TO "authenticated";



GRANT ALL ON TABLE "public"."ref_type_migration_status" TO "service_role";
GRANT SELECT ON TABLE "public"."ref_type_migration_status" TO "anon";
GRANT SELECT ON TABLE "public"."ref_type_migration_status" TO "authenticated";



GRANT ALL ON TABLE "public"."registration_documents" TO "service_role";
GRANT SELECT ON TABLE "public"."registration_documents" TO "anon";
GRANT SELECT ON TABLE "public"."registration_documents" TO "authenticated";



GRANT ALL ON TABLE "public"."report_daily_sales" TO "service_role";
GRANT SELECT ON TABLE "public"."report_daily_sales" TO "anon";
GRANT SELECT ON TABLE "public"."report_daily_sales" TO "authenticated";



GRANT ALL ON TABLE "public"."report_executions" TO "service_role";
GRANT SELECT ON TABLE "public"."report_executions" TO "anon";
GRANT SELECT ON TABLE "public"."report_executions" TO "authenticated";



GRANT ALL ON TABLE "public"."report_hourly_metrics" TO "service_role";
GRANT SELECT ON TABLE "public"."report_hourly_metrics" TO "anon";
GRANT SELECT ON TABLE "public"."report_hourly_metrics" TO "authenticated";



GRANT ALL ON TABLE "public"."report_product_performance" TO "service_role";
GRANT SELECT ON TABLE "public"."report_product_performance" TO "anon";
GRANT SELECT ON TABLE "public"."report_product_performance" TO "authenticated";



GRANT ALL ON TABLE "public"."report_scheduled" TO "service_role";
GRANT SELECT ON TABLE "public"."report_scheduled" TO "anon";
GRANT SELECT ON TABLE "public"."report_scheduled" TO "authenticated";



GRANT ALL ON TABLE "public"."report_templates" TO "service_role";
GRANT SELECT ON TABLE "public"."report_templates" TO "anon";
GRANT SELECT ON TABLE "public"."report_templates" TO "authenticated";



GRANT ALL ON TABLE "public"."reviews" TO "service_role";
GRANT SELECT ON TABLE "public"."reviews" TO "anon";
GRANT SELECT ON TABLE "public"."reviews" TO "authenticated";



GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";
GRANT SELECT ON TABLE "public"."role_permissions" TO "anon";
GRANT SELECT ON TABLE "public"."role_permissions" TO "authenticated";



GRANT ALL ON TABLE "public"."roles" TO "service_role";
GRANT SELECT ON TABLE "public"."roles" TO "anon";
GRANT SELECT ON TABLE "public"."roles" TO "authenticated";



GRANT ALL ON TABLE "public"."saved_queries" TO "service_role";
GRANT SELECT ON TABLE "public"."saved_queries" TO "anon";
GRANT SELECT ON TABLE "public"."saved_queries" TO "authenticated";



GRANT ALL ON TABLE "public"."saved_reports" TO "service_role";
GRANT SELECT ON TABLE "public"."saved_reports" TO "anon";
GRANT SELECT ON TABLE "public"."saved_reports" TO "authenticated";



GRANT ALL ON TABLE "public"."seasonal_pricing_analysis" TO "service_role";
GRANT SELECT ON TABLE "public"."seasonal_pricing_analysis" TO "anon";
GRANT SELECT ON TABLE "public"."seasonal_pricing_analysis" TO "authenticated";



GRANT ALL ON TABLE "public"."seasonal_pricing_rules" TO "service_role";
GRANT SELECT ON TABLE "public"."seasonal_pricing_rules" TO "anon";
GRANT SELECT ON TABLE "public"."seasonal_pricing_rules" TO "authenticated";



GRANT ALL ON TABLE "public"."security_audit_log" TO "service_role";
GRANT SELECT ON TABLE "public"."security_audit_log" TO "anon";
GRANT SELECT ON TABLE "public"."security_audit_log" TO "authenticated";



GRANT ALL ON TABLE "public"."segment_members" TO "service_role";
GRANT SELECT ON TABLE "public"."segment_members" TO "anon";
GRANT SELECT ON TABLE "public"."segment_members" TO "authenticated";



GRANT SELECT ON TABLE "public"."service_locations" TO "anon";
GRANT SELECT ON TABLE "public"."service_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."service_locations" TO "service_role";



GRANT ALL ON TABLE "public"."session_reviews" TO "service_role";
GRANT SELECT ON TABLE "public"."session_reviews" TO "anon";
GRANT SELECT ON TABLE "public"."session_reviews" TO "authenticated";



GRANT ALL ON TABLE "public"."sessions" TO "service_role";
GRANT SELECT ON TABLE "public"."sessions" TO "anon";
GRANT SELECT ON TABLE "public"."sessions" TO "authenticated";



GRANT ALL ON TABLE "public"."shared_inventory_allocations" TO "service_role";
GRANT SELECT ON TABLE "public"."shared_inventory_allocations" TO "anon";
GRANT SELECT ON TABLE "public"."shared_inventory_allocations" TO "authenticated";



GRANT ALL ON TABLE "public"."shift_swap_requests" TO "service_role";
GRANT SELECT ON TABLE "public"."shift_swap_requests" TO "anon";
GRANT SELECT ON TABLE "public"."shift_swap_requests" TO "authenticated";



GRANT ALL ON TABLE "public"."site_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."site_settings" TO "anon";
GRANT SELECT ON TABLE "public"."site_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."staff_shifts" TO "service_role";
GRANT SELECT ON TABLE "public"."staff_shifts" TO "anon";
GRANT SELECT ON TABLE "public"."staff_shifts" TO "authenticated";



GRANT ALL ON TABLE "public"."support_inquiries" TO "service_role";
GRANT SELECT ON TABLE "public"."support_inquiries" TO "anon";
GRANT SELECT ON TABLE "public"."support_inquiries" TO "authenticated";



GRANT ALL ON TABLE "public"."supported_languages" TO "service_role";
GRANT SELECT ON TABLE "public"."supported_languages" TO "anon";
GRANT SELECT ON TABLE "public"."supported_languages" TO "authenticated";



GRANT ALL ON TABLE "public"."system_config" TO "service_role";
GRANT SELECT ON TABLE "public"."system_config" TO "anon";
GRANT SELECT ON TABLE "public"."system_config" TO "authenticated";



GRANT ALL ON TABLE "public"."system_defaults" TO "service_role";
GRANT SELECT ON TABLE "public"."system_defaults" TO "anon";
GRANT SELECT ON TABLE "public"."system_defaults" TO "authenticated";



GRANT ALL ON TABLE "public"."system_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."system_settings" TO "anon";
GRANT SELECT ON TABLE "public"."system_settings" TO "authenticated";



GRANT SELECT ON TABLE "public"."tenant_integrations" TO "anon";
GRANT SELECT ON TABLE "public"."tenant_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "service_role";
GRANT SELECT ON TABLE "public"."tenants" TO "anon";
GRANT SELECT ON TABLE "public"."tenants" TO "authenticated";



GRANT ALL ON TABLE "public"."terminology_overrides" TO "service_role";
GRANT SELECT ON TABLE "public"."terminology_overrides" TO "anon";
GRANT SELECT ON TABLE "public"."terminology_overrides" TO "authenticated";



GRANT ALL ON TABLE "public"."time_clock_adjustments" TO "service_role";
GRANT SELECT ON TABLE "public"."time_clock_adjustments" TO "anon";
GRANT SELECT ON TABLE "public"."time_clock_adjustments" TO "authenticated";



GRANT ALL ON TABLE "public"."token_blacklist" TO "service_role";
GRANT SELECT ON TABLE "public"."token_blacklist" TO "anon";
GRANT SELECT ON TABLE "public"."token_blacklist" TO "authenticated";



GRANT ALL ON TABLE "public"."transactions" TO "service_role";
GRANT SELECT ON TABLE "public"."transactions" TO "anon";
GRANT SELECT ON TABLE "public"."transactions" TO "authenticated";



GRANT SELECT ON TABLE "public"."translation_keys" TO "anon";
GRANT SELECT ON TABLE "public"."translation_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."translation_keys" TO "service_role";



GRANT ALL ON TABLE "public"."translations" TO "service_role";
GRANT SELECT ON TABLE "public"."translations" TO "anon";
GRANT SELECT ON TABLE "public"."translations" TO "authenticated";



GRANT ALL ON TABLE "public"."two_factor_auth" TO "service_role";
GRANT SELECT ON TABLE "public"."two_factor_auth" TO "anon";
GRANT SELECT ON TABLE "public"."two_factor_auth" TO "authenticated";



GRANT ALL ON TABLE "public"."two_factor_pending" TO "service_role";
GRANT SELECT ON TABLE "public"."two_factor_pending" TO "anon";
GRANT SELECT ON TABLE "public"."two_factor_pending" TO "authenticated";



GRANT ALL ON TABLE "public"."user_credits" TO "service_role";
GRANT SELECT ON TABLE "public"."user_credits" TO "anon";
GRANT SELECT ON TABLE "public"."user_credits" TO "authenticated";



GRANT ALL ON TABLE "public"."user_group_access" TO "service_role";
GRANT SELECT ON TABLE "public"."user_group_access" TO "anon";
GRANT SELECT ON TABLE "public"."user_group_access" TO "authenticated";



GRANT ALL ON TABLE "public"."user_permissions" TO "service_role";
GRANT SELECT ON TABLE "public"."user_permissions" TO "anon";
GRANT SELECT ON TABLE "public"."user_permissions" TO "authenticated";



GRANT ALL ON TABLE "public"."user_property_access" TO "service_role";
GRANT SELECT ON TABLE "public"."user_property_access" TO "anon";
GRANT SELECT ON TABLE "public"."user_property_access" TO "authenticated";



GRANT ALL ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT ON TABLE "public"."user_roles" TO "anon";
GRANT SELECT ON TABLE "public"."user_roles" TO "authenticated";



GRANT ALL ON TABLE "public"."users" TO "service_role";
GRANT SELECT ON TABLE "public"."users" TO "anon";
GRANT SELECT ON TABLE "public"."users" TO "authenticated";



GRANT SELECT ON TABLE "public"."v_tenant_overview" TO "anon";
GRANT SELECT ON TABLE "public"."v_tenant_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tenant_overview" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist_entries" TO "service_role";
GRANT SELECT ON TABLE "public"."waitlist_entries" TO "anon";
GRANT SELECT ON TABLE "public"."waitlist_entries" TO "authenticated";



GRANT ALL ON TABLE "public"."webhook_failures" TO "service_role";
GRANT SELECT ON TABLE "public"."webhook_failures" TO "anon";
GRANT SELECT ON TABLE "public"."webhook_failures" TO "authenticated";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




























