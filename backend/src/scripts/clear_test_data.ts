import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearData() {
    console.log('🧹 Clearing test data from unified transactions table...');

    // All financial/access events now flow through the unified transactions table
    // Delete records by engine_type instead of querying legacy tables (per ARCHITECTURE_LAW.md)
    const engineTypes = [
        'instant_transaction',      // restaurant, snack bar, retail orders
        'time_exclusive_reservation', // chalets, hotel rooms, courts
        'shared_capacity_access',   // pool, gym, events
        'ongoing_entitlement'       // subscriptions, memberships
    ];

    let totalDeleted = 0;

    for (const engineType of engineTypes) {
        console.log(`Clearing transactions with engine_type: ${engineType}...`);
        const { error, count } = await supabase
            .from('transactions')
            .delete({ count: 'exact' })
            .eq('engine_type', engineType)
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
            console.warn(`Warning clearing ${engineType}:`, error.message);
        } else {
            totalDeleted += count || 0;
            console.log(`  Deleted ${count || 0} ${engineType} records`);
        }
    }

    // Also clear related auxiliary tables that may contain test data
    const auxiliaryTables = [
        'restaurant_tabs',
        'restaurant_order_status_history',
        'restaurant_order_items',
        'chalet_booking_add_ons',
        'pool_sessions'
    ];

    for (const table of auxiliaryTables) {
        console.log(`Clearing ${table}...`);
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) {
            // Ignore errors if table doesn't exist or is already empty
            if (!error.message.includes('does not exist')) {
                console.warn(`Warning clearing ${table}:`, error.message);
            }
        }
    }

    console.log(`✅ Data cleared successfully. Total transactions deleted: ${totalDeleted}`);
}

clearData().catch(console.error);
