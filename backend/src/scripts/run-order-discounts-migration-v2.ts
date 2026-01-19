import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';

// Force IPv4 for DNS resolution
dns.setDefaultResultOrder('ipv4first');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  console.log('🔌 Connecting to database (forcing IPv4)...');
  
  // Parse URL and force IPv4 resolution
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    // Add connection timeout
    connectionTimeoutMillis: 30000,
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
    
    // Try alternative: use Supabase pooler connection
    console.log('\n🔄 Trying Supabase pooler connection...');
    
    // Supabase pooler uses port 6543 instead of 5432
    const poolerUrl = dbUrl.replace(':5432/', ':6543/').replace(':5432', ':6543');
    
    const poolerPool = new Pool({
      connectionString: poolerUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
    });
    
    try {
      const poolerClient = await poolerPool.connect();
      console.log('✅ Connected via pooler');
      
      const sqlPath = path.join(__dirname, '../../../supabase/migrations/20260117170000_order_discounts_integration.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      
      await poolerClient.query(sql);
      console.log('✅ Migration completed via pooler!');
      poolerClient.release();
      await poolerPool.end();
    } catch (poolerErr: any) {
      console.error('❌ Pooler connection also failed:', poolerErr.message);
      console.log('\n⚠️  Please run the SQL manually in Supabase SQL Editor');
    }
  } finally {
    await pool.end();
  }
}

run();
