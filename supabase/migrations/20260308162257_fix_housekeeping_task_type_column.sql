-- Add denormalized task_type text column to housekeeping_tasks for advanced controller compatibility
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS task_type TEXT;

-- Backfill from task_types table
UPDATE housekeeping_tasks ht
SET task_type = htt.name
FROM housekeeping_task_types htt
WHERE ht.task_type_id = htt.id
  AND ht.task_type IS NULL;

-- Add the advanced task types if they don't exist
INSERT INTO housekeeping_task_types (name, description, estimated_duration, checklist)
VALUES
  ('standard_cleaning', 'Standard room cleaning', 45, '["Vacuum","Dust surfaces","Clean bathroom","Change linens","Restock amenities"]'::jsonb),
  ('deep_cleaning', 'Deep cleaning with extra attention', 120, '["Vacuum","Dust all surfaces","Clean bathroom thoroughly","Change all linens","Restock amenities","Clean windows","Move furniture and clean behind","Sanitize high-touch surfaces"]'::jsonb),
  ('turnover', 'Checkout turnover cleaning', 90, '["Strip all linens","Deep clean bathroom","Vacuum and mop","Restock all amenities","Inspect for damage","Final walkthrough"]'::jsonb),
  ('inspection', 'Room quality inspection', 30, '["Check cleanliness","Verify amenities stocked","Test fixtures","Check for maintenance issues","Verify safety equipment"]'::jsonb),
  ('maintenance', 'General maintenance task', 60, '["Assess issue","Perform repair","Test functionality","Clean up work area","Document work done"]'::jsonb)
ON CONFLICT DO NOTHING;
