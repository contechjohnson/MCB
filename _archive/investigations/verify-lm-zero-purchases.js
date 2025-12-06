require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyZeroPurchases() {
  console.log('=== COMPREHENSIVE LEAD MAGNET PURCHASE VERIFICATION ===\n');

  // 1. Read original CSV directly to get ALL emails
  const csv = fs.readFileSync('/Users/connorjohnson/Downloads/Export-2025-11-21 19_20_08.csv', 'utf8');
  const lines = csv.split('\n');
  const headers = lines[0].split(',');
  const emailIdx = headers.indexOf('email');

  console.log(`CSV has ${lines.length - 1} rows (excluding header)`);
  console.log(`Email column index: ${emailIdx}\n`);

  // Extract all emails from CSV
  const csvEmails = new Set();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    // Handle CSV parsing with possible quotes
    const match = lines[i].match(/(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|([^,]+))/g) || [];
    const email = match[emailIdx]?.replace(/^\"|\"$/g, '').toLowerCase().trim();
    if (email && email.includes('@')) {
      csvEmails.add(email);
    }
  }

  console.log(`Unique emails from CSV: ${csvEmails.size}`);

  // 2. Check against DB payments table
  console.log('\n--- CHECK 1: Database payments table ---');
  const { data: dbPayments } = await supabase
    .from('payments')
    .select('customer_email, amount, payment_source, payment_date');

  const dbPaymentEmails = new Set(dbPayments?.map(p => p.customer_email?.toLowerCase()).filter(Boolean));
  console.log(`Total payments in DB: ${dbPayments?.length}`);
  console.log(`Unique payment emails in DB: ${dbPaymentEmails.size}`);

  const dbMatches = [];
  for (const email of csvEmails) {
    if (dbPaymentEmails.has(email)) {
      const payment = dbPayments.find(p => p.customer_email?.toLowerCase() === email);
      dbMatches.push({ email, amount: payment.amount, source: payment.payment_source, date: payment.payment_date });
    }
  }
  console.log(`LM emails matching DB payments: ${dbMatches.length}`);
  if (dbMatches.length > 0) {
    dbMatches.forEach(m => console.log(`  - ${m.email}: $${m.amount} (${m.source}) ${m.date}`));
  }

  // 3. Check against Stripe CSV
  console.log('\n--- CHECK 2: Stripe historical CSV ---');
  const stripeCsv = fs.readFileSync('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/stripe_unified_payments.csv', 'utf8');
  const stripeLines = stripeCsv.split('\n');

  const stripeEmails = new Set();
  for (let i = 1; i < stripeLines.length; i++) {
    if (!stripeLines[i].trim()) continue;
    const cols = stripeLines[i].split(',');
    const email = cols[20]?.toLowerCase().trim(); // Customer Email column
    const status = cols[22]?.trim(); // Status column
    if (email && email.includes('@') && status === 'Paid') {
      stripeEmails.add(email);
    }
  }
  console.log(`Stripe paid emails: ${stripeEmails.size}`);

  const stripeMatches = [];
  for (const email of csvEmails) {
    if (stripeEmails.has(email)) {
      stripeMatches.push(email);
    }
  }
  console.log(`LM emails matching Stripe: ${stripeMatches.length}`);
  if (stripeMatches.length > 0) {
    stripeMatches.forEach(e => console.log(`  - ${e}`));
  }

  // 4. Check against Denefits CSV
  console.log('\n--- CHECK 3: Denefits historical CSV ---');
  const denefitsCsv = fs.readFileSync('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/denefits_contracts.csv', 'utf8');
  const denefitsLines = denefitsCsv.split('\n');

  const denefitsEmails = new Set();
  for (let i = 1; i < denefitsLines.length; i++) {
    if (!denefitsLines[i].trim()) continue;
    const cols = denefitsLines[i].split(',');
    const email = cols[5]?.toLowerCase().trim(); // Customer Email column
    if (email && email.includes('@')) {
      denefitsEmails.add(email);
    }
  }
  console.log(`Denefits contract emails: ${denefitsEmails.size}`);

  const denefitsMatches = [];
  for (const email of csvEmails) {
    if (denefitsEmails.has(email)) {
      denefitsMatches.push(email);
    }
  }
  console.log(`LM emails matching Denefits: ${denefitsMatches.length}`);
  if (denefitsMatches.length > 0) {
    denefitsMatches.forEach(e => console.log(`  - ${e}`));
  }

  // 5. Check contacts table for any with purchase_date
  console.log('\n--- CHECK 4: Contacts with purchase_date ---');
  const { data: purchasedContacts } = await supabase
    .from('contacts')
    .select('email_primary, email_booking, email_payment, purchase_date, purchase_amount')
    .not('purchase_date', 'is', null);

  console.log(`Contacts with purchase_date: ${purchasedContacts?.length}`);

  const purchasedEmails = new Set();
  purchasedContacts?.forEach(c => {
    if (c.email_primary) purchasedEmails.add(c.email_primary.toLowerCase());
    if (c.email_booking) purchasedEmails.add(c.email_booking.toLowerCase());
    if (c.email_payment) purchasedEmails.add(c.email_payment.toLowerCase());
  });

  const purchaseMatches = [];
  for (const email of csvEmails) {
    if (purchasedEmails.has(email)) {
      const contact = purchasedContacts.find(c =>
        c.email_primary?.toLowerCase() === email ||
        c.email_booking?.toLowerCase() === email ||
        c.email_payment?.toLowerCase() === email
      );
      purchaseMatches.push({ email, amount: contact?.purchase_amount, date: contact?.purchase_date });
    }
  }
  console.log(`LM emails matching purchased contacts: ${purchaseMatches.length}`);
  if (purchaseMatches.length > 0) {
    purchaseMatches.forEach(m => console.log(`  - ${m.email}: $${m.amount} on ${m.date}`));
  }

  // SUMMARY
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('FINAL SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Lead Magnet CSV emails: ${csvEmails.size}`);
  console.log(`\nMatches found:`);
  console.log(`  Database payments table: ${dbMatches.length}`);
  console.log(`  Stripe historical CSV: ${stripeMatches.length}`);
  console.log(`  Denefits historical CSV: ${denefitsMatches.length}`);
  console.log(`  Contacts with purchase_date: ${purchaseMatches.length}`);
  console.log(`\nTOTAL PURCHASES FROM LEAD MAGNET: ${dbMatches.length + stripeMatches.length + denefitsMatches.length + purchaseMatches.length}`);

  if (dbMatches.length === 0 && stripeMatches.length === 0 && denefitsMatches.length === 0 && purchaseMatches.length === 0) {
    console.log('\n⚠️  CONFIRMED: ZERO lead magnet contacts have EVER purchased.');
    console.log('   - Not in live database payments');
    console.log('   - Not in historical Stripe data');
    console.log('   - Not in historical Denefits data');
    console.log('   - Not marked as purchased in contacts table');
  }

  // Show a few sample emails to verify parsing worked
  console.log('\n--- Sample LM emails (first 5) ---');
  let count = 0;
  for (const email of csvEmails) {
    console.log(`  ${email}`);
    if (++count >= 5) break;
  }

  // Show a few sample payment emails
  console.log('\n--- Sample payment emails (first 5) ---');
  count = 0;
  for (const email of stripeEmails) {
    console.log(`  ${email}`);
    if (++count >= 5) break;
  }
}

verifyZeroPurchases().catch(console.error);
