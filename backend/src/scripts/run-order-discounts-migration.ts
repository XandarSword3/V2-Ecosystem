import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;

async function run() {
  // Use pooler URL which resolves correctly
  const dbUrl = 'postgresql://postgres.dfneswicpdprhneeqlsn:k8yhxQ8ktbKU8b@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';

  console.log('🔌 Connecting to database via pooler...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected successfully');

    const sqlPath = path.join(__dirname, '../../../supabase/migrations/20260117170000_order_discounts_integration.sql');
    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ SQL file not found at ${sqlPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('📝 Executing Order Discounts Integration SQL...');
    console.log('   This adds atomic RPC functions for coupons, gift cards, loyalty, and inventory...');
    
    await client.query(sql);
    console.log('✅ Order Discounts Integration migration completed successfully!');
    console.log('');
    console.log('🎉 The following features are now integrated:');
    console.log('   • Coupon application at checkout');
    console.log('   • Gift card redemption at checkout');
    console.log('   • Loyalty points redemption & earning');
    console.log('   • Automatic inventory deduction');
    
    client.release();
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ Migration failed:', err.message);
    console.log('\n⚠️  Please run the following SQL manually in your Supabase SQL Editor:');
    console.log('=' .repeat(50));
    const sqlPath = path.join(__dirname, '../../../supabase/migrations/20260117170000_order_discounts_integration.sql');
    if (fs.existsSync(sqlPath)) {
      console.log(fs.readFileSync(sqlPath, 'utf8'));
    }
    console.log('=' .repeat(50));
  } finally {
    await pool.end();
  }
}

run();
