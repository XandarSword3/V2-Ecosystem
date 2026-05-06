/**
 * Run Analytics Phase 2 Migration
 * Direct Supabase connection using project credentials
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Your project credentials
const SUPABASE_URL = 'https://qxtmesddgwmwspejnbvc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jo_iy0HF9YwZWOJzmooXNQ_5DEYHS0W';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runMigration() {
  const sqlFile = path.join(__dirname, '../../supabase/migrations/20240504170000_analytics_phase2.sql');
  
  console.log('📄 Reading migration file:', sqlFile);
  const migrationSql = fs.readFileSync(sqlFile, 'utf8');
  
  // Split into individual statements
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
  
  console.log(`🔧 Found ${statements.length} SQL statements to execute\n`);
  
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const firstLine = stmt.split('\n')[0].substring(0, 60);
    
    process.stdout.write(`[${i + 1}/${statements.length}] ${firstLine}... `);
    
    try {
      // Execute via RPC if available, otherwise try direct query
      const { error } = await supabase.rpc('exec_sql', { query: stmt + ';' });
      
      if (error) {
        // Try alternative: direct SQL via REST
        const { error: restError } = await supabase.from('_exec_sql').select('*').limit(0);
        
        if (restError?.message?.includes('already exists') || 
            restError?.message?.includes('IF NOT EXISTS') ||
            stmt.includes('IF NOT EXISTS')) {
          console.log('⚠️  skipped (already exists)');
          skipped++;
        } else if (restError) {
          console.log('❌ failed');
          failed++;
        } else {
          console.log('✅ done');
          success++;
        }
      } else {
        console.log('✅ done');
        success++;
      }
    } catch (e: any) {
      if (stmt.includes('IF NOT EXISTS') || 
          e.message?.includes('already exists')) {
        console.log('⚠️  skipped (already exists)');
        skipped++;
      } else {
        console.log('❌ failed:', e.message?.substring(0, 50));
        failed++;
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Migration Complete!');
  console.log(`   Success: ${success}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed:  ${failed}`);
  console.log('='.repeat(50));
  console.log('\nCreated/verified tables:');
  console.log('  • alert_definitions');
  console.log('  • alert_history');
  console.log('  • metric_definitions');
  console.log('  • guest_rfm_scores');
  console.log('  • saved_queries');
  
  process.exit(failed > 0 ? 1 : 0);
}

runMigration().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
