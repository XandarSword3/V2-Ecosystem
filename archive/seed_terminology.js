const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function seed() {
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
  if (error) console.error('❌ Error:', error);
  else console.log('✅ Terminology seeded:', data.length, 'records');
}
seed();
