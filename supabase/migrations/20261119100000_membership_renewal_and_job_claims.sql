-- Migration: membership renewal schema + distributed job claims (2026-11-19)
--
-- Batch 3, Tasks 2 and 3.
--
-- `src/jobs/membership-renewal.job.ts` and the Stripe `invoice.payment_succeeded`
-- handler both query `public.pool_memberships`, but no such table existed in
-- any migration or in the database. The nightly job therefore failed at the
-- first query, and the invoice webhook branch could not run at all.
--
-- This migration creates:
--   * pool_memberships              — one row per member subscription
--   * membership_renewal_attempts   — unique (membership_id, period_start),
--                                     i.e. at most one renewal attempt per
--                                     membership per billing period
--   * job_runs                      — distributed claim table for cron jobs;
--                                     PK (job_name, run_window) lets exactly one
--                                     instance win a run window
--
-- Access model mirrors tenant_payment_settings: service-role only, RLS enabled
-- with no policies (deny-by-default), browser roles revoked.

CREATE TABLE IF NOT EXISTS public.pool_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid,
  plan_id uuid,
  status text NOT NULL DEFAULT 'ACTIVE',
  billing_cycle text NOT NULL DEFAULT 'MONTHLY',
  end_date timestamp with time zone NOT NULL,
  stripe_subscription_id text,
  renewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pool_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT pool_memberships_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT pool_memberships_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT pool_memberships_billing_cycle_check
    CHECK (billing_cycle IN ('MONTHLY', 'QUARTERLY', 'ANNUALLY'))
);

CREATE UNIQUE INDEX IF NOT EXISTS pool_memberships_stripe_subscription_id_key
  ON public.pool_memberships (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pool_memberships_due_idx
  ON public.pool_memberships (status, end_date);

CREATE INDEX IF NOT EXISTS pool_memberships_tenant_idx
  ON public.pool_memberships (tenant_id);

COMMENT ON TABLE public.pool_memberships IS
  'Member subscriptions. tenant_id is mandatory; Stripe invoice webhooks resolve the tenant through this table.';

CREATE TABLE IF NOT EXISTS public.membership_renewal_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL,
  tenant_id uuid NOT NULL,
  billing_period_start timestamp with time zone NOT NULL,
  billing_period_end timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'claimed',
  stripe_invoice_id text,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT membership_renewal_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT membership_renewal_attempts_membership_id_fkey
    FOREIGN KEY (membership_id) REFERENCES public.pool_memberships(id) ON DELETE CASCADE,
  CONSTRAINT membership_renewal_attempts_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- The idempotency guarantee: one renewal per membership per billing period.
  CONSTRAINT membership_renewal_attempts_period_key
    UNIQUE (membership_id, billing_period_start),
  CONSTRAINT membership_renewal_attempts_status_check
    CHECK (status IN ('claimed', 'succeeded', 'failed'))
);

CREATE INDEX IF NOT EXISTS membership_renewal_attempts_tenant_idx
  ON public.membership_renewal_attempts (tenant_id);

COMMENT ON TABLE public.membership_renewal_attempts IS
  'One row per membership billing period. The unique key prevents a second invoice for the same period even when two schedulers race.';

CREATE TABLE IF NOT EXISTS public.job_runs (
  job_name text NOT NULL,
  run_window text NOT NULL,
  claimed_by text,
  claimed_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  CONSTRAINT job_runs_pkey PRIMARY KEY (job_name, run_window)
);

COMMENT ON TABLE public.job_runs IS
  'Distributed cron claim table. INSERT succeeds for exactly one instance per (job_name, run_window); a 23505 means another instance owns the run.';

ALTER TABLE public.pool_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_renewal_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pool_memberships FROM anon, authenticated;
REVOKE ALL ON public.membership_renewal_attempts FROM anon, authenticated;
REVOKE ALL ON public.job_runs FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_memberships TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_renewal_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_runs TO service_role;
