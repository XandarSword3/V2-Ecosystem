-- ============================================
-- V2 Resort - Add Settings Table
-- Run this in Supabase SQL Editor
-- ============================================

-- Site Settings table (key-value pairs)
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(key);

-- Insert default settings
INSERT INTO site_settings (key, value) VALUES
  ('general', '{
    "resortName": "V2 Resort",
    "tagline": "Lebanon''s Premier Resort Experience",
    "description": "Your premium destination for exceptional dining, comfortable chalets, and refreshing pool experiences in the heart of Lebanon.",
    "currency": "USD",
    "taxRate": 0.11,
    "timezone": "Asia/Beirut"
  }'::jsonb),
  ('contact', '{
    "phone": "+961 XX XXX XXX",
    "email": "info@v2resort.com",
    "address": "V2 Resort, Lebanon"
  }'::jsonb),
  ('hours', '{
    "poolHours": "9:00 AM - 7:00 PM",
    "restaurantHours": "8:00 AM - 11:00 PM",
    "receptionHours": "24/7"
  }'::jsonb),
  ('chalets', '{
    "checkIn": "3:00 PM",
    "checkOut": "12:00 PM",
    "depositPercent": 50,
    "cancellationPolicy": "Free cancellation up to 48 hours before check-in. 50% charge for late cancellations."
  }'::jsonb),
  ('pool', '{
    "adultPrice": 15,
    "childPrice": 10,
    "infantPrice": 0,
    "capacity": 100
  }'::jsonb),
  ('legal', '{
    "privacyPolicy": "",
    "termsOfService": "",
    "refundPolicy": ""
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Grant access
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy for authenticated users to read
CREATE POLICY "Anyone can read settings" ON site_settings FOR SELECT USING (true);

-- RLS policy for admin users to update
CREATE POLICY "Admins can update settings" ON site_settings FOR UPDATE USING (true);
CREATE POLICY "Admins can insert settings" ON site_settings FOR INSERT WITH CHECK (true);
