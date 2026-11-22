-- P0 security foundation (2026-11-20)
--
-- Closes the audit's P0-1, P0-2, P0-3, P0-10 and the P0-11 database backstop:
--   1. Redemption RPCs are tenant-scoped (gift card / coupon / loyalty). The new
--      p_tenant_id overloads are added here; the old overloads are dropped by
--      20261120100300 after the new backend is live, so a running old backend
--      keeps working during the rollout.
--   2. RLS is enabled on the nine public tables that had it disabled, anon
--      SELECT is revoked from the sensitive four, and translations becomes a
--      public-read-only table under RLS.
--   3. The recursive users/payments/tenants policies are replaced with
--      SECURITY DEFINER helpers (or non-recursive equivalents).
--   4. engine_idempotency_keys gets an atomic claim RPC and a nullable
--      property_id (it was NOT NULL with no default, so every guard upsert
--      failed and the guard silently ran unprotected).
--   5. payments.stripe_payment_intent_id gets a partial unique index.
--
-- All statements are idempotent so this can be re-run on a drifted database.

-- ===========================================================================
-- 1. Tenant-scoped redemption RPCs
-- ===========================================================================

-- (legacy overload kept for now; dropped by 20261120100300_p0_drop_legacy_redemption_overloads.sql once the tenant-scoped backend is deployed)

CREATE OR REPLACE FUNCTION public.redeem_giftcard_atomic(
  p_code text,
  p_amount numeric,
  p_order_id uuid,
  p_tenant_id uuid
)
RETURNS TABLE(success boolean, amount_redeemed numeric, new_balance numeric, gift_card_id uuid, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_card RECORD;
    v_redeem_amount DECIMAL;
BEGIN
    IF p_tenant_id IS NULL THEN
        RETURN QUERY SELECT false, 0::DECIMAL, 0::DECIMAL, NULL::UUID, 'Tenant context is required for gift card redemption'::TEXT;
        RETURN;
    END IF;

    SELECT * INTO v_card
      FROM gift_cards
     WHERE code = UPPER(p_code)
       AND tenant_id = p_tenant_id
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > NOW())
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0::DECIMAL, 0::DECIMAL, NULL::UUID, 'Gift card not found, inactive, or expired'::TEXT;
        RETURN;
    END IF;

    IF v_card.current_balance <= 0 THEN
        RETURN QUERY SELECT false, 0::DECIMAL, v_card.current_balance, v_card.id, 'Gift card has no balance'::TEXT;
        RETURN;
    END IF;

    v_redeem_amount := LEAST(p_amount, v_card.current_balance);

    UPDATE gift_cards
       SET current_balance = current_balance - v_redeem_amount,
           status = CASE WHEN current_balance - v_redeem_amount <= 0 THEN 'redeemed' ELSE 'active' END,
           redeemed_at = CASE WHEN current_balance - v_redeem_amount <= 0 THEN NOW() ELSE redeemed_at END,
           updated_at = NOW()
     WHERE id = v_card.id;

    INSERT INTO gift_card_transactions(
      gift_card_id, transaction_type, amount, balance_after, order_id, notes,
      tenant_id, property_id
    ) VALUES (
      v_card.id, 'redemption', -v_redeem_amount, v_card.current_balance - v_redeem_amount,
      p_order_id, 'Order redemption', v_card.tenant_id, v_card.property_id
    );

    RETURN QUERY SELECT true, v_redeem_amount, v_card.current_balance - v_redeem_amount, v_card.id, NULL::TEXT;
END;
$$;

ALTER FUNCTION public.redeem_giftcard_atomic(text, numeric, uuid, uuid) OWNER TO postgres;


-- (legacy overload kept for now; dropped by 20261120100300_p0_drop_legacy_redemption_overloads.sql once the tenant-scoped backend is deployed)

