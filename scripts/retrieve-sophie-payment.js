// Retrieve Sophie's payment from webhook_logs and reprocess it
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

async function retrieveSophiePayment() {
  console.log('🔍 Searching for Sophie\'s payment in webhook_logs...\n');

  // Step 1: Query webhook_logs for Sophie's payment
  const { data: logs, error: logsError } = await supabaseAdmin
    .from('webhook_logs')
    .select('*')
    .eq('source', 'stripe')
    .eq('event_type', 'checkout.session.completed')
    .order('created_at', { ascending: false })
    .limit(10);

  if (logsError) {
    console.error('❌ Error querying webhook_logs:', logsError);
    return;
  }

  // Find Sophie's payment
  const sophieLog = logs.find(log => {
    const payload = log.raw_payload;
    const email = payload?.data?.object?.customer_details?.email;
    return email?.toLowerCase() === 'sophimaureen@gmail.com';
  });

  if (!sophieLog) {
    console.log('❌ Could not find Sophie\'s payment in webhook_logs');
    console.log(`Found ${logs.length} checkout.session.completed events, but none matched sophimaureen@gmail.com`);
    return;
  }

  console.log('✅ Found Sophie\'s payment event!\n');
  console.log('Event Details:');
  console.log('- Event ID:', sophieLog.event_id);
  console.log('- Event Type:', sophieLog.event_type);
  console.log('- Received At:', sophieLog.created_at);
  console.log('- Log ID:', sophieLog.id);

  // Step 2: Extract payment details from the event payload
  const event = sophieLog.raw_payload;
  const session = event.data.object;

  const paymentDetails = {
    payment_event_id: sophieLog.event_id,
    payment_source: 'stripe',
    payment_type: 'buy_in_full',
    customer_email: session.customer_details.email,
    customer_name: session.customer_details.name,
    amount: session.amount_total / 100, // Convert cents to dollars
    status: session.payment_status === 'paid' ? 'paid' : session.payment_status,
    payment_date: new Date(event.created * 1000).toISOString(),
    stripe_customer_id: session.customer,
    stripe_session_id: session.id,
    raw_payload: event
  };

  console.log('\n📋 Extracted Payment Details:');
  console.log('- Email:', paymentDetails.customer_email);
  console.log('- Name:', paymentDetails.customer_name);
  console.log('- Amount: $' + paymentDetails.amount.toFixed(2));
  console.log('- Status:', paymentDetails.status);
  console.log('- Payment Date:', paymentDetails.payment_date);
  console.log('- Stripe Customer ID:', paymentDetails.stripe_customer_id);
  console.log('- Stripe Session ID:', paymentDetails.stripe_session_id);

  // Step 3: Check if this payment already exists
  const { data: existingPayment, error: checkError } = await supabaseAdmin
    .from('payments')
    .select('id, payment_event_id')
    .eq('payment_event_id', paymentDetails.payment_event_id)
    .maybeSingle();

  if (checkError) {
    console.error('\n❌ Error checking for existing payment:', checkError);
    return;
  }

  if (existingPayment) {
    console.log('\n⚠️  Payment already exists in payments table!');
    console.log('- Payment ID:', existingPayment.id);
    console.log('- Event ID:', existingPayment.payment_event_id);
    return;
  }

  console.log('\n💾 Inserting payment into payments table...');

  // Step 4: Insert payment into payments table
  const { data: newPayment, error: insertError } = await supabaseAdmin
    .from('payments')
    .insert(paymentDetails)
    .select()
    .single();

  if (insertError) {
    console.error('\n❌ Error inserting payment:', insertError);
    return;
  }

  console.log('\n✅ Payment successfully inserted!');
  console.log('- Payment ID:', newPayment.id);
  console.log('- Event ID:', newPayment.payment_event_id);
  console.log('- Contact ID:', newPayment.contact_id || '(orphan - no contact linked yet)');

  // Step 5: Check if contact exists for Sophie
  console.log('\n🔍 Checking if contact exists for Sophie...');

  const { data: contact, error: contactError } = await supabaseAdmin
    .from('contacts')
    .select('id, email, first_name, last_name')
    .ilike('email', paymentDetails.customer_email)
    .maybeSingle();

  if (contactError) {
    console.error('❌ Error checking for contact:', contactError);
    return;
  }

  if (contact) {
    console.log('✅ Contact exists!');
    console.log('- Contact ID:', contact.id);
    console.log('- Name:', contact.first_name, contact.last_name);
    console.log('- Email:', contact.email);
    console.log('\n💡 You may want to link the payment to this contact by updating contact_id');
  } else {
    console.log('⚠️  No contact exists for', paymentDetails.customer_email);
    console.log('\n💡 You may want to create a contact record for Sophie');
  }

  // Step 6: Show final verification query
  console.log('\n📊 Verification Query:');
  console.log('Run this to see the payment in the database:');
  console.log(`
SELECT
  id,
  payment_event_id,
  payment_source,
  customer_email,
  customer_name,
  amount,
  status,
  payment_date,
  contact_id,
  created_at
FROM payments
WHERE payment_event_id = '${paymentDetails.payment_event_id}';
  `);
}

retrieveSophiePayment().catch(console.error);
