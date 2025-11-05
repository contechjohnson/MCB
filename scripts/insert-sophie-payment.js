// Insert Sophie's payment into payments table
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

async function insertSophiePayment() {
  console.log('🔍 Retrieving Sophie\'s payment from webhook_logs...\n');

  // Step 1: Get the webhook log
  const { data: log, error: logError } = await supabaseAdmin
    .from('webhook_logs')
    .select('*')
    .eq('event_type', 'checkout.session.completed')
    .limit(1)
    .single();

  if (logError) {
    console.error('❌ Error:', logError);
    return;
  }

  console.log('✅ Found webhook log!\n');

  // Step 2: Extract payment details
  const event = log.payload;
  const session = event.data.object;

  const paymentDetails = {
    payment_event_id: event.id,
    payment_source: 'stripe',
    payment_type: 'buy_in_full',
    customer_email: session.customer_details.email,
    customer_name: session.customer_details.name,
    customer_phone: session.customer_details.phone,
    amount: session.amount_total / 100, // Convert cents to dollars
    status: session.payment_status === 'paid' ? 'paid' : session.payment_status,
    payment_date: new Date(event.created * 1000).toISOString(),
    stripe_event_type: event.type,
    stripe_customer_id: session.customer, // This is null in the payload
    stripe_session_id: session.id,
    raw_payload: event
  };

  console.log('📋 Payment Details Extracted:');
  console.log('- Event ID:', paymentDetails.payment_event_id);
  console.log('- Email:', paymentDetails.customer_email);
  console.log('- Name:', paymentDetails.customer_name);
  console.log('- Phone:', paymentDetails.customer_phone);
  console.log('- Amount: $' + paymentDetails.amount.toFixed(2));
  console.log('- Status:', paymentDetails.status);
  console.log('- Payment Date:', paymentDetails.payment_date);
  console.log('- Event Type:', paymentDetails.stripe_event_type);
  console.log('- Session ID:', paymentDetails.stripe_session_id);

  // Step 3: Check if payment already exists
  const { data: existing, error: checkError } = await supabaseAdmin
    .from('payments')
    .select('id, payment_event_id')
    .eq('payment_event_id', paymentDetails.payment_event_id)
    .maybeSingle();

  if (checkError) {
    console.error('\n❌ Error checking existing payment:', checkError);
    return;
  }

  if (existing) {
    console.log('\n⚠️  Payment already exists in payments table!');
    console.log('- Payment ID:', existing.id);
    return;
  }

  console.log('\n💾 Inserting payment into payments table...');

  // Step 4: Insert payment
  const { data: payment, error: insertError } = await supabaseAdmin
    .from('payments')
    .insert(paymentDetails)
    .select()
    .single();

  if (insertError) {
    console.error('\n❌ Error inserting payment:', insertError);
    console.error('Details:', insertError.details);
    console.error('Message:', insertError.message);
    return;
  }

  console.log('\n✅ Payment successfully inserted!');
  console.log('- Payment ID:', payment.id);
  console.log('- Event ID:', payment.payment_event_id);
  console.log('- Contact ID:', payment.contact_id || '(orphan - will link later)');

  // Step 5: Check if contact exists
  console.log('\n🔍 Checking for existing contact...');

  const { data: contact, error: contactError } = await supabaseAdmin
    .from('contacts')
    .select('id, email, first_name, last_name')
    .ilike('email', paymentDetails.customer_email)
    .maybeSingle();

  if (contactError) {
    console.error('❌ Error checking contact:', contactError);
    return;
  }

  if (contact) {
    console.log('✅ Contact exists!');
    console.log('- Contact ID:', contact.id);
    console.log('- Name:', contact.first_name, contact.last_name);
    console.log('\n💡 Next step: Link this payment to the contact');
  } else {
    console.log('⚠️  No contact exists for', paymentDetails.customer_email);
    console.log('\n💡 Options:');
    console.log('1. Create a contact record for Sophie');
    console.log('2. Wait for ManyChat/GHL webhook to create it');
    console.log('3. Payment will remain as an orphan until contact is created');
  }

  // Step 6: Verification
  console.log('\n📊 Verification Query:');
  console.log('SELECT * FROM payments WHERE id = \'' + payment.id + '\';');
}

insertSophiePayment().catch(console.error);
