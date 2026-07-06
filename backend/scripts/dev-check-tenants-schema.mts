/** DEV-ONLY diagnostic. Standalone, no app imports. */
import { createClient } from '@supabase/supabase-js';
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  const { data, error } = await supabase.from('tenants').select('*').limit(3);
  if (error) {
    console.log('tenants query failed:', error.message);
    return;
  }
  if (!data || data.length === 0) {
    console.log('No rows in tenants.');
    return;
  }
  console.log('Columns:', Object.keys(data[0]).join(', '));
  data.forEach(t => console.log(JSON.stringify(t)));
}
main();
