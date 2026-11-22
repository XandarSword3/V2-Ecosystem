-- Migration: per-tenant payment / Stripe configuration (2026-11-18)
--
-- P0-3. `site_settings` is keyed on `key` alone (`site_settings_pkey PRIMARY
-- KEY (key)`) while `tenant_id` / `property_id` are NOT NULL. That makes a
-- per-tenant `payments` settings row impossible: the second tenant's row
-- violates the primary key with 23505. At runtime `getStripeInstance()` read
-- whichever single `payments` row existed with no tenant filter, so every
-- tenant charged through the same Stripe account.
--
-- Why a dedicated table rather than widening the `site_settings` PK to
-- (key, tenant_id):
--   * ~50 call sites read `site_settings` with `.eq('key', X).single()`;
--     with a composite PK and more than one tenant row, every one of those
--     starts returning PGRST116 / multiple rows.
--   * Several writers upsert with `{ onConflict: 'key' }`; that target stops
--     existing once `key` alone is no longer unique.
--   * Those settings are genuinely global (appearance, hours, legal, etc.).
--     Changing their scoping is a much larger, unrelated change.
-- So Stripe credentials get their own tenant-scoped home, and the rest of
-- `site_settings` keeps its current semantics.
--
-- Access model: the backend's only path is the service-role client, which
-- bypasses RLS. RLS is enabled deny-by-default and anon/authenticated are
-- revoked outright, because these values are live API secrets and must never
-- be readable through PostgREST by a browser session.
--
-- Backwards compatibility: `getStripeInstance()` falls back to the legacy
-- `site_settings.payments` value (and then to STRIPE_SECRET_KEY) when a
-- tenant has no row here, so pre-existing installations keep working until
-- they are migrated.

CREATE TABLE IF NOT EXISTS public.tenant_payment_settings (
  tenant_id uuid NOT NULL,
  stripe_secret_key text,
  stripe_publishable_key text,
  stripe_webhook_secret text,
  currency character varying(3),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT tenant_payment_settings_pkey PRIMARY KEY (tenant_id),
  CONSTRAINT tenant_payment_settings_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT tenant_payment_settings_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT tenant_payment_settings_currency_format
    CHECK (currency IS NULL OR currency::text ~ '^[A-Z]{3}$')
);

COMMENT ON TABLE public.tenant_payment_settings IS
  'Per-tenant payment gateway credentials (P0-3). Service-role only: values are live API secrets.';
COMMENT ON COLUMN public.tenant_payment_settings.stripe_secret_key IS
  'Stripe secret key for this tenant. NULL means fall back to the platform default.';
COMMENT ON COLUMN public.tenant_payment_settings.stripe_webhook_secret IS
  'Stripe webhook signing secret for this tenant. NULL means fall back to the platform default.';

ALTER TABLE public.tenant_payment_settings ENABLE ROW LEVEL SECURITY;

-- Explicitly deny browser-facing roles. RLS with no policy is already
-- deny-by-default, but revoking the table privileges too keeps a future
-- policy from accidentally exposing secrets.
REVOKE ALL ON public.tenant_payment_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_payment_settings TO service_role;
