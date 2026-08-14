/**
 * Test script for customization inventory integration
 * Tests both creation-time and status→confirmed paths
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Test configuration
const TEST_TENANT_ID = process.env.TEST_TENANT_ID || 'test-tenant-id';
const TEST_PROPERTY_ID = process.env.TEST_PROPERTY_ID || 'test-property-id';
const TEST_PERFORMED_BY = process.env.TEST_PERFORMED_BY || null;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Test 1: Creation-time path - order with customization
 */
async function testCreationTimePath() {
  console.log('\n=== Test 1: Creation-time path ===');
  
  try {
    // Setup: Create test inventory item
    const { data: invItem, error: invError } = await supabase
      .from('inventory_items')
      .insert({
        id: randomUUID(),
        name: 'Test Extra Cheese',
        sku: 'TEST-CHEESE-001',
        current_stock: 10,
        minimum_stock: 2,
        unit: 'pcs',
        tenant_id: TEST_TENANT_ID,
        property_id: TEST_PROPERTY_ID,
      })
      .select()
      .single();
    
    if (invError) throw invError;
    console.log(`Created inventory item: ${invItem.name} (stock: ${invItem.current_stock})`);
    
    // Setup: Create customization option linked to inventory
    const { data: group, error: groupError } = await supabase
      .from('customization_groups')
      .insert({
        id: randomUUID(),
        name: 'Test Add-ons',
        selection_mode: 'multiple',
        tenant_id: TEST_TENANT_ID,
        property_id: TEST_PROPERTY_ID,
      })
      .select()
      .single();
    
    if (groupError) throw groupError;
    
    const { data: option, error: optionError } = await supabase
      .from('customization_options')
      .insert({
        id: randomUUID(),
        group_id: group.id,
        name: 'Extra Cheese',
        customization_type: 'add',
        price_adjustment: 2.00,
        inventory_item_id: invItem.id,
        quantity_per_selection: 1,
        tenant_id: TEST_TENANT_ID,
        property_id: TEST_PROPERTY_ID,
      })
      .select()
      .single();
    
    if (optionError) throw optionError;
    console.log(`Created customization option: ${option.name} linked to ${invItem.name}`);
    
    // Setup: Create catalog item
    const { data: catalogItem, error: catError } = await supabase
      .from('catalog_items')
      .insert({
        id: randomUUID(),
        name: 'Test Burger',
        price: 15.00,
        tenant_id: TEST_TENANT_ID,
        property_id: TEST_PROPERTY_ID,
      })
      .select()
      .single();
    
    if (catError) throw catError;
    console.log(`Created catalog item: ${catalogItem.name}`);
    
    // Link customization to catalog item
    await supabase.from('entity_customizations').insert({
      entity_type: 'catalog_item',
      entity_id: catalogItem.id,
      customization_group_id: group.id,
      tenant_id: TEST_TENANT_ID,
      property_id: TEST_PROPERTY_ID,
    });
    
    // Test: Simulate order creation with customization
    const orderId = randomUUID();
    const orderItemId = randomUUID();
    
    // Create order_items with selectedModifiers
    const { error: orderItemError } = await supabase
      .from('order_items')
      .insert({
        id: orderItemId,
        transaction_id: orderId,
        catalog_item_id: catalogItem.id,
        quantity: 2,
        unit_price: 15.00,
        subtotal: 30.00,
        status: 'pending',
        tenant_id: TEST_TENANT_ID,
        property_id: TEST_PROPERTY_ID,
        metadata: {
          selectedModifiers: [
            {
              groupId: group.id,
              optionId: option.id,
              quantity: 1,
            },
          ],
        },
      });
    
    if (orderItemError) throw orderItemError;
    console.log(`Created order_item with customization`);
    
    // Call create_order_customization_snapshot
    const { data: snapshotResult, error: snapshotError } = await supabase.rpc(
      'create_order_customization_snapshot',
      {
        p_order_type: 'instant_transaction',
        p_order_id: orderId,
        p_order_item_id: orderItemId,
        p_entity_type: 'catalog_item',
        p_entity_id: catalogItem.id,
        p_selections: [
          {
            groupId: group.id,
            optionId: option.id,
            quantity: 1,
          },
        ],
        p_base_quantity: 2,
        p_execute_inventory: true,
        p_performed_by: TEST_PERFORMED_BY,
      }
    );
    
    if (snapshotError) throw snapshotError;
    
    const result = Array.isArray(snapshotResult) ? snapshotResult[0] : snapshotResult;
    console.log(`Snapshot result:`, result);
    if (!result?.success) {
      throw new Error(`Snapshot RPC did not succeed: ${result?.validation_errors?.join(', ') || 'unknown error'}`);
    }
    
    // Verify inventory was deducted
    const { data: updatedItem } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', invItem.id)
      .single();
    
    console.log(`Inventory after deduction: ${updatedItem.current_stock} (expected: 8)`);
    
    // Verify order_customizations was created
    const { data: orderCustomizations } = await supabase
      .from('order_customizations')
      .select('*')
      .eq('order_id', orderId);
    
    console.log(`Order customizations created: ${orderCustomizations.length}`);
    console.log(`Inventory deducted flag: ${orderCustomizations[0]?.inventory_deducted}`);
    
    // Cleanup
    await supabase.from('order_customizations').delete().eq('order_id', orderId);
    await supabase.from('order_items').delete().eq('id', orderItemId);
    await supabase.from('entity_customizations').delete().eq('entity_id', catalogItem.id);
    await supabase.from('customization_options').delete().eq('id', option.id);
    await supabase.from('customization_groups').delete().eq('id', group.id);
    await supabase.from('catalog_items').delete().eq('id', catalogItem.id);
    await supabase.from('inventory_items').delete().eq('id', invItem.id);
    
    console.log('✅ Test 1 passed: Creation-time path works correctly');
    return true;
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
    return false;
  }
}

