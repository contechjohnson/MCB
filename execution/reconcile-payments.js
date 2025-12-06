#!/usr/bin/env node
/**
 * Payment Reconciliation Script
 *
 * Verifies payments from Stripe/Denefits CSVs exist in database
 * and are properly linked to contacts.
 *
 * Usage:
 *   node execution/reconcile-payments.js --stripe path/to/stripe.csv
 *   node execution/reconcile-payments.js --denefits path/to/denefits.csv
 *   node execution/reconcile-payments.js --stripe stripe.csv --denefits denefits.csv
 *   node execution/reconcile-payments.js --stripe stripe.csv --import  # Auto-import missing
 *
 * See: directives/payment-reconciliation.md
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    stripe: null,
    denefits: null,
    import: false,
    tenant: 'ppcu',
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--stripe' && args[i + 1]) {
      options.stripe = args[++i];
    } else if (args[i] === '--denefits' && args[i + 1]) {
      options.denefits = args[++i];
    } else if (args[i] === '--tenant' && args[i + 1]) {
      options.tenant = args[++i];
    } else if (args[i] === '--import') {
      options.import = true;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      options.verbose = true;
    }
  }

  return options;
}

// Read and parse CSV file
function readCSV(filepath) {
  if (!fs.existsSync(filepath)) {
    console.error(`File not found: ${filepath}`);
    return null;
  }

  const content = fs.readFileSync(filepath, 'utf8');
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim()
  });

  if (result.errors.length > 0) {
    console.warn('CSV parse warnings:', result.errors.slice(0, 3));
  }

  return result.data;
}

// Normalize email for comparison
function normalizeEmail(email) {
  if (!email) return null;
  return email.toLowerCase().trim();
}

// Parse Stripe CSV row
function parseStripeRow(row) {
  return {
    paymentId: row['id'],
    email: normalizeEmail(row['email (metadata)'] || row['Customer Email']),
    amount: parseFloat(row['Amount']) || 0,
    status: row['Status'],
    date: row['Created date (UTC)'],
    source: 'stripe'
  };
}

// Parse Denefits CSV row
function parseDenefitsRow(row) {
  // Handle date format MM/DD/YYYY
  const dateStr = row['Payment Plan Sign Up Date'];
  let date = null;
  if (dateStr) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      date = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }

  return {
    paymentId: row['Payment Plan ID'],
    email: normalizeEmail(row['Customer Email']),
    name: row['Customer Name'],
    amount: parseFloat(row['Payment Plan Amount']) || 0,
    status: row['Payment Plan Status'],
    date: date,
    source: 'denefits'
  };
}

// Check if payment exists in database
// Note: Stripe CSV has charge IDs (py_, ch_) but webhooks store event IDs (evt_)
// So we match by email + amount instead, which is more reliable
async function checkPaymentExists(paymentId, email, amount, source) {
  // First try exact ID match (works for Denefits)
  const { data: exactMatch, error: exactError } = await supabase
    .from('payments')
    .select('id, contact_id, customer_email, amount, payment_event_id')
    .eq('payment_event_id', paymentId)
    .maybeSingle();

  if (exactMatch) return exactMatch;

  // For Stripe, match by email + amount (since IDs differ between CSV export and webhook)
  if (source === 'stripe' && email) {
    const { data: emailMatch, error: emailError } = await supabase
      .from('payments')
      .select('id, contact_id, customer_email, amount, payment_event_id')
      .ilike('customer_email', email)
      .eq('amount', amount)
      .eq('payment_source', 'stripe')
      .maybeSingle();

    if (emailMatch) return emailMatch;
  }

  return null;
}

// Check if email exists in contacts
async function checkContactByEmail(email, tenantId) {
  if (!email) return null;

  const { data, error } = await supabase
    .from('contacts')
    .select('id, email_primary, email_booking, email_payment, first_name, last_name')
    .eq('tenant_id', tenantId)
    .or(`email_primary.ilike.${email},email_booking.ilike.${email},email_payment.ilike.${email}`)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking contact:', error.message);
    return null;
  }

  return data;
}

// Get tenant ID by slug
async function getTenantId(slug) {
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error(`Tenant '${slug}' not found`);
    return null;
  }

  return data.id;
}

// Main reconciliation logic
async function reconcile(payments, tenantId, source, options) {
  const results = {
    total: payments.length,
    inDatabase: 0,
    missing: [],
    orphans: [],
    matched: 0,
    errors: []
  };

  console.log(`\nProcessing ${payments.length} ${source} payments...`);

  for (const payment of payments) {
    // Skip non-paid Stripe transactions (abandoned, failed)
    if (source === 'stripe' && payment.status !== 'Paid') {
      continue;
    }

    // Skip cancelled Denefits contracts
    if (source === 'denefits' && payment.status === 'Cancelled') {
      continue;
    }

    // Check if payment exists in DB
    const existingPayment = await checkPaymentExists(payment.paymentId, payment.email, payment.amount, source);

    if (existingPayment) {
      results.inDatabase++;

      // Check if it has a contact linked
      if (!existingPayment.contact_id) {
        // Payment exists but no contact linked - orphan
        const contact = await checkContactByEmail(payment.email, tenantId);
        results.orphans.push({
          ...payment,
          reason: contact
            ? 'Payment exists but contact_id not set (contact found by email)'
            : 'Payment exists but no matching contact in database',
          suggestedContactId: contact?.id || null
        });
      } else {
        results.matched++;
      }
    } else {
      // Payment not in database
      const contact = await checkContactByEmail(payment.email, tenantId);
      results.missing.push({
        ...payment,
        contactExists: !!contact,
        contactId: contact?.id || null,
        contactName: contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : null
      });
    }
  }

  return results;
}

// Print report
function printReport(stripeResults, denefitsResults, options) {
  const now = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  console.log('\n' + '='.repeat(60));
  console.log('         PAYMENT RECONCILIATION REPORT');
  console.log('='.repeat(60));
  console.log(`Date: ${now}`);
  console.log(`Tenant: ${options.tenant}`);
  console.log('='.repeat(60));

  if (stripeResults) {
    console.log('\nSTRIPE PAYMENTS');
    console.log('-'.repeat(40));
    console.log(`Total paid in CSV:    ${stripeResults.total}`);
    console.log(`Already in database:  ${stripeResults.inDatabase}`);
    console.log(`Fully matched:        ${stripeResults.matched}`);
    console.log(`Missing from DB:      ${stripeResults.missing.length}`);
    console.log(`Orphans (no contact): ${stripeResults.orphans.length}`);

    if (stripeResults.missing.length > 0) {
      console.log('\nMissing Stripe payments:');
      stripeResults.missing.slice(0, 10).forEach(p => {
        const contactNote = p.contactExists ? '(contact exists)' : '(NO CONTACT)';
        console.log(`  - ${p.email || 'NO EMAIL'} | $${p.amount.toLocaleString()} | ${p.date} ${contactNote}`);
      });
      if (stripeResults.missing.length > 10) {
        console.log(`  ... and ${stripeResults.missing.length - 10} more`);
      }
    }

    if (stripeResults.orphans.length > 0) {
      console.log('\nOrphan Stripe payments (in DB but no contact link):');
      stripeResults.orphans.slice(0, 5).forEach(p => {
        console.log(`  - ${p.paymentId} | ${p.email} | ${p.reason}`);
      });
    }
  }

  if (denefitsResults) {
    console.log('\nDENEFITS CONTRACTS');
    console.log('-'.repeat(40));
    console.log(`Total active in CSV:  ${denefitsResults.total}`);
    console.log(`Already in database:  ${denefitsResults.inDatabase}`);
    console.log(`Fully matched:        ${denefitsResults.matched}`);
    console.log(`Missing from DB:      ${denefitsResults.missing.length}`);
    console.log(`Orphans (no contact): ${denefitsResults.orphans.length}`);

    if (denefitsResults.missing.length > 0) {
      console.log('\nMissing Denefits contracts:');
      denefitsResults.missing.slice(0, 10).forEach(p => {
        const contactNote = p.contactExists ? '(contact exists)' : '(NO CONTACT)';
        console.log(`  - ${p.paymentId} | ${p.email} | $${p.amount.toLocaleString()} ${contactNote}`);
      });
      if (denefitsResults.missing.length > 10) {
        console.log(`  ... and ${denefitsResults.missing.length - 10} more`);
      }
    }

    if (denefitsResults.orphans.length > 0) {
      console.log('\nOrphan Denefits payments (in DB but no contact link):');
      denefitsResults.orphans.slice(0, 5).forEach(p => {
        console.log(`  - ${p.paymentId} | ${p.email} | ${p.reason}`);
      });
    }
  }

  // Summary and recommendations
  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(60));

  const totalMissing = (stripeResults?.missing.length || 0) + (denefitsResults?.missing.length || 0);
  const totalOrphans = (stripeResults?.orphans.length || 0) + (denefitsResults?.orphans.length || 0);

  if (totalMissing === 0 && totalOrphans === 0) {
    console.log('\nAll payments are in sync! No action needed.');
  } else {
    if (totalMissing > 0) {
      console.log(`\n1. Import ${totalMissing} missing payments`);
      console.log('   Run with --import flag to auto-import');
    }
    if (totalOrphans > 0) {
      console.log(`\n2. Link ${totalOrphans} orphan payments to contacts`);
      console.log('   Review emails and manually set contact_id');
    }
  }

  console.log('\n' + '='.repeat(60));

  // Return summary for programmatic use
  return {
    stripe: stripeResults,
    denefits: denefitsResults,
    totalMissing,
    totalOrphans
  };
}

// Main function
async function main() {
  const options = parseArgs();

  if (!options.stripe && !options.denefits) {
    console.log(`
Payment Reconciliation Script
=============================

Usage:
  node execution/reconcile-payments.js --stripe path/to/stripe.csv
  node execution/reconcile-payments.js --denefits path/to/denefits.csv
  node execution/reconcile-payments.js --stripe s.csv --denefits d.csv

Options:
  --stripe <file>    Path to Stripe CSV export
  --denefits <file>  Path to Denefits CSV export
  --tenant <slug>    Tenant slug (default: ppcu)
  --import           Auto-import missing payments (not yet implemented)
  --verbose          Show detailed output

Example CSV locations:
  historical_data/stripe_unified_payments.csv
  historical_data/denefits_contracts.csv
`);
    process.exit(0);
  }

  // Get tenant ID
  const tenantId = await getTenantId(options.tenant);
  if (!tenantId) {
    console.error(`Tenant '${options.tenant}' not found. Available: ppcu, centner, columnline`);
    process.exit(1);
  }

  console.log(`\nPayment Reconciliation for tenant: ${options.tenant}`);
  console.log('='.repeat(60));

  let stripeResults = null;
  let denefitsResults = null;

  // Process Stripe CSV
  if (options.stripe) {
    const stripePath = path.resolve(options.stripe);
    console.log(`\nReading Stripe CSV: ${stripePath}`);

    const stripeData = readCSV(stripePath);
    if (stripeData) {
      // Parse and filter to paid only
      const payments = stripeData
        .map(parseStripeRow)
        .filter(p => p.status === 'Paid');

      console.log(`Found ${payments.length} paid transactions (of ${stripeData.length} total)`);
      stripeResults = await reconcile(payments, tenantId, 'stripe', options);
    }
  }

  // Process Denefits CSV
  if (options.denefits) {
    const denefitsPath = path.resolve(options.denefits);
    console.log(`\nReading Denefits CSV: ${denefitsPath}`);

    const denefitsData = readCSV(denefitsPath);
    if (denefitsData) {
      // Parse and filter to active/completed only
      const payments = denefitsData
        .map(parseDenefitsRow)
        .filter(p => p.status !== 'Cancelled');

      console.log(`Found ${payments.length} active contracts (of ${denefitsData.length} total)`);
      denefitsResults = await reconcile(payments, tenantId, 'denefits', options);
    }
  }

  // Print report
  const summary = printReport(stripeResults, denefitsResults, options);

  // Auto-import if requested
  if (options.import && summary.totalMissing > 0) {
    console.log('\n--import flag detected but auto-import not yet implemented.');
    console.log('Please import manually or enhance this script.');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
