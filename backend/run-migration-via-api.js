/**
 * Run migration via Supabase client (bypasses blocked ports by using HTTPS)
 * Usage: node run-migration-via-api.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://dfneswicpdprhneeqlsn.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbmVzd2ljcGRwcmhuZWVxbHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA5NDIzNSwiZXhwIjoyMDgyNjcwMjM1fQ.N1pHUMHaQWDevK1CIG6pN8re5Qr2cX5jfJSoE9UoHP8'
);

async function runMigration() {
  console.log('Running migration via Supabase HTTPS API...\n');

  // Step 1: Add columns to menu_modifier_options
  console.log('Step 1: Adding columns to menu_modifier_options...');
  
  // Check if modifier_type column already exists
  const { data: check, error: checkErr } = await supabase
    .from('menu_modifier_options')
    .select('id')
    .limit(1);
  
  if (checkErr) {
    console.error('Cannot access table:', checkErr.message);
    return;
  }

  // Since we can't run ALTER TABLE via REST API, we need to use the sql() function
  // which requires the pg_graphql extension or a custom RPC function
  
  // Let's create a migration RPC function first
  const migrationSQL = `
    -- Add columns if they don't exist
    DO $$ 
    BEGIN
      -- menu_modifier_options columns
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_modifier_options' AND column_name = 'modifier_type') THEN
        ALTER TABLE menu_modifier_options ADD COLUMN modifier_type TEXT DEFAULT 'add';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_modifier_options' AND column_name = 'inventory_item_id') THEN
        ALTER TABLE menu_modifier_options ADD COLUMN inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_modifier_options' AND column_name = 'quantity_required') THEN
        ALTER TABLE menu_modifier_options ADD COLUMN quantity_required DECIMAL(10,3) DEFAULT 1;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_modifier_options' AND column_name = 'unit') THEN
        ALTER TABLE menu_modifier_options ADD COLUMN unit TEXT DEFAULT 'pcs';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_modifier_options' AND column_name = 'description') THEN
        ALTER TABLE menu_modifier_options ADD COLUMN description TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_modifier_options' AND column_name = 'description_ar') THEN
        ALTER TABLE menu_modifier_options ADD COLUMN description_ar TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_modifier_options' AND column_name = 'max_quantity') THEN
        ALTER TABLE menu_modifier_options ADD COLUMN max_quantity INTEGER DEFAULT 1;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_modifier_options' AND column_name = 'is_default') THEN
        ALTER TABLE menu_modifier_options ADD COLUMN is_default BOOLEAN DEFAULT false;
      END IF;

      -- menu_modifier_groups columns
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_modifier_groups' AND column_name = 'name_ar') THEN
        ALTER TABLE menu_modifier_groups ADD COLUMN name_ar TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_modifier_groups' AND column_name = 'name_fr') THEN
        ALTER TABLE menu_modifier_groups ADD COLUMN name_fr TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_modifier_groups' AND column_name = 'description') THEN
        ALTER TABLE menu_modifier_groups ADD COLUMN description TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_modifier_groups' AND column_name = 'allow_multiple_same') THEN
        ALTER TABLE menu_modifier_groups ADD COLUMN allow_multiple_same BOOLEAN DEFAULT false;
      END IF;

      -- restaurant_order_items columns
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_order_items' AND column_name = 'selected_modifiers') THEN
        ALTER TABLE restaurant_order_items ADD COLUMN selected_modifiers JSONB DEFAULT '[]';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_order_items' AND column_name = 'modifier_total') THEN
        ALTER TABLE restaurant_order_items ADD COLUMN modifier_total DECIMAL(10,2) DEFAULT 0;
      END IF;

      -- restaurant_orders columns
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_orders' AND column_name = 'modifiers_total') THEN
        ALTER TABLE restaurant_orders ADD COLUMN modifiers_total DECIMAL(10,2) DEFAULT 0;
      END IF;
    END $$;
  `;

  // Try calling via RPC if a function exists, otherwise output instructions
  const { data: rpcResult, error: rpcError } = await supabase.rpc('run_sql', { sql: migrationSQL });
  
  if (rpcError && rpcError.message.includes('function') && rpcError.message.includes('does not exist')) {
    console.log('\n⚠️  No run_sql RPC function available.');
    console.log('The migration SQL needs to be run via Supabase Dashboard.');
    console.log('\nYour network is blocking PostgreSQL ports (5432, 6543).');
    console.log('HTTPS port 443 works, so the backend can connect via REST API,');
    console.log('but DDL commands (ALTER TABLE) require direct database access.\n');
    
    console.log('Options:');
    console.log('1. Use a different network (mobile hotspot, VPN, etc.)');
    console.log('2. Run migration via Supabase Dashboard SQL Editor');
    console.log('3. Have someone with network access run: supabase db push --yes\n');
    
    // Output the SQL for manual execution
    console.log('='.repeat(60));
    console.log('SQL TO RUN MANUALLY:');
    console.log('='.repeat(60));
    console.log(fs.readFileSync(path.join(__dirname, '../MIGRATION_TO_RUN.sql'), 'utf8'));
  } else if (rpcError) {
    console.error('RPC Error:', rpcError.message);
  } else {
    console.log('✓ Migration completed via RPC!');
  }
}

runMigration().catch(console.error);
