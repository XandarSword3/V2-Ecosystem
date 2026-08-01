const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkTransaction() {
  const userId = 'a30a02f5-8022-46bc-b23b-f3e46166a1e4';
  const propertyId = '00000000-0000-0000-0000-000000000001';
  
  console.log('Checking transactions for user:', userId);
  console.log('With property_id filter:', propertyId);
  
  // Check with property filter
  const { data: transactionsWithProp, error: errorWithProp } = await supabase
    .from('transactions')
    .select('id, engine_type, amount, tax_amount, discount_amount, status, created_at, customer_id, property_id, module_id, metadata')
    .eq('customer_id', userId)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });

  console.log('With property filter - Found:', transactionsWithProp?.length || 0);
  if (errorWithProp) console.error('Error with property filter:', errorWithProp);

  // Check without property filter
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, engine_type, amount, tax_amount, discount_amount, status, created_at, customer_id, property_id, module_id, metadata')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${transactions.length} transactions:`);
  transactions.forEach(tx => {
    console.log('\n--- Transaction ---');
    console.log('ID:', tx.id);
    console.log('Engine Type:', tx.engine_type);
    console.log('Amount:', tx.amount);
    console.log('Total Amount:', tx.total_amount);
    console.log('Tax Amount:', tx.tax_amount);
    console.log('Discount Amount:', tx.discount_amount);
    console.log('Status:', tx.status);
    console.log('Property ID:', tx.property_id);
    console.log('Module ID:', tx.module_id);
    console.log('Created At:', tx.created_at);
    console.log('Metadata:', JSON.stringify(tx.metadata, null, 2));
  });
  
  // Also check payments
  console.log('\n\n--- Payments ---');
  const { data: payments, error: payError } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (payError) {
    console.error('Error fetching payments:', payError);
  } else {
    console.log(`Found ${payments.length} payments:`);
    payments.forEach(pay => {
      console.log('\n--- Payment ---');
      console.log('ID:', pay.id);
      console.log('Reference Type:', pay.reference_type);
      console.log('Reference ID:', pay.reference_id);
      console.log('Amount:', pay.amount);
      console.log('Status:', pay.status);
      console.log('Method:', pay.method);
      console.log('Created At:', pay.created_at);
    });
  }
}

checkTransaction().catch(console.error);
