-- Enhanced Housekeeping System Migration
-- State machine: pending → assigned → in_progress → completed → pending_inspection → inspected/rework_needed

-- Add missing columns to housekeeping_tasks if they don't exist
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS booking_id UUID;
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS task_type VARCHAR(50);
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS sla_due TIMESTAMPTZ;
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20);
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS inspection_id UUID;
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS inspection_passed BOOLEAN;
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES housekeeping_tasks(id);
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS override_reason TEXT;
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS overridden_by UUID REFERENCES users(id);
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS overridden_at TIMESTAMPTZ;
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS photo_urls TEXT[];
ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS issues_found TEXT;

-- Add cleaning_status and block fields to chalets if they don't exist
ALTER TABLE chalets ADD COLUMN IF NOT EXISTS cleaning_status VARCHAR(30) DEFAULT 'clean';
ALTER TABLE chalets ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE chalets ADD COLUMN IF NOT EXISTS block_reason TEXT;
ALTER TABLE chalets ADD COLUMN IF NOT EXISTS blocked_until DATE;
ALTER TABLE chalets ADD COLUMN IF NOT EXISTS last_cleaned TIMESTAMPTZ;
ALTER TABLE chalets ADD COLUMN IF NOT EXISTS last_inspected TIMESTAMPTZ;

-- SLA Configuration table
CREATE TABLE IF NOT EXISTS housekeeping_sla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type VARCHAR(50) NOT NULL UNIQUE,
  target_minutes INTEGER NOT NULL,
  warning_minutes INTEGER,
  critical_minutes INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default SLA configs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'housekeeping_sla' AND column_name = 'target_minutes'
  ) THEN
    INSERT INTO housekeeping_sla (task_type, target_minutes, warning_minutes, critical_minutes) VALUES
      ('standard_cleaning', 45, 35, 50),
      ('deep_cleaning', 120, 90, 150),
      ('turnover', 60, 45, 75),
      ('inspection', 15, 10, 20),
      ('maintenance', 90, 60, 120)
    ON CONFLICT DO NOTHING;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'housekeeping_sla' AND column_name = 'max_duration_minutes'
  ) THEN
    INSERT INTO housekeeping_sla (task_type, priority, max_duration_minutes, warning_threshold_minutes, escalation_after_minutes) VALUES
      ('standard_cleaning', 'normal', 45, 35, 50),
      ('deep_cleaning', 'high', 120, 90, 150),
      ('turnover', 'high', 60, 45, 75),
      ('inspection', 'normal', 15, 10, 20),
      ('maintenance', 'normal', 90, 60, 120)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Inspections table
CREATE TABLE IF NOT EXISTS housekeeping_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES housekeeping_tasks(id) ON DELETE CASCADE,
  chalet_id UUID NOT NULL REFERENCES chalets(id),
  inspector_id UUID REFERENCES users(id),
  checklist_items JSONB,
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  passed BOOLEAN NOT NULL,
  notes TEXT,
  photo_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Housekeeping supplies configuration (links task types to inventory items)
CREATE TABLE IF NOT EXISTS housekeeping_supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type VARCHAR(50) NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_per_task DECIMAL(10, 3) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_type, inventory_item_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_booking ON housekeeping_tasks(booking_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sla ON housekeeping_tasks(sla_due) WHERE sla_due IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON housekeeping_tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chalets_cleaning_status ON chalets(cleaning_status);
CREATE INDEX IF NOT EXISTS idx_inspections_task ON housekeeping_inspections(task_id);
CREATE INDEX IF NOT EXISTS idx_inspections_chalet ON housekeeping_inspections(chalet_id);
CREATE INDEX IF NOT EXISTS idx_supplies_task_type ON housekeeping_supplies(task_type);

-- Function to check if chalet can accept check-in
DROP FUNCTION IF EXISTS can_check_in(UUID);
CREATE OR REPLACE FUNCTION can_check_in(p_chalet_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_chalet RECORD;
  v_pending_tasks INTEGER;
BEGIN
  -- Get chalet status
  SELECT cleaning_status, is_blocked INTO v_chalet
  FROM chalets WHERE id = p_chalet_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if blocked
  IF v_chalet.is_blocked THEN
    RETURN FALSE;
  END IF;
  
  -- Check if clean
  IF v_chalet.cleaning_status != 'clean' THEN
    RETURN FALSE;
  END IF;
  
  -- Check for pending tasks that would prevent check-in
  SELECT COUNT(*) INTO v_pending_tasks
  FROM housekeeping_tasks
  WHERE chalet_id = p_chalet_id
    AND status IN ('pending', 'assigned', 'in_progress', 'rework_needed')
    AND task_type IN ('turnover', 'deep_cleaning');
  
  RETURN v_pending_tasks = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-trigger housekeeping on checkout (can be called by booking service)
CREATE OR REPLACE FUNCTION trigger_checkout_housekeeping()
RETURNS TRIGGER AS $$
DECLARE
  v_new_status TEXT;
  v_old_status TEXT;
  v_chalet_id UUID;
  v_booking_id UUID;
BEGIN
  v_new_status := COALESCE(to_jsonb(NEW)->>'status', '');
  v_old_status := COALESCE(to_jsonb(OLD)->>'status', '');
  v_chalet_id := COALESCE(
    NULLIF(to_jsonb(NEW)->>'unit_id', '')::UUID,
    NULLIF(to_jsonb(NEW)->>'chalet_id', '')::UUID
  );
  v_booking_id := NULLIF(to_jsonb(NEW)->>'id', '')::UUID;

  -- Only trigger when booking status changes to 'checked_out'
  IF v_new_status = 'checked_out' AND v_old_status IS DISTINCT FROM 'checked_out' AND v_chalet_id IS NOT NULL THEN
    -- Update chalet status to dirty
    UPDATE chalets 
    SET cleaning_status = 'dirty', updated_at = NOW()
    WHERE id = v_chalet_id;
    
    -- Create turnover task
    INSERT INTO housekeeping_tasks (
      chalet_id, task_type, priority, status, 
      notes, booking_id, created_at
    ) VALUES (
      v_chalet_id, 'turnover', 'high', 'pending',
      'Auto-generated from checkout', v_booking_id, NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-housekeeping on checkout
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookings'
  ) THEN
    DROP TRIGGER IF EXISTS booking_checkout_housekeeping ON bookings;
    CREATE TRIGGER booking_checkout_housekeeping
      AFTER UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION trigger_checkout_housekeeping();
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chalet_bookings'
  ) THEN
    DROP TRIGGER IF EXISTS booking_checkout_housekeeping ON chalet_bookings;
    CREATE TRIGGER booking_checkout_housekeeping
      AFTER UPDATE ON chalet_bookings
      FOR EACH ROW
      EXECUTE FUNCTION trigger_checkout_housekeeping();
  END IF;
END $$;

-- Row Level Security
ALTER TABLE housekeeping_sla ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_supplies ENABLE ROW LEVEL SECURITY;

-- Read policies
CREATE POLICY housekeeping_sla_read ON housekeeping_sla FOR SELECT TO authenticated USING (true);
CREATE POLICY housekeeping_inspections_read ON housekeeping_inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY housekeeping_supplies_read ON housekeeping_supplies FOR SELECT TO authenticated USING (true);

-- Modify policies for admin/staff
CREATE POLICY housekeeping_sla_modify ON housekeeping_sla FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'super_admin')
    )
  );
CREATE POLICY housekeeping_inspections_modify ON housekeeping_inspections FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'super_admin')
    )
  );
CREATE POLICY housekeeping_supplies_modify ON housekeeping_supplies FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'super_admin')
    )
  );
