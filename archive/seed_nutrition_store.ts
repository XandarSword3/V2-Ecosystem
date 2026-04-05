// Seed script for Nutrition Store items
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://dfneswicpdprhneeqlsn.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbmVzd2ljcGRwcmhuZWVxbHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA5NDIzNSwiZXhwIjoyMDgyNjcwMjM1fQ.N1pHUMHaQWDevK1CIG6pN8re5Qr2cX5jfJSoE9UoHP8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const NUTRITION_MODULE_ID = 'd36108da-e9a2-469c-9288-af51c0aebf73';
const CATEGORY_ID = '144f9091-4985-4c18-a166-f7b8a584f8ff';

async function seedNutritionStore() {
  console.log('Seeding Nutrition Store...');

  // Add menu items
  const items = [
    {
      name: 'Whey Protein Isolate',
      description: 'Premium 100% whey protein isolate - 2lb tub. 25g protein per serving.',
      price: 49.99,
      category_id: CATEGORY_ID,
      module_id: NUTRITION_MODULE_ID,
      is_available: true,
      is_featured: true,
    },
    {
      name: 'Pre-Workout Energy',
      description: 'High-performance pre-workout formula. Explosive energy and focus.',
      price: 34.99,
      category_id: CATEGORY_ID,
      module_id: NUTRITION_MODULE_ID,
      is_available: true,
      is_featured: true,
    },
    {
      name: 'BCAA Recovery',
      description: 'Branch chain amino acids for muscle recovery. 30 servings.',
      price: 29.99,
      category_id: CATEGORY_ID,
      module_id: NUTRITION_MODULE_ID,
      is_available: true,
      is_featured: false,
    },
    {
      name: 'Creatine Monohydrate',
      description: 'Pure creatine monohydrate for strength and power. 60 servings.',
      price: 24.99,
      category_id: CATEGORY_ID,
      module_id: NUTRITION_MODULE_ID,
      is_available: true,
      is_featured: false,
    },
    {
      name: 'Protein Bar Box (12 pack)',
      description: 'Delicious protein bars with 20g protein each. Mixed flavors.',
      price: 29.99,
      category_id: CATEGORY_ID,
      module_id: NUTRITION_MODULE_ID,
      is_available: true,
      is_featured: true,
    },
  ];

  const { data, error } = await supabase
    .from('menu_items')
    .insert(items)
    .select();

  if (error) {
    console.error('Error inserting items:', error);
    return;
  }

  console.log('Successfully created items:', data?.length);
  console.log(data);
}

seedNutritionStore().catch(console.error);
