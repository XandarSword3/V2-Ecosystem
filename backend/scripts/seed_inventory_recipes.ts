
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log('🌱 Seeding Inventory & Recipes...');

  // 1. Get/Create "Food & Beverages" Category
  let categoryId: string;
  const { data: catData, error: catError } = await supabase
    .from('inventory_categories')
    .select('id')
    .eq('name', 'Food & Beverages')
    .single();

  if (catError && catError.code !== 'PGRST116') {
    throw new Error(`Error fetching category: ${catError.message}`);
  }

  if (catData) {
    categoryId = catData.id;
  } else {
    const { data: newCat, error: createCatError } = await supabase
      .from('inventory_categories')
      .insert({ name: 'Food & Beverages', description: 'Restaurant ingredients' })
      .select('id')
      .single();
    
    if (createCatError) throw new Error(`Error creating category: ${createCatError.message}`);
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

  const ingredientMap = new Map<string, string>(); // Name -> ID

  for (const ing of ingredients) {
    const { data: item, error: itemError } = await supabase
      .from('inventory_items')
      .upsert({
        name: ing.name,
        category_id: categoryId,
        unit: ing.unit,
        current_stock: ing.stock,
        min_stock_level: 5,
        sku: `ING-${ing.name.substring(0, 3).toUpperCase()}-001`
      }, { onConflict: 'sku' })
      .select('id, name')
      .single();

    if (itemError) {
      console.error(`Error Upserting ${ing.name}:`, itemError.message);
    } else {
      ingredientMap.set(item.name, item.id);
      console.log(`  - Upserted ${item.name}`);
    }
  }

  // 3. Link to Menu Items
  // Fattoush ID: 860bc50c-d85c-41f1-bd0b-55d763314218
  // Baba Ganoush ID: 20d64112-e2c9-49b3-97cb-b49b8d8c3b62
  
  // Fattoush Recipe
  const fattoushId = '860bc50c-d85c-41f1-bd0b-55d763314218';
  const fattoushIngredients = [
    { name: 'Tomato', qty: 0.2 },
    { name: 'Cucumber', qty: 0.15 },
    { name: 'Lettuce', qty: 0.1 },
    { name: 'Radish', qty: 0.05 },
    { name: 'Bread', qty: 0.5 }, // 0.5 pack
    { name: 'Olive Oil', qty: 0.05 },
    { name: 'Lemon', qty: 0.05 },
  ];

  console.log('Linking Fattoush Ingredients...');
  for (const ing of fattoushIngredients) {
    const invId = ingredientMap.get(ing.name);
    if (!invId) continue;

    const { error } = await supabase
      .from('menu_item_ingredients')
      .upsert({
        menu_item_id: fattoushId,
        inventory_item_id: invId,
        quantity_required: ing.qty,
        unit: 'kg', // Defaulting unit for simplicity of this script
        is_optional: false
      }, { onConflict: 'menu_item_id,inventory_item_id' }); // Schema constraint unique

    if (error) console.error(`Failed to link ${ing.name}:`, error.message);
  }

  // Baba Ganoush Recipe
  const babaId = '20d64112-e2c9-49b3-97cb-b49b8d8c3b62';
  const babaIngredients = [
    { name: 'Eggplant', qty: 0.3 },
    { name: 'Olive Oil', qty: 0.05 },
    { name: 'Lemon', qty: 0.05 },
    { name: 'Bread', qty: 1 }, // 1 pack
  ];

  console.log('Linking Baba Ganoush Ingredients...');
  for (const ing of babaIngredients) {
    const invId = ingredientMap.get(ing.name);
    if (!invId) continue;

    const { error } = await supabase
      .from('menu_item_ingredients')
      .upsert({
        menu_item_id: babaId,
        inventory_item_id: invId,
        quantity_required: ing.qty,
        unit: 'kg',
        is_optional: false
      }, { onConflict: 'menu_item_id,inventory_item_id' });

    if (error) console.error(`Failed to link ${ing.name}:`, error.message);
  }

  console.log('✅ Seeding Complete');
}

seed().catch(console.error);
