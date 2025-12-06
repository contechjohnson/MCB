require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyFinal() {
  console.log('=== FINAL LEAD MAGNET PURCHASE VERIFICATION ===\n');

  // 1. Read LM CSV
  const lmCsv = fs.readFileSync('/Users/connorjohnson/Downloads/Export-2025-11-21 19_20_08.csv', 'utf8');
  const lmLines = lmCsv.split('\n');
  const lmHeaders = lmLines[0].split(',');
  const lmEmailIdx = lmHeaders.indexOf('email');

  const lmEmails = new Set();
  for (let i = 1; i < lmLines.length; i++) {
    if (!lmLines[i].trim()) continue;
    const cols = lmLines[i].split(',');
    const email = cols[lmEmailIdx]?.toLowerCase().trim();
    if (email && email.includes('@')) {
      lmEmails.add(email);
    }
  }

  console.log(`Lead Magnet emails from CSV: ${lmEmails.size}`);

  // 2. Read Stripe CSV with correct column indices
  const stripeCsv = fs.readFileSync('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/stripe_unified_payments.csv', 'utf8');
  const stripeLines = stripeCsv.split('\n');
  const stripeHeaders = stripeLines[0].split(',');

  // Find correct indices
  const stripeEmailIdx = stripeHeaders.indexOf('Customer Email');
  const stripeStatusIdx = stripeHeaders.indexOf('Status');
  const stripeAmountIdx = stripeHeaders.indexOf('Amount');

  console.log(`\nStripe column indices: email=${stripeEmailIdx}, status=${stripeStatusIdx}, amount=${stripeAmountIdx}`);

  const stripePaidEmails = new Map(); // email -> amount
  for (let i = 1; i < stripeLines.length; i++) {
    if (!stripeLines[i].trim()) continue;
    const cols = stripeLines[i].split(',');
    const email = cols[stripeEmailIdx]?.toLowerCase().trim();
    const status = cols[stripeStatusIdx]?.trim();
    const amount = cols[stripeAmountIdx];

    if (email && email.includes('@') && status === 'Paid') {
      stripePaidEmails.set(email, amount);
    }
  }

  console.log(`Stripe paid emails: ${stripePaidEmails.size}`);

  // 3. Read Denefits CSV
  const denefitsCsv = fs.readFileSync('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/denefits_contracts.csv', 'utf8');
  const denefitsLines = denefitsCsv.split('\n');
  const denefitsHeaders = denefitsLines[0].split(',');

  const denefitsEmailIdx = denefitsHeaders.indexOf('Customer Email');
  const denefitsAmountIdx = denefitsHeaders.indexOf('Payment Plan Amount');

  console.log(`Denefits column indices: email=${denefitsEmailIdx}, amount=${denefitsAmountIdx}`);

  const denefitsEmails = new Map();
  for (let i = 1; i < denefitsLines.length; i++) {
    if (!denefitsLines[i].trim()) continue;
    const cols = denefitsLines[i].split(',');
    const email = cols[denefitsEmailIdx]?.toLowerCase().trim();
    const amount = cols[denefitsAmountIdx];

    if (email && email.includes('@')) {
      denefitsEmails.set(email, amount);
    }
  }

  console.log(`Denefits contract emails: ${denefitsEmails.size}`);

  // 4. Check DB payments
  const { data: dbPayments } = await supabase
    .from('payments')
    .select('customer_email, amount, payment_source');

  const dbEmails = new Map();
  dbPayments?.forEach(p => {
    if (p.customer_email) {
      dbEmails.set(p.customer_email.toLowerCase(), { amount: p.amount, source: p.payment_source });
    }
  });

  console.log(`Database payment emails: ${dbEmails.size}`);

  // 5. Find matches
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('CROSS-REFERENCE RESULTS');
  console.log('═══════════════════════════════════════════════════════\n');

  const stripeMatches = [];
  const denefitsMatches = [];
  const dbMatches = [];

  for (const email of lmEmails) {
    if (stripePaidEmails.has(email)) {
      stripeMatches.push({ email, amount: stripePaidEmails.get(email) });
    }
    if (denefitsEmails.has(email)) {
      denefitsMatches.push({ email, amount: denefitsEmails.get(email) });
    }
    if (dbEmails.has(email)) {
      dbMatches.push({ email, ...dbEmails.get(email) });
    }
  }

  console.log(`Stripe matches: ${stripeMatches.length}`);
  stripeMatches.forEach(m => console.log(`  - ${m.email}: $${m.amount}`));

  console.log(`\nDenefits matches: ${denefitsMatches.length}`);
  denefitsMatches.forEach(m => console.log(`  - ${m.email}: $${m.amount}`));

  console.log(`\nDatabase matches: ${dbMatches.length}`);
  dbMatches.forEach(m => console.log(`  - ${m.email}: $${m.amount} (${m.source})`));

  // Show samples
  console.log('\n--- Sample LM emails ---');
  let c = 0;
  for (const e of lmEmails) { console.log(`  ${e}`); if (++c >= 3) break; }

  console.log('\n--- Sample Stripe paid emails ---');
  c = 0;
  for (const [e, a] of stripePaidEmails) { console.log(`  ${e}: $${a}`); if (++c >= 3) break; }

  console.log('\n--- Sample Denefits emails ---');
  c = 0;
  for (const [e, a] of denefitsEmails) { console.log(`  ${e}: $${a}`); if (++c >= 3) break; }

  // FINAL VERDICT
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('FINAL VERDICT');
  console.log('═══════════════════════════════════════════════════════');

  const totalMatches = stripeMatches.length + denefitsMatches.length + dbMatches.length;
  if (totalMatches === 0) {
    console.log(`\n❌ CONFIRMED: Out of ${lmEmails.size} lead magnet emails:`);
    console.log(`   - 0 match Stripe payments (${stripePaidEmails.size} total)`);
    console.log(`   - 0 match Denefits contracts (${denefitsEmails.size} total)`);
    console.log(`   - 0 match database payments (${dbEmails.size} total)`);
    console.log(`\n   ZERO lead magnet contacts have EVER purchased.`);
  } else {
    console.log(`\n✅ Found ${totalMatches} purchases from lead magnet contacts!`);
  }
}

verifyFinal().catch(console.error);
