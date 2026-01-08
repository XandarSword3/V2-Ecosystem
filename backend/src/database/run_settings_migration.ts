import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found in .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false } // Required for Supabase/Render
  });

  try {
    const sqlPath = path.join(__dirname, 'update_settings_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running settings migration...');
    await pool.query(sql);
    console.log('Settings migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

run();
