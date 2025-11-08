const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function debugWebhookLogs() {
  console.log('Checking webhook logs for event ID...');

  const { data: payment } = await supabase
    .from('payments')
    .select('payment_event_id')
    .ilike('customer_email', 'sophimaureen@gmail.com')
    .single();

  if (!payment) {
    console.log('No payment found');
    return;
  }

  console.log('Payment event ID:', payment.payment_event_id);

  const { data: log } = await supabase
    .from('webhook_logs')
    .select('*')
    .contains('payload', { id: payment.payment_event_id })
    .limit(1);

  if (log && log.length > 0) {
    console.log('FOUND webhook log!');
  } else {
    console.log('NO webhook log found - checking all logs...');
    
    const { data: allLogs } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('source', 'stripe');
      
    console.log('Total Stripe logs:', allLogs ? allLogs.length : 0);
    
    if (allLogs && allLogs.length > 0) {
      console.log('Sample log columns:', Object.keys(allLogs[0]));
    }
  }
}

debugWebhookLogs().catch(console.error);
