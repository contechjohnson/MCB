#!/usr/bin/env node
/**
 * Revenue Analysis
 *
 * Analyzes revenue patterns, customer segments, and payment sources
 */

const fs = require('fs');
const path = require('path');

function parseCSV(filePath) {
  const csv = fs.readFileSync(filePath, 'utf8');
  const lines = csv.split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = line.split(',');
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    return row;
  });
}

console.log('\n' + '='.repeat(80));
console.log('💰 REVENUE ANALYSIS');
console.log('='.repeat(80) + '\n');

// Load data
const data = parseCSV(path.join(__dirname, '..', 'historical_data', 'unified_contacts_v2.csv'));
const customers = data.filter(row => row.has_purchase === 'TRUE');

console.log(`Total contacts: ${data.length.toLocaleString()}`);
console.log(`Total customers: ${customers.length.toLocaleString()}`);
console.log();

// =============================================================================
// OVERALL REVENUE
// =============================================================================

const totalRevenue = customers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0);
const stripeRevenue = customers.reduce((sum, c) => sum + parseFloat(c.stripe_revenue || 0), 0);
const denefitsRevenue = customers.reduce((sum, c) => sum + parseFloat(c.denefits_revenue || 0), 0);

console.log('📊 TOTAL REVENUE\n');
console.log(`  Total:    $${totalRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`  Stripe:   $${stripeRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${((stripeRevenue/totalRevenue)*100).toFixed(1)}%)`);
console.log(`  Denefits: $${denefitsRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${((denefitsRevenue/totalRevenue)*100).toFixed(1)}%)`);
console.log();

const avgOrderValue = totalRevenue / customers.length;
console.log(`  Average Order Value: $${avgOrderValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log();

// =============================================================================
// TOP CUSTOMERS
// =============================================================================

console.log('🏆 TOP 20 CUSTOMERS BY REVENUE\n');

const sortedCustomers = customers
  .map(c => ({
    email: c.email,
    name: `${c.first_name} ${c.last_name}`.trim() || 'Unknown',
    total: parseFloat(c.total_revenue || 0),
    stripe: parseFloat(c.stripe_revenue || 0),
    denefits: parseFloat(c.denefits_revenue || 0),
    source: c.source
  }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 20);

sortedCustomers.forEach((customer, i) => {
  console.log(`${(i+1).toString().padStart(2)}. $${customer.total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).padStart(10)} - ${customer.name}`);
  console.log(`    ${customer.email}`);
  if (customer.stripe > 0) console.log(`    Stripe: $${customer.stripe.toFixed(2)}`);
  if (customer.denefits > 0) console.log(`    Denefits: $${customer.denefits.toFixed(2)}`);
  console.log();
});

// =============================================================================
// REVENUE BY SOURCE
// =============================================================================

console.log('='.repeat(80));
console.log('📦 REVENUE BY DATA SOURCE\n');

const revenueBySource = {};
customers.forEach(c => {
  const source = c.source || 'unknown';
  if (!revenueBySource[source]) {
    revenueBySource[source] = { count: 0, revenue: 0 };
  }
  revenueBySource[source].count++;
  revenueBySource[source].revenue += parseFloat(c.total_revenue || 0);
});

Object.entries(revenueBySource)
  .sort((a, b) => b[1].revenue - a[1].revenue)
  .forEach(([source, data]) => {
    const avg = data.revenue / data.count;
    console.log(`${source}:`);
    console.log(`  Customers: ${data.count}`);
    console.log(`  Revenue:   $${data.revenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log(`  Avg/Customer: $${avg.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log();
  });

// =============================================================================
// REVENUE DISTRIBUTION
// =============================================================================

console.log('='.repeat(80));
console.log('📈 REVENUE DISTRIBUTION\n');

const buckets = {
  '$0-$500': 0,
  '$500-$1,000': 0,
  '$1,000-$2,000': 0,
  '$2,000-$3,000': 0,
  '$3,000-$5,000': 0,
  '$5,000+': 0
};

customers.forEach(c => {
  const revenue = parseFloat(c.total_revenue || 0);
  if (revenue < 500) buckets['$0-$500']++;
  else if (revenue < 1000) buckets['$500-$1,000']++;
  else if (revenue < 2000) buckets['$1,000-$2,000']++;
  else if (revenue < 3000) buckets['$2,000-$3,000']++;
  else if (revenue < 5000) buckets['$3,000-$5,000']++;
  else buckets['$5,000+']++;
});

Object.entries(buckets).forEach(([bucket, count]) => {
  const pct = (count / customers.length) * 100;
  const bar = '█'.repeat(Math.round(pct / 2));
  console.log(`${bucket.padEnd(15)} ${count.toString().padStart(4)} (${pct.toFixed(1)}%) ${bar}`);
});
console.log();

// =============================================================================
// PAYMENT METHOD SPLIT
// =============================================================================

console.log('='.repeat(80));
console.log('💳 PAYMENT METHOD BREAKDOWN\n');

const paymentMethods = {
  'Stripe Only': 0,
  'Denefits Only': 0,
  'Both (Stripe + Denefits)': 0
};

customers.forEach(c => {
  const hasStripe = parseFloat(c.stripe_revenue || 0) > 0;
  const hasDenefits = parseFloat(c.denefits_revenue || 0) > 0;

  if (hasStripe && hasDenefits) paymentMethods['Both (Stripe + Denefits)']++;
  else if (hasStripe) paymentMethods['Stripe Only']++;
  else if (hasDenefits) paymentMethods['Denefits Only']++;
});

Object.entries(paymentMethods).forEach(([method, count]) => {
  const pct = (count / customers.length) * 100;
  console.log(`${method.padEnd(30)} ${count.toString().padStart(4)} (${pct.toFixed(1)}%)`);
});
console.log();

// =============================================================================
// MULTIPLE PAYMENTS
// =============================================================================

console.log('='.repeat(80));
console.log('🔄 REPEAT CUSTOMERS\n');

const repeatStripe = customers.filter(c => parseInt(c.stripe_payments || 0) > 1);
const repeatDenefits = customers.filter(c => parseInt(c.denefits_contracts || 0) > 1);

console.log(`Customers with multiple Stripe payments: ${repeatStripe.length}`);
console.log(`Customers with multiple Denefits contracts: ${repeatDenefits.length}`);
console.log();

if (repeatStripe.length > 0) {
  console.log('Top repeat Stripe customers:\n');
  repeatStripe
    .sort((a, b) => parseInt(b.stripe_payments || 0) - parseInt(a.stripe_payments || 0))
    .slice(0, 10)
    .forEach(c => {
      console.log(`  ${c.email} - ${c.stripe_payments} payments, $${parseFloat(c.stripe_revenue || 0).toFixed(2)}`);
    });
  console.log();
}

console.log('='.repeat(80));
console.log('✅ REVENUE ANALYSIS COMPLETE');
console.log('='.repeat(80));
console.log();
