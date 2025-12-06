require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLMPurchases() {
  console.log('=== CHECKING LEAD MAGNET EMAILS AGAINST HISTORICAL PAYMENTS ===\n');

  // Get all lead magnet contact emails
  const { data: lmContacts } = await supabase
    .from('contacts')
    .select('email_primary, first_name, subscribe_date')
    .eq('source', 'instagram_lm');

  const lmEmails = new Set(lmContacts.map(c => c.email_primary?.toLowerCase()).filter(Boolean));
  console.log(`Lead magnet contacts: ${lmEmails.size} unique emails\n`);

  // Read Stripe CSV
  const stripeCsv = fs.readFileSync('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/stripe_unified_payments.csv', 'utf8');
  const stripeLines = stripeCsv.split('\n');
  const stripeHeaders = stripeLines[0].split(',');
  const stripeEmailIdx = stripeHeaders.findIndex(h => h.toLowerCase().includes('customer email'));
  const stripeAmountIdx = stripeHeaders.findIndex(h => h === 'Amount');
  const stripeDateIdx = stripeHeaders.findIndex(h => h.includes('Created date'));
  const stripeStatusIdx = stripeHeaders.findIndex(h => h === 'Status');

  console.log('Stripe email column index:', stripeEmailIdx);

  // Find Stripe matches
  const stripeMatches = [];
  for (let i = 1; i < stripeLines.length; i++) {
    if (!stripeLines[i].trim()) continue;
    const row = stripeLines[i].split(',');
    const email = row[stripeEmailIdx]?.toLowerCase().trim();
    const status = row[stripeStatusIdx]?.trim();

    if (email && lmEmails.has(email) && status === 'Paid') {
      stripeMatches.push({
        email,
        amount: row[stripeAmountIdx],
        date: row[stripeDateIdx],
        status
      });
    }
  }

  // Read Denefits CSV
  const denefitsCsv = fs.readFileSync('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/denefits_contracts.csv', 'utf8');
  const denefitsLines = denefitsCsv.split('\n');
  const denefitsHeaders = denefitsLines[0].split(',');
  const denefitsEmailIdx = denefitsHeaders.findIndex(h => h.toLowerCase().includes('email'));
  const denefitsAmountIdx = denefitsHeaders.findIndex(h => h.includes('Payment Plan Amount'));
  const denefitsDateIdx = denefitsHeaders.findIndex(h => h.includes('Sign Up Date'));
  const denefitsStatusIdx = denefitsHeaders.findIndex(h => h.includes('Payment Plan Status'));

  console.log('Denefits email column index:', denefitsEmailIdx);

  // Find Denefits matches
  const denefitsMatches = [];
  for (let i = 1; i < denefitsLines.length; i++) {
    if (!denefitsLines[i].trim()) continue;
    const row = denefitsLines[i].split(',');
    const email = row[denefitsEmailIdx]?.toLowerCase().trim();

    if (email && lmEmails.has(email)) {
      denefitsMatches.push({
        email,
        amount: row[denefitsAmountIdx],
        date: row[denefitsDateIdx],
        status: row[denefitsStatusIdx]
      });
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('RESULTS');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`STRIPE MATCHES: ${stripeMatches.length}`);
  if (stripeMatches.length > 0) {
    stripeMatches.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.email} - $${m.amount} - ${m.date} (${m.status})`);
    });
  }

  console.log(`\nDENEFITS MATCHES: ${denefitsMatches.length}`);
  if (denefitsMatches.length > 0) {
    denefitsMatches.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.email} - $${m.amount} - ${m.date} (${m.status})`);
    });
  }

  const totalMatches = stripeMatches.length + denefitsMatches.length;
  const totalRevenue =
    stripeMatches.reduce((sum, m) => sum + parseFloat(m.amount || 0), 0) +
    denefitsMatches.reduce((sum, m) => sum + parseFloat(m.amount || 0), 0);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Lead magnet emails checked: ${lmEmails.size}`);
  console.log(`Total matches found: ${totalMatches}`);
  console.log(`  - Stripe: ${stripeMatches.length}`);
  console.log(`  - Denefits: ${denefitsMatches.length}`);
  console.log(`Total revenue from LM leads: $${totalRevenue.toLocaleString()}`);
}

checkLMPurchases().catch(console.error);
