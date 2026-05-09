import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkEconomics() {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const { data, error } = await supabase.rpc('get_economics_gross_vs_net', {
    p_from: from,
    p_to: to,
    p_property_id: null,
    p_module_id: null,
    p_engine_type: null
  });
  
  if (error) {
    console.log(`❌ Error: ${error.message}`);
  } else {
    console.log('Economics Data Keys:', Object.keys(data[0] || {}));
    console.log('Economics Data:', data[0]);
  }
}

checkEconomics();
