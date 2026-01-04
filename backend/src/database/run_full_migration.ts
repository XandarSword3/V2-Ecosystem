
import { initializeDatabase, getPool, closeDatabase } from './connection';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

async function runMigration() {
  try {
    await initializeDatabase();
    const pool = getPool();

    const sqlPath = path.join(__dirname, 'add_module_id_to_all.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    logger.info('Running full module_id migration...');
    await pool.query(sql);
    logger.info('Migration completed successfully.');

  } catch (error) {
    logger.error('Migration failed:', error);
  } finally {
    await closeDatabase();
  }
}

runMigration();
