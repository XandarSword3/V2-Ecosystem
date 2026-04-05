import { getSupabase } from './src/database/connection';

async function main() {
    try {
        const supabase = getSupabase();

        console.log('--- COLUMN CHECK START ---');

        const { data: sampleTx } = await supabase.from('loyalty_transactions').select('*').limit(1);
        console.log('TX_COLUMNS:', JSON.stringify(Object.keys(sampleTx?.[0] || {})));

        const { data: sampleMembers } = await supabase.from('loyalty_members').select('*').limit(1);
        console.log('MEMBER_COLUMNS:', JSON.stringify(Object.keys(sampleMembers?.[0] || {})));

        console.log('--- COLUMN CHECK END ---');

    } catch (err) {
        console.error(err);
    }
}
main();
