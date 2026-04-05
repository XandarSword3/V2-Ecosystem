-- Ensure payments reference columns exist for legacy schemas.
-- Some bootstrap schemas create payments with chalet_booking_id/pool_ticket_id
-- but without reference_type/reference_id.
BEGIN;

ALTER TABLE IF EXISTS payments
  ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reference_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'chalet_booking_id'
  ) THEN
    UPDATE payments
    SET reference_type = COALESCE(reference_type, 'booking'),
        reference_id = COALESCE(reference_id, chalet_booking_id)
    WHERE chalet_booking_id IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'pool_ticket_id'
  ) THEN
    UPDATE payments
    SET reference_type = COALESCE(reference_type, 'pool_ticket'),
        reference_id = COALESCE(reference_id, pool_ticket_id)
    WHERE pool_ticket_id IS NOT NULL;
  END IF;
END $$;

UPDATE payments
SET reference_type = COALESCE(reference_type, 'legacy')
WHERE reference_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);

COMMIT;
