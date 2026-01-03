
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
    ssl: { rejectUnauthorized: false } // Required for Supabase/Render usually
  });

  try {
    const sqlPath = path.join(__dirname, 'add_qr_code_to_tickets.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running QR code migration...');
    await pool.query(sql);
    console.log('QR code migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

run();