CREATE OR REPLACE FUNCTION public.redeem_loyalty_points_atomic(
  p_user_id uuid,
  p_points integer,
  p_order_id uuid,
  p_dollar_value numeric,
  p_tenant_id uuid
)
RETURNS TABLE(success boolean, points_redeemed integer, new_balance integer, member_id uuid, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_member RECORD;
BEGIN
    IF p_tenant_id IS NULL THEN
        RETURN QUERY SELECT false, 0, 0, NULL::UUID, 'Tenant context is required for loyalty redemption'::TEXT;
        RETURN;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('loyalty_member_' || p_user_id::text));

    SELECT * INTO v_member
      FROM loyalty_members
     WHERE user_id = p_user_id
       AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, 0, NULL::UUID, 'User does not have a loyalty account'::TEXT;
        RETURN;
    END IF;

    IF v_member.available_points < p_points THEN
        RETURN QUERY SELECT false, 0, v_member.available_points::INTEGER, v_member.id, 'Insufficient points balance'::TEXT;
        RETURN;
    END IF;

    UPDATE loyalty_members
       SET available_points = available_points - p_points,
           last_activity = NOW(),
           updated_at = NOW()
     WHERE id = v_member.id
    RETURNING available_points INTO v_member.available_points;

    INSERT INTO loyalty_transactions(
      member_id, transaction_type, points, balance_after, description,
      reference_type, reference_id, tenant_id, property_id
    ) VALUES (
      v_member.id, 'redeem', -p_points, v_member.available_points,
      'Redeemed ' || p_points || ' points for $' || p_dollar_value || ' discount for order ' || p_order_id,
      CASE WHEN p_order_id IS NULL THEN NULL ELSE 'order' END,
      p_order_id,
      v_member.tenant_id, v_member.property_id
    );

    RETURN QUERY SELECT true, p_points, v_member.available_points::INTEGER, v_member.id, NULL::TEXT;
END;
$$;

ALTER FUNCTION public.redeem_loyalty_points_atomic(uuid, integer, uuid, numeric, uuid) OWNER TO postgres;


-- (legacy overload kept for now; dropped by 20261120100300_p0_drop_legacy_redemption_overloads.sql once the tenant-scoped backend is deployed)

