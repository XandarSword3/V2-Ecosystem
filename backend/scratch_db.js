require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  // Query metadata of columns for users, loyalty_members, and loyalty_point_batches
  // We can select one row from each table and log the keys
  
  const { data: user } = await supabase.from('users').select('*').limit(1);
  console.log('User columns:', user ? Object.keys(user[0]) : 'None');
  
  const { data: member } = await supabase.from('loyalty_members').select('*').limit(1);
  console.log('Loyalty member columns:', member ? Object.keys(member[0]) : 'None');
  
  const { data: batch } = await supabase.from('loyalty_point_batches').select('*').limit(1);
  console.log('Loyalty point batch columns:', batch ? Object.keys(batch[0]) : 'None');
  
  const { data: flag } = await supabase.from('loyalty_fraud_flags').select('*').limit(1);
  console.log('Loyalty fraud flag columns:', flag ? Object.keys(flag[0]) : 'None');
}

run().catch(console.error);
