DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chalet_bookings' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE chalet_bookings RENAME COLUMN user_id TO customer_id;
  END IF;
END $$