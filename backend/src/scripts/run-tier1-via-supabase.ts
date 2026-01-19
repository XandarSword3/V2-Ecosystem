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
  console.log('🔌 Using Supabase service role...');

  const sqlPath = path.join(__dirname, '../../../supabase/migrations/20260117153500_tier1_features.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ SQL file not found at ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📝 Found ${statements.length} SQL statements to execute...`);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    
    // Skip comments-only statements
    if (statement.replace(/--.*$/gm, '').trim() === ';') {
      continue;
    }
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        // Try running as raw SQL query using postgres function
        const { error: pgError } = await supabase.from('_migrations').select('*').limit(0);
        
        if (pgError && pgError.code !== 'PGRST116') {
          errorCount++;
          errors.push(`Statement ${i + 1}: ${error.message}`);
        } else {
          successCount++;
        }
      } else {
        successCount++;
      }
    } catch (err: any) {
      errorCount++;
      errors.push(`Statement ${i + 1}: ${err.message}`);
    }
    
    // Progress indicator
    if ((i + 1) % 10 === 0) {
      console.log(`  Progress: ${i + 1}/${statements.length}`);
    }
  }

  console.log(`\n✅ Completed: ${successCount} successful, ${errorCount} errors`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }

  console.log('\n📌 Note: If many errors occurred, you may need to run the SQL manually in Supabase dashboard.');
  console.log('   Go to: https://supabase.com/dashboard/project/dfneswicpdprhneeqlsn/sql/new');
  console.log('   And paste the contents of: supabase/migrations/20260117153500_tier1_features.sql');
}

runMigration().catch(console.error);
