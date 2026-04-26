-- =============================================================================
-- Migration: Make payment_ledger fully immutable
-- Date: 2026-04-24
--
-- The existing trigger (20260123210000_security_hardening.sql) only blocks
-- changes to amount, currency, and reference_id.
-- Fields like status, metadata, gateway_reference_id, webhook_id, and
-- gateway_fee remain freely writable, which violates append-only ledger semantics.
--
-- Fix: replace the partial guard with a total UPDATE block.
-- Any status transition must be recorded as a NEW row with a different status
-- (e.g., a reversal entry). This is the correct double-entry approach.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'payment_ledger is append-only. Deleting rows is forbidden. '
      'Create a reversal entry with a negative amount instead.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'payment_ledger is append-only. Updating any field is forbidden. '
      'Record a new corrective row instead. '
      'Attempted UPDATE on ledger row id=%.', OLD.id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger (replaces the one from 20260123210000)
DROP TRIGGER IF EXISTS trg_payment_ledger_immutable ON payment_ledger;

CREATE TRIGGER trg_payment_ledger_immutable
BEFORE DELETE OR UPDATE ON payment_ledger
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_modification();

COMMENT ON TRIGGER trg_payment_ledger_immutable ON payment_ledger IS
  'Enforces full immutability: no UPDATE or DELETE on any column is permitted. '
  'All corrections must be new reversal rows.';

COMMIT;
