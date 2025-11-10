import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const PAYMENT = {
  event_id: 'evt_3SRZFLCZF69l9Gkp0arGlxqB',
  email: 'thetarrynleethomas@gmail.com',
  amount: 1196.00,
  phone: '6029357075',
  payment_date: '2025-11-09T09:17:28Z',
  charge_id: 'ch_3SRZFLCZF69l9Gkp0CVayALS'
};

async function insertPayment() {
  console.log('🔍 Checking if payment already exists...');

  const { data: existing } = await supabase
    .from('payments')
    .select('*')
    .eq('payment_event_id', PAYMENT.event_id)
    .maybeSingle();

  if (existing) {
    console.log('✅ Payment already exists:', existing.id);
    return;
  }

  console.log('📧 Finding contact by email...');
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email_primary, stage')
    .or(`email_primary.ilike.${PAYMENT.email},email_booking.ilike.${PAYMENT.email},email_payment.ilike.${PAYMENT.email}`);

  const contact = contacts?.[0];

  if (contact) {
    console.log(`✅ Found contact: ${contact.first_name} ${contact.last_name} (${contact.id})`);
  } else {
    console.log('⚠️  No contact found - creating orphan payment');
  }

  console.log('💾 Inserting payment...');
  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      contact_id: contact?.id || null,
      payment_event_id: PAYMENT.event_id,
      payment_source: 'stripe',
      payment_type: 'buy_in_full',
      customer_email: PAYMENT.email,
      customer_phone: PAYMENT.phone,
      amount: PAYMENT.amount,
      currency: 'usd',
      status: 'paid',
      payment_date: PAYMENT.payment_date,
      stripe_event_type: 'charge.succeeded',
      raw_payload: {
        event_id: PAYMENT.event_id,
        charge_id: PAYMENT.charge_id,
        note: 'Manually inserted missed payment'
      }
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`✅ Payment inserted: ${payment.id}`);

  if (contact) {
    console.log('📝 Updating contact...');
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        stage: 'purchased',
        purchase_date: PAYMENT.payment_date,
        purchase_amount: PAYMENT.amount,
        phone: contact.phone || PAYMENT.phone
      })
      .eq('id', contact.id);

    if (updateError) {
      console.error('❌ Update error:', updateError);
    } else {
      console.log('✅ Contact updated to purchased!');
    }
  }

  console.log('\n✨ Done! Payment of $' + PAYMENT.amount + ' inserted successfully.');
}

insertPayment().catch(console.error);
