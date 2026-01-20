-- Migration: Add photo storage and checkout tracking to housekeeping
-- Enables photo evidence system and automatic checkout task generation

-- Add completion_photos column to housekeeping_tasks
ALTER TABLE housekeeping_tasks
ADD COLUMN IF NOT EXISTS completion_photos JSONB DEFAULT '[]'::jsonb;

-- Add before_photos column for before/after comparison
ALTER TABLE housekeeping_tasks
ADD COLUMN IF NOT EXISTS before_photos JSONB DEFAULT '[]'::jsonb;

-- Add booking reference for checkout tasks
ALTER TABLE housekeeping_tasks
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES chalet_bookings(id) ON DELETE SET NULL;

-- Add inspection fields
ALTER TABLE housekeeping_tasks
ADD COLUMN IF NOT EXISTS inspected_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE housekeeping_tasks
ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMPTZ;

ALTER TABLE housekeeping_tasks
ADD COLUMN IF NOT EXISTS inspection_notes TEXT;

ALTER TABLE housekeeping_tasks
ADD COLUMN IF NOT EXISTS quality_score INT CHECK (quality_score >= 1 AND quality_score <= 5);

-- Create index for booking lookups
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_booking_id ON housekeeping_tasks(booking_id);

-- Create index for inspections
CREATE INDEX IF NOT EXISTS idx_housekeeping_tasks_inspected_at ON housekeeping_tasks(inspected_at) WHERE inspected_at IS NOT NULL;

-- Add checkout task type if not exists
INSERT INTO housekeeping_task_types (name, estimated_duration, is_active, checklist)
SELECT 'Checkout Deep Clean', 60, true, 
  '[
    {"item": "Strip and remake beds", "required": true},
    {"item": "Clean all bathroom surfaces", "required": true},
    {"item": "Vacuum/mop all floors", "required": true},
    {"item": "Empty all trash bins", "required": true},
    {"item": "Wipe down all surfaces", "required": true},
    {"item": "Restock toiletries", "required": true},
    {"item": "Check for damage/lost items", "required": true},
    {"item": "Clean kitchen/kitchenette", "required": false},
    {"item": "Clean windows if needed", "required": false},
    {"item": "Final walkthrough inspection", "required": true}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM housekeeping_task_types WHERE name = 'Checkout Deep Clean'
);

COMMENT ON COLUMN housekeeping_tasks.completion_photos IS 'Array of photo URLs taken after task completion';
COMMENT ON COLUMN housekeeping_tasks.before_photos IS 'Array of photo URLs taken before starting the task';
COMMENT ON COLUMN housekeeping_tasks.booking_id IS 'Reference to chalet booking if this is a checkout task';
COMMENT ON COLUMN housekeeping_tasks.quality_score IS 'Quality rating 1-5 given during inspection';
