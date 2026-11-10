import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { scriptSsl } from './db-ssl.js';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;


async function run() {
  // SECURITY: credentials are no longer hardcoded in source — read from .env
  // (DATABASE_URL) like the sibling migration scripts. The historical value
  // was a Supabase transaction-pooler URL.
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  console.log('🔌 Connecting to database via pooler...');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: scriptSsl(dbUrl)
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