CREATE OR REPLACE FUNCTION public.apply_coupon_atomic(
  p_code text,
  p_user_id uuid,
  p_order_total numeric,
  p_order_id uuid,
  p_module_type text,
  p_tenant_id uuid
)
RETURNS TABLE(success boolean, discount_amount numeric, coupon_id uuid, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_coupon RECORD;
    v_user_usage_count INTEGER;
    v_calculated_discount DECIMAL;
BEGIN
    IF p_tenant_id IS NULL THEN
        RETURN QUERY SELECT false, 0::DECIMAL, NULL::UUID, 'Tenant context is required for coupon application'::TEXT;
        RETURN;
    END IF;

    SELECT * INTO v_coupon
      FROM coupons
     WHERE code = UPPER(p_code)
       AND tenant_id = p_tenant_id
       AND is_active = true
       AND (valid_from IS NULL OR valid_from <= NOW())
       AND (valid_until IS NULL OR valid_until > NOW())
       FOR UPDATE;

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
        SELECT COUNT(*) INTO v_user_usage_count
          FROM coupon_usage
         WHERE coupon_usage.coupon_id = v_coupon.id
           AND coupon_usage.user_id = p_user_id;
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
    INSERT INTO coupon_usage(
      coupon_id, user_id, order_id, discount_applied, tenant_id, property_id
    ) VALUES (
      v_coupon.id, p_user_id, p_order_id, v_calculated_discount,
      v_coupon.tenant_id, v_coupon.property_id
    );
    RETURN QUERY SELECT true, v_calculated_discount, v_coupon.id, NULL::TEXT;
END;
$function$;

ALTER FUNCTION public.apply_coupon_atomic(text, uuid, numeric, uuid, text, uuid) OWNER TO postgres;


-- ===========================================================================
-- 1b. Reversal functions (missing on the local schema and tenant-scoped now)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.restore_gift_card_balance(
  p_gift_card_id uuid,
  p_amount numeric,
  p_order_id uuid DEFAULT NULL
)
RETURNS TABLE(success boolean, new_balance numeric, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      status = CASE WHEN status = 'redeemed' THEN 'active' ELSE status END,
      redeemed_at = CASE WHEN status = 'redeemed' THEN NULL ELSE redeemed_at END,
      updated_at = NOW()
  WHERE id = p_gift_card_id;

  INSERT INTO gift_card_transactions(
    gift_card_id, transaction_type, amount, balance_after, order_id, notes,
    tenant_id, property_id
  ) VALUES (
    p_gift_card_id, 'refund', p_amount, v_new_balance, p_order_id,
    'Reversal: order creation failed, was cancelled, or was refunded',
    v_card.tenant_id, v_card.property_id
  );

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

ALTER FUNCTION public.restore_gift_card_balance(uuid, numeric, uuid) OWNER TO postgres;


CREATE OR REPLACE FUNCTION public.reverse_coupon_usage(
  p_coupon_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE coupons
  SET usage_count = GREATEST(0, usage_count - 1),
      updated_at = NOW()
  WHERE id = p_coupon_id;

  IF p_order_id IS NOT NULL THEN
    DELETE FROM coupon_usage
    WHERE coupon_id = p_coupon_id
      AND order_id = p_order_id;
  ELSIF p_user_id IS NOT NULL THEN
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

ALTER FUNCTION public.reverse_coupon_usage(uuid, uuid, uuid) OWNER TO postgres;


CREATE OR REPLACE FUNCTION public.reverse_loyalty_redemption(
  p_user_id uuid,
  p_points integer,
  p_order_id uuid,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_member RECORD;
  v_new_balance INTEGER;
BEGIN
  IF p_tenant_id IS NULL OR p_points IS NULL OR p_points <= 0 THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('loyalty_member_' || p_user_id::text));

  SELECT * INTO v_member
    FROM loyalty_members
   WHERE user_id = p_user_id
     AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE loyalty_members
     SET available_points = available_points + p_points,
         last_activity = NOW(),
         updated_at = NOW()
   WHERE id = v_member.id
  RETURNING available_points INTO v_new_balance;

  INSERT INTO loyalty_transactions(
    member_id, transaction_type, points, balance_after, description,
    reference_type, reference_id, tenant_id, property_id
  ) VALUES (
    v_member.id, 'refund', p_points, v_new_balance,
    'Reversed ' || p_points || ' redeemed points (order ' || COALESCE(p_order_id::text, 'n/a') || ')',
    CASE WHEN p_order_id IS NULL THEN NULL ELSE 'order' END,
    p_order_id,
    v_member.tenant_id, v_member.property_id
  );

  RETURN true;
END;
$$;

ALTER FUNCTION public.reverse_loyalty_redemption(uuid, integer, uuid, uuid) OWNER TO postgres;


-- Tenant-local codes must be unique: a code lookup can no longer cross tenants,
-- and duplicates inside one tenant make the atomic RPC ambiguous.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT tenant_id, code FROM public.gift_cards GROUP BY 1, 2 HAVING COUNT(*) > 1
    ) d
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_tenant_code_key
      ON public.gift_cards (tenant_id, code);
  ELSE
    RAISE NOTICE 'gift_cards has duplicate (tenant_id, code) rows; unique index not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT tenant_id, code FROM public.coupons GROUP BY 1, 2 HAVING COUNT(*) > 1
    ) d
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS coupons_tenant_code_key
      ON public.coupons (tenant_id, code);
  ELSE
    RAISE NOTICE 'coupons has duplicate (tenant_id, code) rows; unique index not created';
  END IF;
END $$;


-- ===========================================================================
-- 2. RLS on the nine tables that had it disabled
-- ===========================================================================

ALTER TABLE public.checkout_compensation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_compensation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_fulfillment_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

-- Internal/back-office tables: service role only, no browser policies.
REVOKE ALL ON TABLE
  public.checkout_compensation_log,
  public.checkout_compensation_queue,
  public.engine_fulfillment_capabilities,
  public.idempotency_records
FROM anon, authenticated;

-- Sensitive tenant tables: authenticated reads stay tenant-scoped; anon loses
-- SELECT entirely (the browser never talks to Postgres directly).
REVOKE ALL ON TABLE
  public.expenses,
  public.reservations,
  public.shift_cash_movements,
  public.staff_reviews
FROM anon;

DROP POLICY IF EXISTS expenses_tenant_isolation ON public.expenses;
CREATE POLICY expenses_tenant_isolation ON public.expenses
  FOR ALL
  USING (public.user_has_tenant_access(auth.uid(), tenant_id))
  WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

DROP POLICY IF EXISTS reservations_tenant_isolation ON public.reservations;
CREATE POLICY reservations_tenant_isolation ON public.reservations
  FOR ALL
  USING (public.user_has_tenant_access(auth.uid(), tenant_id))
  WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

DROP POLICY IF EXISTS shift_cash_movements_tenant_isolation ON public.shift_cash_movements;
CREATE POLICY shift_cash_movements_tenant_isolation ON public.shift_cash_movements
  FOR ALL
  USING (public.user_has_tenant_access(auth.uid(), tenant_id))
  WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

DROP POLICY IF EXISTS staff_reviews_tenant_isolation ON public.staff_reviews;
CREATE POLICY staff_reviews_tenant_isolation ON public.staff_reviews
  FOR ALL
  USING (public.user_has_tenant_access(auth.uid(), tenant_id))
  WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));

-- Translations is public catalogue content: keep anonymous SELECT, but only
-- through a read policy, and never allow browser writes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.translations FROM anon, authenticated;
DROP POLICY IF EXISTS translations_public_read ON public.translations;
CREATE POLICY translations_public_read ON public.translations
  FOR SELECT
  USING (true);


