-- Migration: Add device tokens table for mobile push notifications
-- This table stores FCM (Android) and APNS (iOS) device tokens for push notifications

-- Create enum for device platform
DO $$ BEGIN
  CREATE TYPE device_platform AS ENUM ('ios', 'android', 'web');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create device_tokens table
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Device identification
  device_token TEXT NOT NULL,
  platform device_platform NOT NULL,
  device_id TEXT, -- Unique device identifier (optional)
  device_name TEXT, -- User-friendly name like "iPhone 15 Pro"
  
  -- App information
  app_version TEXT,
  os_version TEXT,
  
  -- Token status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  
  -- Notification preferences per device
  notifications_enabled BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one token per device per user
  UNIQUE(user_id, device_token)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(device_token);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_device_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_device_tokens_updated_at ON device_tokens;
CREATE TRIGGER trigger_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_device_tokens_updated_at();

-- Create notification_logs table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Target
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  device_token_id UUID REFERENCES device_tokens(id) ON DELETE SET NULL,
  
  -- Notification content
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  
  -- Delivery status
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed
  provider TEXT, -- fcm, apns, web_push
  provider_message_id TEXT, -- ID returned by FCM/APNS
  error_message TEXT,
  
  -- Metadata
  notification_type TEXT, -- order_update, booking_confirmation, promotion, etc.
  reference_type TEXT, -- order, booking, etc.
  reference_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- Create indexes for notification logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);

-- Add RLS policies
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Users can manage their own device tokens
CREATE POLICY device_tokens_user_policy ON device_tokens
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can view all device tokens
CREATE POLICY device_tokens_admin_policy ON device_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- Users can view their own notification logs
CREATE POLICY notification_logs_user_policy ON notification_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all notification logs
CREATE POLICY notification_logs_admin_policy ON notification_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    )
  );

-- Add comment for documentation
COMMENT ON TABLE device_tokens IS 'Stores FCM/APNS device tokens for mobile push notifications';
COMMENT ON TABLE notification_logs IS 'Audit log of all push notifications sent';
