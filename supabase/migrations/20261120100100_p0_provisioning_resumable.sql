-- P0-6: make tenant provisioning resumable (2026-11-20)
--
-- Provisioning used to be a fire-and-forget chain of inserts:
--   * `provision()` returned early (`created: false`) whenever the tenants row
--     already existed, even if the property group, property, owner user or
--     property-access rows were never written because an earlier attempt died
--     half-way. Stripe's retry therefore became a permanent no-op and the
--     customer was charged for a tenant that could never be used.
--   * A failure to create `user_property_access` was logged and ignored, so the
--     owner could sign in but see no property.
--   * The welcome email (which carries the ONLY copy of the generated
--     temporary password) was fire-and-forget. If SMTP was down the credential
--     was lost; the hash is one-way, so it could not be regenerated.
--
-- This migration adds the durable outbox that makes the credential email
-- retriable. The service writes the row (with the temporary password encrypted
-- at rest via utils/encryption.ts) in the same request that creates the user,
-- and every later `provision()` call for the same subscription re-attempts any
-- still-pending row. No cron is required: Stripe's own retry loop drives it,
-- and an operator can trigger it by replaying the webhook.
--
-- Access model: service role only. RLS enabled with no policies, and DML is
-- revoked from anon/authenticated, matching tenant_payment_settings and
-- job_runs.

CREATE TABLE IF NOT EXISTS public.provisioning_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  purpose text NOT NULL DEFAULT 'welcome',
  recipient_email text NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  subdomain text NOT NULL,
  -- AES-256-GCM ciphertext (utils/encryption.ts). Never log this column.
  temp_password_encrypted text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'abandoned')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- One email per (tenant, purpose); retries update the same row instead of
-- enqueueing a second credential email with a different password.
--
-- Deliberately a FULL unique index rather than a partial one: PostgREST's
-- upsert(onConflict: 'tenant_id,purpose') can only infer a non-partial unique
-- index, and a partial index would make every enqueue fail with 42P10.
DROP INDEX IF EXISTS public.uq_provisioning_email_outbox_welcome;
CREATE UNIQUE INDEX IF NOT EXISTS uq_provisioning_email_outbox_tenant_purpose
  ON public.provisioning_email_outbox (tenant_id, purpose);

CREATE INDEX IF NOT EXISTS idx_provisioning_email_outbox_pending
  ON public.provisioning_email_outbox (status, created_at)
  WHERE status IN ('pending', 'failed');

ALTER TABLE public.provisioning_email_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.provisioning_email_outbox FROM anon, authenticated;

COMMENT ON TABLE public.provisioning_email_outbox IS
  'Durable queue for provisioning emails whose payload cannot be regenerated (welcome credentials). Service-role only.';
