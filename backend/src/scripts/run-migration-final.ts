import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_KEY is not defined in .env');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

async function runMigration() {
  const sqlPath = path.join(__dirname, '../../../supabase/migrations/20260117170000_order_discounts_integration.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ SQL file not found at ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('🔌 Attempting to run SQL via Supabase REST API...');
  console.log(`   Project: ${projectRef}`);
  
  // Supabase has an undocumented endpoint for running SQL directly
  // It's at: POST /pg/query with the service role key
  const queryUrl = `${supabaseUrl}/rest/v1/rpc/exec_sql`;
  
  try {
    // First, let's try the rpc approach
    const response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey || '',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ sql_query: sql }),
    });

    if (response.ok) {
      console.log('✅ Migration executed successfully via RPC!');
      return;
    }

    const errorText = await response.text();
    console.log(`RPC exec_sql not available: ${response.status} - ${errorText}`);
  } catch (err: any) {
    console.log(`RPC approach failed: ${err.message}`);
  }

  // Alternative: Use the Supabase Management API
  // This requires a personal access token, not the service key
  console.log('\n⚠️  The migration requires direct SQL execution which is not supported via REST API.');
  console.log('\n📋 Please run the migration SQL in one of these ways:\n');
  console.log('Option 1: Supabase Dashboard SQL Editor');
  console.log(`   1. Go to: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log(`   2. Copy contents of: ${sqlPath}`);
  console.log('   3. Paste and click "Run"\n');
  
  console.log('Option 2: Supabase CLI (if linked)');
  console.log('   npx supabase db push\n');
  
  console.log('Option 3: Copy to clipboard and paste manually:');
  console.log(`   PowerShell: Get-Content "${sqlPath}" | Set-Clipboard\n`);
  
  // Output the SQL for easy copy
  console.log('=' .repeat(60));
  console.log('MIGRATION SQL (copy everything below):');
  console.log('=' .repeat(60));
  console.log(sql);
  console.log('=' .repeat(60));
}

runMigration().catch(console.error);
