
import { initializeDatabase, getPool, closeDatabase } from './connection';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

async function runMigration() {
  try {
    await initializeDatabase();
    const pool = getPool();

    const moduleMigrationSqlPath = path.join(__dirname, 'add_module_id_to_all.sql');
    const moduleMigrationSql = fs.readFileSync(moduleMigrationSqlPath, 'utf8');
    logger.info('Running module_id migration...');
    await pool.query(moduleMigrationSql);
    logger.info('Module_id migration completed successfully.');

    const themeSettingsSqlPath = path.join(__dirname, 'add_theme_settings.sql');
    const themeSettingsSql = fs.readFileSync(themeSettingsSqlPath, 'utf8');
    logger.info('Running theme settings migration...');
    await pool.query(themeSettingsSql);
    logger.info('Theme settings migration completed successfully.');

  } catch (error) {
    logger.error('Migration failed:', error);
  } finally {
    await closeDatabase();
  }
}

runMigration();
