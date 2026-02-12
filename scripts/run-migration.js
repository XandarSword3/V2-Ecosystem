const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  console.error('Copy backend/.env.example to backend/.env and fill in your credentials.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  console.log('Testing connection...');
  
  // Test connection
  const { data: test, error: testErr } = await supabase.from('menu_modifier_options').select('id').limit(1);
  if (testErr) {
    console.error('Connection failed:', testErr.message);
    return;
  }
  console.log('✓ Connected to Supabase');

  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260203100000_menu_modifiers_complete.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  // Split into individual statements (roughly)
  // We need to be careful with functions that contain semicolons
  console.log('\nApplying migration...');
  
  // Execute the SQL directly using the REST API
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ sql })
  });

  if (!response.ok) {
    const text = await response.text();
    console.log('RPC not available, will try alternative approach');
    console.log('Response:', text);
  } else {
    console.log('✓ Migration applied via RPC');
    return;
  }

  // Alternative: Use pg directly if available
  console.log('\nTrying direct pg connection...');
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const client = await pool.connect();
    console.log('✓ Connected via pg');
    
    await client.query(sql);
    console.log('✓ Migration executed successfully!');
    
    client.release();
    await pool.end();
  } catch (pgErr) {
    console.error('pg error:', pgErr.message);
    console.log('\nPlease run the migration manually via Supabase SQL editor:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Paste and run the contents of:');
    console.log('   supabase/migrations/20260203100000_menu_modifiers_complete.sql');
  }
}

runMigration().catch(console.error);
