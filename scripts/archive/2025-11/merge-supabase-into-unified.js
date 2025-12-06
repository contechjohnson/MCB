#!/usr/bin/env node
/**
 * Merge Supabase Export into Unified Contacts
 *
 * This script:
 * 1. Loads unified_contacts.csv (4,162 contacts)
 * 2. Finds 2,224 NEW contacts in Supabase export
 * 3. Cross-references with Stripe and Denefits for revenue
 * 4. Generates unified_contacts_v2.csv (6,386 contacts)
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('MERGING SUPABASE EXPORT INTO UNIFIED CONTACTS');
console.log('='.repeat(80) + '\n');

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function normalizeEmail(email) {
  if (!email) return null;
  email = String(email).trim().toLowerCase();
  if (!email.includes('@')) return null;
  return email;
}

function parseDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toISOString();
  } catch {
    return '';
  }
}

function parseAmount(value) {
  if (!value) return 0;
  const str = String(value);
  // Try to extract a number from the string
  const match = str.match(/(\d+\.?\d*)/);
  if (match) {
    const num = parseFloat(match[1]);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// =============================================================================
// LOAD UNIFIED CONTACTS
// =============================================================================

console.log('📖 Loading unified_contacts.csv...\n');

const unifiedCsv = fs.readFileSync(
  path.join(__dirname, '..', 'historical_data', 'unified_contacts.csv'),
  'utf8'
);
const unifiedLines = unifiedCsv.split('\n');
const unifiedHeaders = unifiedLines[0].split(',');
const unifiedRows = unifiedLines.slice(1).filter(line => line.trim()).map(line => {
  const values = line.split(',');
  const row = {};
  unifiedHeaders.forEach((header, i) => {
    row[header] = values[i] || '';
  });
  return row;
});

console.log(`  ✓ Loaded ${unifiedRows.length} unified contacts`);

// Create email lookup
const unifiedEmails = new Set(
  unifiedRows.map(row => normalizeEmail(row.email)).filter(Boolean)
);

console.log(`  ✓ ${unifiedEmails.size} unique emails\n`);

// =============================================================================
// LOAD SUPABASE EXPORT
// =============================================================================

console.log('📖 Loading supabase_export_contacts_full.csv...\n');

const supabaseCsv = fs.readFileSync(
  path.join(__dirname, '..', 'historical_data', 'supabase_export_contacts_full.csv'),
  'utf8'
);
const supabaseLines = supabaseCsv.split('\n');
const supabaseHeaders = supabaseLines[0].split(',');
const supabaseRows = supabaseLines.slice(1).filter(line => line.trim()).map(line => {
  const values = line.split(',');
  const row = {};
  supabaseHeaders.forEach((header, i) => {
    row[header] = values[i] || '';
  });
  return row;
});

console.log(`  ✓ Loaded ${supabaseRows.length} total Supabase contacts`);

// Filter to new contacts with emails
const newSupabaseContacts = supabaseRows.filter(row => {
  const email = normalizeEmail(row.email_address);
  if (!email) return false;
  return !unifiedEmails.has(email);
});

console.log(`  ✓ Found ${newSupabaseContacts.length} NEW contacts (not in unified)\n`);

// =============================================================================
// LOAD STRIPE DATA
// =============================================================================

console.log('📖 Loading stripe_unified_payments.csv...\n');

const stripeCsv = fs.readFileSync(
  path.join(__dirname, '..', 'historical_data', 'stripe_unified_payments.csv'),
  'utf8'
);
const stripeLines = stripeCsv.split('\n');
const stripeHeaders = stripeLines[0].split(',');
const stripeRows = stripeLines.slice(1).filter(line => line.trim()).map(line => {
  const values = line.split(',');
  const row = {};
  stripeHeaders.forEach((header, i) => {
    row[header] = values[i] || '';
  });
  return row;
});

console.log(`  ✓ Loaded ${stripeRows.length} Stripe transactions`);

// Create Stripe lookup by email
const stripeByEmail = new Map();
stripeRows.forEach(row => {
  const email = normalizeEmail(row['Customer Email']);
  if (!email) return;

  const status = row['Status'] || '';
  const amount = parseFloat(row['Amount']) || 0;
  const date = row['Created date (UTC)'] || '';

  if (status.toLowerCase() === 'paid' && amount > 0) {
    if (!stripeByEmail.has(email)) {
      stripeByEmail.set(email, {
        total: 0,
        firstDate: date,
        payments: []
      });
    }
    const data = stripeByEmail.get(email);
    data.total += amount;
    data.payments.push({ amount, date });
    if (date < data.firstDate) {
      data.firstDate = date;
    }
  }
});

console.log(`  ✓ ${stripeByEmail.size} unique Stripe customers\n`);

// =============================================================================
// LOAD DENEFITS DATA
// =============================================================================

console.log('📖 Loading denefits_contracts.csv...\n');

const denefitsCsv = fs.readFileSync(
  path.join(__dirname, '..', 'historical_data', 'denefits_contracts.csv'),
  'utf8'
);
const denefitsLines = denefitsCsv.split('\n');
const denefitsHeaders = denefitsLines[0].split(',');
const denefitsRows = denefitsLines.slice(1).filter(line => line.trim()).map(line => {
  const values = line.split(',');
  const row = {};
  denefitsHeaders.forEach((header, i) => {
    row[header] = values[i] || '';
  });
  return row;
});

console.log(`  ✓ Loaded ${denefitsRows.length} Denefits contracts`);

// Create Denefits lookup by email
const denefitsByEmail = new Map();
denefitsRows.forEach(row => {
  const email = normalizeEmail(row['Customer Email']);
  if (!email) return;

  const amount = parseFloat(row['Payment Plan Amount']) || 0;
  const date = row['Payment Plan Sign Up Date'] || '';

  if (amount > 0) {
    if (!denefitsByEmail.has(email)) {
      denefitsByEmail.set(email, {
        total: 0,
        firstDate: date,
        contracts: []
      });
    }
    const data = denefitsByEmail.get(email);
    data.total += amount;
    data.contracts.push({ amount, date });
    if (date && (!data.firstDate || date < data.firstDate)) {
      data.firstDate = date;
    }
  }
});

console.log(`  ✓ ${denefitsByEmail.size} unique Denefits customers\n`);

// =============================================================================
// PROCESS NEW CONTACTS
// =============================================================================

console.log('🔄 Processing new contacts and cross-referencing payments...\n');

let newContactsAdded = 0;
let newCustomersAdded = 0;
let stripeMatches = 0;
let denefitsMatches = 0;

const newContactsMapped = newSupabaseContacts.map(supabaseRow => {
  const email = normalizeEmail(supabaseRow.email_address);

  // Cross-reference with Stripe
  const stripeData = stripeByEmail.get(email);
  const hasStripe = !!stripeData;
  const stripeRevenue = hasStripe ? stripeData.total : 0;
  const stripeDate = hasStripe ? stripeData.firstDate : '';
  const stripePayments = hasStripe ? stripeData.payments.length : 0;

  // Cross-reference with Denefits
  const denefitsData = denefitsByEmail.get(email);
  const hasDenefits = !!denefitsData;
  const denefitsRevenue = hasDenefits ? denefitsData.total : 0;
  const denefitsDate = hasDenefits ? denefitsData.firstDate : '';
  const denefitsContracts = hasDenefits ? denefitsData.contracts.length : 0;

  // Calculate totals
  const totalRevenue = stripeRevenue + denefitsRevenue;
  const hasPurchase = totalRevenue > 0;

  // Determine first purchase date
  let purchaseDate = '';
  if (stripeDate && denefitsDate) {
    purchaseDate = stripeDate < denefitsDate ? stripeDate : denefitsDate;
  } else {
    purchaseDate = stripeDate || denefitsDate;
  }

  // Count matches
  if (hasStripe) stripeMatches++;
  if (hasDenefits) denefitsMatches++;
  if (hasPurchase) newCustomersAdded++;
  newContactsAdded++;

  // Map to unified schema
  return {
    email: email,
    first_name: supabaseRow.first_name || '',
    last_name: supabaseRow.last_name || '',
    phone: supabaseRow.phone || '',
    instagram: supabaseRow.instagram_handle || '',
    facebook: supabaseRow.facebook_name || '',

    // Source tracking
    source: 'supabase_export',

    // Attribution
    paid_vs_organic: '', // Corrupted in Supabase, leave blank
    trigger_word: '', // Corrupted in Supabase, leave blank
    ad_id: supabaseRow.ad_id || '',
    ad_name: '',
    campaign: '',

    // Funnel stage
    stage: supabaseRow.stage || '',

    // Subscription
    subscription_date: parseDate(supabaseRow.subscription_date),

    // Purchase data (from Stripe/Denefits cross-reference)
    has_purchase: hasPurchase ? 'TRUE' : 'FALSE',
    purchase_date: parseDate(purchaseDate),
    purchase_amount: totalRevenue.toFixed(2),

    // Stripe details
    stripe_revenue: stripeRevenue.toFixed(2),
    stripe_payments: stripePayments,
    stripe_first_payment: parseDate(stripeDate),

    // Denefits details
    denefits_revenue: denefitsRevenue.toFixed(2),
    denefits_contracts: denefitsContracts,
    denefits_signup_date: parseDate(denefitsDate),

    // Total revenue
    total_revenue: totalRevenue.toFixed(2),

    // Notes
    notes: 'Imported from Supabase export; revenue fields were corrupted, matched via Stripe/Denefits'
  };
});

console.log(`  ✓ Processed ${newContactsMapped.length} new contacts`);
console.log(`  ✓ Found ${newCustomersAdded} new customers (matched to payments)`);
console.log(`  ✓ Stripe matches: ${stripeMatches}`);
console.log(`  ✓ Denefits matches: ${denefitsMatches}`);
console.log();

// =============================================================================
// MERGE WITH UNIFIED CONTACTS
// =============================================================================

console.log('🔀 Merging with unified_contacts.csv...\n');

// Read unified contacts into objects
const unifiedContactsMapped = unifiedRows.map(row => ({
  email: normalizeEmail(row.email),
  first_name: row.first_name || '',
  last_name: row.last_name || '',
  phone: row.phone || '',
  instagram: row.instagram || '',
  facebook: row.facebook || '',
  source: row.source || '',
  paid_vs_organic: row.paid_vs_organic || '',
  trigger_word: row.trigger_word || '',
  ad_id: row.ad_id || '',
  ad_name: row.ad_name || '',
  campaign: row.campaign || '',
  stage: row.stage || '',
  subscription_date: row.subscription_date || '',
  has_purchase: row.has_purchase || 'FALSE',
  purchase_date: row.purchase_date || '',
  purchase_amount: row.purchase_amount || '0',
  stripe_revenue: row.stripe_revenue || '0',
  stripe_payments: row.stripe_payments || '0',
  stripe_first_payment: row.stripe_first_payment || '',
  denefits_revenue: row.denefits_revenue || '0',
  denefits_contracts: row.denefits_contracts || '0',
  denefits_signup_date: row.denefits_signup_date || '',
  total_revenue: row.total_revenue || '0',
  notes: row.notes || ''
}));

// Combine
const allContacts = [...unifiedContactsMapped, ...newContactsMapped];

console.log(`  ✓ Original unified contacts: ${unifiedContactsMapped.length}`);
console.log(`  ✓ New contacts from Supabase: ${newContactsMapped.length}`);
console.log(`  ✓ Total in v2: ${allContacts.length}`);
console.log();

// =============================================================================
// GENERATE unified_contacts_v2.csv
// =============================================================================

console.log('💾 Writing unified_contacts_v2.csv...\n');

// CSV headers
const headers = [
  'email', 'first_name', 'last_name', 'phone', 'instagram', 'facebook',
  'source', 'paid_vs_organic', 'trigger_word', 'ad_id', 'ad_name', 'campaign',
  'stage', 'subscription_date', 'has_purchase', 'purchase_date', 'purchase_amount',
  'stripe_revenue', 'stripe_payments', 'stripe_first_payment',
  'denefits_revenue', 'denefits_contracts', 'denefits_signup_date',
  'total_revenue', 'notes'
];

// Generate CSV
const csvLines = [headers.join(',')];

allContacts.forEach(contact => {
  const row = headers.map(header => csvEscape(contact[header]));
  csvLines.push(row.join(','));
});

const outputPath = path.join(__dirname, '..', 'historical_data', 'unified_contacts_v2.csv');
fs.writeFileSync(outputPath, csvLines.join('\n'));

console.log(`  ✓ Wrote ${allContacts.length} contacts to unified_contacts_v2.csv\n`);

// =============================================================================
// SUMMARY STATISTICS
// =============================================================================

console.log('='.repeat(80));
console.log('📊 SUMMARY STATISTICS\n');

const v2Customers = allContacts.filter(c => c.has_purchase === 'TRUE').length;
const v2TotalRevenue = allContacts.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0);
const v2StripeRevenue = allContacts.reduce((sum, c) => sum + parseFloat(c.stripe_revenue || 0), 0);
const v2DenefitsRevenue = allContacts.reduce((sum, c) => sum + parseFloat(c.denefits_revenue || 0), 0);

console.log('📈 Growth:');
console.log(`  Contacts:  4,162 → ${allContacts.length.toLocaleString()} (+${newContactsAdded.toLocaleString()})`);
console.log(`  Customers: 192 → ${v2Customers} (+${newCustomersAdded})`);
console.log();

console.log('💰 Revenue:');
console.log(`  Total:     $${v2TotalRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`  Stripe:    $${v2StripeRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`  Denefits:  $${v2DenefitsRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log();

console.log('🎯 Conversion Rates:');
const v1ConversionRate = (192 / 4162) * 100;
const v2ConversionRate = (v2Customers / allContacts.length) * 100;
console.log(`  V1: ${v1ConversionRate.toFixed(2)}% (192 / 4,162)`);
console.log(`  V2: ${v2ConversionRate.toFixed(2)}% (${v2Customers} / ${allContacts.length.toLocaleString()})`);
console.log();

console.log('📦 Sources:');
const sources = {};
allContacts.forEach(c => {
  sources[c.source] = (sources[c.source] || 0) + 1;
});
Object.entries(sources).sort((a, b) => b[1] - a[1]).forEach(([source, count]) => {
  console.log(`  ${source}: ${count.toLocaleString()}`);
});
console.log();

console.log('='.repeat(80));
console.log('✅ MERGE COMPLETE');
console.log('='.repeat(80));
console.log();
console.log('📄 Output file: historical_data/unified_contacts_v2.csv');
console.log();
console.log('Next steps:');
console.log('  1. Review unified_contacts_v2.csv');
console.log('  2. Run: python scripts/import_unified_to_supabase.py');
console.log('     (Update script to use unified_contacts_v2.csv)');
console.log('  3. Query your expanded dataset in Supabase!');
console.log();
