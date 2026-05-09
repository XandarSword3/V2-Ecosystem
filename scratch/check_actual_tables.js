import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
  const { data, error } = await supabase.rpc('get_tables_list'); // If this RPC exists
  
  if (error) {
    // Try querying pg_tables
    const { data: tables, error: tErr } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public');
    if (tErr) {
      // Last resort: query common tables
      const common = ['orders', 'bookings', 'tickets', 'pool_tickets', 'restaurant_orders', 'chalet_bookings'];
      const results = {};
      for (const t of common) {
        const { error: e } = await supabase.from(t).select('id').limit(1);
        results[t] = e ? `Error: ${e.message}` : 'Exists';
      }
      console.log('Table checks:', results);
    } else {
      console.log('Public tables:', tables.map(t => t.tablename));
    }
  } else {
    console.log('Tables:', data);
  }
}

checkTables();
