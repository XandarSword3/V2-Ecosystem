require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  console.log('=== CUSTOMIZATION INVENTORY LINK AUDIT ===\n');

  // 1. Get all customization options with their inventory links
  console.log('1. CUSTOMIZATION OPTIONS with inventory links:');
  const { data: options, error: optionsError } = await supabase
    .from('customization_options')
    .select(`
      id,
      name,
      customization_type,
      price_adjustment,
      inventory_item_id,
      quantity_per_selection,
      replaces_inventory_item_id,
      customization_groups (id, name, tenant_id, property_id),
      inventory_items!customization_options_inventory_item_id_fkey (id, name, sku, current_stock)
    `)
    .order('customization_groups(name), name');

  if (optionsError) {
    console.error('Error fetching customization options:', optionsError);
    return;
  }

  if (!options || options.length === 0) {
    console.log('No customization options found.');
  } else {
    let linkedCount = 0;
    let unlinkedCount = 0;

    options.forEach(opt => {
      const group = opt.customization_groups;
      const inv = opt.inventory_items;
      const isLinked = opt.inventory_item_id !== null;

      if (isLinked) {
        linkedCount++;
        console.log(`  ✅ LINKED: ${group?.name || 'Unknown Group'} > ${opt.name}`);
        console.log(`     Type: ${opt.customization_type}, Price adj: $${opt.price_adjustment}`);
        console.log(`     Inventory: ${inv?.name || 'Unknown'} (${inv?.sku || 'N/A'}), Stock: ${inv?.current_stock || 'N/A'}, Qty/selection: ${opt.quantity_per_selection || 1}`);
      } else {
        unlinkedCount++;
        console.log(`  ❌ NOT LINKED: ${group?.name || 'Unknown Group'} > ${opt.name}`);
        console.log(`     Type: ${opt.customization_type}, Price adj: $${opt.price_adjustment}`);
        console.log(`     No inventory item linked`);
      }
      console.log('');
    });

    console.log(`\nSummary: ${linkedCount} linked, ${unlinkedCount} unlinked out of ${options.length} total`);
  }

  // 2. Get customization options by type
  console.log('\n2. BY CUSTOMIZATION TYPE:');
  const typeCounts = {};
  options?.forEach(opt => {
    const type = opt.customization_type || 'unknown';
    const isLinked = opt.inventory_item_id !== null;
    if (!typeCounts[type]) {
      typeCounts[type] = { total: 0, linked: 0, unlinked: 0 };
    }
    typeCounts[type].total++;
    if (isLinked) typeCounts[type].linked++;
    else typeCounts[type].unlinked++;
  });

  Object.entries(typeCounts).forEach(([type, counts]) => {
    console.log(`  ${type}: ${counts.total} total (${counts.linked} linked, ${counts.unlinked} unlinked)`);
  });

  // 3. Check which customization types should typically have inventory links
  console.log('\n3. INVENTORY LINK RECOMMENDATIONS:');
  console.log('  Types that SHOULD have inventory links:');
  console.log('    - add: Adding extra items (e.g., extra cheese, extra bacon)');
  console.log('    - swap: Replacing one item with another (e.g., swap fries for salad)');
  console.log('    - upgrade: Upgrading to premium version (e.g., upgrade to large size)');
  console.log('  Types that typically DO NOT need inventory links:');
  console.log('    - remove: Removing items (handled by base recipe logic)');
  console.log('    - replace: Direct replacement without inventory impact');

  // 4. Highlight potential issues
  console.log('\n4. POTENTIAL ISSUES:');
  const issues = [];
  const seenOptions = new Set();

  options?.forEach(opt => {
    const isLinked = opt.inventory_item_id !== null;
    const type = opt.customization_type;
    const optionKey = `${opt.customization_groups?.name} > ${opt.name}`;

    // Skip duplicates
    if (seenOptions.has(optionKey)) return;
    seenOptions.add(optionKey);

    // 'add', 'swap', 'upgrade' should typically have inventory links
    if (['add', 'swap', 'upgrade'].includes(type) && !isLinked) {
      issues.push({
        type: 'missing_inventory_link',
        option: optionKey,
        reason: `${type} type should typically have an inventory link`,
      });
    }

    // 'remove' typically should NOT have inventory links
    if (type === 'remove' && isLinked) {
      issues.push({
        type: 'unexpected_inventory_link',
        option: optionKey,
        reason: 'remove type typically should not have an inventory link',
      });
    }
  });

  if (issues.length === 0) {
    console.log('  No potential issues detected.');
  } else {
    console.log(`  Found ${issues.length} potential issues (showing first 20):`);
    issues.slice(0, 20).forEach(issue => {
      console.log(`  ⚠️  ${issue.type}: ${issue.option}`);
      console.log(`     Reason: ${issue.reason}`);
    });
    if (issues.length > 20) {
      console.log(`  ... and ${issues.length - 20} more`);
    }
  }

  console.log('\n=== AUDIT COMPLETE ===');
}

run().catch(console.error);
