
import { getSupabase } from './src/database/connection';

async function inspect() {
    const supabase = getSupabase();
    console.log('Fetching one module...');
    const { data, error } = await supabase.from('modules').select('*').limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Module Data:', data);
        if (data && data.length > 0) {
            console.log('Keys:', Object.keys(data[0]));
        }
    }
    process.exit(0);
}

inspect();
