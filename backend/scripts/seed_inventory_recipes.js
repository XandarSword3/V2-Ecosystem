
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use Service Key for admin rights

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('🌱 Seeding Inventory & Recipes (via Supabase HTTP Client)...');

  try {
    // 1. Get/Create "Food & Beverages" Category
    let categoryId;
    const { data: catNodes, error: catError } = await supabase
      .from('inventory_categories')
      .select('id')
      .eq('name', 'Food & Beverages');

    if (catError) throw new Error(catError.message);

    if (catNodes && catNodes.length > 0) {
      categoryId = catNodes[0].id;
    } else {
      const { data: newCat, error: insertError } = await supabase
        .from('inventory_categories')
        .insert({ name: 'Food & Beverages', description: 'Restaurant ingredients' })
        .select('id')
        .single();
      
      if (insertError) throw new Error(insertError.message);
      categoryId = newCat.id;
    }
    console.log(`✓ Category "Food & Beverages": ${categoryId}`);

    // 2. Upsert Ingredients
    const ingredients = [
      { name: 'Tomato', unit: 'kg', stock: 50 },
      { name: 'Cucumber', unit: 'kg', stock: 50 },
      { name: 'Eggplant', unit: 'kg', stock: 30 },
      { name: 'Lemon', unit: 'kg', stock: 20 },
      { name: 'Olive Oil', unit: 'l', stock: 100 },
      { name: 'Bread', unit: 'pack', stock: 200 },
      { name: 'Lettuce', unit: 'kg', stock: 40 },
      { name: 'Radish', unit: 'kg', stock: 15 },
    ];

    const ingredientMap = new Map(); // Name -> ID

    for (const ing of ingredients) {
      const sku = `ING-${ing.name.substring(0, 3).toUpperCase()}-001`;
      
      // Upsert by SKU
      const { data: item, error: upsertError } = await supabase
        .from('inventory_items')
        .upsert({
          name: ing.name,
          category_id: categoryId,
          unit: ing.unit,
          current_stock: ing.stock,
          min_stock_level: 5,
          sku: sku
        }, { onConflict: 'sku' })
        .select('id, name')
        .single();

      if (upsertError) {
        console.error(`Error upserting ${ing.name}:`, upsertError.message);
        continue;
      }

      ingredientMap.set(item.name, item.id);
      console.log(`  - Upserted ${item.name}`);
    }

    // 3. Link to Menu Items
    const fattoushId = '860bc50c-d85c-41f1-bd0b-55d763314218';
    
    // Hardcoded logic for demo purposes:
    // We assume the menu item 'Fattoush' exists with this ID.
    // If you want to be robust, fetch it first.

    const fattoushIngredients = [
      { name: 'Tomato', qty: 0.2 },
      { name: 'Cucumber', qty: 0.15 },
      { name: 'Lettuce', qty: 0.1 },
      { name: 'Radish', qty: 0.05 },
      { name: 'Bread', qty: 0.5 }, 
      { name: 'Olive Oil', qty: 0.05 },
      { name: 'Lemon', qty: 0.05 },
    ];

    console.log('Linking Fattoush Ingredients...');
    for (const ing of fattoushIngredients) {
      const invId = ingredientMap.get(ing.name);
      if (!invId) continue;

      const { error: linkError } = await supabase
        .from('menu_item_ingredients')
        .upsert({
            menu_item_id: fattoushId,
            inventory_item_id: invId,
            quantity_required: ing.qty,
            unit: 'kg',
            is_optional: false
        }, { onConflict: 'menu_item_id, inventory_item_id' });

      if (linkError) {
          console.error(`Error linking ${ing.name}:`, linkError.message);
      }
    }

    // Baba Ganoush Example
    const babaId = '639386d9-9526-4d2a-8451-8772a806900f';
    const babaIngredients = [
        { name: 'Eggplant', qty: 0.5 },
        { name: 'Olive Oil', qty: 0.05 },
        { name: 'Lemon', qty: 0.05 },
    ];
    console.log('Linking Baba Ganoush Ingredients...');
    for (const ing of babaIngredients) {
        const invId = ingredientMap.get(ing.name);
        if (!invId) continue;
  
        const { error: linkError } = await supabase
          .from('menu_item_ingredients')
          .upsert({
              menu_item_id: babaId,
              inventory_item_id: invId,
              quantity_required: ing.qty,
              unit: 'kg',
              is_optional: false
          }, { onConflict: 'menu_item_id, inventory_item_id' }); // Assuming composite PK
          
        if (linkError) {
             console.error(`Error linking ${ing.name} to Baba Ganoush:`, linkError.message);
        }
    }

    console.log('✅ Seeding Complete.');

  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
