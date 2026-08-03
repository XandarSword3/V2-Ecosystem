-- Migration: Add property_id to notifications, notification_broadcasts, and notification_templates for multi-tenant isolation
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_property_id ON notifications(property_id);

ALTER TABLE notification_broadcasts ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notification_broadcasts_property_id ON notification_broadcasts(property_id);

ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_notification_templates_property_id ON notification_templates(property_id);
