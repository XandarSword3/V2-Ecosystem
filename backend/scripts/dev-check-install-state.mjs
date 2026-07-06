import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data, error } = await supabase
  .from('system_config')
  .select('*')
  .eq('key', 'install.machine_id')
  .maybeSingle();

console.log('error:', error?.message ?? null);
console.log('row:', JSON.stringify(data, null, 2));
