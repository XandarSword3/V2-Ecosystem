
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Copied from config/index.ts to avoid import issues
const config = {
  database: {
    url: process.env.DATABASE_URL,
  },
};

async function runMigration() {
  console.log('Running order migration...');
  
  if (!config.database.url) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
  }

  const client = new Client({
    connectionString: config.database.url,
    ssl: { rejectUnauthorized: false } // Add SSL for Supabase
  });

  try {
    await client.connect();
    
    const sqlPath = path.join(__dirname, 'add_module_id_to_orders.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query(sql);
    console.log('Migration successful!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

runMigration();
