-- Create notification_broadcasts table
CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  target_type TEXT NOT NULL DEFAULT 'all',
  priority TEXT NOT NULL DEFAULT 'normal',
  target_user_ids UUID[] DEFAULT ARRAY[]::uuid[],
  actions JSONB,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivery_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notification_templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  target_type TEXT NOT NULL DEFAULT 'all',
  priority TEXT NOT NULL DEFAULT 'normal',
  actions JSONB,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notification_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Service role policies (backend uses service_role key)
CREATE POLICY service_role_all_notification_broadcasts 
  ON notification_broadcasts FOR ALL TO service_role 
  USING (true) WITH CHECK (true);

CREATE POLICY service_role_all_notification_templates 
  ON notification_templates FOR ALL TO service_role 
  USING (true) WITH CHECK (true);
