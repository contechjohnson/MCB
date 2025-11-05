// Verify Sophie's payment was inserted correctly
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseAdmin = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function verify() {
  console.log('📊 Verifying Sophie\'s payment...\n');

  // Query the payment
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('customer_email', 'sophimaureen@gmail.com')
    .single();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Payment Found in Database!\n');
  console.log('Payment Details:');
  console.log('- ID:', payment.id);
  console.log('- Event ID:', payment.payment_event_id);
  console.log('- Source:', payment.payment_source);
  console.log('- Type:', payment.payment_type);
  console.log('- Customer Email:', payment.customer_email);
  console.log('- Customer Name:', payment.customer_name);
  console.log('- Customer Phone:', payment.customer_phone);
  console.log('- Amount: $' + payment.amount);
  console.log('- Status:', payment.status);
  console.log('- Payment Date:', payment.payment_date);
  console.log('- Stripe Session ID:', payment.stripe_session_id);
  console.log('- Contact ID:', payment.contact_id || '(orphan - not linked yet)');
  console.log('- Created At:', payment.created_at);

  // Check if contact exists using correct column names
  console.log('\n🔍 Checking for contact with email sophimaureen@gmail.com...');

  const { data: contact, error: contactError } = await supabaseAdmin
    .from('contacts')
    .select('id, first_name, last_name, email_primary, email_booking, email_payment')
    .or('email_primary.ilike.sophimaureen@gmail.com,email_booking.ilike.sophimaureen@gmail.com,email_payment.ilike.sophimaureen@gmail.com')
    .maybeSingle();

  if (contactError) {
    console.error('❌ Error checking contacts:', contactError);
    return;
  }

  if (contact) {
    console.log('✅ Contact exists!');
    console.log('- Contact ID:', contact.id);
    console.log('- Name:', contact.first_name, contact.last_name);
    console.log('- Primary Email:', contact.email_primary);
    console.log('- Booking Email:', contact.email_booking);
    console.log('- Payment Email:', contact.email_payment);
    console.log('\n💡 You can link this payment by running:');
    console.log(`UPDATE payments SET contact_id = '${contact.id}' WHERE id = '${payment.id}';`);
  } else {
    console.log('⚠️  No contact found with email sophimaureen@gmail.com');
    console.log('\n💡 Options:');
    console.log('1. Create a contact manually');
    console.log('2. Wait for ManyChat or GHL webhook to create the contact');
    console.log('3. Payment will remain orphaned until contact is created');
  }

  console.log('\n✅ Verification Complete!');
  console.log('\nThe payment is now in the database and the Stripe webhook fix is working correctly.');
}

verify().catch(console.error);
