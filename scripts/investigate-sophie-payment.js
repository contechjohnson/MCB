const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function investigate() {
  const email = 'sophimaureen@gmail.com';

  console.log('🔍 Investigating payment for:', email);
  console.log('='.repeat(60));

  // 1. Check for contact (search all email fields)
  console.log('\n1️⃣ Searching for contact...');
  const { data: contacts, error: contactError } = await supabase
    .from('contacts')
    .select('*')
    .or(`email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`);

  if (contactError) {
    console.error('❌ Contact query error:', contactError);
  } else if (contacts && contacts.length > 0) {
    console.log('✅ Found contact:');
    contacts.forEach(c => {
      console.log(`   ID: ${c.id}`);
      console.log(`   Email Primary: ${c.email_primary}`);
      console.log(`   Email Booking: ${c.email_booking}`);
      console.log(`   Email Payment: ${c.email_payment}`);
      console.log(`   Name: ${c.first_name} ${c.last_name}`);
      console.log(`   Stage: ${c.stage}`);
      console.log(`   Purchase Amount: $${c.purchase_amount || 0}`);
      console.log(`   Purchase Date: ${c.purchase_date}`);
      console.log(`   Created: ${c.created_at}`);
    });
  } else {
    console.log('⚠️  No contact found');
  }

  // 2. Check for payments
  console.log('\n2️⃣ Searching for payments...');
  const { data: payments, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .ilike('customer_email', email)
    .order('created_at', { ascending: false });

  if (paymentError) {
    console.error('❌ Payment query error:', paymentError);
  } else if (payments && payments.length > 0) {
    console.log(`✅ Found ${payments.length} payment(s):`);
    payments.forEach((p, i) => {
      console.log(`\n   Payment ${i + 1}:`);
      console.log(`   Payment ID: ${p.id}`);
      console.log(`   Contact ID: ${p.contact_id || '❌ MISSING'}`);
      console.log(`   Email: ${p.customer_email}`);
      console.log(`   Name: ${p.customer_name}`);
      console.log(`   Amount: $${p.amount}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Payment Date: ${p.payment_date}`);
      console.log(`   Stripe Session ID: ${p.stripe_session_id}`);
      console.log(`   Created: ${p.created_at}`);
    });
  } else {
    console.log('⚠️  No payments found');
  }

  // 3. Check webhook logs for this email
  console.log('\n3️⃣ Checking recent webhook logs...');
  const { data: logs, error: logError } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('source', 'stripe')
    .order('created_at', { ascending: false })
    .limit(100);

  if (logError) {
    console.error('❌ Log query error:', logError);
  } else if (logs) {
    const relevantLogs = logs.filter(log => {
      const body = typeof log.body === 'string' ? JSON.parse(log.body) : log.body;
      const logEmail = body?.data?.object?.customer_details?.email ||
                       body?.data?.object?.receipt_email;
      return logEmail && logEmail.toLowerCase() === email.toLowerCase();
    });

    if (relevantLogs.length > 0) {
      console.log(`✅ Found ${relevantLogs.length} relevant webhook log(s):`);
      relevantLogs.forEach((log, i) => {
        const body = typeof log.body === 'string' ? JSON.parse(log.body) : log.body;
        console.log(`\n   Log ${i + 1}:`);
        console.log(`   Event Type: ${log.event_type}`);
        console.log(`   Status: ${log.status}`);
        console.log(`   Error: ${log.error_message || 'none'}`);
        console.log(`   Created: ${log.created_at}`);
      });
    } else {
      console.log('⚠️  No webhook logs found for this email');
    }
  }

  // 4. Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));

  const hasContact = contacts && contacts.length > 0;
  const hasPayment = payments && payments.length > 0;
  const paymentHasContactId = hasPayment && payments[0].contact_id;

  if (hasPayment && !paymentHasContactId) {
    console.log('\n🚨 ISSUE IDENTIFIED:');
    console.log('   Payment exists but contact_id is NULL');

    if (!hasContact) {
      console.log('\n💡 LIKELY CAUSE:');
      console.log('   No contact exists with this email');
      console.log('   The webhook tried to find a contact but failed');
      console.log('\n✅ SOLUTION:');
      console.log('   1. Create the contact manually, OR');
      console.log('   2. Wait for a GHL/ManyChat webhook to create it, OR');
      console.log('   3. Run a script to link existing payments to contacts');
    } else {
      console.log('\n💡 LIKELY CAUSE:');
      console.log('   Contact exists but webhook failed to link it');
      console.log('   Possible timing issue or webhook error');
      console.log('\n✅ SOLUTION:');
      console.log('   Run a script to update payment.contact_id with contact.id');
    }
  } else if (!hasPayment) {
    console.log('\n🚨 ISSUE: No payment record found in database');
    console.log('   Check if Stripe webhook fired correctly');
  } else if (hasPayment && paymentHasContactId) {
    console.log('\n✅ Everything looks good!');
    console.log('   Payment is properly linked to contact');
  }
}

investigate().catch(console.error);
