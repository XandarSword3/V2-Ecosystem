-- Fix module creation failures: missing show_in_main column and NOT NULL template_type
-- engine_type is the canonical field; template_type is deprecated legacy compat only.

ALTER TABLE modules ADD COLUMN IF NOT EXISTS show_in_main BOOLEAN DEFAULT true;

ALTER TABLE modules ALTER COLUMN template_type DROP NOT NULL;

-- ongoing_entitlement modules need a legacy enum value when template_type is populated
DO $$ BEGIN
  ALTER TYPE module_template_type ADD VALUE IF NOT EXISTS 'subscription';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