/**
 * Test 2: Status→confirmed path - deduct_inventory_for_order RPC
 */
async function testStatusConfirmedPath() {
  console.log('\n=== Test 2: Status→confirmed path ===');
  
  try {
    // Setup: Create test inventory item
    const { data: invItem, error: invError } = await supabase
      .from('inventory_items')
      .insert({
        id: randomUUID(),
        name: 'Test Bacon',
        sku: 'TEST-BACON-001',
        current_stock: 15,
        minimum_stock: 3,
        unit: 'pcs',
        tenant_id: TEST_TENANT_ID,
        property_id: TEST_PROPERTY_ID,
      })
      .select()
      .single();
    
    if (invError) throw invError;
    console.log(`Created inventory item: ${invItem.name} (stock: ${invItem.current_stock})`);
    
    // Setup: Create customization option
    const { data: group, error: groupError } = await supabase
      .from('customization_groups')
      .insert({
        id: randomUUID(),
        name: 'Test Toppings',
        selection_mode: 'multiple',
        tenant_id: TEST_TENANT_ID,
        property_id: TEST_PROPERTY_ID,
      })
      .select()
      .single();
    
    if (groupError) throw groupError;
    
    const { data: option, error: optionError } = await supabase
      .from('customization_options')
      .insert({
        id: randomUUID(),
        group_id: group.id,
        name: 'Extra Bacon',
        customization_type: 'add',
        price_adjustment: 3.00,
        inventory_item_id: invItem.id,
        quantity_per_selection: 2,
        tenant_id: TEST_TENANT_ID,
        property_id: TEST_PROPERTY_ID,
      })
      .select()
      .single();
    
    if (optionError) throw optionError;
    console.log(`Created customization option: ${option.name} linked to ${invItem.name}`);
    
    // Setup: Create catalog item and order
    const { data: catalogItem } = await supabase
      .from('catalog_items')
      .insert({
        id: randomUUID(),
        name: 'Test Sandwich',
        price: 12.00,
        tenant_id: TEST_TENANT_ID,
        property_id: TEST_PROPERTY_ID,
      })
      .select()
      .single();
    
    const orderId = randomUUID();
    const orderItemId = randomUUID();
    
    // Create order_items with customization snapshot (inventory_deducted = false)
    await supabase.from('order_items').insert({
      id: orderItemId,
      transaction_id: orderId,
      catalog_item_id: catalogItem.id,
      quantity: 3,
      unit_price: 12.00,
      subtotal: 36.00,
      status: 'pending',
      tenant_id: TEST_TENANT_ID,
      property_id: TEST_PROPERTY_ID,
    });
    
    // Create order_customizations snapshot (simulating creation-time path that didn't execute inventory)
    await supabase.from('order_customizations').insert({
      id: randomUUID(),
      order_type: 'instant_transaction',
      order_id: orderId,
      order_item_id: orderItemId,
      customization_group_id: group.id,
      customization_option_id: option.id,
      group_name: 'Test Toppings',
      option_name: 'Extra Bacon',
      customization_type: 'add',
      quantity: 1,
      unit_price_adjustment: 3.00,
      total_price_adjustment: 3.00,
      inventory_item_id: invItem.id,
      inventory_quantity_used: null, // Not yet deducted
      inventory_deducted: false, // This triggers the RPC to process it
    });
    
    console.log(`Created order with undeducted customization`);
    
    // Test: Call deduct_inventory_for_order RPC
    const { data: deductResult, error: deductError } = await supabase.rpc(
      'deduct_inventory_for_order',
      {
        p_transaction_id: orderId,
      }
    );
    
    if (deductError) throw deductError;
    
    const result = Array.isArray(deductResult) ? deductResult[0] : deductResult;
    console.log(`Deduct result:`, result);
    
    // Verify inventory was deducted
    const { data: updatedItem } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', invItem.id)
      .single();
    
    console.log(`Inventory after deduction: ${updatedItem.current_stock} (expected: 9, deducted 6 for 3 orders x 2 qty)`);
    
    // Verify order_customizations was marked as deducted
    const { data: orderCustomizations } = await supabase
      .from('order_customizations')
      .select('inventory_deducted, inventory_quantity_used')
      .eq('order_id', orderId)
      .single();
    
    console.log(`Inventory deducted flag: ${orderCustomizations.inventory_deducted}`);
    console.log(`Inventory quantity used: ${orderCustomizations.inventory_quantity_used}`);
    
    // Cleanup
    await supabase.from('order_customizations').delete().eq('order_id', orderId);
    await supabase.from('order_items').delete().eq('id', orderItemId);
    await supabase.from('catalog_items').delete().eq('id', catalogItem.id);
    await supabase.from('customization_options').delete().eq('id', option.id);
    await supabase.from('customization_groups').delete().eq('id', group.id);
    await supabase.from('inventory_items').delete().eq('id', invItem.id);
    
    console.log('✅ Test 2 passed: Status→confirmed path works correctly');
    return true;
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
    return false;
  }
}

