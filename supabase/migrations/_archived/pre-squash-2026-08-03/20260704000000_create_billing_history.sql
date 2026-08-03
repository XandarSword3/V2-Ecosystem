-- ============================================================
-- Migration: billing_history table (Engine E)
--
-- Root cause this fixes: the platform-admin tenant detail page has always
-- rendered a "Billing History" card reading tenant.billing_history, but no
-- table ever existed and no webhook handler ever wrote one. The field was
-- never real — see saas-webhook.controller.ts, wired in the same session
-- to insert rows here on invoice.paid / invoice.payment_failed /
-- customer.subscription.deleted.
--
-- One row per billable Stripe event for a tenant. Append-only ledger —
-- nothing here is ever updated or deleted, matching the immutability
-- pattern already used for the payments ledger
-- (20260424000001_payment_ledger_full_immutability.sql).
-- ============================================================

CREATE TABLE IF NOT EXISTS billing_history (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type            TEXT NOT NULL, -- e.g. 'invoice_paid', 'invoice_payment_failed', 'subscription_cancelled', 'subscription_created'
  amount                INTEGER NOT NULL DEFAULT 0, -- integer cents, matches plans.price_monthly_cents convention
  currency              TEXT NOT NULL DEFAULT 'usd',
  status                TEXT NOT NULL, -- 'paid' | 'failed' | 'cancelled' | 'created'
  stripe_event_id       TEXT, -- Stripe event.id, for idempotent inserts / debugging
  stripe_invoice_id     TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_history_tenant
  ON billing_history (tenant_id, created_at DESC);

-- Idempotency guard: a given Stripe event should only ever produce one
-- billing_history row, even if the webhook is retried by Stripe.
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_history_stripe_event
  ON billing_history (stripe_event_id)
  WHERE stripe_event_id IS NOT NULL;

ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;

-- Service role only — reads are proxied through the platform-admin
-- backend (getTenant), same pattern as the tenants table itself.
DROP POLICY IF EXISTS billing_history_service_role_all ON billing_history;
CREATE POLICY billing_history_service_role_all
  ON billing_history
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE billing_history IS
  'Append-only ledger of billable Stripe events per tenant, written by saas-webhook.controller.ts. Backs the platform-admin tenant detail "Billing History" card.';
