-- Fill remaining schema compatibility gaps.
BEGIN;

-- snack_orders: REMOVED. Snack bar orders are instant_transaction engine records.
-- All snack order data lives in transactions + order_items.
-- Backend controllers must query transactions WHERE engine_type = 'instant_transaction'.
DO $$ BEGIN NULL; END $$;

-- accommodation_unit price rule columns (pricing rules table, not booking table)
ALTER TABLE IF EXISTS accommodation_unit_price_rules
  ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS weekend_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS holiday_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS per_guest_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS min_guests INTEGER,
  ADD COLUMN IF NOT EXISTS max_guests INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accommodation_unit_price_rules'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accommodation_unit_price_rules' AND column_name = 'price'
    ) THEN
      UPDATE accommodation_unit_price_rules
      SET base_price = COALESCE(base_price, price)
      WHERE base_price IS NULL;
    END IF;

    UPDATE accommodation_unit_price_rules
    SET weekend_price = COALESCE(weekend_price, base_price, 0)
    WHERE weekend_price IS NULL;

    UPDATE accommodation_unit_price_rules
    SET min_guests = COALESCE(min_guests, 1)
    WHERE min_guests IS NULL;

    UPDATE accommodation_unit_price_rules
    SET max_guests = COALESCE(max_guests, 10)
    WHERE max_guests IS NULL;
  END IF;
END $$;

ALTER TABLE IF EXISTS properties
  ADD COLUMN IF NOT EXISTS total_rooms INTEGER;

COMMIT;
