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

  // The 5 unique catalog items referenced in entity_customizations
  const { data: links } = await supabase
    .from('entity_customizations')
    .select('entity_type, entity_id, customization_group_id')
    .eq('tenant_id', tenantId).eq('property_id', propertyId);
  const entityIds = [...new Set(links.map(l => l.entity_id))];
  console.log('catalog_items referenced in entity_customizations: ' + entityIds.length);

  const { data: items, error: itemsErr } = await supabase
    .from('catalog_items')
    .select('id, name, sku, is_active')
    .eq('tenant_id', tenantId).eq('property_id', propertyId).is('deleted_at', null)
    .in('id', entityIds);
  if (itemsErr) console.log('itemsErr:', itemsErr);
  const itemById = new Map((items || []).map(i => [i.id, i]));

  // Print per-item breakdown
  const perItem = {};
  for (const l of links) {
    (perItem[l.entity_id] ||= []).push(l.customization_group_id);
  }
  const { data: groups } = await supabase
    .from('customization_groups').select('id, name')
    .eq('tenant_id', tenantId).eq('property_id', propertyId).is('deleted_at', null);
  const gName = new Map(groups.map(g => [g.id, g.name]));

  console.log('\n=== Per catalog_item link summary ===\n');
  Object.entries(perItem).forEach(([eid, gids]) => {
    const item = itemById.get(eid);
    console.log(
      '📦 ' + (item ? item.name : '?').padEnd(40) +
      (item ? ' SKU=' + (item.sku||'-') : '') +
      '\n   id=' + eid.substring(0,8) + '..' +
      '  [' + gids.length + ' groups: ' +
      gids.map(gid => gName.get(gid) || '?').join(', ') + ']\n'
    );
  });

  // Also: print ae5a81da (the one showing 0)
  const targetEid = 'ae5a81da-53a2-469a-9d6b-58bdc7a8a38e';
  const { data: tgt } = await supabase
    .from('catalog_items')
    .select('id, name, sku, description, is_active')
    .eq('id', targetEid);
  if (tgt && tgt[0]) {
    console.log('\n=== Catalog item ae5a81da (from logs, 0 groups): ===');
    console.log(JSON.stringify(tgt[0], null, 2));
  } else {
    console.log('\n=== ae5a81da NOT FOUND in catalog_items (tenant/proeprty scope)?? ===');
  }
}
run().catch(e => { console.error(e); process.exit(1); });
