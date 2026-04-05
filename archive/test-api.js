async function runSQL() {
  // Test REST API connectivity
  const response = await fetch('https://dfneswicpdprhneeqlsn.supabase.co/rest/v1/menu_modifier_options?select=id&limit=1', {
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbmVzd2ljcGRwcmhuZWVxbHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA5NDIzNSwiZXhwIjoyMDgyNjcwMjM1fQ.N1pHUMHaQWDevK1CIG6pN8re5Qr2cX5jfJSoE9UoHP8',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbmVzd2ljcGRwcmhuZWVxbHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA5NDIzNSwiZXhwIjoyMDgyNjcwMjM1fQ.N1pHUMHaQWDevK1CIG6pN8re5Qr2cX5jfJSoE9UoHP8'
    }
  });
  
  console.log('REST API status:', response.status);
  const data = await response.json();
  console.log('Data:', JSON.stringify(data, null, 2));
  
  if (response.ok) {
    console.log('\n✓ REST API is working');
    console.log('\nHowever, DDL (ALTER TABLE) cannot be run via REST API.');
    console.log('The migration needs to be run via:');
    console.log('1. Supabase Dashboard SQL Editor: https://supabase.com/dashboard/project/dfneswicpdprhneeqlsn/sql');
    console.log('2. Or via direct psql connection when network allows');
  }
}

runSQL().catch(e => console.error('Error:', e.message));
