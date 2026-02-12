import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const DDL_SQL = `
CREATE TABLE IF NOT EXISTS support_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'new',
  admin_notes TEXT,
  responded_at TIMESTAMP WITH TIME ZONE,
  responded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE support_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "allow_all_support_inquiries" ON support_inquiries FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "allow_all_faqs" ON faqs FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
`;

async function createSupportTable() {
  console.log(`📍 Supabase URL: ${supabaseUrl}`);

  // Try Method 1: Supabase SQL API endpoint (available on newer Supabase versions)
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ query: DDL_SQL }),
    });
    console.log('SQL API response status:', response.status);
  } catch (e) {
    console.log('SQL API not available');
  }

  // Try Method 2: Use pg with IPv6 forced
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });

    // Force Node.js to try the connection
    const client = await pool.connect();
    console.log('✅ Connected via direct PostgreSQL!');
    await client.query(DDL_SQL);
    console.log('✅ Tables created successfully!');
    client.release();
    await pool.end();
    return;
  } catch (e: any) {
    console.log(`⚠️ Direct PG failed: ${e.message}`);
  }

  // Try Method 3: Use Supabase pooler URL  
  try {
    const { Pool } = await import('pg');
    // Supabase transaction pooler format
    const poolerUrl = process.env.DATABASE_URL!
      .replace('db.dfneswicpdprhneeqlsn.supabase.co:5432', 'aws-0-eu-central-1.pooler.supabase.com:6543')
      .replace('postgres:', 'postgres.dfneswicpdprhneeqlsn:');
    
    console.log('Trying pooler connection...');
    const pool = new Pool({
      connectionString: poolerUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });

    const client = await pool.connect();
    console.log('✅ Connected via Supabase pooler!');
    await client.query(DDL_SQL);
    console.log('✅ Tables created successfully via pooler!');
    client.release();
    await pool.end();
    return;
  } catch (e: any) {
    console.log(`⚠️ Pooler connection failed: ${e.message}`);
  }

  // If all methods fail, print the SQL for manual execution
  console.log('');
  console.log('❌ Could not create tables automatically.');
  console.log('Please run this SQL in Supabase SQL Editor:');
  console.log('📍 URL: https://supabase.com/dashboard/project/dfneswicpdprhneeqlsn/sql/new');
  console.log('');
  console.log('=========================================');
  console.log(DDL_SQL);
  console.log('=========================================');
}

createSupportTable();
