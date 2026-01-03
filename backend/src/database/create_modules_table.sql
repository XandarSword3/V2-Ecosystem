-- Create modules table
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type VARCHAR(50) NOT NULL, -- 'menu_service', 'multi_day_booking', 'session_access'
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default modules
INSERT INTO modules (template_type, name, slug, description, sort_order, is_active)
VALUES 
  ('menu_service', 'Restaurant', 'restaurant', 'Fine dining restaurant management', 1, true),
  ('multi_day_booking', 'Chalets', 'chalets', 'Chalet booking and management', 2, true),
  ('session_access', 'Pool', 'pool', 'Pool access and session management', 3, true),
  ('menu_service', 'Snack Bar', 'snack-bar', 'Quick service snack bar', 4, true)
ON CONFLICT (slug) DO NOTHING;
