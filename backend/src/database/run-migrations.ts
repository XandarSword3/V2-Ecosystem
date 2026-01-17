/**
 * V2 Resort Database Migration Runner
 * 
 * This script executes database migrations in the correct sequential order.
 * It tracks which migrations have been applied and only runs new ones.
 * 
 * Usage: npm run migrate
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

interface Migration {
  filename: string;
  number: number;
  applied: boolean;
}

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected successfully\n');

    // Create migrations tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get list of applied migrations
    const { rows: appliedMigrations } = await client.query(
      'SELECT filename FROM _migrations ORDER BY filename'
    );
    const appliedSet = new Set(appliedMigrations.map(m => m.filename));

    // Get all migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && /^\d{3}_/.test(f))
      .sort();

    if (files.length === 0) {
      console.log('📁 No migration files found in migrations/ directory');
      console.log('   Migration files should be named: 001_name.sql, 002_name.sql, etc.');
      client.release();
      await pool.end();
      return;
    }

    console.log(`📋 Found ${files.length} migration files\n`);

    let applied = 0;
    let skipped = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        skipped++;
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`🔄 Applying ${file}...`);
      
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ Applied ${file}`);
        applied++;
      } catch (err) {
        await client.query('ROLLBACK');
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`❌ Failed to apply ${file}: ${message}`);
        throw err;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  ✅ Applied:  ${applied}`);
    console.log(`  ⏭️  Skipped:  ${skipped}`);
    console.log(`  📁 Total:    ${files.length}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    client.release();
    await pool.end();
    
    console.log('✨ Migrations complete!');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('❌ Migration failed:', message);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
