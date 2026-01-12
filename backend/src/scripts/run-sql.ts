import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected successfully');

    const sqlPath = path.join(__dirname, '../database/add_missing_tables.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ SQL file not found at ${sqlPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('📝 Executing SQL...');
    
    await client.query(sql);
    console.log('✅ Migration completed successfully!');
    
    client.release();
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Migration failed:', err.message);
    console.log('\n⚠️  Please run the following SQL manually in your Supabase SQL Editor:');
    console.log('=' .repeat(50));
    console.log(fs.readFileSync(path.join(__dirname, '../database/add_missing_tables.sql'), 'utf8'));
    console.log('=' .repeat(50));
  } finally {
    await pool.end();
  }
}

run();
