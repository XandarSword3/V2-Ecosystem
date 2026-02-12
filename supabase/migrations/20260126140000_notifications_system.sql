-- Notifications System Migration
-- Creates tables for in-app notifications, broadcasts, and templates

-- Create notification type enum if not exists
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create notification target type enum if not exists  
DO $$ BEGIN
  CREATE TYPE notification_target_type AS ENUM ('all', 'customer', 'staff', 'admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create notification priority enum if not exists
DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create notification channel enum if not exists
DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'sms', 'push');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main notifications table (for individual user notifications)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type notification_type DEFAULT 'info',
  target_type notification_target_type DEFAULT 'user',
  channel notification_channel DEFAULT 'in_app',
  priority notification_priority DEFAULT 'normal',
  
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  data JSONB DEFAULT '{}',
  actions JSONB DEFAULT '[]', -- [{label, url, style}]
  
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Broadcasts table (notifications sent to multiple users)
CREATE TABLE IF NOT EXISTS notification_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type notification_type DEFAULT 'info',
  target_type notification_target_type DEFAULT 'all',
  priority notification_priority DEFAULT 'normal',
  
  target_user_ids UUID[] DEFAULT '{}', -- Empty means all users of target_type
  actions JSONB DEFAULT '[]',
  
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  
  delivery_count INT DEFAULT 0,
  read_count INT DEFAULT 0,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notification templates
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type notification_type DEFAULT 'info',
  target_type notification_target_type DEFAULT 'all',
  priority notification_priority DEFAULT 'normal',
  
  actions JSONB DEFAULT '[]',
  variables TEXT[] DEFAULT '{}', -- Template variables like {{name}}, {{orderId}}
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for) WHERE scheduled_for IS NOT NULL AND sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_broadcasts_target_type ON notification_broadcasts(target_type);
CREATE INDEX IF NOT EXISTS idx_broadcasts_created_at ON notification_broadcasts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled ON notification_broadcasts(scheduled_for) WHERE scheduled_for IS NOT NULL AND sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_templates_is_active ON notification_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_name ON notification_templates(name);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
DO $$ BEGIN
  DROP POLICY IF EXISTS notifications_user_select ON notifications;
  CREATE POLICY notifications_user_select ON notifications
    FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS notifications_user_update ON notifications;
  CREATE POLICY notifications_user_update ON notifications
    FOR UPDATE USING (user_id = auth.uid());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS notifications_admin_all ON notifications;
  CREATE POLICY notifications_admin_all ON notifications
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin')
      )
    );
END $$;

-- RLS Policies for broadcasts (staff/admin can view, admin can manage)
DO $$ BEGIN
  DROP POLICY IF EXISTS broadcasts_staff_select ON notification_broadcasts;
  CREATE POLICY broadcasts_staff_select ON notification_broadcasts
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name IN ('staff', 'admin', 'super_admin')
      )
    );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS broadcasts_admin_all ON notification_broadcasts;
  CREATE POLICY broadcasts_admin_all ON notification_broadcasts
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin')
      )
    );
END $$;

-- RLS Policies for templates (admin only)
DO $$ BEGIN
  DROP POLICY IF EXISTS templates_admin_all ON notification_templates;
  CREATE POLICY templates_admin_all ON notification_templates
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin')
      )
    );
END $$;

-- Trigger for updated_at on templates
CREATE OR REPLACE FUNCTION update_notification_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notification_templates_updated_at ON notification_templates;
CREATE TRIGGER trigger_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_templates_updated_at();

-- Comments
COMMENT ON TABLE notifications IS 'Individual user notifications (in-app)';
COMMENT ON TABLE notification_broadcasts IS 'Broadcast notifications sent to multiple users';
COMMENT ON TABLE notification_templates IS 'Reusable notification templates';
