-- Missing housekeeping advanced tables

-- SLA Configuration
CREATE TABLE IF NOT EXISTS housekeeping_sla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL UNIQUE,
  target_minutes INTEGER NOT NULL DEFAULT 60,
  warning_minutes INTEGER NOT NULL DEFAULT 45,
  critical_minutes INTEGER NOT NULL DEFAULT 90,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'housekeeping_sla'
  ) THEN
    ALTER TABLE housekeeping_sla ADD COLUMN IF NOT EXISTS target_minutes INTEGER;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'housekeeping_sla' AND column_name = 'max_duration_minutes'
    ) THEN
      UPDATE housekeeping_sla
      SET target_minutes = COALESCE(target_minutes, max_duration_minutes)
      WHERE target_minutes IS NULL;
    END IF;
  END IF;
END $$;

-- Inspections
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chalets'
  ) THEN
    CREATE TABLE IF NOT EXISTS housekeeping_inspections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES housekeeping_tasks(id),
      chalet_id UUID NOT NULL REFERENCES chalets(id),
      inspector_id UUID REFERENCES users(id),
      checklist_items JSONB DEFAULT '[]'::jsonb,
      overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
      passed BOOLEAN DEFAULT false,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  ELSE
    CREATE TABLE IF NOT EXISTS housekeeping_inspections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL REFERENCES housekeeping_tasks(id),
      chalet_id UUID NOT NULL,
      inspector_id UUID REFERENCES users(id),
      checklist_items JSONB DEFAULT '[]'::jsonb,
      overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
      passed BOOLEAN DEFAULT false,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  END IF;
END $$;

-- Supplies per task type (links housekeeping to inventory)
CREATE TABLE IF NOT EXISTS housekeeping_supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  quantity_per_task NUMERIC NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns to housekeeping_tasks if they don't exist
DO $$ BEGIN
  ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS sla_due TIMESTAMPTZ;
  ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS sla_status TEXT;
  ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
  ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS completion_notes TEXT;
  ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS issues_found TEXT;
  ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS photo_urls JSONB;
  ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS inspection_id UUID;
  ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS inspection_passed BOOLEAN;
  ALTER TABLE housekeeping_tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID;
END $$;

-- Add columns to chalets if they don't exist
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chalets'
  ) THEN
    ALTER TABLE chalets ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
    ALTER TABLE chalets ADD COLUMN IF NOT EXISTS block_reason TEXT;
    ALTER TABLE chalets ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ;
    ALTER TABLE chalets ADD COLUMN IF NOT EXISTS last_cleaned TIMESTAMPTZ;
    ALTER TABLE chalets ADD COLUMN IF NOT EXISTS last_inspected TIMESTAMPTZ;
    ALTER TABLE chalets ADD COLUMN IF NOT EXISTS cleaning_status TEXT DEFAULT 'clean';
  END IF;
END $$;

-- Check-in readiness function
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chalets'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION can_check_in(p_chalet_id UUID)
      RETURNS BOOLEAN AS $$
      DECLARE
        v_chalet RECORD;
        v_pending_count INTEGER;
      BEGIN
        SELECT cleaning_status, is_blocked INTO v_chalet
        FROM chalets WHERE id = p_chalet_id;

        IF NOT FOUND THEN RETURN FALSE; END IF;
        IF v_chalet.is_blocked THEN RETURN FALSE; END IF;
        IF v_chalet.cleaning_status != 'clean' THEN RETURN FALSE; END IF;

        SELECT COUNT(*) INTO v_pending_count
        FROM housekeeping_tasks
        WHERE chalet_id = p_chalet_id
          AND status IN ('pending', 'in_progress', 'rework_needed');

        RETURN v_pending_count = 0;
      END;
      $$ LANGUAGE plpgsql;
    $fn$;
  ELSE
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION can_check_in(p_chalet_id UUID)
      RETURNS BOOLEAN AS $$
      BEGIN
        RETURN FALSE;
      END;
      $$ LANGUAGE plpgsql;
    $fn$;
  END IF;
END $do$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hk_inspections_task ON housekeeping_inspections(task_id);
CREATE INDEX IF NOT EXISTS idx_hk_supplies_type ON housekeeping_supplies(task_type);

-- Seed default SLA config
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'housekeeping_sla' AND column_name = 'target_minutes'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'housekeeping_sla' AND column_name = 'warning_minutes'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'housekeeping_sla' AND column_name = 'critical_minutes'
  ) THEN
    INSERT INTO housekeeping_sla (task_type, target_minutes, warning_minutes, critical_minutes) VALUES
      ('standard_cleaning', 45, 35, 60),
      ('deep_cleaning', 120, 90, 180),
      ('turnover', 90, 60, 120),
      ('inspection', 30, 20, 45),
      ('maintenance', 60, 45, 90)
    ON CONFLICT (task_type) DO NOTHING;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'housekeeping_sla' AND column_name = 'max_duration_minutes'
  ) THEN
    INSERT INTO housekeeping_sla (task_type, priority, max_duration_minutes, warning_threshold_minutes, escalation_after_minutes) VALUES
      ('standard_cleaning', 'normal', 45, 35, 60),
      ('deep_cleaning', 'high', 120, 90, 180),
      ('turnover', 'high', 90, 60, 120),
      ('inspection', 'normal', 30, 20, 45),
      ('maintenance', 'normal', 60, 45, 90)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
