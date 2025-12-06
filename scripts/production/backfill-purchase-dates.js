/**
 * Backfill contacts with purchase_date from payments table
 *
 * Problem: Historical payments were logged but contacts.purchase_date was not updated.
 * Solution: For each contact with a linked payment, set purchase_date to first payment date
 *           and purchase_amount to total of all payments.
 *
 * Usage: node scripts/production/backfill-purchase-dates.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfill() {
  console.log('=== BACKFILL: Update contacts with purchase_date from payments ===\n');

  // Get all payments with contact_id
  const { data: payments } = await supabase
    .from('payments')
    .select('contact_id, customer_email, amount, payment_date')
    .not('contact_id', 'is', null)
    .order('payment_date', { ascending: true }); // Oldest first

  console.log('Total payments with contact_id:', payments?.length);

  // Group by contact_id - get first payment date and total amount
  const contactPayments = {};
  for (const p of payments || []) {
    if (!contactPayments[p.contact_id]) {
      contactPayments[p.contact_id] = {
        first_payment_date: p.payment_date,
        total_amount: 0,
        email: p.customer_email
      };
    }
    contactPayments[p.contact_id].total_amount += parseFloat(p.amount || 0);
  }

  console.log('Unique contacts with payments:', Object.keys(contactPayments).length);

  // Check how many contacts are missing purchase_date
  const contactIds = Object.keys(contactPayments);
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email_primary, purchase_date, purchase_amount')
    .in('id', contactIds);

  const missingPurchaseDate = contacts?.filter(c => !c.purchase_date) || [];
  const hasPurchaseDate = contacts?.filter(c => c.purchase_date) || [];

  console.log('\nContacts status:');
  console.log('  Already have purchase_date:', hasPurchaseDate.length);
  console.log('  Missing purchase_date:', missingPurchaseDate.length);

  if (missingPurchaseDate.length === 0) {
    console.log('\n✅ All contacts are up to date!');
    return;
  }

  console.log('\nBackfilling missing purchase_date...');

  let updated = 0;
  let errors = 0;

  for (const contact of missingPurchaseDate) {
    const paymentInfo = contactPayments[contact.id];
    const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email_primary;

    const { error } = await supabase
      .from('contacts')
      .update({
        purchase_date: paymentInfo.first_payment_date,
        purchase_amount: paymentInfo.total_amount,
        stage: 'purchased'
      })
      .eq('id', contact.id);

    if (error) {
      console.log('  ❌ Error updating', displayName, ':', error.message);
      errors++;
    } else {
      console.log('  ✅', displayName, '- $' + paymentInfo.total_amount);
      updated++;
    }
  }

  console.log('\n=== BACKFILL COMPLETE ===');
  console.log('Updated:', updated);
  console.log('Errors:', errors);
}

backfill().catch(console.error);
