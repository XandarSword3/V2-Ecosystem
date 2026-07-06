import 'dotenv/config';
import { getSupabaseAdmin } from '../database/supabase.js';

async function main() {
  const supabase = getSupabaseAdmin();

  const { data: prop, error } = await supabase
    .from('properties')
    .select('id, tenant_id, name')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .maybeSingle();
  console.log('=== placeholder property row ===');
  console.log('error:', error);
  console.log('data:', prop);

  // How many distinct tenants actually have a two_factor_auth row, and which property_id did each land on?
  const { data: rows, error: rowsErr } = await supabase
    .from('two_factor_auth')
    .select('user_id, tenant_id, property_id');
  console.log('=== all two_factor_auth rows (tenant/property spread) ===');
  console.log('error:', rowsErr);
  console.log('rows:', rows);

  // Does the user's own tenant have properties, and is there an obvious "first/default" one?
  const { data: props, error: propsErr } = await supabase
    .from('properties')
    .select('id, tenant_id, name, is_active')
    .eq('tenant_id', '6efae426-a89d-488f-b808-3994fd6db567');
  console.log('=== properties for the failing-login user\'s tenant ===');
  console.log('error:', propsErr);
  console.log('data:', props);

  // Full column list for `properties` to check for an is_default-style flag
  const { data: sample, error: sampleErr } = await supabase
    .from('properties')
    .select('*')
    .limit(1);
  console.log('=== properties table columns ===');
  console.log('error:', sampleErr);
  console.log('columns:', sample?.[0] ? Object.keys(sample[0]) : sample);
}

main().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1); });
