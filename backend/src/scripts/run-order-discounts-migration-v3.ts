import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;

async function run() {
  // Supabase uses pooler for external connections
  // Format: postgres://[user].[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  const projectRef = 'dfneswicpdprhneeqlsn';
  const password = 'k8yhxQ8ktbKU8b';
  
  // Try different connection strings
  const connectionStrings = [
    // Transaction pooler (port 6543)
    `postgresql://postgres.${projectRef}:${password}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
    // Session pooler (port 5432)
    `postgresql://postgres.${projectRef}:${password}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
    // Direct (may not work externally)
    `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`,
  ];

  const sqlPath = path.join(__dirname, '../../../supabase/migrations/20260117170000_order_discounts_integration.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ SQL file not found at ${sqlPath}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');

  for (let i = 0; i < connectionStrings.length; i++) {
    const connStr = connectionStrings[i];
    console.log(`\n🔌 Trying connection ${i + 1}/${connectionStrings.length}...`);
    console.log(`   ${connStr.replace(password, '***')}`);
    
    const pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });

    try {
      const client = await pool.connect();
      console.log('✅ Connected successfully!');
      
      console.log('📝 Executing Order Discounts Integration SQL...');
      await client.query(sql);
      
      console.log('✅ Migration completed successfully!');
      console.log('');
      console.log('🎉 The following features are now integrated:');
      console.log('   • Coupon application at checkout');
      console.log('   • Gift card redemption at checkout');
      console.log('   • Loyalty points redemption & earning');
      console.log('   • Automatic inventory deduction');
      
      client.release();
      await pool.end();
      process.exit(0);
    } catch (error: any) {
      console.log(`❌ Failed: ${error.message}`);
      await pool.end();
    }
  }

  console.log('\n⚠️  All connection attempts failed.');
  console.log('Please run the SQL manually in Supabase SQL Editor.');
}

run();
