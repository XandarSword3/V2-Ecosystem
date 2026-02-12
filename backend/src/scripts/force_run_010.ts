
import fs from 'fs';
import path from 'path';
import { getSupabase } from "../database/connection.js";
import { logger } from "../utils/logger.js";

async function forceRunMigration() {
    const filePath = path.join(__dirname, '../database/migrations/010_add_pool_pricing.sql');
    const sql = fs.readFileSync(filePath, 'utf8');

    logger.info(`Running migration: 010_add_pool_pricing.sql`);

    const supabase = getSupabase();
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        // Fallback if RPC not available (not super admin) or other error
        logger.error('RPC Failed, trying raw query if possible (not supported by supabase client usually)');
        console.error(error);
        process.exit(1);
    } else {
        logger.info('Migration success!');
    }
}

forceRunMigration();
