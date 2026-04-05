import { getSupabase } from './backend/src/database/connection.js';

async function main() {
    const supabase = getSupabase();
    const { error } = await supabase.rpc('execute_sql', {
        sql_query: 'ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);'
    });

    if (error) {
        if (error.message.includes('permission denied')) {
            console.log('Permission denied for execute_sql. Trying alternative...');
            // If execute_sql is not available, try to at least confirm if it is missing
            const { error: checkError } = await supabase.from('loyalty_transactions').select('created_by').limit(1);
            if (checkError) {
                console.error('Column created_by is DEFINITELY missing:', checkError.message);
            } else {
                console.log('Column created_by seems to ALREADY exist.');
            }
        } else {
            console.error('Error adding column:', error.message);
        }
    } else {
        console.log('Successfully added column created_by.');
    }
}

main();
