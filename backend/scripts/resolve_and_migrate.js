
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const dns = require('dns');

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // Fixed path

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

// Parse connection URL to get hostname
const dbUrl = new URL(connectionString);
const hostname = dbUrl.hostname;

console.log(`🔍 Resolving hostname: ${hostname}`);

async function runMigration() {
  try {
    // Manually resolve DNS to finding IPv6 if IPv4 missing
    const addresses = await dns.promises.resolve6(hostname).catch(() => []);
    const ipv4 = await dns.promises.resolve4(hostname).catch(() => []);
    
    console.log('IPv4:', ipv4);
    console.log('IPv6:', addresses);

    let hostToUse = hostname;
    if (ipv4.length === 0 && addresses.length > 0) {
        console.log(`⚠️ No IPv4 found. Forcing usage of IPv6 address: ${addresses[0]}`);
        // Modify connection string or config
        hostToUse = addresses[0];
        // Note: For IPv6 literal, we might need brackets? Postgres URL usually handles it or we pass config object.
    }

    const client = new Client({
      // Parse individual params from URL, but override host
      user: dbUrl.username,
      password: dbUrl.password,
      host: hostToUse,
      port: dbUrl.port,
      database: dbUrl.pathname.split('/')[1],
      ssl: { rejectUnauthorized: false }
    });

    try {
        console.log(`🔌 Connecting to ${hostToUse}...`);
        await client.connect();
        console.log('🔌 Connected to Database');

        const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20260118120000_fix_coupon_ambiguity.sql');
        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found at ${migrationPath}`);
        }

        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('📂 Reading Migration:', path.basename(migrationPath));
        console.log('Content preview:', sql.substring(0, 50) + '...');

        await client.query(sql);
        console.log('✅ Migration executed successfully');

        await client.end();
    } catch (err) {
        console.error('❌ Connection/Query Failed:', err);
        if(client) client.end();
        process.exit(1);
    }

  } catch (err) {
    console.error('❌ Resolution Failed:', err);
    process.exit(1);
  }
}

runMigration();
