-- Add module_id to add-ons table to isolate add-ons per module
-- This fixes the bug where all modules share the same add-ons

BEGIN;

-- First, check which table name exists and add module_id column
DO $$
BEGIN
  -- Check if accommodation_add_ons exists (renamed table)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'accommodation_add_ons') THEN
    -- Add module_id column if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'accommodation_add_ons' AND column_name = 'module_id') THEN
      ALTER TABLE accommodation_add_ons ADD COLUMN module_id UUID REFERENCES modules(id) ON DELETE CASCADE;
      
      -- Create index for performance
      CREATE INDEX IF NOT EXISTS idx_accommodation_add_ons_module_id ON accommodation_add_ons(module_id);
      
      RAISE NOTICE 'Added module_id column to accommodation_add_ons';
    END IF;
    
  -- Check if chalet_add_ons exists (original table name)
  ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chalet_add_ons') THEN
    -- Add module_id column if it doesn't exist
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'chalet_add_ons' AND column_name = 'module_id') THEN
      ALTER TABLE chalet_add_ons ADD COLUMN module_id UUID REFERENCES modules(id) ON DELETE CASCADE;
      
      -- Create index for performance
      CREATE INDEX IF NOT EXISTS idx_chalet_add_ons_module_id ON chalet_add_ons(module_id);
      
      RAISE NOTICE 'Added module_id column to chalet_add_ons';
    END IF;
  ELSE
    RAISE NOTICE 'Neither accommodation_add_ons nor chalet_add_ons table found';
  END IF;
END $$;

-- Set existing add-ons to the original Chalets module if one exists
-- This ensures backwards compatibility
DO $$
DECLARE
  v_chalets_module_id UUID;
BEGIN
  -- Find the original Chalets module (first multi_day_booking module by creation date)
  SELECT id INTO v_chalets_module_id 
  FROM modules 
  WHERE template_type = 'multi_day_booking' 
  ORDER BY created_at ASC 
  LIMIT 1;
  
  IF v_chalets_module_id IS NOT NULL THEN
    -- Update add-ons that don't have a module_id set
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'accommodation_add_ons') THEN
      UPDATE accommodation_add_ons SET module_id = v_chalets_module_id WHERE module_id IS NULL;
      RAISE NOTICE 'Updated existing add-ons to module %', v_chalets_module_id;
    ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chalet_add_ons') THEN
      UPDATE chalet_add_ons SET module_id = v_chalets_module_id WHERE module_id IS NULL;
      RAISE NOTICE 'Updated existing add-ons to module %', v_chalets_module_id;
    END IF;
  ELSE
    RAISE NOTICE 'No multi_day_booking module found to assign add-ons to';
  END IF;
END $$;

COMMIT;