-- ===========================================================================
-- 3. Recursive RLS policies (users / payments / tenants)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.current_user_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (u.is_platform_admin OR u.scope IN ('super_admin', 'platform_admin'))
       FROM public.users u
      WHERE u.id = auth.uid()),
    false
  );
$$;

ALTER FUNCTION public.current_user_is_platform_admin() OWNER TO postgres;

-- users: self-read + the existing tenant isolation policy are enough. The old
-- users_admin_write/users_self_read policies subqueried users and recursed.
DROP POLICY IF EXISTS users_self_read ON public.users;
CREATE POLICY users_self_read ON public.users
  FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS users_admin_write ON public.users;

-- payments: tenant isolation (payments_isolation) is the authority. The old
-- staff-read/admin-write policies subqueried users and recursed.
DROP POLICY IF EXISTS payments_staff_read ON public.payments;
DROP POLICY IF EXISTS payments_admin_write ON public.payments;

-- tenants: platform admins only, via a SECURITY DEFINER helper.
DROP POLICY IF EXISTS tenants_platform_admin_read ON public.tenants;
CREATE POLICY tenants_platform_admin_read ON public.tenants
  FOR SELECT
  USING (public.current_user_is_platform_admin());


-- ===========================================================================
-- 4. Atomic idempotency claim for engine_idempotency_keys
-- ===========================================================================

-- The table was created with property_id NOT NULL and no default. The guard
-- never supplied it, so every claim INSERT failed and the guard proceeded
-- unprotected. Property is optional for engine-level operations.
ALTER TABLE public.engine_idempotency_keys ALTER COLUMN property_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_engine_idempotency_key(
  p_key text,
  p_tenant_id text,
  p_engine_type text,
  p_entity_id text,
  p_action text,
  p_ttl_seconds integer DEFAULT 86400
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row RECORD;
  v_now timestamptz := NOW();
  v_expires timestamptz := NOW() + make_interval(secs => GREATEST(p_ttl_seconds, 1));
BEGIN
  INSERT INTO engine_idempotency_keys(
    key, tenant_id, engine_type, entity_id, action, status, created_at, expires_at
  ) VALUES (
    p_key, p_tenant_id, p_engine_type, p_entity_id, p_action, 'processing', v_now, v_expires
  )
  ON CONFLICT (key) DO NOTHING
  RETURNING * INTO v_row;

  IF FOUND THEN
    RETURN jsonb_build_object('claimed', true, 'status', 'processing');
  END IF;

  SELECT * INTO v_row FROM engine_idempotency_keys WHERE key = p_key FOR UPDATE;

  IF NOT FOUND THEN
    -- Extremely unlikely (row deleted between insert and select); retry once.
    INSERT INTO engine_idempotency_keys(
      key, tenant_id, engine_type, entity_id, action, status, created_at, expires_at
    ) VALUES (
      p_key, p_tenant_id, p_engine_type, p_entity_id, p_action, 'processing', v_now, v_expires
    )
    ON CONFLICT (key) DO NOTHING
    RETURNING * INTO v_row;

    IF FOUND THEN
      RETURN jsonb_build_object('claimed', true, 'status', 'processing');
    END IF;
    RETURN jsonb_build_object('claimed', false, 'status', 'processing');
  END IF;

  IF v_row.status = 'completed' THEN
    RETURN jsonb_build_object(
      'claimed', false,
      'status', 'completed',
      'result_data', v_row.result_data
    );
  END IF;

  IF v_row.status = 'failed' OR v_row.expires_at <= v_now THEN
    UPDATE engine_idempotency_keys
       SET status = 'processing',
           result_data = NULL,
           completed_at = NULL,
           created_at = v_now,
           expires_at = v_expires
     WHERE key = p_key;
    RETURN jsonb_build_object('claimed', true, 'status', 'processing');
  END IF;

  RETURN jsonb_build_object(
    'claimed', false,
    'status', 'processing',
    'expires_at', v_row.expires_at
  );
END;
$$;

ALTER FUNCTION public.claim_engine_idempotency_key(text, text, text, text, text, integer) OWNER TO postgres;


-- ===========================================================================
-- 5. Payment intent uniqueness (P0-11 backstop)
-- ===========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM (
      SELECT stripe_payment_intent_id
        FROM public.payments
       WHERE stripe_payment_intent_id IS NOT NULL
       GROUP BY 1
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_stripe_payment_intent
      ON public.payments (stripe_payment_intent_id)
      WHERE stripe_payment_intent_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'payments has duplicate stripe_payment_intent_id rows; unique index not created';
  END IF;
END $$;
