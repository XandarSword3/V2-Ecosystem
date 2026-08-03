-- Ensure payments reference columns exist for legacy schemas.
-- Some bootstrap schemas create payments with unit_booking_id
-- but without reference_type/reference_id.
BEGIN;

ALTER TABLE IF EXISTS payments
  ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reference_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'unit_booking_id'
  ) THEN
    UPDATE payments
    SET reference_type = COALESCE(reference_type, 'booking'),
        reference_id = COALESCE(reference_id, unit_booking_id)
    WHERE unit_booking_id IS NOT NULL;
  END IF;

  -- pool_ticket_id not in canonical schema — branch removed.
END $$;

UPDATE payments
SET reference_type = COALESCE(reference_type, 'legacy')
WHERE reference_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference_type, reference_id);

COMMIT;
