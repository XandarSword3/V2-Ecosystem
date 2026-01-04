
import fs from 'fs';
import path from 'path';
import { getSupabase } from './connection';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  console.log('Running order migration...');
  
  const supabase = getSupabase();
  const sqlPath = path.join(__dirname, 'add_module_id_to_orders.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // If exec_sql RPC is not available, we might need another way.
    // But usually in this project it seems to be the way.
    // Alternatively, we can try to run it via direct connection if we had pg client, 
    // but here we are using supabase client.
    // If RPC fails, it might be because the function doesn't exist.
    console.error('Migration failed:', error);
    
    // Fallback: Try to run it via raw query if the client supports it (supabase-js doesn't support raw query directly usually unless via RPC)
    // But let's assume the user has the exec_sql function as seen in other files.
  } else {
    console.log('Migration successful!');
  }
}

runMigration();
