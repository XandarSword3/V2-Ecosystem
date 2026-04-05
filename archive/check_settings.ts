
import { getSupabase } from './src/database/connection';

async function check() {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('site_settings').select('*');
    console.log('Settings:', JSON.stringify(data, null, 2));
    process.exit(0);
}

check();
