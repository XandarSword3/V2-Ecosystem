const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  'https://qxtmeuuuiarzsimvwqsy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4dG1ldXV1aWFyc3NpbXZ3cXN5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODA3NzE4NCwiZXhwIjoyMDczNjU3MTg0fQ.bp513GPvSl1sFLIb6Km4S3RGMQp5GPg_ZYbVL5ZqMaU'
);

const TENANT_A_ID = 'cef22e40-fac4-49d5-ac56-215e1db3fae4';

async function main() {
  console.log('1. Verify tenant B email...');
  await supabase.from('users').update({ email_verified: true }).eq('email', 'e2e-tenant-b@v2ecosystem.com');
  const { data: tb } = await supabase.from('users').select('id, tenant_id').eq('email', 'e2e-tenant-b@v2ecosystem.com').single();
  if (!tb) { console.error('Tenant B user not found'); process.exit(1); }
  const TID = tb.tenant_id;
  console.log('  Tenant B ID:', TID);

  console.log('2. Create staff B...');
  const hash = await bcrypt.hash('staff123', 12);
  const { data: sb } = await supabase.from('users').select('id').eq('email', 'e2e-staff-b@v2ecosystem.com').single();
  let sid = sb?.id;
  if (!sid) {
    const { data: n, error: ne } = await supabase.from('users').insert({
      email: 'e2e-staff-b@v2ecosystem.com',
      password_hash: hash,
      full_name: 'E2E Staff B',
      scope: 'property_staff',
      app_roles: ['staff'],
      tenant_id: TID,
      email_verified: true,
      is_active: true,
    }).select('id').single();
    sid = n?.id;
    if (ne) { console.error('  Error:', ne.message); process.exit(1); }
    console.log('  Created:', sid);
  } else {
    console.log('  Exists:', sid);
  }

  console.log('3. Ensure property...');
  const { data: p } = await supabase.from('properties').select('id').eq('tenant_id', TID).limit(1).single();
  let pid = p?.id;
  if (!pid) {
    const { data: np } = await supabase.from('properties').insert({
      tenant_id: TID, name: 'E2E Property B', slug: 'e2e-property-b', is_active: true,
    }).select('id').single();
    pid = np?.id;
  }
  console.log('  Property:', pid);

  console.log('4. Create module...');
  const { data: m } = await supabase.from('modules').select('id, slug').eq('tenant_id', TID).eq('engine_type', 'instant_transaction').limit(1).single();
  let mid = m?.id, mslug = m?.slug;
  if (!mid) {
    const { data: nm } = await supabase.from('modules').insert({
      tenant_id: TID, property_id: pid, name: 'E2E Module B', slug: 'e2e-module-b',
      engine_type: 'instant_transaction', is_active: true, show_in_main: true,
    }).select('id, slug').single();
    mid = nm?.id; mslug = nm?.slug;
  }
  console.log('  Module:', mslug, mid);

  console.log('5. Catalog items...');
  const { data: ci } = await supabase.from('catalog_items').select('id').eq('module_id', mid).limit(1);
  let itemId;
  if (!ci || ci.length === 0) {
    const { data: ni } = await supabase.from('catalog_items').insert({
      module_id: mid, tenant_id: TID, name: 'Tenant B Salad', price: 12, category: 'e2e', is_available: true,
    }).select('id').single();
    itemId = ni?.id;
    console.log('  Created item:', itemId);
  } else {
    itemId = ci[0].id;
    console.log('  Item exists:', itemId);
  }

  console.log('6. Assign staff B to module...');
  const { data: ua } = await supabase.from('user_module_access').select('id').eq('user_id', sid).eq('module_id', mid).limit(1);
  if (!ua || ua.length === 0) {
    await supabase.from('user_module_access').insert({ user_id: sid, module_id: mid, tenant_id: TID });
    console.log('  Assigned');
  } else {
    console.log('  Already assigned');
  }

  console.log('\n=== FIXTURES READY ===');
  console.log('Tenant A Staff: menu.service.staff@v2ecosystem.com / staff123 (module: delete)');
  console.log('Tenant B Admin: e2e-tenant-b@v2ecosystem.com / SecurePass123!');
  console.log('Tenant B Staff: e2e-staff-b@v2ecosystem.com / staff123 (module: ' + mslug + ')');
  console.log('Tenant A ID:', TENANT_A_ID);
  console.log('Tenant B ID:', TID);
  console.log('Tenant B Module Slug:', mslug);
  console.log('Tenant B Catalog Item ID:', itemId);
}
main().catch(e => { console.error(e); process.exit(1); });
