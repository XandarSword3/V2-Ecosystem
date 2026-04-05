DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS price_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_type VARCHAR(50) NOT NULL,
      item_id UUID NOT NULL,
      base_price DECIMAL(10, 2) NOT NULL,
      final_price DECIMAL(10, 2) NOT NULL,
      applied_rules JSONB DEFAULT '[]',
      booking_date DATE NOT NULL,
      check_in_date DATE NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_price_history_item ON price_history(item_type, item_id);
  CREATE INDEX IF NOT EXISTS idx_price_history_dates ON price_history(check_in_date);
  CREATE INDEX IF NOT EXISTS idx_price_history_recorded ON price_history(recorded_at);
END $$