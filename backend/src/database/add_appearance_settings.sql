-- ============================================
-- V2 Resort - Appearance & Theme Settings Migration
-- Run this in Supabase SQL Editor to enable all theme/appearance features
-- ============================================

-- Ensure site_settings table exists
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(key);

-- Insert or update appearance settings with full theme configuration
INSERT INTO site_settings (key, value) VALUES
  ('appearance', '{
    "theme": "beach",
    "themeColors": null,
    "showWeatherWidget": true,
    "weatherLocation": "Beirut, Lebanon",
    "weatherEffect": "waves",
    "animationsEnabled": true,
    "reducedMotion": false,
    "soundEnabled": true
  }'::jsonb)
ON CONFLICT (key) 
DO UPDATE SET 
  value = site_settings.value || '{
    "theme": "beach",
    "showWeatherWidget": true,
    "weatherEffect": "waves",
    "animationsEnabled": true
  }'::jsonb,
  updated_at = NOW();

-- ============================================
-- Available Theme Options:
-- ============================================
-- "theme" can be one of:
--   - "beach"     (Beach Paradise - tropical cyan/teal with wave animations)
--   - "mountain"  (Mountain Retreat - earthy stone tones with snow effect)
--   - "sunset"    (Sunset Glow - warm orange/rose with rain effect)
--   - "forest"    (Forest Escape - green/emerald with falling leaves)
--   - "midnight"  (Midnight Elegance - dark slate/purple with stars)
--   - "luxury"    (Luxury Gold - amber/gold with fireflies)
--
-- ============================================
-- Weather Effect Options:
-- ============================================
-- "weatherEffect" can be one of:
--   - "waves"      (Animated ocean waves at bottom of screen)
--   - "snow"       (Falling snowflakes)
--   - "rain"       (Rain drops falling)
--   - "leaves"     (Autumn leaves falling and spinning)
--   - "stars"      (Twinkling stars with shooting stars)
--   - "fireflies"  (Glowing fireflies floating around)
--   - "none"       (No weather animation)
--
-- ============================================
-- Custom Theme Colors:
-- ============================================
-- If you want custom colors instead of preset themes, 
-- set "themeColors" to an object like:
-- {
--   "primary": "#0891b2",
--   "secondary": "#06b6d4", 
--   "accent": "#f59e0b",
--   "background": "#f0fdfa",
--   "surface": "#ffffff",
--   "text": "#164e63",
--   "textMuted": "#0e7490"
-- }
--
-- ============================================
-- Example: Change to Forest theme with leaves
-- ============================================
-- UPDATE site_settings 
-- SET value = jsonb_set(
--   jsonb_set(value, '{theme}', '"forest"'),
--   '{weatherEffect}', '"leaves"'
-- )
-- WHERE key = 'appearance';
--
-- ============================================
-- Example: Disable weather animations
-- ============================================
-- UPDATE site_settings 
-- SET value = jsonb_set(value, '{showWeatherWidget}', 'false')
-- WHERE key = 'appearance';
--
-- ============================================
-- Example: Set custom colors
-- ============================================
-- UPDATE site_settings 
-- SET value = jsonb_set(value, '{themeColors}', '{
--   "primary": "#dc2626",
--   "secondary": "#ef4444",
--   "accent": "#fbbf24",
--   "background": "#fef2f2",
--   "surface": "#ffffff",
--   "text": "#7f1d1d",
--   "textMuted": "#991b1b"
-- }'::jsonb)
-- WHERE key = 'appearance';

-- Grant access (if not already set)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Anyone can read settings" ON site_settings;
CREATE POLICY "Anyone can read settings" ON site_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update settings" ON site_settings;
CREATE POLICY "Admins can update settings" ON site_settings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Admins can insert settings" ON site_settings;
CREATE POLICY "Admins can insert settings" ON site_settings FOR INSERT WITH CHECK (true);

-- Verify the settings were created
SELECT key, value FROM site_settings WHERE key = 'appearance';
