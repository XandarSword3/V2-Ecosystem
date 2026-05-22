DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chalet_bookings' AND column_name = 'total_price'
  ) THEN
    ALTER TABLE chalet_bookings RENAME COLUMN total_price TO total_amount;
  END IF;
END $$