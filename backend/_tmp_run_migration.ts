import 'dotenv/config';
import { getSupabase } from './src/database/connection.js';

async function main() {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('migrate_menu_modifiers_to_unified');
  if (error) {
    console.error('MIGRATE_ERROR', JSON.stringify(error));
    process.exit(1);
  }
  console.log('MIGRATE_RESULT', JSON.stringify(data));
}

main();
