// One-off maintenance script to align waitlist table columns in existing environments.
import { config } from '../src/config/index.js';
import { logger } from '../src/utils/logger.js';

async function addWaitlistColumns() {
    // Use the REST API with service key to execute SQL via rpc
    // Supabase provides a pg_net or postgres extension for this...
    // Actually, let's use the pg library directly since we have DATABASE_URL

    const { Pool } = await import('pg');

    const pool = new Pool({
        connectionString: config.database.url,
        ssl: { rejectUnauthorized: false }
    });

    try {
        logger.info('Adding missing columns to waitlist_entries...');

        await pool.query(`
      ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'restaurant';
      ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS quoted_wait_time INTEGER;
      ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
    `);

        logger.info('✅ Columns added successfully!');

        // Verify
        const result = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'waitlist_entries'
    `);
        logger.info('Current columns:', result.rows.map(r => r.column_name).join(', '));

    } catch (e: any) {
        logger.error('Error:', e.message);
        // If connection fails, output the SQL for manual execution
        logger.info('\n--- MANUAL SQL (run in Supabase Dashboard) ---');
        logger.info(`
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'restaurant';
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS quoted_wait_time INTEGER;
ALTER TABLE waitlist_entries ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
    `);
    } finally {
        await pool.end();
    }

    process.exit(0);
}

addWaitlistColumns();
