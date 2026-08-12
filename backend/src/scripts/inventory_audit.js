require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  console.log('=== INVENTORY AUDIT ===\n');

  // 1. Query inventory_items to get creation dates
  console.log('1. INVENTORY ITEMS (with creation dates):');
  const { data: inventoryItems, error: invError } = await supabase
    .from('inventory_items')
    .select('id, name, sku, created_at, current_stock')
    .order('created_at');
  
  if (invError) {
    console.error('Error fetching inventory items:', invError);
    return;
  }
  
  if (!inventoryItems || inventoryItems.length === 0) {
    console.log('No inventory items found.');
  } else {
    inventoryItems.forEach(item => {
      console.log(`  - ${item.name} (SKU: ${item.sku || 'N/A'})`);
      console.log(`    ID: ${item}`);
      console.log(`    Created: ${item.created_at}`);
      console.log(`    Current Stock: ${item.current_stock}`);
      console.log('');
    });
  }

  // 2. Check which inventory items are linked to catalog items via menu_item_ingredients
  console.log('\n2. INVENTORY ITEM LINKS TO CATALOG ITEMS:');
  const { count: menuItemCount, error: countError } = await supabase
    .from('menu_item_ingredients')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('Error counting menu item ingredients:', countError);
  } else {
    console.log(`Total menu_item_ingredients rows: ${menuItemCount ?? 0}`);
  }

  const { data: menuItemIngredients, error: linkError } = await supabase
    .from('menu_item_ingredients')
    .select('*')
    .limit(10);
  
  if (linkError) {
    console.error('Error fetching menu item ingredients:', linkError);
  } else if (!menuItemIngredients || menuItemIngredients.length === 0) {
    console.log('No links found between inventory items and catalog items.');
  } else {
    console.log(`Found ${menuItemIngredients.length} links (showing first 10):`);
    menuItemIngredients.forEach(link => {
      const invItem = inventoryItems?.find(i => i.id === link.inventory_item_id);
      console.log(`  - Inventory Item: ${invItem?.name || link.inventory_item_id}`);
      console.log(`    Catalog Item ID: ${link.catalog_item_id}`);
      console.log(`    Quantity Required: ${link.quantity_required} ${link.unit}`);
      console.log(`    Optional: ${link.is_optional ? 'Yes' : 'No'}`);
      console.log('');
    });
  }

  // 2b. Check actual table structure
  console.log('\n2b. CHECKING ACTUAL TABLE STRUCTURE:');
  const { data: tables, error: tablesError } = await supabase
    .rpc('get_tables');
  
  if (tablesError) {
    console.log('Could not get tables via RPC, trying alternative...');
    // Try to query information schema
    const { data: schemaTables, error: schemaError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');
    
    if (schemaError) {
      console.error('Error fetching schema tables:', schemaError);
    } else {
      console.log('Available tables in public schema:');
      schemaTables?.forEach(t => console.log(`  - ${t.table_name}`));
    }
  } else {
    console.log('Available tables:', tables);
  }

  // 3. Check catalog items (order_items and kiosk_items based on hints)
  console.log('\n3. CATALOG ITEMS:');
  
  // Try order_items (hint from error message)
  const { data: orderItems, error: orderError } = await supabase
    .from('order_items')
    .select('*')
    .limit(20);
  
  if (orderError) {
    console.error('Error fetching order items:', orderError);
  } else {
    console.log(`Order Items: ${orderItems?.length || 0}`);
    if (orderItems && orderItems.length > 0) {
      console.log('Columns:', Object.keys(orderItems[0]));
      orderItems?.forEach(item => {
        console.log(`  - Item ID: ${item.id}, Name: ${item.name || 'N/A'}, Created: ${item.created_at || 'N/A'}`);
      });
    }
  }

  // Try kiosk_items (hint from error message)
  const { data: kioskItems, error: kioskError } = await supabase
    .from('kiosk_items')
    .select('*')
    .limit(20);
  
  if (kioskError) {
    console.error('Error fetching kiosk items:', kioskError);
  } else {
    console.log(`\nKiosk Items: ${kioskItems?.length || 0}`);
    if (kioskItems && kioskItems.length > 0) {
      console.log('Columns:', Object.keys(kioskItems[0]));
      kioskItems?.forEach(item => {
        console.log(`  - Item ID: ${item.id}, Name: ${item.name || 'N/A'}, Created: ${item.created_at || 'N/A'}`);
      });
    }
  }

  // Try catalog_items table
  const { data: catalogItems, error: catalogError } = await supabase
    .from('catalog_items')
    .select('*')
    .limit(20);
  
  if (catalogError) {
    console.error('Error fetching catalog items:', catalogError);
  } else {
    console.log(`\nCatalog Items: ${catalogItems?.length || 0}`);
    if (catalogItems && catalogItems.length > 0) {
      console.log('Columns:', Object.keys(catalogItems[0]));
      catalogItems?.forEach(item => {
        console.log(`  - Item ID: ${item.id}, Name: ${item.name || 'N/A'}, Created: ${item.created_at || 'N/A'}`);
      });
    }
  }

  // 4. Check transactions for catalog items
  console.log('\n4. TRANSACTIONS:');
  
  // Try transactions table
  const { data: transactions, error: transError } = await supabase
    .from('transactions')
    .select('*')
    .limit(20);
  
  if (transError) {
    console.error('Error fetching transactions:', transError);
  } else {
    console.log(`Transactions: ${transactions?.length || 0}`);
    if (transactions && transactions.length > 0) {
      console.log('Transaction columns:', Object.keys(transactions[0]));
      transactions?.forEach(trans => {
        console.log(`  - Transaction ID: ${trans.id}, Status: ${trans.status || 'N/A'}, Created: ${trans.created_at || 'N/A'}`);
      });
    }
  }

  // 5. Check inventory transactions for deductions
  console.log('\n5. INVENTORY TRANSACTIONS (DEDUCTIONS):');
  const { data: inventoryTransactions, error: invTransError } = await supabase
    .from('inventory_transactions')
    .select('*')
    .order('created_at')
    .limit(50);
  
  if (invTransError) {
    console.error('Error fetching inventory transactions:', invTransError);
    console.log('Trying to get column structure...');
    // Try to get one row to see structure
    const { data: sampleTrans, error: sampleError } = await supabase
      .from('inventory_transactions')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('Error fetching sample:', sampleError);
    } else if (sampleTrans && sampleTrans.length > 0) {
      console.log('Sample inventory transaction columns:', Object.keys(sampleTrans[0]));
    }
  } else if (!inventoryTransactions || inventoryTransactions.length === 0) {
    console.log('No inventory transactions found.');
  } else {
    console.log(`Found ${inventoryTransactions.length} inventory transactions:`);
    console.log('Columns:', Object.keys(inventoryTransactions[0]));
    inventoryTransactions.forEach(trans => {
      const invItem = inventoryItems?.find(i => i.id === trans.item_id);
      console.log(`  - Inventory Item: ${invItem?.name || trans.item_id}`);
      console.log(`    Full record:`, trans);
      console.log('');
    });
  }

  // 6. Summary analysis
  console.log('\n=== SUMMARY ANALYSIS ===');
  console.log(`Total Inventory Items: ${inventoryItems?.length || 0}`);
  console.log(`Total Links to Catalog Items: ${menuItemIngredients?.length || 0}`);
  console.log(`Total Order Items: ${orderItems?.length || 0}`);
  console.log(`Total Kiosk Items: ${kioskItems?.length || 0}`);
  console.log(`Total Catalog Items: ${catalogItems?.length || 0}`);
  console.log(`Total Transactions: ${transactions?.length || 0}`);
  console.log(`Total Inventory Transactions: ${inventoryTransactions?.length || 0}`);
  
  // Check if transactions fired inventory deductions
  const consumeTransactions = inventoryTransactions?.filter(t => t.type === 'consume' || t.transaction_type === 'consume');
  console.log(`\nConsume Transactions (deductions): ${consumeTransactions?.length || 0}`);
  
  if (consumeTransactions && consumeTransactions.length > 0) {
    consumeTransactions.forEach(trans => {
      const invItem = inventoryItems?.find(i => i.id === trans.item_id);
      console.log(`  - ${invItem?.name || trans.item_id}: Deducted ${trans.quantity} (ref: ${trans.reference_type})`);
    });
  }

  // TEST: Create a test recipe link
  console.log('\n=== CLEANUP: Removing test recipe link ===');
  if (inventoryItems && inventoryItems.length > 0 && catalogItems && catalogItems.length > 0) {
    const testInvItem = inventoryItems[0];
    const testCatalogItem = catalogItems[0];
    
    const { error: deleteError } = await supabase
      .from('menu_item_ingredients')
      .delete()
      .eq('catalog_item_id', testCatalogItem.id)
      .eq('inventory_item_id', testInvItem.id);
    
    if (deleteError) {
      console.error('Failed to delete test link:', deleteError);
    } else {
      console.log('Test link removed successfully!');
    }
  }
}

run().catch(console.error);
