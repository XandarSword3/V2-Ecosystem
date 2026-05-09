import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
  console.log('Cleaning up architectural regressions...');
  
  const { error: error1 } = await supabase.rpc('execute_sql', {
    sql_query: `
      DROP VIEW IF EXISTS pool_tickets CASCADE;
      DROP VIEW IF EXISTS chalet_bookings CASCADE;
      DROP VIEW IF EXISTS restaurant_orders CASCADE;
      DROP TABLE IF EXISTS tickets CASCADE;
      DROP TABLE IF EXISTS bookings CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
    `
  });

  if (error1) {
    // If rpc fails, try direct postgres connection via node-postgres if needed
    // But usually we can use a migration
    console.error('RPC failed, creating emergency migration instead...');
  } else {
    console.log('Cleanup successful.');
  }
}

cleanup();
