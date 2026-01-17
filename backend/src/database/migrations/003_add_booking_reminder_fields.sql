-- Migration: Add reminder fields to chalet_bookings table
-- Date: 2026-01-15
-- Description: Add reminder_sent and reminder_sent_at fields for pre-arrival email reminders

-- Add reminder_sent boolean field (defaults to false)
ALTER TABLE chalet_bookings 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;

-- Add reminder_sent_at timestamp field
ALTER TABLE chalet_bookings 
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient querying of bookings needing reminders
CREATE INDEX IF NOT EXISTS idx_chalet_bookings_reminder 
ON chalet_bookings (check_in_date, status, reminder_sent)
WHERE status = 'confirmed' AND (reminder_sent IS NULL OR reminder_sent = FALSE);
