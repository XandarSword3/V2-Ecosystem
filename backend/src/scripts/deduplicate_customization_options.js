require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  console.log('=== DEDUPLICATE CUSTOMIZATION OPTIONS ===\n');

  // 1. Get all customization options
  const { data: options, error: optionsError } = await supabase
    .from('customization_options')
    .select('id, name, group_id, customization_type, price_adjustment, inventory_item_id, quantity_per_selection')
    .order('group_id, name');

  if (optionsError) {
    console.error('Error fetching customization options:', optionsError);
    return;
  }

  if (!options || options.length === 0) {
    console.log('No customization options found.');
    return;
  }

  console.log(`Found ${options.length} customization options total.\n`);

  // 2. Group by group_id and name to find duplicates
  const grouped = new Map();
  
  options.forEach(opt => {
    const key = `${opt.group_id}-${opt.name}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(opt);
  });

  // 3. Identify duplicates
  const duplicates = [];
  grouped.forEach((opts, key) => {
    if (opts.length > 1) {
      duplicates.push({ key, options: opts });
    }
  });

  console.log(`Found ${duplicates.length} groups with duplicates.\n`);

  if (duplicates.length === 0) {
    console.log('No duplicates to remove.');
    return;
  }

  // 4. Show what will be deleted
  let totalToDelete = 0;
  duplicates.forEach(dup => {
    const keep = dup.options[0];
    const toDelete = dup.options.slice(1);
    totalToDelete += toDelete.length;
    
    console.log(`Group: ${dup.key}`);
    console.log(`  KEEP: ${keep.id} - ${keep.name}`);
    toDelete.forEach(opt => {
      console.log(`  DELETE: ${opt.id} - ${opt.name}`);
    });
    console.log('');
  });

  console.log(`Total to delete: ${totalToDelete} options\n`);

  // 5. Confirm before deleting
  console.log('⚠️  WARNING: This will delete customization options from the database.');
  console.log('Make sure you have a backup before proceeding.\n');
  
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve => rl.question('Proceed with deletion? (yes/no): ', resolve));
  rl.close();
  if (answer !== 'yes') {
    console.log('Aborted.');
    return;
  }

  // 6. Delete duplicates
  console.log('Deleting duplicates...\n');
  
  let deletedCount = 0;
  const errors = [];

  for (const dup of duplicates) {
    const toDelete = dup.options.slice(1);
    
    for (const opt of toDelete) {
      // First, delete any entity_customizations that reference this option
      const { error: entityError } = await supabase
        .from('entity_customizations')
        .delete()
        .eq('customization_option_id', opt.id);
      
      if (entityError) {
        errors.push({ option: opt.id, error: entityError.message });
        continue;
      }

      // Then delete the customization option
      const { error: deleteError } = await supabase
        .from('customization_options')
        .delete()
        .eq('id', opt.id);
      
      if (deleteError) {
        errors.push({ option: opt.id, error: deleteError.message });
      } else {
        deletedCount++;
        console.log(`Deleted: ${opt.id} - ${opt.name}`);
      }
    }
  }

  console.log(`\nDeleted ${deletedCount} duplicate options.`);
  
  if (errors.length > 0) {
    console.log(`\nErrors encountered: ${errors.length}`);
    errors.forEach(err => {
      console.log(`  ${err.option}: ${err.error}`);
    });
  }

  console.log('\n=== DEDUPLICATION COMPLETE ===');
}

run().catch(console.error);
