require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Proper CSV parsing that handles quoted fields with commas
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function verify() {
  console.log('=== LEAD MAGNET PURCHASE VERIFICATION (Proper CSV Parsing) ===\n');

  // 1. Get all lead magnet emails
  const lmCsv = fs.readFileSync('/Users/connorjohnson/Downloads/Export-2025-11-21 19_20_08.csv', 'utf8');
  const lmLines = lmCsv.split('\n');
  const lmHeaders = parseCSVLine(lmLines[0]);
  const lmEmailIdx = lmHeaders.indexOf('email');

  const lmEmails = new Set();
  for (let i = 1; i < lmLines.length; i++) {
    if (!lmLines[i].trim()) continue;
    const cols = parseCSVLine(lmLines[i]);
    const email = cols[lmEmailIdx]?.toLowerCase().trim();
    if (email && email.includes('@')) {
      lmEmails.add(email);
    }
  }

  console.log(`Lead Magnet unique emails: ${lmEmails.size}`);

  // 2. Parse Stripe CSV
  const stripeCsv = fs.readFileSync('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/stripe_unified_payments.csv', 'utf8');
  const stripeLines = stripeCsv.split('\n');
  const stripeHeaders = parseCSVLine(stripeLines[0]);
  const stripeEmailIdx = stripeHeaders.indexOf('Customer Email');
  const stripeStatusIdx = stripeHeaders.indexOf('Status');
  const stripeAmountIdx = stripeHeaders.indexOf('Amount');

  console.log(`\nStripe: email col=${stripeEmailIdx}, status col=${stripeStatusIdx}, amount col=${stripeAmountIdx}`);

  const stripePaid = new Map();
  for (let i = 1; i < stripeLines.length; i++) {
    if (!stripeLines[i].trim()) continue;
    const cols = parseCSVLine(stripeLines[i]);
    const email = cols[stripeEmailIdx]?.toLowerCase().trim();
    const status = cols[stripeStatusIdx];
    const amount = cols[stripeAmountIdx];

    if (email && email.includes('@') && status === 'Paid') {
      stripePaid.set(email, amount);
    }
  }

  console.log(`Stripe paid emails: ${stripePaid.size}`);

  // 3. Parse Denefits CSV
  const denefitsCsv = fs.readFileSync('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/denefits_contracts.csv', 'utf8');
  const denefitsLines = denefitsCsv.split('\n');
  const denefitsHeaders = parseCSVLine(denefitsLines[0]);
  const denefitsEmailIdx = denefitsHeaders.indexOf('Customer Email');
  const denefitsAmountIdx = denefitsHeaders.indexOf('Payment Plan Amount');

  console.log(`\nDenefits: email col=${denefitsEmailIdx}, amount col=${denefitsAmountIdx}`);

  const denefitsContracts = new Map();
  for (let i = 1; i < denefitsLines.length; i++) {
    if (!denefitsLines[i].trim()) continue;
    const cols = parseCSVLine(denefitsLines[i]);
    const email = cols[denefitsEmailIdx]?.toLowerCase().trim();
    const amount = cols[denefitsAmountIdx];

    if (email && email.includes('@')) {
      denefitsContracts.set(email, amount);
    }
  }

  console.log(`Denefits contract emails: ${denefitsContracts.size}`);

  // 4. Get DB payments
  const { data: dbPayments } = await supabase
    .from('payments')
    .select('customer_email, amount, payment_source');

  const dbPaid = new Map();
  dbPayments?.forEach(p => {
    if (p.customer_email) {
      dbPaid.set(p.customer_email.toLowerCase(), { amount: p.amount, source: p.payment_source });
    }
  });

  console.log(`\nDatabase payment emails: ${dbPaid.size}`);

  // 5. Find matches
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('CROSS-REFERENCE');
  console.log('═══════════════════════════════════════════════════════');

  const stripeMatches = [];
  const denefitsMatches = [];
  const dbMatches = [];

  for (const email of lmEmails) {
    if (stripePaid.has(email)) {
      stripeMatches.push({ email, amount: stripePaid.get(email) });
    }
    if (denefitsContracts.has(email)) {
      denefitsMatches.push({ email, amount: denefitsContracts.get(email) });
    }
    if (dbPaid.has(email)) {
      dbMatches.push({ email, ...dbPaid.get(email) });
    }
  }

  console.log(`\nStripe matches: ${stripeMatches.length}`);
  stripeMatches.forEach(m => console.log(`  ✅ ${m.email}: $${m.amount}`));

  console.log(`\nDenefits matches: ${denefitsMatches.length}`);
  denefitsMatches.forEach(m => console.log(`  ✅ ${m.email}: $${m.amount}`));

  console.log(`\nDatabase matches: ${dbMatches.length}`);
  dbMatches.forEach(m => console.log(`  ✅ ${m.email}: $${m.amount} (${m.source})`));

  // Verify parsing with samples
  console.log('\n--- Verification: Sample Denefits records (proper parsing) ---');
  for (let i = 1; i <= 3 && i < denefitsLines.length; i++) {
    const cols = parseCSVLine(denefitsLines[i]);
    console.log(`  ${cols[denefitsEmailIdx]} → $${cols[denefitsAmountIdx]}`);
  }

  console.log('\n--- Verification: Sample Stripe records ---');
  let count = 0;
  for (let i = 1; i < stripeLines.length && count < 3; i++) {
    const cols = parseCSVLine(stripeLines[i]);
    if (cols[stripeStatusIdx] === 'Paid') {
      console.log(`  ${cols[stripeEmailIdx]} → $${cols[stripeAmountIdx]} (${cols[stripeStatusIdx]})`);
      count++;
    }
  }

  // Final
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('FINAL ANSWER');
  console.log('═══════════════════════════════════════════════════════');

  const total = stripeMatches.length + denefitsMatches.length + dbMatches.length;
  console.log(`\nLead Magnet emails: ${lmEmails.size}`);
  console.log(`Stripe paid: ${stripePaid.size}`);
  console.log(`Denefits contracts: ${denefitsContracts.size}`);
  console.log(`DB payments: ${dbPaid.size}`);
  console.log(`\nTOTAL MATCHES: ${total}`);

  if (total === 0) {
    console.log(`\n⚠️  ZERO lead magnet contacts have purchased.`);
  }
}

verify().catch(console.error);
