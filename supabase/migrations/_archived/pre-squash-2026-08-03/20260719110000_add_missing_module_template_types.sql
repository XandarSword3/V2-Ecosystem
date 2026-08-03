-- Add missing enum values to module_template_type
-- These values are referenced in backend code but were never added to the enum
-- They must be added BEFORE 20260719120000_freeze_modules_engine_type.sql runs
-- to avoid PostgreSQL's "unsafe use of new value" error

DO $$ BEGIN
  ALTER TYPE module_template_type ADD VALUE IF NOT EXISTS 'membership_access';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE module_template_type ADD VALUE IF NOT EXISTS 'class_scheduling';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE module_template_type ADD VALUE IF NOT EXISTS 'appointment_booking';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE module_template_type ADD VALUE IF NOT EXISTS 'saas_subscription';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
