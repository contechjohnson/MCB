#!/usr/bin/env node
/**
 * Time-Based Cohort Analysis
 *
 * Analyzes contact behavior over time (by month, by day of week, etc.)
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

function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

console.log('\n' + '='.repeat(80));
console.log('📅 TIME-BASED COHORT ANALYSIS');
console.log('='.repeat(80) + '\n');

// Load data
const data = parseCSV(path.join(__dirname, '..', 'historical_data', 'unified_contacts_v2.csv'));

// =============================================================================
// MONTHLY SUBSCRIPTION TRENDS
// =============================================================================

console.log('📈 MONTHLY SUBSCRIPTION TRENDS\n');

const monthlyData = {};

data.forEach(row => {
  const date = parseDate(row.subscription_date);
  if (!date) return;

  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  if (!monthlyData[monthKey]) {
    monthlyData[monthKey] = {
      contacts: 0,
      customers: 0,
      revenue: 0
    };
  }

  monthlyData[monthKey].contacts++;
  if (row.has_purchase === 'TRUE') {
    monthlyData[monthKey].customers++;
    monthlyData[monthKey].revenue += parseFloat(row.total_revenue || 0);
  }
});

const sortedMonths = Object.entries(monthlyData)
  .sort((a, b) => a[0].localeCompare(b[0]));

console.log('Month       | Contacts | Customers | Conversion | Revenue');
console.log('-'.repeat(70));

sortedMonths.forEach(([month, data]) => {
  const conversion = data.contacts > 0 ? (data.customers / data.contacts) * 100 : 0;
  console.log(
    `${month}   | ${data.contacts.toString().padStart(8)} | ` +
    `${data.customers.toString().padStart(9)} | ${conversion.toFixed(1).padStart(10)}% | ` +
    `$${data.revenue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}).padStart(8)}`
  );
});
console.log();

// =============================================================================
// MONTHLY PURCHASE TRENDS
// =============================================================================

console.log('='.repeat(80));
console.log('💰 MONTHLY PURCHASE TRENDS\n');

const monthlyPurchases = {};

data.filter(row => row.has_purchase === 'TRUE').forEach(row => {
  const date = parseDate(row.purchase_date);
  if (!date) return;

  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  if (!monthlyPurchases[monthKey]) {
    monthlyPurchases[monthKey] = {
      purchases: 0,
      revenue: 0,
      stripe: 0,
      denefits: 0
    };
  }

  monthlyPurchases[monthKey].purchases++;
  monthlyPurchases[monthKey].revenue += parseFloat(row.total_revenue || 0);
  monthlyPurchases[monthKey].stripe += parseFloat(row.stripe_revenue || 0);
  monthlyPurchases[monthKey].denefits += parseFloat(row.denefits_revenue || 0);
});

const sortedPurchaseMonths = Object.entries(monthlyPurchases)
  .sort((a, b) => a[0].localeCompare(b[0]));

console.log('Month       | Purchases |   Total Revenue |  Stripe |  Denefits');
console.log('-'.repeat(75));

sortedPurchaseMonths.forEach(([month, data]) => {
  console.log(
    `${month}   | ${data.purchases.toString().padStart(9)} | ` +
    `$${data.revenue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}).padStart(14)} | ` +
    `$${data.stripe.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}).padStart(7)} | ` +
    `$${data.denefits.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}).padStart(9)}`
  );
});
console.log();

// =============================================================================
// DAY OF WEEK ANALYSIS
// =============================================================================

console.log('='.repeat(80));
console.log('📆 DAY OF WEEK PATTERNS\n');

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayData = {};

daysOfWeek.forEach(day => {
  dayData[day] = { contacts: 0, customers: 0, revenue: 0 };
});

data.forEach(row => {
  const date = parseDate(row.subscription_date);
  if (!date) return;

  const dayName = daysOfWeek[date.getDay()];
  dayData[dayName].contacts++;

  if (row.has_purchase === 'TRUE') {
    dayData[dayName].customers++;
    dayData[dayName].revenue += parseFloat(row.total_revenue || 0);
  }
});

console.log('Subscriptions by Day of Week:\n');
daysOfWeek.forEach(day => {
  const conversion = dayData[day].contacts > 0 ? (dayData[day].customers / dayData[day].contacts) * 100 : 0;
  const bar = '█'.repeat(Math.round(dayData[day].contacts / 50));
  console.log(
    `${day.padEnd(10)} ${dayData[day].contacts.toString().padStart(5)} contacts (${conversion.toFixed(1)}% conversion) ${bar}`
  );
});
console.log();

// =============================================================================
// TIME TO PURCHASE ANALYSIS
// =============================================================================

console.log('='.repeat(80));
console.log('⏱️  TIME TO PURCHASE\n');

const timeToPurchase = [];

data.filter(row => row.has_purchase === 'TRUE').forEach(row => {
  const subDate = parseDate(row.subscription_date);
  const purchaseDate = parseDate(row.purchase_date);

  if (subDate && purchaseDate) {
    const days = Math.round((purchaseDate - subDate) / (1000 * 60 * 60 * 24));
    if (days >= 0) { // Only count positive time differences
      timeToPurchase.push(days);
    }
  }
});

if (timeToPurchase.length > 0) {
  timeToPurchase.sort((a, b) => a - b);

  const median = timeToPurchase[Math.floor(timeToPurchase.length / 2)];
  const avg = timeToPurchase.reduce((sum, d) => sum + d, 0) / timeToPurchase.length;
  const min = Math.min(...timeToPurchase);
  const max = Math.max(...timeToPurchase);

  console.log(`Customers with timing data: ${timeToPurchase.length}`);
  console.log();
  console.log(`Average:   ${avg.toFixed(1)} days`);
  console.log(`Median:    ${median} days`);
  console.log(`Fastest:   ${min} days`);
  console.log(`Slowest:   ${max} days`);
  console.log();

  // Distribution
  const buckets = {
    'Same day (0 days)': 0,
    '1-7 days': 0,
    '8-14 days': 0,
    '15-30 days': 0,
    '31-60 days': 0,
    '61-90 days': 0,
    '90+ days': 0
  };

  timeToPurchase.forEach(days => {
    if (days === 0) buckets['Same day (0 days)']++;
    else if (days <= 7) buckets['1-7 days']++;
    else if (days <= 14) buckets['8-14 days']++;
    else if (days <= 30) buckets['15-30 days']++;
    else if (days <= 60) buckets['31-60 days']++;
    else if (days <= 90) buckets['61-90 days']++;
    else buckets['90+ days']++;
  });

  console.log('Time to Purchase Distribution:\n');
  Object.entries(buckets).forEach(([bucket, count]) => {
    const pct = (count / timeToPurchase.length) * 100;
    const bar = '█'.repeat(Math.round(pct / 2));
    console.log(`${bucket.padEnd(20)} ${count.toString().padStart(4)} (${pct.toFixed(1).padStart(5)}%) ${bar}`);
  });
  console.log();
} else {
  console.log('No timing data available (missing subscription or purchase dates)');
  console.log();
}

// =============================================================================
// RECENT ACTIVITY
// =============================================================================

console.log('='.repeat(80));
console.log('🕐 RECENT ACTIVITY (Last 30 Days)\n');

const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const recentContacts = data.filter(row => {
  const date = parseDate(row.subscription_date);
  return date && date >= thirtyDaysAgo;
});

const recentCustomers = recentContacts.filter(row => row.has_purchase === 'TRUE');
const recentRevenue = recentCustomers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0);

console.log(`New contacts in last 30 days:  ${recentContacts.length.toLocaleString()}`);
console.log(`New customers in last 30 days: ${recentCustomers.length}`);
console.log(`Revenue in last 30 days:       $${recentRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log();

if (recentCustomers.length > 0) {
  console.log('Recent customers:\n');
  recentCustomers
    .sort((a, b) => parseDate(b.subscription_date) - parseDate(a.subscription_date))
    .slice(0, 10)
    .forEach(c => {
      const subDate = parseDate(c.subscription_date);
      console.log(`  ${subDate.toLocaleDateString()} - ${c.email} - $${parseFloat(c.total_revenue || 0).toFixed(2)}`);
    });
  console.log();
}

console.log('='.repeat(80));
console.log('✅ COHORT ANALYSIS COMPLETE');
console.log('='.repeat(80));
console.log();
