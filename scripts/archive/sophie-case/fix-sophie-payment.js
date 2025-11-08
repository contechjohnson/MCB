const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function fixPayment() {
  const email = 'sophimaureen@gmail.com';

  console.log('🔧 Fixing payment linkage for:', email);
  console.log('='.repeat(60));

  // 1. Get the contact ID
  console.log('\n1️⃣ Finding contact...');
  const { data: contacts, error: contactError } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .or(`email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`)
    .limit(1);

  if (contactError) {
    console.error('❌ Error finding contact:', contactError);
    return;
  }

  if (!contacts || contacts.length === 0) {
    console.error('❌ No contact found with this email');
    return;
  }

  const contact = contacts[0];
  console.log(`✅ Found contact: ${contact.first_name} ${contact.last_name} (${contact.id})`);

  // 2. Find the payment
  console.log('\n2️⃣ Finding payment...');
  const { data: payments, error: paymentError } = await supabase
    .from('payments')
    .select('id, contact_id, amount, payment_date')
    .ilike('customer_email', email)
    .is('contact_id', null)
    .limit(1);

  if (paymentError) {
    console.error('❌ Error finding payment:', paymentError);
    return;
  }

  if (!payments || payments.length === 0) {
    console.log('⚠️  No unlinked payments found for this email');
    console.log('   Payment may already be linked or does not exist');
    return;
  }

  const payment = payments[0];
  console.log(`✅ Found unlinked payment: $${payment.amount} on ${payment.payment_date}`);

  // 3. Update the payment with the contact_id
  console.log('\n3️⃣ Linking payment to contact...');
  const { data: updated, error: updateError } = await supabase
    .from('payments')
    .update({ contact_id: contact.id })
    .eq('id', payment.id)
    .select();

  if (updateError) {
    console.error('❌ Error updating payment:', updateError);
    return;
  }

  console.log('✅ Payment successfully linked!');

  // 4. Verify the update
  console.log('\n4️⃣ Verifying update...');
  const { data: verified, error: verifyError } = await supabase
    .from('payments')
    .select('id, contact_id, customer_email, amount')
    .eq('id', payment.id)
    .single();

  if (verifyError) {
    console.error('❌ Error verifying:', verifyError);
    return;
  }

  console.log('✅ Verification successful:');
  console.log(`   Payment ID: ${verified.id}`);
  console.log(`   Contact ID: ${verified.contact_id}`);
  console.log(`   Email: ${verified.customer_email}`);
  console.log(`   Amount: $${verified.amount}`);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 SUCCESS! Payment is now linked to contact.');
  console.log('='.repeat(60));
}

fixPayment().catch(console.error);
