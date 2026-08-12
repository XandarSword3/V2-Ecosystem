require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);
async function run() {
  const { data: platformTenant } = await supabase
    .from('tenants').select('id').eq('is_platform_root', true).limit(1);
  const tenantId = platformTenant[0].id;
  const { data: properties } = await supabase
    .from('properties').select('id').eq('tenant_id', tenantId).order('created_at').limit(1);
  const propertyId = properties[0].id;

  // ALL entity_customizations for this tenant+property (no deleted_at filter — they don't have one)
  const { data: links } = await supabase
    .from('entity_customizations')
    .select('id, entity_type, entity_id, customization_group_id, created_at')
    .eq('tenant_id', tenantId).eq('property_id', propertyId);
  console.log('TOTAL entity_customizations rows: ' + links.length + '\n');

  // ALL customization groups (active + soft-deleted), so we can resolve names
  const { data: allGroups } = await supabase
    .from('customization_groups')
    .select('id, name, deleted_at')
    .eq('tenant_id', tenantId).eq('property_id', propertyId);
  const groupById = new Map(allGroups.map(g => [g.id, g]));

  // Active (non-deleted) groups by name — keepers
  const active = allGroups.filter(g => !g.deleted_at);
  const activeByName = new Map(active.map(g => [g.name.toLowerCase(), g]));
  console.log('Active keeper groups (' + active.length + '): ' + active.map(g => g.name).join(', ') + '\n');

  const orphans = [];
  for (const l of links) {
    const g = groupById.get(l.customization_group_id);
    const isOrphan = !g || g.deleted_at !== null;
    const line =
      '  LINK ' + l.id.substring(0,8) +
      ' | ' + l.entity_type + ':' + l.entity_id.substring(0,8) + '..' +
      ' → group ' + l.customization_group_id.substring(0,8) + '..' +
      ' "' + (g ? g.name : '?UNKNOWN?') + '"' +
      (isOrphan ? '  ❌ ORPHAN (group deleted)' : '  ✅');
    console.log(line);
    if (isOrphan) orphans.push({ link: l, group: g });
  }

  console.log('\n=== Orphan analysis ===');
  for (const o of orphans) {
    const name = o.group?.name;
    const keeper = name ? activeByName.get(name.toLowerCase()) : null;
    console.log('  Orphan group "' + (name||'?') + '" → reassign to keeper ' +
      (keeper ? keeper.id.substring(0,8) + '.. (id=' + keeper.id + ')' : '⚠️ NO ACTIVE KEEPER FOUND'));
  }
  console.log('\nOrphans found: ' + orphans.length + '/' + links.length);
}
run().catch(e => { console.error(e); process.exit(1); });
