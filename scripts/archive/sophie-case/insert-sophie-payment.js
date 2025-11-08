const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkMultipleAttempts() {
  const eventId = 'evt_1SQ7KACZF69l9GkpkKPMdoLO';
  
  console.log('Searching for ALL webhook logs with this event ID...\n');
  
  const { data: logs } = await supabase
    .from('webhook_logs')
    .select('*')
    .contains('payload', { id: eventId })
    .order('created_at', { ascending: true });
    
  console.log(`Found ${logs ? logs.length : 0} webhook log(s)\n`);
  
  if (logs && logs.length > 0) {
    logs.forEach((log, i) => {
      console.log(`Attempt ${i + 1}:`);
      console.log(`  Logged at: ${log.created_at}`);
      console.log(`  Status: ${log.status}`);
      console.log(`  Error: ${log.error_message || 'none'}`);
      console.log('');
    });
  }
  
  // Also check payments table for this event
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('payment_event_id', eventId);
    
  console.log(`\nPayments with this event ID: ${payments ? payments.length : 0}\n`);
  
  if (payments && payments.length > 0) {
    payments.forEach((p, i) => {
      console.log(`Payment ${i + 1}:`);
      console.log(`  Created at: ${p.created_at}`);
      console.log(`  Contact ID: ${p.contact_id || 'NULL'}`);
      console.log(`  Email: ${p.customer_email}`);
      console.log('');
    });
  }
}

checkMultipleAttempts().catch(console.error);
