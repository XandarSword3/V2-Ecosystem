import { createClient } from '@supabase/supabase-js';
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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration() {
  console.log('🔌 Using Supabase service role client...');

  const sqlPath = path.join(__dirname, '../../../supabase/migrations/20260117170000_order_discounts_integration.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ SQL file not found at ${sqlPath}`);
    process.exit(1);
  }

  const fullSql = fs.readFileSync(sqlPath, 'utf8');
  
  // Split into logical blocks by CREATE OR REPLACE FUNCTION, ALTER TABLE, CREATE TABLE, etc.
  // We'll try to run smaller chunks
  const blocks: string[] = [];
  
  // First, handle ALTER TABLE statements
  const alterTableRegex = /ALTER TABLE[^;]+;/gi;
  const alterMatches = fullSql.match(alterTableRegex) || [];
  blocks.push(...alterMatches);
  
  // Handle CREATE TABLE statements
  const createTableRegex = /CREATE TABLE IF NOT EXISTS[^;]+;/gi;
  const createTableMatches = fullSql.match(createTableRegex) || [];
  blocks.push(...createTableMatches);
  
  // Handle CREATE INDEX statements
  const createIndexRegex = /CREATE INDEX IF NOT EXISTS[^;]+;/gi;
  const createIndexMatches = fullSql.match(createIndexRegex) || [];
  blocks.push(...createIndexMatches);
  
  // Handle CREATE OR REPLACE FUNCTION statements (these are multiline with $$)
  const functionRegex = /CREATE OR REPLACE FUNCTION[\s\S]*?\$\$;/gi;
  const functionMatches = fullSql.match(functionRegex) || [];
  blocks.push(...functionMatches);
  
  // Handle GRANT statements
  const grantRegex = /GRANT[^;]+;/gi;
  const grantMatches = fullSql.match(grantRegex) || [];
  blocks.push(...grantMatches);
  
  // Handle RLS statements
  const rlsRegex = /ALTER TABLE [^ ]+ ENABLE ROW LEVEL SECURITY;/gi;
  const rlsMatches = fullSql.match(rlsRegex) || [];
  blocks.push(...rlsMatches);
  
  // Handle CREATE POLICY statements
  const policyRegex = /CREATE POLICY[^;]+;/gi;
  const policyMatches = fullSql.match(policyRegex) || [];
  blocks.push(...policyMatches);

  console.log(`📝 Found ${blocks.length} SQL blocks to execute...`);

  // Since we can't run arbitrary SQL via PostgREST, we need a workaround
  // Let's check if there's an exec_sql RPC function or create one
  
  // First, test if we can create a simple table
  const { error: testError } = await supabase
    .from('_migration_test')
    .select('*')
    .limit(1);
  
  if (testError && testError.code === 'PGRST116') {
    // Table doesn't exist - that's fine
    console.log('Testing Supabase connection... OK');
  } else if (testError) {
    console.log('Testing Supabase connection...', testError.message);
  } else {
    console.log('Testing Supabase connection... OK');
  }

  // Since PostgREST doesn't support raw SQL execution, we need to use the SQL Editor approach
  // Let's try creating a temporary function that can execute SQL
  
  // Actually, let's try the database webhook/function approach
  // Or use the fact that we can call RPC functions
  
  console.log('\n⚠️  Supabase PostgREST API does not support raw SQL execution.');
  console.log('   The migration SQL needs to be run directly in the Supabase SQL Editor.');
  console.log('\n📋 SQL has been saved to: supabase/migrations/20260117170000_order_discounts_integration.sql');
  console.log('\n🔗 Steps to run manually:');
  console.log('   1. Go to https://supabase.com/dashboard/project/dfneswicpdprhneeqlsn/sql');
  console.log('   2. Copy the contents of the migration file');
  console.log('   3. Paste and run in the SQL Editor');
  console.log('\n📄 Or run this PowerShell command to copy to clipboard:');
  console.log(`   Get-Content "${sqlPath}" | Set-Clipboard`);
}

runMigration().catch(console.error);
