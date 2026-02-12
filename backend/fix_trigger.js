const { createClient } = require('@supabase/supabase-js');
const dayjs = require('dayjs');

const supabase = createClient(
  'https://dfneswicpdprhneeqlsn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbmVzd2ljcGRwcmhuZWVxbHNuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA5NDIzNSwiZXhwIjoyMDgyNjcwMjM1fQ.N1pHUMHaQWDevK1CIG6pN8re5Qr2cX5jfJSoE9UoHP8'
);

function generateTicketNumber() {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `P-${date}-${random}`;
}

async function run() {
  try {
    console.log('Testing full ticket insert after trigger drop...');
    
    // Get a valid session first
    const { data: sessions, error: sessError } = await supabase
      .from('pool_sessions')
      .select('*')
      .limit(1);
    
    if (sessError || !sessions?.length) {
      console.log('No sessions found:', sessError?.message);
      return;
    }
    
    const session = sessions[0];
    console.log('Using session:', session.name);
    
    const ticketNumber = generateTicketNumber();
    const targetDate = dayjs().startOf('day').toISOString();
    
    // Try to insert a ticket like the backend does
    const { data, error } = await supabase
      .from('pool_tickets')
      .insert({
        ticket_number: ticketNumber,
        session_id: session.id,
        module_id: session.module_id,
        customer_name: 'Test User',
        customer_phone: '1234567890',
        ticket_date: targetDate,
        number_of_guests: 1,
        total_amount: '10.00',
        status: 'valid',
        payment_status: 'pending',
        payment_method: 'cash',
        qr_code: 'test-qr-code',
      })
      .select()
      .single();
    
    if (error) {
      console.log('Insert error:', error.message);
      console.log('Error details:', error.details);
      console.log('Error hint:', error.hint);
    } else {
      console.log('Insert successful!');
      console.log('Ticket created:', data.id, data.ticket_number);
      
      // Clean up test record
      await supabase.from('pool_tickets').delete().eq('id', data.id);
      console.log('Test record deleted');
    }
    
    console.log('Done!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