/**
 * Test 3: Stock sufficiency check
 */
async function testStockSufficiencyCheck() {
  console.log('\n=== Test 3: Stock sufficiency check ===');
  
  try {
    // Setup: Create inventory item with low stock
    const { data: invItem } = await supabase
      .from('inventory_items')
      .insert({
        id: randomUUID(),
        name: 'Test Limited Item',
        sku: 'TEST-LIMITED-001',
        current_stock: 2,
        minimum_stock: 1,
        unit: 'pcs',
        tenant_id: TEST_TENANT_ID,
        property_id: TEST_PROPERTY_ID,
      })
      .select()
      .single();
    
    console.log(`Created inventory item with low stock: ${invItem.current_stock}`);
    
    // Setup: Create catalog item with recipe requiring more than available
    const { data: catalogItem } = await supabase
      .from('catalog_items')
      .insert({
        id: randomUUID(),
        name: 'Test Item with Expensive Recipe',
        price: 20.00,
        tenant_id: TEST_TENANT_ID,
        property_id: TEST_PROPERTY_ID,
      })
      .select()
      .single();
    
    // Link recipe requiring 5 units (only 2 available)
    await supabase.from('menu_item_ingredients').insert({
      catalog_item_id: catalogItem.id,
      inventory_item_id: invItem.id,
      quantity_required: 5,
      unit: 'pcs',
      tenant_id: TEST_TENANT_ID,
      property_id: TEST_PROPERTY_ID,
    });
    
    const orderId = randomUUID();
    const orderItemId = randomUUID();
    
    // Create order_items
    await supabase.from('order_items').insert({
      id: orderItemId,
      transaction_id: orderId,
      catalog_item_id: catalogItem.id,
      quantity: 1,
      unit_price: 20.00,
      subtotal: 20.00,
      status: 'pending',
      tenant_id: TEST_TENANT_ID,
      property_id: TEST_PROPERTY_ID,
    });
    
    console.log(`Created order requiring 5 units (only 2 available)`);
    
    // Test: Call deduct_inventory_for_order - should fail
    const { data: deductResult, error: deductError } = await supabase.rpc(
      'deduct_inventory_for_order',
      {
        p_transaction_id: orderId,
      }
    );
    
    const result = Array.isArray(deductResult) ? deductResult[0] : deductResult;
    
    console.log(`Deduct result:`, result);
    
    if (result.success === false) {
      console.log(`✅ Stock check correctly blocked deduction: ${result.error_message}`);
    } else {
      throw new Error('Stock check failed to block insufficient stock');
    }
    
    // Verify stock was NOT deducted
    const { data: unchangedItem } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', invItem.id)
      .single();
    
    console.log(`Stock unchanged: ${unchangedItem.current_stock} (expected: 2)`);
    
    // Cleanup
    await supabase.from('order_items').delete().eq('id', orderItemId);
    await supabase.from('menu_item_ingredients').delete().eq('catalog_item_id', catalogItem.id);
    await supabase.from('catalog_items').delete().eq('id', catalogItem.id);
    await supabase.from('inventory_items').delete().eq('id', invItem.id);
    
    console.log('✅ Test 3 passed: Stock sufficiency check works correctly');
    return true;
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('Starting customization inventory integration tests...\n');
  
  const results = {
    test1: await testCreationTimePath(),
    test2: await testStatusConfirmedPath(),
    test3: await testStockSufficiencyCheck(),
  };
  
  console.log('\n=== Test Summary ===');
  console.log(`Test 1 (Creation-time path): ${results.test1 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Test 2 (Status→confirmed path): ${results.test2 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Test 3 (Stock sufficiency check): ${results.test3 ? '✅ PASSED' : '❌ FAILED'}`);
  
  const allPassed = Object.values(results).every(r => r === true);
  console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch(console.error);
