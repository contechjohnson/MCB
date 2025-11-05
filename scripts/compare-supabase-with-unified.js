#!/usr/bin/env node
/**
 * Compare Supabase Export with Unified Contacts
 *
 * This script compares the 9,666 Supabase contacts (with emails) against the
 * 4,162 unified contacts to identify:
 * 1. Overlap (contacts in both datasets)
 * 2. New contacts (in Supabase but not in unified)
 * 3. Revenue validation (do amounts match?)
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(80));
console.log('COMPARING SUPABASE EXPORT WITH UNIFIED CONTACTS');
console.log('='.repeat(80) + '\n');

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

// Create email lookup map (normalized to lowercase)
const unifiedEmailMap = new Map();
unifiedRows.forEach(row => {
  const email = (row.email || '').trim().toLowerCase();
  if (email) {
    unifiedEmailMap.set(email, row);
  }
});

console.log(`  ✓ Created email map with ${unifiedEmailMap.size} unique emails\n`);

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

// Filter to only those with emails
const supabaseWithEmail = supabaseRows.filter(row => {
  const email = (row.email_address || '').trim();
  return email && email.includes('@');
});

console.log(`  ✓ Filtered to ${supabaseWithEmail.length} contacts with emails\n`);

// =============================================================================
// COMPARE DATASETS
// =============================================================================

console.log('🔍 Comparing datasets...\n');

let overlap = 0;
let newInSupabase = 0;
let purchasersInSupabase = 0;
let newPurchasers = 0;

const newContacts = [];
const newPurchasersDetails = [];

supabaseWithEmail.forEach(supabaseContact => {
  const email = (supabaseContact.email_address || '').trim().toLowerCase();

  if (!email) return;

  const inUnified = unifiedEmailMap.has(email);
  const hasPurchase = parseFloat(supabaseContact.total_purchased || 0) > 0 ||
                      parseFloat(supabaseContact.first_purchase_amount || 0) > 0 ||
                      parseFloat(supabaseContact.package_purchase_amount || 0) > 0;

  if (inUnified) {
    overlap++;
  } else {
    newInSupabase++;
    newContacts.push({
      email: email,
      first_name: supabaseContact.first_name || '',
      last_name: supabaseContact.last_name || '',
      stage: supabaseContact.stage || '',
      subscription_date: supabaseContact.subscription_date || '',
      has_purchase: hasPurchase
    });
  }

  if (hasPurchase) {
    purchasersInSupabase++;

    if (!inUnified) {
      newPurchasers++;
      newPurchasersDetails.push({
        email: email,
        first_name: supabaseContact.first_name || '',
        last_name: supabaseContact.last_name || '',
        total_purchased: supabaseContact.total_purchased || '0',
        first_purchase_amount: supabaseContact.first_purchase_amount || '0',
        package_purchase_amount: supabaseContact.package_purchase_amount || '0',
        stage: supabaseContact.stage || '',
        subscription_date: supabaseContact.subscription_date || ''
      });
    }
  }
});

// =============================================================================
// RESULTS
// =============================================================================

console.log('📊 COMPARISON RESULTS\n');
console.log('='.repeat(80));
console.log();

console.log('Dataset Sizes:');
console.log(`  Unified contacts:           ${unifiedRows.length.toLocaleString()}`);
console.log(`  Supabase (with emails):     ${supabaseWithEmail.length.toLocaleString()}`);
console.log();

console.log('Overlap Analysis:');
console.log(`  Contacts in BOTH datasets:  ${overlap.toLocaleString()} (${((overlap / supabaseWithEmail.length) * 100).toFixed(1)}% of Supabase)`);
console.log(`  NEW in Supabase:            ${newInSupabase.toLocaleString()} (${((newInSupabase / supabaseWithEmail.length) * 100).toFixed(1)}% of Supabase)`);
console.log();

console.log('Purchase Analysis:');
console.log(`  Purchasers in Supabase:     ${purchasersInSupabase.toLocaleString()}`);
console.log(`  NEW purchasers (not in unified): ${newPurchasers.toLocaleString()}`);
console.log();

console.log('Potential Expansion:');
console.log(`  Current unified contacts:   ${unifiedRows.length.toLocaleString()}`);
console.log(`  Potential after merge:      ${(unifiedRows.length + newInSupabase).toLocaleString()}`);
console.log(`  Growth:                     +${newInSupabase.toLocaleString()} contacts (+${((newInSupabase / unifiedRows.length) * 100).toFixed(1)}%)`);
console.log();

console.log('Customer Expansion:');
console.log(`  Current unified customers:  192`);
console.log(`  Potential new customers:    ${newPurchasers}`);
console.log(`  Potential total:            ${192 + newPurchasers}`);
console.log();

// =============================================================================
// SAMPLE NEW CONTACTS
// =============================================================================

if (newContacts.length > 0) {
  console.log('='.repeat(80));
  console.log('📋 SAMPLE NEW CONTACTS (First 10)\n');

  newContacts.slice(0, 10).forEach((contact, i) => {
    console.log(`${i + 1}. ${contact.email}`);
    console.log(`   Name: ${contact.first_name} ${contact.last_name}`);
    console.log(`   Stage: ${contact.stage}`);
    console.log(`   Subscribed: ${contact.subscription_date}`);
    console.log(`   Has Purchase: ${contact.has_purchase ? 'YES' : 'No'}`);
    console.log();
  });
}

// =============================================================================
// NEW PURCHASERS DETAILS
// =============================================================================

if (newPurchasersDetails.length > 0) {
  console.log('='.repeat(80));
  console.log('💰 NEW PURCHASERS NOT IN UNIFIED (All)\n');

  newPurchasersDetails.forEach((customer, i) => {
    const totalAmount = parseFloat(customer.total_purchased || 0) +
                       parseFloat(customer.first_purchase_amount || 0) +
                       parseFloat(customer.package_purchase_amount || 0);

    console.log(`${i + 1}. ${customer.email}`);
    console.log(`   Name: ${customer.first_name} ${customer.last_name}`);
    console.log(`   Total Purchased: $${customer.total_purchased || '0'}`);
    console.log(`   First Purchase: $${customer.first_purchase_amount || '0'}`);
    console.log(`   Package Purchase: $${customer.package_purchase_amount || '0'}`);
    console.log(`   Estimated Total: $${totalAmount.toFixed(2)}`);
    console.log(`   Stage: ${customer.stage}`);
    console.log(`   Subscribed: ${customer.subscription_date}`);
    console.log();
  });

  // Calculate potential new revenue
  const potentialRevenue = newPurchasersDetails.reduce((sum, customer) => {
    const amount = parseFloat(customer.total_purchased || 0) +
                   parseFloat(customer.first_purchase_amount || 0) +
                   parseFloat(customer.package_purchase_amount || 0);
    return sum + amount;
  }, 0);

  console.log('='.repeat(80));
  console.log('💵 POTENTIAL NEW REVENUE\n');
  console.log(`  Current tracked revenue: $504,538`);
  console.log(`  Potential new revenue:   $${potentialRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  console.log(`  Potential total:         $${(504538 + potentialRevenue).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  console.log();
}

// =============================================================================
// RECOMMENDATIONS
// =============================================================================

console.log('='.repeat(80));
console.log('🎯 RECOMMENDATIONS\n');

if (newPurchasers > 0) {
  console.log('✅ YES, merge Supabase data with unified contacts!');
  console.log();
  console.log(`Reasons:`);
  console.log(`  1. ${newPurchasers} NEW customers found (not in unified)`);
  console.log(`  2. ${newInSupabase.toLocaleString()} new contacts for funnel analysis`);
  console.log(`  3. Potential revenue tracking expansion`);
  console.log();
  console.log('Next steps:');
  console.log('  1. Create merge script to add ${newInSupabase} new contacts');
  console.log('  2. Flag Supabase records with data quality notes');
  console.log('  3. Generate unified_contacts_v2.csv');
  console.log('  4. Re-run import to Supabase');
} else if (newInSupabase > 1000) {
  console.log('⚠️  CONSIDER merging Supabase data');
  console.log();
  console.log('While no new purchasers found, you have:');
  console.log(`  - ${newInSupabase.toLocaleString()} new contacts for funnel analysis`);
  console.log('  - Potential to improve conversion rate insights');
  console.log();
  console.log('Decision: Up to you based on how much you value funnel stage data');
} else {
  console.log('❌ NOT RECOMMENDED to merge');
  console.log();
  console.log('Reasons:');
  console.log('  - No new purchasers found');
  console.log('  - Small number of new contacts');
  console.log('  - Data quality issues in Supabase export');
  console.log();
  console.log('Recommendation: Stick with unified_contacts.csv (already comprehensive)');
}

console.log();
console.log('='.repeat(80));
console.log('✅ COMPARISON COMPLETE');
console.log('='.repeat(80));
console.log();
