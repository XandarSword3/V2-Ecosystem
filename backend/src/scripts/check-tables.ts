import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function check() {
  console.log('Checking tables...');
  
  const tables = ['modules', 'email_templates', 'reviews', 'site_settings'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('count').limit(1);
    if (error) {
      console.log(`❌ Table '${table}' error: ${error.message}`);
    } else {
      console.log(`✅ Table '${table}' exists`);
    }
  }
}

check();
