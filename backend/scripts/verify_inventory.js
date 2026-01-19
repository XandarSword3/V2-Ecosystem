
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// 1. Setup
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTest() {
  console.log('🧪 Starting Inventory Auto-Deduction Test (JS)...');

  try {
    // 2. Setup Data
    // Create/Get Inventory Item
    const { data: invItem, error: invError } = await supabase
      .from('inventory_items')
      .upsert({
        name: 'TestTomato',
        unit: 'kg',
        current_stock: 100,
        sku: 'TEST-TOM-001-JS',
        category_id: null // Assuming nullable or triggers handle it
      }, { onConflict: 'sku' })
      .select()
      .single();
    
    if (invError) {
        // Handle category_id if strict
         if(invError.message.includes('category_id')) {
             const { data: cat } = await supabase.from('inventory_categories').select('id').limit(1).single();
             if(cat) {
                 const { data: invRetry, error: retryError } = await supabase.from('inventory_items').upsert({
                    name: 'TestTomato',
                    unit: 'kg',
                    current_stock: 100,
                    sku: 'TEST-TOM-001-JS',
                    category_id: cat.id
                 }, { onConflict: 'sku' }).select().single();
                 if(retryError) throw new Error(retryError.message);
                 // Assign for later
                 Object.assign(invItem || {}, invRetry); 
             }
         } else {
             throw new Error(`Inventory setup failed: ${invError.message}`);
         }
    }
    
    // Safety check if invItem is populated (it might be null if error block executed and retry success, wait logic is messy above)
    // Let's just re-fetch to be safe if upsert failed.
    const { data: finalInvStart } = await supabase.from('inventory_items').select('*').eq('sku', 'TEST-TOM-001-JS').single();
    if(!finalInvStart) throw new Error("Failed to create inventory item");
    console.log(`✓ Inventory Item: ${finalInvStart.name} (Stock: ${finalInvStart.current_stock})`);

    // Create/Get Menu Item 
    const { data: module } = await supabase.from('modules').select('id').limit(1).single();
    if(!module) throw new Error('No modules found');

    // Get Menu Category
    let menuCatId;
    const { data: menuCat } = await supabase.from('menu_categories').select('id').limit(1).single();
    if (menuCat) {
        menuCatId = menuCat.id;
    } else {
        const { data: newCat, error: catError } = await supabase
            .from('menu_categories')
            .insert({ name: 'Test Category', module_id: module.id, sort_order: 1 })
            .select()
            .single();
        if(catError) throw new Error(`Category creation failed: ${catError.message}`);
        menuCatId = newCat.id;
    }

    let menuItem;
    const { data: existingMenu } = await supabase
      .from('menu_items')
      .select('*')
      .eq('name', 'TestSaladJS')
      .single();
    
    if (existingMenu) {
        menuItem = existingMenu;
    } else {
        const { data: newMenu, error: createError } = await supabase
            .from('menu_items')
            .insert({
                name: 'TestSaladJS',
                price: 10,
                module_id: module.id,
                category_id: menuCatId,
                is_available: true,
                description: 'Test Item'
            }) 
            .select()
            .single();
        if(createError) throw new Error(`Menu creation failed: ${createError.message}`);
        menuItem = newMenu;
    }

    console.log(`✓ Menu Item: ${menuItem.name}`);

    // Link them (Recipe: 1 Salad -> 0.5kg Tomato)
    const { error: linkError } = await supabase
      .from('menu_item_ingredients')
      .upsert({
        menu_item_id: menuItem.id,
        inventory_item_id: finalInvStart.id,
        quantity_required: 0.5,
        unit: finalInvStart.unit
      }, { onConflict: 'menu_item_id,inventory_item_id' });
    
    if (linkError) throw new Error(`Link setup failed: ${linkError.message}`);
    console.log(`✓ Linked: 1 ${menuItem.name} requires 0.5 ${finalInvStart.unit} ${finalInvStart.name}`);

    // 3. Create Order
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .insert({
        order_number: `T${Date.now()}`,
        status: 'pending',
        total_amount: 20,
        module_id: module.id,
        order_type: 'dine_in',
        customer_name: 'Test User',
        customer_phone: '12345678',
        subtotal: 20,
        tax_amount: 0,
        service_charge: 0,
        payment_status: 'pending'
      })
      .select()
      .single();

    if (orderError) throw new Error(`Order creation failed: ${orderError.message}`);
    console.log(`✓ Created Order: ${order.order_number}`);

    // Create Order Items
    const { error: itemError } = await supabase
      .from('restaurant_order_items')
      .insert({
        order_id: order.id,
        menu_item_id: menuItem.id,
        quantity: 2,
        unit_price: 10,
        subtotal: 20
      });
    
    if (itemError) throw new Error(`Order Item creation failed: ${itemError.message}`);

    // 4. Trigger Logic (Call the RPC)
    console.log('⚡ Calling deduct_inventory_for_order...');
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'deduct_inventory_for_order',
        { p_order_id: order.id }
    );

    if (rpcError) throw new Error(`RPC failed: ${rpcError.message}`);
    console.log('✓ RPC Result:', rpcResult);

    // 5. Verify
    const { data: finalInv } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', finalInvStart.id)
      .single();

    if (!finalInv) throw new Error('Could not fetch final stock');

    // Expected: 100 - (2 * 0.5) = 99
    // BUT verify restart stock was 100 (upsert might have kept old value if it existed)
    // We should have forced it to 100 in upsert? Yes, logic provided current_stock: 100.
    // DOES upsert update columns if conflict? Defaults to update ALL unless specified.
    // Supabase upsert updates by default.

    console.log(`Stock: ${finalInvStart.current_stock} -> ${finalInv.current_stock}`);
    
    // We compare against the fetched start stock, but if start stock was already reduced from prev run...
    // We set 100 in upsert.
    
    const expectedStock = 99; // 100 - 1

    if (Math.abs(finalInv.current_stock - expectedStock) < 0.01) {
      console.log('✅ TEST PASSED: Inventory deducted correctly.');
    } else {
      console.error(`❌ TEST FAILED: Expected ${expectedStock}, got ${finalInv.current_stock}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ CHECK FAILED:', error.message);
    process.exit(1);
  }
}

runTest();
