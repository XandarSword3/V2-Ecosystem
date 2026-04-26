// One-off utility to clear stale rate limiting entries during admin lockout recovery.
import { getSupabase } from '../src/database/connection.js';
import { logger } from '../src/utils/logger.js';

async function clearRateLimit() {
    const supabase = getSupabase();
    logger.info('Clearing rate limit for admin user...');

    try {
        // Clear login attempts for admin user
        const { error } = await supabase
            .from('login_attempts')
            .delete()
            .eq('email', 'admin@v2resort.com');

        if (error) {
            logger.warn('Could not clear login_attempts:', error.message);
            // Table might not exist or have different structure
        } else {
            logger.info('✅ Rate limit cleared!');
        }
    } catch (e: any) {
        logger.warn('Error:', e.message);
    }

    // Also try rate_limits table if it exists
    try {
        const { error } = await supabase
            .from('rate_limits')
            .delete()
            .ilike('key', '%admin@v2resort.com%');

        if (!error) {
            logger.info('✅ rate_limits cleared!');
        }
    } catch (e) {
        // ignore
    }

    process.exit(0);
}

clearRateLimit();
