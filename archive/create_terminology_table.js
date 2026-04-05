const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function createAndSeedTable() {
  console.log('Creating terminology_overrides table...');
  
  // Use RPC to execute raw SQL
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS terminology_overrides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_type VARCHAR(50) NOT NULL DEFAULT 'resort',
      term_key VARCHAR(100) NOT NULL,
      term_value VARCHAR(255) NOT NULL,
      language VARCHAR(10) NOT NULL DEFAULT 'en',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(business_type, term_key, language)
    );

    CREATE INDEX IF NOT EXISTS idx_terminology_lookup 
      ON terminology_overrides(business_type, language);

    ALTER TABLE terminology_overrides ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Allow public read access to terminology" ON terminology_overrides;
    CREATE POLICY "Allow public read access to terminology" 
      ON terminology_overrides FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Allow admin write access to terminology" ON terminology_overrides;
    CREATE POLICY "Allow admin write access to terminology" 
      ON terminology_overrides FOR ALL USING (true) WITH CHECK (true);
  `;

  // Execute via direct PostgreSQL connection if available, otherwise insert data directly
  try {
    // Try direct insert approach since we can't exec raw SQL via REST API
    const data = [
      { business_type: 'resort', term_key: 'unit_singular', term_value: 'Chalet', language: 'en' },
      { business_type: 'resort', term_key: 'unit_plural', term_value: 'Chalets', language: 'en' },
      { business_type: 'resort', term_key: 'facility_singular', term_value: 'Pool', language: 'en' },
      { business_type: 'resort', term_key: 'facility_plural', term_value: 'Pools', language: 'en' },
      { business_type: 'resort', term_key: 'dining_singular', term_value: 'Restaurant', language: 'en' },
      { business_type: 'resort', term_key: 'dining_plural', term_value: 'Restaurants', language: 'en' },
      { business_type: 'hotel', term_key: 'unit_singular', term_value: 'Room', language: 'en' },
      { business_type: 'hotel', term_key: 'unit_plural', term_value: 'Rooms', language: 'en' },
      { business_type: 'hotel', term_key: 'facility_singular', term_value: 'Spa', language: 'en' },
      { business_type: 'hotel', term_key: 'facility_plural', term_value: 'Amenities', language: 'en' },
      { business_type: 'gym', term_key: 'unit_singular', term_value: 'Training Session', language: 'en' },
      { business_type: 'gym', term_key: 'unit_plural', term_value: 'Training Sessions', language: 'en' },
      { business_type: 'gym', term_key: 'facility_singular', term_value: 'Class', language: 'en' },
      { business_type: 'gym', term_key: 'facility_plural', term_value: 'Classes', language: 'en' }
    ];

    const { error } = await supabase.from('terminology_overrides').upsert(data, { onConflict: 'business_type,term_key,language' });
    
    if (error) {
      if (error.code === 'PGRST205') {
        console.log('\n❌ Table does not exist. Creating via Supabase Dashboard...');
        console.log('\nRun this SQL in Supabase SQL Editor:');
        console.log(createTableSQL);
        console.log('\nThen run this script again.');
      } else {
        throw error;
      }
    } else {
      console.log('✅ Terminology seeded:', data.length, 'records');
      
      // Verify
      const { data: check } = await supabase.from('terminology_overrides').select('*').limit(3);
      console.log('Sample data:', check);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

createAndSeedTable();
