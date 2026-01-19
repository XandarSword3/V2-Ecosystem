
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Supabase requires SSL, usually self-signed OK or explicit cert
  });

  try {
    await client.connect();
    console.log('🔌 Connected to Database');

    const migrationPath = path.resolve(__dirname, '../supabase/migrations/20260118120000_fix_coupon_ambiguity.sql');
    if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found at ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('📂 Reading Migration:', path.basename(migrationPath));

    await client.query(sql);
    console.log('✅ Migration executed successfully');

    await client.end();
  } catch (err) {
    console.error('❌ Migration Failed:', err);
    if(client) client.end();
    process.exit(1);
  }
}

runMigration();
