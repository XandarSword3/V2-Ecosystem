import { getSupabase } from './src/database/connection';

async function check() {
    const supabase = getSupabase();

    console.log('--- pool_sessions columns ---');
    const { data: poolCols, error: pErr } = await supabase.rpc('get_table_columns', { table_name: 'pool_sessions' });
    if (pErr) console.log('RPC Error (pool):', pErr.message);
    else console.log(poolCols);

    // Manual insert/select test to find columns if RPC fails
    if (pErr) {
        const { error: iErr } = await supabase.from('pool_sessions').select('*').limit(0);
        // Supabase client doesn't give columns on select * limit 0 easily without data.
        // But error message on insert might hint.
    }

    console.log('\n--- menu_categories columns ---');
    const { data: menuCols, error: mErr } = await supabase.rpc('get_table_columns', { table_name: 'menu_categories' });
    if (mErr) console.log('RPC Error (menu):', mErr.message);
    else console.log(menuCols);

    process.exit(0);
}

check();
