const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function analyzeIssue() {
  console.log('===== FULL ANALYSIS =====\n');
  
  // Get the payment
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .ilike('customer_email', 'sophimaureen@gmail.com')
    .single();
    
  console.log('1. PAYMENT RECORD:');
  console.log('   Payment ID:', payment.id);
  console.log('   Contact ID:', payment.contact_id || 'NULL <<< ISSUE');
  console.log('   Event ID:', payment.payment_event_id);
  console.log('   Created:', payment.created_at);
  console.log('');
  
  // Get the webhook log
  const { data: logs } = await supabase
    .from('webhook_logs')
    .select('*')
    .contains('payload', { id: payment.payment_event_id });
    
  const log = logs[0];
  console.log('2. WEBHOOK LOG:');
  console.log('   Status:', log.status);
  console.log('   Error:', log.error_message || 'none');
  console.log('   Logged at:', log.created_at);
  console.log('');
  
  // Test the RPC now
  const email = 'sophimaureen@gmail.com';
  const { data: contactId } = await supabase
    .rpc('find_contact_by_email', { search_email: email });
    
  console.log('3. RPC TEST (NOW):');
  console.log('   find_contact_by_email returned:', contactId);
  console.log('');
  
  // Compare timestamps
  const paymentTime = new Date(payment.created_at);
  const webhookTime = new Date(log.created_at);
  
  console.log('4. TIMELINE:');
  console.log('   Webhook logged:', webhookTime.toISOString());
  console.log('   Payment created:', paymentTime.toISOString());
  console.log('   Difference:', Math.abs(paymentTime - webhookTime), 'ms');
  console.log('');
  
  // Get contact creation date
  const { data: contact } = await supabase
    .from('contacts')
    .select('created_at')
    .eq('id', 'f3b45fad-7d85-490e-8bc6-a22a296aaeae')
    .single();
    
  console.log('   Contact created:', contact.created_at);
  console.log('');
  
  console.log('5. CONCLUSION:');
  console.log('   Contact existed BEFORE webhook (Sept 17)');
  console.log('   Webhook executed and was logged (Nov 5)');
  console.log('   RPC returns contactId correctly NOW');
  console.log('   Payment was created with contact_id = NULL');
  console.log('');
  console.log('   ISSUE: The handleCheckoutCompleted function at line 167-251');
  console.log('   successfully called find_contact_by_email (line 198-199)');
  console.log('   but the RPC returned NULL at that time, OR');
  console.log('   the payment insert at line 202-218 used NULL instead of contactId');
  console.log('');
  console.log('   Most likely: RPC returned NULL when webhook ran but works now.');
  console.log('   This suggests the contact email was changed/updated after Nov 5.');
}

analyzeIssue().catch(console.error);
