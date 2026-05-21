
import { initializeDatabase, getPool, closeDatabase } from "./connection.js";
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

const potentialUrls = [
    process.env.DATABASE_URL,
    'postgresql://v2ecosystem_test:v2ecosystem_test_secret@localhost:5433/v2ecosystem_test',
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    'postgresql://postgres:postgres@localhost:5432/postgres'
].filter((value): value is string => Boolean(value));

async function tryConnectAndMigrate(url: string, sql: string): Promise<boolean> {
    console.log(`Trying connection: ${url}`);
    const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 2000 });
    try {
        await pool.query('SELECT 1');
        console.log('Connected successfully!');
        
        console.log('Running migration...');
        await pool.query(sql);
        console.log('Migration succeeded!');
        
        try {
             await pool.query("NOTIFY pgrst, 'reload schema';");
             console.log('Reload schema notification sent.');
           } catch (e: unknown) {
               console.log('Could not notify pgrst (might not be needed/supported):', getErrorMessage(e));
        }
        
        await pool.end();
        return true;
    } catch (e: unknown) {
        console.log(`Connection failed: ${getErrorMessage(e)}`);
        await pool.end();
        return false;
    }
}

async function runAtomicMigration() {
  const migrationPath = path.resolve(__dirname, '../../../supabase/migrations/20260224000000_atomic_safety_functions.sql');
  if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found at: ${migrationPath}`);
      process.exit(1);
  }
  const sql = fs.readFileSync(migrationPath, 'utf8');

  for (const url of potentialUrls) {
      if (await tryConnectAndMigrate(url, sql)) {
          console.log('SUCCESS: Migration applied.');
          process.exit(0);
      }
  }
  
  console.error('FAILURE: Could not connect to any database.');
  process.exit(1);
}

runAtomicMigration();
