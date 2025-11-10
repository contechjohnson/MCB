/**
 * Insert missed Stripe payment from charge.succeeded event
 * Run with: node scripts/insert-missed-payment.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function insertMissedPayment() {
  console.log('🔍 Checking for existing payment...\n');

  const eventId = 'evt_3SRZFLCZF69l9Gkp0arGlxqB';
  const email = 'thetarrynleethomas@gmail.com';
  const amount = 1196.00; // $1,196.00
  const chargeId = 'ch_3SRZFLCZF69l9Gkp0CVayALS';
  const paymentDate = new Date(1762697847 * 1000); // Nov 9, 2025, 9:17:28 AM

  // Check if payment already exists
  const { data: existing } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('payment_event_id', eventId)
    .single();

  if (existing) {
    console.log('✅ Payment already exists in database:');
    console.log(JSON.stringify(existing, null, 2));
    return;
  }

  console.log('❌ Payment not found in database\n');
  console.log('📧 Finding contact by email:', email);

  // Find contact by email
  const { data: contactId } = await supabaseAdmin
    .rpc('find_contact_by_email', { search_email: email });

  if (contactId) {
    console.log('✅ Contact found:', contactId);
  } else {
    console.log('⚠️  No contact found - will create orphan payment');
  }

  console.log('\n💾 Inserting payment...');

  // Insert payment
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .insert({
      contact_id: contactId || null,
      payment_event_id: eventId,
      payment_source: 'stripe',
      payment_type: 'buy_in_full',
      customer_email: email,
      customer_name: '',
      customer_phone: '6029357075',
      amount: amount,
      currency: 'usd',
      status: 'paid',
      payment_date: paymentDate.toISOString(),
      stripe_event_type: 'charge.succeeded',
      stripe_customer_id: null, // No customer object in charge.succeeded
      stripe_session_id: null,  // No session in charge.succeeded
      raw_payload: {
        id: eventId,
        type: 'charge.succeeded',
        created: 1762697847,
        data: {
          object: {
            id: chargeId,
            amount: 119600,
            billing_details: {
              email: email,
              phone: '6029357075'
            },
            metadata: {
              package_id: '5',
              patient_id: '1420',
              email: email,
              package_name: 'Returning Mom - Paid in Full'
            }
          }
        }
      }
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error inserting payment:', error);
    return;
  }

  console.log('✅ Payment inserted successfully!');
  console.log(JSON.stringify(payment, null, 2));

  // If contact found, update their purchase info
  if (contactId) {
    console.log('\n📝 Updating contact with purchase info...');

    // Recalculate total from all payments
    const { data: allPayments } = await supabaseAdmin
      .from('payments')
      .select('amount')
      .eq('contact_id', contactId)
      .in('status', ['paid', 'active']);

    const totalAmount = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || amount;

    const { error: updateError } = await supabaseAdmin
      .rpc('update_contact_dynamic', {
        contact_id: contactId,
        update_data: {
          email_payment: email,
          purchase_date: paymentDate.toISOString(),
          purchase_amount: totalAmount,
          stage: 'purchased'
        }
      });

    if (updateError) {
      console.error('❌ Error updating contact:', updateError);
    } else {
      console.log('✅ Contact updated with purchase info');
    }
  }

  console.log('\n✨ Done!');
}

insertMissedPayment()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
