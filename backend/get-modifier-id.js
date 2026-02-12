const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Remove quotes if present
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/^"|"$/g, '');
const supabaseKey = (process.env.SUPABASE_SERVICE_KEY || '').replace(/^"|"$/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Check if there are any orders at all
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .limit(5);
    
  console.log('Orders query result:', orders?.length, 'orders found');
  if (error) console.error('Orders error:', error);
  
  // Check restaurant_orders table instead
  const { data: restOrders, error: restError } = await supabase
    .from('restaurant_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
    
  console.log('\\nRestaurant orders:', restOrders?.length, 'found');
  if (restError) console.error('Restaurant orders error:', restError);
  
  if (restOrders?.length > 0) {
    console.log('Most recent order:', JSON.stringify(restOrders[0], null, 2));
    
    // Get order items
    const { data: items } = await supabase
      .from('restaurant_order_items')
      .select('*')
      .eq('order_id', restOrders[0].id);
    
    console.log('\\nOrder items:', JSON.stringify(items, null, 2));
  }
}

main();
