import { initializeDatabase, getPool, closeDatabase } from './src/database/connection.js';
import { logger } from './src/utils/logger.js';

async function fixCatalogItemsTable() {
  try {
    await initializeDatabase();
    const pool = getPool();

    logger.info('Checking and fixing catalog_items table...');

    // Add category column if it doesn't exist
    await pool.query(`
      ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS category TEXT;
    `);
    logger.info('Added category column (if missing)');

    // Add metadata column if it doesn't exist
    await pool.query(`
      ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
    `);
    logger.info('Added metadata column (if missing)');

    // Add property_id column if it doesn't exist
    await pool.query(`
      ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS property_id UUID;
    `);
    logger.info('Added property_id column (if missing)');

    // Add tenant_id column if it doesn't exist
    await pool.query(`
      ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS tenant_id UUID;
    `);
    logger.info('Added tenant_id column (if missing)');

    logger.info('catalog_items table fixed successfully!');
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    logger.error('Error fixing catalog_items table:', error);
    await closeDatabase();
    process.exit(1);
  }
}

fixCatalogItemsTable();
