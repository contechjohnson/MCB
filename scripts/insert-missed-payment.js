/**
 * Insert Missed Stripe Payment
 *
 * Inserts a charge.succeeded event that was missed by the webhook.
 *
 * Usage: node scripts/insert-missed-payment.js
 */

// Try to load .env.local if it exists, but don't fail if it doesn't
try {
  require('dotenv').config({ path: '.env.local' });
} catch (e) {
  // Environment variables may already be set
}
const { createClient } = require('@supabase/supabase-js');

// Payment details
const PAYMENT_DATA = {
  event_id: 'evt_3SRZFLCZF69l9Gkp0arGlxqB',
  stripe_charge_id: 'ch_3SRZFLCZF69l9Gkp0CVayALS',
  email: 'thetarrynleethomas@gmail.com',
  amount: 1196.00,
  phone: '6029357075',
  payment_date: '2025-11-09T09:17:28Z',
  package: 'Returning Mom - Paid in Full'
};

async function main() {
  console.log('🔧 Insert Missed Stripe Payment Script');
  console.log('========================================\n');

  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  console.log('Payment Details:');
  console.log(`- Event ID: ${PAYMENT_DATA.event_id}`);
  console.log(`- Charge ID: ${PAYMENT_DATA.stripe_charge_id}`);
  console.log(`- Email: ${PAYMENT_DATA.email}`);
  console.log(`- Amount: $${PAYMENT_DATA.amount.toFixed(2)}`);
  console.log(`- Phone: ${PAYMENT_DATA.phone}`);
  console.log(`- Date: ${PAYMENT_DATA.payment_date}`);
  console.log(`- Package: ${PAYMENT_DATA.package}\n`);

  // Step 1: Check if payment already exists
  console.log('Step 1: Checking if payment already exists...');
  const { data: existingPayment, error: checkError } = await supabase
    .from('payments')
    .select('*')
    .eq('payment_event_id', PAYMENT_DATA.event_id)
    .maybeSingle();

  if (checkError) {
    console.error('❌ Error checking existing payment:', checkError);
    process.exit(1);
  }

  if (existingPayment) {
    console.log('⚠️  Payment already exists in database:');
    console.log(JSON.stringify(existingPayment, null, 2));
    console.log('\n✅ No action needed - payment is already recorded.');
    return;
  }
  console.log('✓ Payment does not exist yet\n');

  // Step 2: Find contact by email
  console.log('Step 2: Finding contact by email...');
  const { data: contacts, error: contactError } = await supabase
    .from('contacts')
    .select('id, mc_id, ghl_id, first_name, last_name, email_primary, stage')
    .or(`email_primary.ilike.${PAYMENT_DATA.email},email_booking.ilike.${PAYMENT_DATA.email},email_payment.ilike.${PAYMENT_DATA.email}`);

  if (contactError) {
    console.error('❌ Error finding contact:', contactError);
    process.exit(1);
  }

  let contact = null;
  if (contacts && contacts.length > 0) {
    contact = contacts[0];
    console.log('✓ Contact found:');
    console.log(`  - ID: ${contact.id}`);
    console.log(`  - Name: ${contact.first_name} ${contact.last_name}`);
    console.log(`  - Email: ${contact.email_primary}`);
    console.log(`  - Current Stage: ${contact.stage}`);
    console.log(`  - MC ID: ${contact.mc_id || 'None'}`);
    console.log(`  - GHL ID: ${contact.ghl_id || 'None'}\n`);
  } else {
    console.log('⚠️  No contact found with this email');
    console.log('   Payment will be inserted as orphaned (contact_id = NULL)\n');
  }

  // Step 3: Insert payment record
  console.log('Step 3: Inserting payment record...');

  const paymentRecord = {
    payment_source: 'stripe',
    payment_type: 'buy_in_full',
    payment_event_id: PAYMENT_DATA.event_id,
    contact_id: contact ? contact.id : null,
    customer_email: PAYMENT_DATA.email,
    customer_phone: PAYMENT_DATA.phone,
    amount: PAYMENT_DATA.amount,
    currency: 'usd',
    status: 'succeeded',
    payment_date: PAYMENT_DATA.payment_date,
    stripe_event_type: 'charge.succeeded',
    stripe_customer_id: null, // Not available from provided data
    stripe_session_id: null, // Not available from provided data
    raw_payload: {
      event_id: PAYMENT_DATA.event_id,
      charge_id: PAYMENT_DATA.stripe_charge_id,
      package: PAYMENT_DATA.package,
      note: 'Manually inserted from missed charge.succeeded event'
    }
  };

  const { data: insertedPayment, error: insertError } = await supabase
    .from('payments')
    .insert(paymentRecord)
    .select()
    .single();

  if (insertError) {
    console.error('❌ Error inserting payment:', insertError);
    process.exit(1);
  }

  console.log('✓ Payment inserted successfully:');
  console.log(`  - Payment ID: ${insertedPayment.id}`);
  console.log(`  - Amount: $${insertedPayment.amount}`);
  console.log(`  - Status: ${insertedPayment.status}`);
  console.log(`  - Linked to Contact: ${insertedPayment.contact_id ? 'Yes' : 'No (Orphaned)'}\n`);

  // Step 4: Update contact if found
  if (contact) {
    console.log('Step 4: Updating contact with purchase info...');

    const updateData = {
      stage: 'purchased',
      purchase_date: PAYMENT_DATA.payment_date,
      purchase_amount: PAYMENT_DATA.amount,
      updated_at: new Date().toISOString()
    };

    // Only update phone if contact doesn't have one
    if (!contact.phone && PAYMENT_DATA.phone) {
      updateData.phone = PAYMENT_DATA.phone;
    }

    const { data: updatedContact, error: updateError } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', contact.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating contact:', updateError);
      console.log('   Payment was inserted, but contact update failed.\n');
    } else {
      console.log('✓ Contact updated successfully:');
      console.log(`  - Stage: ${contact.stage} → ${updatedContact.stage}`);
      console.log(`  - Purchase Date: ${updatedContact.purchase_date}`);
      console.log(`  - Purchase Amount: $${updatedContact.purchase_amount}\n`);
    }
  } else {
    console.log('Step 4: No contact to update (orphaned payment)\n');
  }

  // Summary
  console.log('========================================');
  console.log('✅ OPERATION COMPLETE');
  console.log('========================================');
  console.log(`Payment Record: ${insertedPayment.id}`);
  console.log(`Contact Linked: ${contact ? `Yes (${contact.id})` : 'No (Orphaned)'}`);
  console.log(`Contact Updated: ${contact ? 'Yes' : 'No'}`);
  console.log('\nTo verify, run:');
  console.log(`  SELECT * FROM payments WHERE payment_event_id = '${PAYMENT_DATA.event_id}';`);
  if (contact) {
    console.log(`  SELECT * FROM contacts WHERE id = '${contact.id}';`);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
