import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createReviewsTable() {
  console.log('Creating reviews table via Supabase...\n');

  // Try to create the table using raw SQL via rpc if available
  // Otherwise, we'll test if the table exists by trying to select from it
  
  const { data, error } = await supabase
    .from('reviews')
    .select('id')
    .limit(1);

  if (error && error.message.includes('not found')) {
    console.log('❌ Reviews table does not exist.');
    console.log('\n📋 Please create the table manually in Supabase SQL Editor:');
    console.log('Go to: https://supabase.com/dashboard/project/dfneswicpdprhneeqlsn/sql/new');
    console.log('\n-- Run this SQL:\n');
    console.log(`
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL,
  service_type VARCHAR(50) DEFAULT 'general',
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved);
    `);
  } else if (error) {
    console.log('Error checking table:', error.message);
  } else {
    console.log('✅ Reviews table already exists!');
  }
}

createReviewsTable()
  .then(() => console.log('\nDone.'))
  .catch(console.error);
