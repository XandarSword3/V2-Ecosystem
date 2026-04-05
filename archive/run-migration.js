const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://dfneswicpdprhneeqlsn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbmVzd2ljcGRwcmhuZWVxbHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA5NDIzNSwiZXhwIjoyMDgyNjcwMjM1fQ.N1pHUMHaQWDevK1CIG6pN8re5Qr2cX5jfJSoE9UoHP8'
);

async function runMigrationSteps() {
  console.log('Running migration in steps via Supabase...\n');
  
  // We'll use direct table operations since RPC might not be available
  // First, let's check what we can do
  
  // Step 1: Test if we can read from the table
  const { data: existing, error: readErr } = await supabase
    .from('menu_modifier_options')
    .select('id, name')
    .limit(5);
  
  if (readErr) {
    console.log('Read error:', readErr.message);
    return;
  }
  
  console.log('Current modifier options:', existing?.length || 0, 'found');
  
  // Since we can't run DDL via REST API, let's output the SQL to run manually
  console.log('\n' + '='.repeat(60));
  console.log('MANUAL MIGRATION REQUIRED');
  console.log('='.repeat(60));
  console.log('\nPlease run the following SQL in Supabase Dashboard:');
  console.log('https://supabase.com/dashboard/project/dfneswicpdprhneeqlsn/sql\n');
  
  const sql = `
-- Add modifier type and inventory linking to menu_modifier_options
ALTER TABLE menu_modifier_options 
  ADD COLUMN IF NOT EXISTS modifier_type TEXT DEFAULT 'add',
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity_required DECIMAL(10,3) DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS max_quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Add constraint for modifier_type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_modifier_type') THEN
    ALTER TABLE menu_modifier_options 
      ADD CONSTRAINT chk_modifier_type CHECK (modifier_type IN ('add', 'remove', 'swap'));
  END IF;
END$$;

-- Add translations to modifier groups  
ALTER TABLE menu_modifier_groups
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_fr TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS allow_multiple_same BOOLEAN DEFAULT false;

-- Add modifier columns to restaurant_order_items
ALTER TABLE restaurant_order_items 
  ADD COLUMN IF NOT EXISTS selected_modifiers JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS modifier_total DECIMAL(10,2) DEFAULT 0;

-- Add modifiers_total to restaurant_orders
ALTER TABLE restaurant_orders 
  ADD COLUMN IF NOT EXISTS modifiers_total DECIMAL(10,2) DEFAULT 0;

-- Add modifier columns to snack_bar_orders if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'snack_bar_orders') THEN
    ALTER TABLE snack_bar_orders 
      ADD COLUMN IF NOT EXISTS modifiers_total DECIMAL(10,2) DEFAULT 0;
  END IF;
END$$;

-- Create snack_bar_item_modifiers table if not exists
CREATE TABLE IF NOT EXISTS snack_bar_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES snack_bar_items(id) ON DELETE CASCADE,
  modifier_group_id UUID NOT NULL REFERENCES menu_modifier_groups(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, modifier_group_id)
);

-- Enable RLS on new table
ALTER TABLE snack_bar_item_modifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "snack_modifiers_all" ON snack_bar_item_modifiers FOR ALL USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_modifier_options_group ON menu_modifier_options(modifier_group_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_modifier_options_inventory ON menu_modifier_options(inventory_item_id) WHERE inventory_item_id IS NOT NULL;

SELECT 'Migration complete!' as status;
`;

  console.log(sql);
  console.log('\n' + '='.repeat(60));
}

runMigrationSteps().catch(e => console.error('Error:', e.message));
