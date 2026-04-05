import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearData() {
    console.log('🧹 Clearing legacy stress test data...');

    const tables = [
        'restaurant_order_status_history',
        'restaurant_order_items',
        'restaurant_orders',
        'snack_order_items',
        'snack_orders',
        'chalet_booking_add_ons',
        'chalet_bookings',
        'pool_tickets'
    ];

    for (const table of tables) {
        console.log(`Clearing ${table}...`);
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) {
            // Ignore errors if table doesn't exist or is already empty
            if (!error.message.includes('does not exist')) {
                console.warn(`Warning clearing ${table}:`, error.message);
            }
        }
    }

    console.log('✅ Data cleared successfully.');
}

clearData().catch(console.error);
