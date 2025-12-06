require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigateAllOrphans() {
  console.log('=== INVESTIGATING ALL ORPHAN PAYMENTS ===\n');

  // Get ALL orphan payments
  const { data: orphanPayments, error: orphanError } = await supabase
    .from('payments')
    .select('*')
    .is('contact_id', null)
    .order('payment_date', { ascending: false });

  if (orphanError) {
    console.error('Error fetching orphan payments:', orphanError);
    return;
  }

  console.log(`Found ${orphanPayments.length} orphan payments\n`);

  const results = [];

  for (const payment of orphanPayments) {
    const email = payment.customer_email?.toLowerCase().trim();

    if (!email) {
      console.log(`❌ Payment ${payment.id} has no email`);
      results.push({
        payment_id: payment.id,
        email: null,
        amount: payment.amount,
        date: payment.payment_date,
        status: 'NO_EMAIL',
        contact_found: false
      });
      continue;
    }

    console.log(`\n--- Checking: ${email} ---`);
    console.log(`Payment ID: ${payment.id}`);
    console.log(`Amount: $${payment.amount}`);
    console.log(`Date: ${payment.payment_date}`);
    console.log(`Source: ${payment.payment_source}`);

    // Try to find contact with ALL email fields
    const { data: contacts, error: contactError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email_primary, email_booking, email_payment, mc_id, ghl_id, stage, purchase_date, purchase_amount')
      .or(`email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`);

    if (contactError) {
      console.error('Error searching for contact:', contactError);
      continue;
    }

    if (contacts && contacts.length > 0) {
      const contact = contacts[0];
      console.log(`✅ MATCH FOUND!`);
      console.log(`   Contact ID: ${contact.id}`);
      console.log(`   Name: ${contact.first_name} ${contact.last_name}`);
      console.log(`   Email Primary: ${contact.email_primary}`);
      console.log(`   Email Booking: ${contact.email_booking}`);
      console.log(`   Email Payment: ${contact.email_payment}`);
      console.log(`   Current Stage: ${contact.stage}`);
      console.log(`   Current Purchase Date: ${contact.purchase_date}`);
      console.log(`   Current Purchase Amount: ${contact.purchase_amount}`);

      results.push({
        payment_id: payment.id,
        email: email,
        amount: payment.amount,
        date: payment.payment_date,
        status: 'MATCH_FOUND',
        contact_found: true,
        contact_id: contact.id,
        contact_name: `${contact.first_name} ${contact.last_name}`,
        contact_stage: contact.stage,
        contact_purchase_date: contact.purchase_date,
        contact_purchase_amount: contact.purchase_amount
      });
    } else {
      console.log(`❌ No contact found for ${email}`);
      results.push({
        payment_id: payment.id,
        email: email,
        amount: payment.amount,
        date: payment.payment_date,
        status: 'NO_MATCH',
        contact_found: false
      });
    }
  }

  // Summary
  console.log('\n\n=== SUMMARY ===');
  const matchFound = results.filter(r => r.status === 'MATCH_FOUND');
  const noMatch = results.filter(r => r.status === 'NO_MATCH');
  const noEmail = results.filter(r => r.status === 'NO_EMAIL');

  console.log(`Total Orphans: ${results.length}`);
  console.log(`✅ Match Found (CAN BE FIXED): ${matchFound.length}`);
  console.log(`❌ No Match (LEGITIMATELY ORPHANED): ${noMatch.length}`);
  console.log(`⚠️  No Email (MISSING DATA): ${noEmail.length}`);

  if (matchFound.length > 0) {
    console.log('\n🔨 FIXABLE ORPHANS:');
    matchFound.forEach(r => {
      console.log(`   ${r.email} - $${r.amount} - ${r.contact_name}`);
    });
  }

  if (noMatch.length > 0) {
    console.log('\n❌ LEGITIMATE ORPHANS (no contact in database):');
    noMatch.forEach(r => {
      console.log(`   ${r.email} - $${r.amount}`);
    });
  }

  return results;
}

investigateAllOrphans().catch(console.error);
