import { getSupabase } from './database/connection.js';
import { logger } from './utils/logger.js';

async function fixWaitlistSchema() {
    const supabase = getSupabase();
    logger.info('Fixing waitlist_entries schema...');

    // Use rpc to execute raw SQL if available, otherwise try direct operations
    // Supabase JS client doesn't support raw SQL directly, so we'll use a workaround:
    // Create the columns via insert/update operations or rely on the table already existing

    // Actually, the best approach is to check if we can query with these columns
    // The standalone_repair.sql was executed, so table exists.
    // The controller expects: customer_name, phone, party_size, type, quoted_wait_time, status
    // Let's verify what columns exist by doing a select

    try {
        const { data, error } = await supabase
            .from('waitlist_entries')
            .select('id, customer_name, phone, party_size, type, status')
            .limit(1);

        if (error) {
            // Column doesn't exist error means we need to add them
            // But Supabase JS can't run DDL. We need to use the Supabase Management API or Dashboard.
            // For now, let's just log what's missing
            logger.error('Waitlist query error:', error.message);

            // Check if error is about missing columns
            if (error.message.includes('type') || error.message.includes('phone')) {
                logger.info('Missing columns detected. Please run the following SQL in Supabase Dashboard:');
                logger.info(`
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'restaurant';
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS quoted_wait_time INTEGER;
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
        `);
            }
        } else {
            logger.info('Waitlist schema looks correct!');
            logger.info('Sample data:', data);
        }
    } catch (e: any) {
        logger.error('Error:', e.message);
    }

    process.exit(0);
}

fixWaitlistSchema();
