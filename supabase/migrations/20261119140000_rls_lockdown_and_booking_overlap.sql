-- Production-readiness hardening (2026-11-19)
--
-- 1. Remove permissive RLS policies that exposed every tenant's transactions,
--    financial ledger and token blacklist to anon/authenticated Supabase
--    clients (`USING (true)` policies survived alongside the isolation ones).
-- 2. Revoke DML from anon/authenticated on public tables. The backend uses the
--    service-role client; the browser never talks to Postgres directly, so
--    broad DML grants were pure attack surface (the local Supabase default ACL
--    granted arwdDxtm to both roles).
-- 3. Enforce non-overlapping time-exclusive reservations for EVERY writer,
--    including direct inserts/updates that bypass
--    reserve_unit_exclusive_atomic.
-- 4. Make the financial-ledger idempotency index unique when the data allows
--    it (pre-existing duplicates are reported, not silently deleted; the
--    engine ledger is append-only).
--
-- NOTE: Anon SELECT is intentionally left in place for public catalogue
-- tables (menus, modules, translations). Sensitive tables are revoked
-- explicitly below and the old permissive policies are dropped.

-- ---------------------------------------------------------------------------
-- 1. Drop permissive policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "transactions_allow_all" ON public.transactions;
DROP POLICY IF EXISTS "efl_read" ON public.engine_financial_ledger;
DROP POLICY IF EXISTS "tbl_system" ON public.token_blacklist;

-- These tables had a permissive "all" policy that bypassed tenant isolation.
-- They are namespaced by tenant/property in the isolation policies already.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'ALL'
      AND qual = 'true'
      AND tablename IN (
        'engine_feature_flags', 'engine_loyalty_events', 'engine_compensation_log',
        'engine_idempotency_keys'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Grant hygiene
-- ---------------------------------------------------------------------------
-- No browser-side writes: the API is the only writer (service_role).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;

-- Revoke read access to sensitive/financial tables from the anonymous role.
-- Authenticated clients keep SELECT, but RLS isolation limits them to their
-- own tenant (policies are enforced for non-service roles).
REVOKE ALL ON TABLE
  public.transactions,
  public.engine_financial_ledger,
  public.payment_ledger,
  public.payments,
  public.token_blacklist,
  public.engine_idempotency_keys,
  public.engine_compensation_log
FROM anon;

REVOKE ALL ON TABLE public.payment_ledger, public.payments FROM authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;
GRANT SELECT ON TABLE public.payment_ledger TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Booking overlap enforcement trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_time_exclusive_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_unit_id text;
BEGIN
  IF NEW.engine_type IS DISTINCT FROM 'time_exclusive_reservation' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;

  v_unit_id := NULLIF(NEW.metadata->>'unit_id', '');
  IF v_unit_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.metadata->>'check_in_date') IS NULL OR (NEW.metadata->>'check_out_date') IS NULL THEN
    RETURN NEW;
  END IF;

  -- Same advisory-lock key as reserve_unit_exclusive_atomic, so the RPC and
  -- direct writers serialize on the same unit.
  PERFORM pg_advisory_xact_lock(
    hashtext(NEW.module_id::text || '::' || v_unit_id)
  );

  IF EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id IS DISTINCT FROM NEW.id
      AND t.engine_type = 'time_exclusive_reservation'
      AND t.module_id = NEW.module_id
      AND (t.metadata->>'unit_id') = v_unit_id
      AND t.status NOT IN ('cancelled', 'no_show')
      AND (t.metadata->>'check_in_date')::date < (NEW.metadata->>'check_out_date')::date
      AND (t.metadata->>'check_out_date')::date > (NEW.metadata->>'check_in_date')::date
  ) THEN
    RAISE EXCEPTION
      'Unit % is already booked for these dates (module %)', v_unit_id, NEW.module_id
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_time_exclusive_no_overlap ON public.transactions;
CREATE TRIGGER trg_enforce_time_exclusive_no_overlap
  BEFORE INSERT OR UPDATE OF status, metadata, module_id, engine_type
  ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_time_exclusive_no_overlap();

-- ---------------------------------------------------------------------------
-- 4. Ledger idempotency uniqueness (safe when no duplicates exist)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_dupes integer;
BEGIN
  SELECT COUNT(*) INTO v_dupes
  FROM (
    SELECT idempotency_key
    FROM public.engine_financial_ledger
    WHERE idempotency_key IS NOT NULL
    GROUP BY idempotency_key
    HAVING COUNT(*) > 1
  ) d;

  IF v_dupes = 0 THEN
    -- idx_efl_idem was a plain (non-unique) index; replace it so concurrent
    -- retries cannot double-post a settlement or refund.
    DROP INDEX IF EXISTS public.idx_efl_idem;
    CREATE UNIQUE INDEX idx_efl_idem
      ON public.engine_financial_ledger (idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  ELSE
    RAISE NOTICE
      'engine_financial_ledger has % duplicate idempotency_key groups; unique index not created. Reconcile duplicates and rerun.',
      v_dupes;
  END IF;
END $$;
