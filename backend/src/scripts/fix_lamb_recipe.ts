
import { getSupabase } from "../database/connection";
import { logger } from "../utils/logger";

async function fixRecipe() {
  const supabase = getSupabase();

  // 1. Get Lamb Kofta Menu Item ID
  const { data: menuItems, error: menuError } = await supabase
    .from('menu_items')
    .select('id, name')
    .ilike('name', '%Lamb Kofta%')
    .single();

  if (menuError || !menuItems) {
    logger.error("Lamb Kofta menu item not found", menuError);
    return;
  }
  logger.info(`Found Menu Item: ${menuItems.name} (${menuItems.id})`);

  // 2. Get Lamb Mince Inventory Item ID
  const { data: inventoryItems, error: invError } = await supabase
    .from('inventory_items') // Verify table name, usually inventory_items
    .select('id, name')
    .ilike('name', '%Lamb Mince%')
    .single();

  if (invError || !inventoryItems) {
    logger.error("Lamb Mince inventory item not found", invError);
    // Try creating it if missing? I added it via UI, so it should be there.
    return;
  }
  logger.info(`Found Inventory Item: ${inventoryItems.name} (${inventoryItems.id})`);

  // 3. Link them
  const { error: insertError } = await supabase
    .from('menu_item_ingredients')
    .insert({
      menu_item_id: menuItems.id,
      inventory_item_id: inventoryItems.id,
      quantity: 0.2, // 200g
      unit: 'kg'
    });

  if (insertError) {
    logger.error("Failed to link ingredients", insertError);
  } else {
    logger.info("Successfully linked Lamb Mince to Lamb Kofta!");
  }
}

fixRecipe();
