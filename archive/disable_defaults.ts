
import { getSupabase } from './src/database/connection';

async function disableDefaults() {
    const supabase = getSupabase();
    const defaultSlugs = ['restaurant', 'chalets', 'pool', 'snack'];

    console.log('Disabling default modules:', defaultSlugs);

    // Force refresh or use simple query which might bypass cache issue if client is fresh
    const { data, error } = await supabase
        .from('modules')
        .update({ is_active: false })
        .in('slug', defaultSlugs)
        .select();

    if (error) console.error('Error:', error.message);
    else console.log('Updated modules:', data?.map(m => m.slug));

    process.exit(0);
}

disableDefaults();
