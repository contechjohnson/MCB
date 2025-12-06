require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  console.log('Investigating orphan payments for:');
  console.log('- vazquez.i.irma@gmail.com');
  console.log('- rachel.hatton95@gmail.com');
  console.log('');

  // Query contacts for both emails
  const { data: contacts, error: contactError } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email_primary, email_booking, email_payment, mc_id, ghl_id, stage, purchase_date, purchase_amount, created_at')
    .or('email_primary.ilike.vazquez.i.irma@gmail.com,email_primary.ilike.rachel.hatton95@gmail.com,email_booking.ilike.vazquez.i.irma@gmail.com,email_booking.ilike.rachel.hatton95@gmail.com,email_payment.ilike.vazquez.i.irma@gmail.com,email_payment.ilike.rachel.hatton95@gmail.com');

  if (contactError) {
    console.error('Contact query error:', contactError);
  } else {
    console.log('=== CONTACTS FOUND ===');
    contacts.forEach(c => {
      console.log(`\nID: ${c.id}`);
      console.log(`Name: ${c.first_name} ${c.last_name}`);
      console.log(`Email Primary: ${c.email_primary}`);
      console.log(`Email Booking: ${c.email_booking}`);
      console.log(`Email Payment: ${c.email_payment}`);
      console.log(`MC ID: ${c.mc_id}`);
      console.log(`GHL ID: ${c.ghl_id}`);
      console.log(`Stage: ${c.stage}`);
      console.log(`Purchase Date: ${c.purchase_date}`);
      console.log(`Purchase Amount: ${c.purchase_amount}`);
      console.log(`Created At: ${c.created_at}`);
    });
  }

  // Query payments for both emails
  const { data: payments, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .or('customer_email.ilike.vazquez.i.irma@gmail.com,customer_email.ilike.rachel.hatton95@gmail.com');

  if (paymentError) {
    console.error('Payment query error:', paymentError);
  } else {
    console.log('\n\n=== PAYMENTS FOUND ===');
    payments.forEach(p => {
      console.log(`\nPayment ID: ${p.id}`);
      console.log(`Contact ID: ${p.contact_id} ${p.contact_id ? '✓ LINKED' : '✗ ORPHANED'}`);
      console.log(`Payment Source: ${p.payment_source}`);
      console.log(`Customer Email: ${p.customer_email}`);
      console.log(`Customer Name: ${p.customer_name}`);
      console.log(`Amount: $${p.amount}`);
      console.log(`Payment Date: ${p.payment_date}`);
      console.log(`Status: ${p.status}`);
      if (p.payment_source === 'stripe') {
        console.log(`Stripe Session ID: ${p.stripe_session_id}`);
      } else if (p.payment_source === 'denefits') {
        console.log(`Denefits Contract ID: ${p.denefits_contract_id}`);
      }
    });
  }
}

investigate().catch(console.error);
