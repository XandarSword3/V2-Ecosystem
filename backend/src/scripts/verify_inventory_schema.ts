
import { getSupabase } from "../database/connection.js";
import { logger } from "../utils/logger.js";

async function verifyInventorySchema() {
    logger.info("=== Verifying Inventory Schema ===");
    const supabase = getSupabase();

    const tablesToCheck = [
        'inventory_categories',
        'inventory_items',
        'inventory_transactions',
        'inventory_alerts',
        'menu_item_ingredients'
    ];

    for (const table of tablesToCheck) {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                logger.error(`[MISSING] Table '${table}': ${error.message}`);
            } else {
                logger.info(`[OK] Table '${table}' exists (${count ?? 0} rows)`);
            }
        } catch (e: any) {
            logger.error(`[ERROR] Table '${table}': ${e.message}`);
        }
    }

    logger.info("=== Verification Complete ===");
    process.exit(0);
}

verifyInventorySchema();
