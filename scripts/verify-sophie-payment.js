const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function verifyContactEmail() {
  console.log('Checking contact email history...\n');
  
  // Get the contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', 'f3b45fad-7d85-490e-8bc6-a22a296aaeae')
    .single();
    
  console.log('Contact details:');
  console.log('  ID:', contact.id);
  console.log('  Created:', contact.created_at);
  console.log('  Updated:', contact.updated_at);
  console.log('  Email Primary:', contact.email_primary);
  console.log('  Email Booking:', contact.email_booking);
  console.log('  Email Payment:', contact.email_payment);
  console.log('');
  
  console.log('Key timestamps:');
  console.log('  Contact created: Sept 17, 2025');
  console.log('  First webhook:   Nov 5, 2025 2:04 PM');
  console.log('  Second webhook:  Nov 7, 2025 12:20 AM');
  console.log('  Contact updated:', contact.updated_at);
  console.log('');
  
  // Check if email was added AFTER the webhook attempts
  const contactUpdated = new Date(contact.updated_at);
  const firstWebhook = new Date('2025-11-05T14:04:37Z');
  const secondWebhook = new Date('2025-11-07T00:20:26Z');
  
  if (contactUpdated < firstWebhook) {
    console.log('✅ Contact email existed BEFORE both webhooks');
  } else if (contactUpdated < secondWebhook) {
    console.log('⚠️  Contact updated AFTER first webhook but BEFORE second');
  } else {
    console.log('❌ Contact updated AFTER both webhooks');
  }
  
  console.log('');
  console.log('Testing RPC with exact email:');
  const { data: result } = await supabase
    .rpc('find_contact_by_email', { search_email: 'sophimaureen@gmail.com' });
  console.log('  Result:', result);
}

verifyContactEmail().catch(console.error);
