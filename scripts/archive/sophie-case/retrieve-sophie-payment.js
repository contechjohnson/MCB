const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function getWebhookDetails() {
  const { data: payment } = await supabase
    .from('payments')
    .select('payment_event_id')
    .ilike('customer_email', 'sophimaureen@gmail.com')
    .single();

  if (!payment) {
    console.log('No payment found');
    return;
  }

  const { data: logs } = await supabase
    .from('webhook_logs')
    .select('*')
    .contains('payload', { id: payment.payment_event_id });

  if (logs && logs.length > 0) {
    const log = logs[0];
    console.log('===== WEBHOOK LOG DETAILS =====');
    console.log('Event Type:', log.event_type);
    console.log('Status:', log.status);
    console.log('Error Message:', log.error_message || 'none');
    console.log('Created:', log.created_at);
    console.log('');
    
    // Extract email from payload
    const payload = log.payload;
    const email = payload?.data?.object?.customer_details?.email;
    console.log('Email in webhook payload:', email);
    console.log('');
    
    // Now test if find_contact_by_email would have found the contact
    console.log('Testing find_contact_by_email RPC...');
    const { data: contactId, error } = await supabase
      .rpc('find_contact_by_email', { search_email: email?.toLowerCase() });
      
    if (error) {
      console.log('ERROR calling find_contact_by_email:', error);
    } else {
      console.log('find_contact_by_email returned:', contactId);
      
      if (!contactId) {
        console.log('');
        console.log('THIS IS THE ISSUE:');
        console.log('find_contact_by_email returned NULL');
        console.log('The RPC function could not find the contact');
      }
    }
  }
}

getWebhookDetails().catch(console.error);
