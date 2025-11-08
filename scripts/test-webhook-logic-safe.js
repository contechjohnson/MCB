const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function testWebhookLogic() {
  console.log('🧪 SIMULATING WEBHOOK LOGIC (no writes)\n');
  console.log('Testing with: sophimaureen@gmail.com\n');
  console.log('='.repeat(60));
  
  const email = 'sophimaureen@gmail.com';
  
  // Step 1: Call find_contact_by_email (exactly like webhook does)
  console.log('\n1️⃣ Calling find_contact_by_email RPC...');
  const { data: contactId, error: rpcError } = await supabase
    .rpc('find_contact_by_email', { search_email: email });
  
  if (rpcError) {
    console.log('❌ RPC ERROR:', rpcError);
    console.log('   This is the bug - webhook doesnt check this!');
  } else {
    console.log('✅ RPC succeeded');
  }
  
  console.log('   Returned contact_id:', contactId || 'NULL');
  
  // Step 2: Show what would be inserted
  console.log('\n2️⃣ What would be inserted into payments table:');
  const mockPayment = {
    contact_id: contactId || null,
    customer_email: email,
    amount: 2250,
    status: 'paid'
  };
  
  console.log(JSON.stringify(mockPayment, null, 2));
  
  if (!contactId) {
    console.log('\n⚠️  WARNING: Payment would be orphaned (contact_id = NULL)');
  } else {
    console.log('\n✅ Payment would be correctly linked to contact:', contactId);
  }
  
  // Step 3: Verify contact exists
  console.log('\n3️⃣ Verifying contact exists in database...');
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('id, email_primary, email_booking, email_payment')
    .or(`email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`)
    .single();
    
  if (contactError) {
    console.log('❌ Contact query error:', contactError);
  } else if (contact) {
    console.log('✅ Contact exists:');
    console.log('   ID:', contact.id);
    console.log('   Primary:', contact.email_primary);
    console.log('   Booking:', contact.email_booking);
    console.log('   Payment:', contact.email_payment);
  } else {
    console.log('❌ No contact found');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULT');
  console.log('='.repeat(60));
  
  if (contactId && contact) {
    console.log('✅ PASS: Webhook logic would work correctly');
    console.log('   Contact found: ' + contactId);
    console.log('   Payment would be linked properly');
  } else if (!contactId && contact) {
    console.log('❌ FAIL: RPC broken but contact exists');
    console.log('   This is the bug that happened on Nov 5-7');
  } else if (!contactId && !contact) {
    console.log('⚠️  Expected: No contact exists, payment would be orphan');
  }
  
  console.log('\n🔒 No data was written or modified');
}

testWebhookLogic().catch(console.error);
