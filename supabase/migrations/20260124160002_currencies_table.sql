-- V2 Resort: Currencies Table Migration
-- Stores supported currencies and exchange rates
-- Production Hardening Phase 1.3

-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
  code CHAR(3) PRIMARY KEY,
  symbol VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  name_fr VARCHAR(100),
  exchange_rate DECIMAL(12, 6) NOT NULL DEFAULT 1.000000,
  decimal_places INTEGER NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_currencies_is_active ON currencies(is_active);
CREATE INDEX IF NOT EXISTS idx_currencies_is_default ON currencies(is_default) WHERE is_default = true;

-- Add comment for documentation
COMMENT ON TABLE currencies IS 'Stores supported currencies and their exchange rates relative to EUR';

-- Enable RLS
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can view active currencies" ON currencies;
CREATE POLICY "Anyone can view active currencies"
  ON currencies FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Public can view active currencies" ON currencies;
CREATE POLICY "Public can view active currencies"
  ON currencies FOR SELECT
  TO anon
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage currencies" ON currencies;
CREATE POLICY "Admins can manage currencies"
  ON currencies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Service role has full access to currencies" ON currencies;
CREATE POLICY "Service role has full access to currencies"
  ON currencies FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Ensure only one default currency
DROP INDEX IF EXISTS idx_currencies_single_default;
CREATE UNIQUE INDEX idx_currencies_single_default ON currencies(is_default) WHERE is_default = true;

-- Insert default currencies
INSERT INTO currencies (code, symbol, name, name_ar, name_fr, exchange_rate, decimal_places, is_active, is_default) VALUES
  ('EUR', '€', 'Euro', 'يورو', 'Euro', 1.000000, 2, true, true),
  ('USD', '$', 'US Dollar', 'دولار أمريكي', 'Dollar américain', 1.085000, 2, true, false),
  ('GBP', '£', 'British Pound', 'جنيه إسترليني', 'Livre sterling', 0.856000, 2, true, false),
  ('AED', 'د.إ', 'UAE Dirham', 'درهم إماراتي', 'Dirham des EAU', 3.980000, 2, true, false),
  ('SAR', '﷼', 'Saudi Riyal', 'ريال سعودي', 'Riyal saoudien', 4.070000, 2, true, false),
  ('QAR', 'ر.ق', 'Qatari Riyal', 'ريال قطري', 'Riyal qatari', 3.950000, 2, true, false),
  ('KWD', 'د.ك', 'Kuwaiti Dinar', 'دينار كويتي', 'Dinar koweïtien', 0.334000, 3, true, false),
  ('CHF', 'CHF', 'Swiss Franc', 'فرنك سويسري', 'Franc suisse', 0.945000, 2, true, false)
ON CONFLICT (code) DO NOTHING;

-- Create trigger for last_updated on exchange rate changes
CREATE OR REPLACE FUNCTION update_currency_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.exchange_rate <> OLD.exchange_rate THEN
    NEW.last_updated = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_currency_last_updated ON currencies;
CREATE TRIGGER set_currency_last_updated
  BEFORE UPDATE ON currencies
  FOR EACH ROW
  EXECUTE FUNCTION update_currency_last_updated();
