import { getSupabase } from './backend/src/database/connection.js';

async function main() {
    const supabase = getSupabase();

    console.log('--- loyalty_members ---');
    const { data: members } = await supabase.from('loyalty_members').select('*');
    console.log(JSON.stringify(members, null, 2));

    console.log('--- loyalty_transactions ---');
    const { data: transactions } = await supabase.from('loyalty_transactions').select('*').order('created_at', { ascending: false }).limit(10);
    console.log(JSON.stringify(transactions, null, 2));
}

main();
