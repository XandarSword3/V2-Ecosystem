-- P0-11: durable, mutable refund intents (2026-11-20)
--
-- The refund path computed "already refunded" from `payment_ledger` rows, but
-- for card refunds those rows are written by the `charge.refunded` webhook, not
-- synchronously. A delayed/lost webhook therefore made a second request see the
-- old balance and refund the same money again. There was also no local record
-- between "Stripe call started" and "Stripe call returned", so a crash or a
-- retry had no way to resume the same refund instead of issuing a new one.
--
-- `payment_ledger` is fully immutable (UPDATE/DELETE are rejected by trigger),
-- so a pending row cannot be promoted to succeeded. This table is the mutable
-- intent/lease record:
--
--   pending   -> Stripe (or the manual ledger) is in flight. A concurrent
--                request for a different amount is rejected.
--   succeeded -> the refund completed; its amount counts toward the cap even
--                before the webhook writes its `payment_ledger` row.
--   failed    -> the attempt failed and may be retried with the same key.
--
-- `idempotency_key` is deterministic (payment + requested amount + prior
-- balance) and is also passed to `stripe.refunds.create`, so retries and
-- concurrent duplicates resolve to the same Stripe refund.
--
-- Access model: service role only. RLS enabled with no policies and DML
-- revoked from anon/authenticated, matching payment_ledger/idempotency tables.

CREATE TABLE IF NOT EXISTS public.refund_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  property_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency varchar(3) NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  idempotency_key text NOT NULL,
  stripe_refund_id varchar(255),
  error text,
  attempts integer NOT NULL DEFAULT 0,
  requested_by uuid,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_refund_intents_idempotency_key
  ON public.refund_intents (idempotency_key);

CREATE INDEX IF NOT EXISTS idx_refund_intents_payment_status
  ON public.refund_intents (payment_id, status);

CREATE INDEX IF NOT EXISTS idx_refund_intents_pending
  ON public.refund_intents (status, created_at)
  WHERE status = 'pending';

ALTER TABLE public.refund_intents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.refund_intents FROM anon, authenticated;

COMMENT ON TABLE public.refund_intents IS
  'Mutable refund intent/lease. Prevents double refunds while Stripe webhooks are delayed and lets a retry resume the same Stripe idempotency key. Service-role only.';
