#!/usr/bin/env node
/**
 * ACTIONABLE BUSINESS INSIGHTS
 *
 * Focused analysis on what's actually working and what needs fixing
 * Based on clean data only - ignores corrupted fields
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

console.log('\n' + '='.repeat(90));
console.log('🎯 ACTIONABLE BUSINESS INSIGHTS - WHAT TO DO NOW');
console.log('='.repeat(90) + '\n');

const data = parseCSV(path.join(__dirname, '..', 'historical_data', 'unified_contacts_v2.csv'));
const customers = data.filter(row => row.has_purchase === 'TRUE');

console.log(`Dataset Overview:`);
console.log(`  Total Contacts: ${data.length.toLocaleString()}`);
console.log(`  Total Customers: ${customers.length}`);
console.log(`  Overall Conversion: ${((customers.length/data.length)*100).toFixed(2)}%`);
console.log(`  Total Revenue: $${customers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0).toLocaleString('en-US', {minimumFractionDigits: 2})}`);
console.log(`  Average Order Value: $${(customers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0) / customers.length).toFixed(2)}`);
console.log();

// =============================================================================
// INSIGHT 1: FUNNEL BOTTLENECKS - WHERE PEOPLE GET STUCK
// =============================================================================

console.log('='.repeat(90));
console.log('🔍 INSIGHT #1: FUNNEL BOTTLENECKS');
console.log('='.repeat(90) + '\n');

console.log('WHERE ARE PEOPLE GETTING STUCK?\n');

const contactsWithStages = data.filter(row => row.stage && row.stage.trim() &&
  !row.stage.includes('{{') && // Filter out corrupted data
  !row.stage.match(/^\d{4}-\d{2}-\d{2}/) && // Filter out dates in stage field
  row.stage !== 'PAID' && row.stage !== 'ORGANIC'); // Filter out attribution in stage field

const stageData = {};
contactsWithStages.forEach(row => {
  const stage = row.stage.trim();
  if (!stageData[stage]) {
    stageData[stage] = { total: 0, customers: 0, revenue: 0 };
  }
  stageData[stage].total++;
  if (row.has_purchase === 'TRUE') {
    stageData[stage].customers++;
    stageData[stage].revenue += parseFloat(row.total_revenue || 0);
  }
});

const stageAnalysis = Object.entries(stageData)
  .map(([stage, data]) => ({
    stage,
    total: data.total,
    customers: data.customers,
    conversionRate: data.total > 0 ? (data.customers / data.total) * 100 : 0,
    revenue: data.revenue
  }))
  .filter(s => s.total >= 10) // Only stages with significant volume
  .sort((a, b) => b.total - a.total);

console.log('Funnel Stage Performance (10+ contacts minimum):\n');
console.log('Stage                              | Volume | Customers | Conv % | Revenue');
console.log('-'.repeat(90));

stageAnalysis.forEach(s => {
  console.log(
    `${s.stage.padEnd(35)} | ${s.total.toString().padStart(6)} | ${s.customers.toString().padStart(9)} | ` +
    `${s.conversionRate.toFixed(1).padStart(6)}% | $${s.revenue.toFixed(0).padStart(8)}`
  );
});
console.log();

// Identify bottlenecks
const bottlenecks = stageAnalysis
  .filter(s => s.total >= 100) // High volume
  .filter(s => s.conversionRate < 3) // Low conversion
  .sort((a, b) => b.total - a.total);

console.log('🚨 CRITICAL BOTTLENECKS (high volume + low conversion):\n');
bottlenecks.forEach((b, i) => {
  console.log(`${i+1}. ${b.stage}`);
  console.log(`   Volume: ${b.total} contacts`);
  console.log(`   Conversion: ${b.conversionRate.toFixed(1)}%`);
  console.log(`   Revenue: $${b.revenue.toFixed(0)}`);
  console.log(`   ISSUE: ${b.total} people stuck, only ${b.customers} converting`);
  console.log();
});

console.log('✅ WHAT TO DO:\n');
console.log('For each bottleneck stage:');
console.log('   1. Add automated follow-up email sequence (2-3 emails over 7 days)');
console.log('   2. Offer time-limited incentive ($100 off if they book within 48 hours)');
console.log('   3. Add social proof (testimonials from people at this exact stage)');
console.log('   4. Reduce friction (simplify next step, remove unnecessary fields)');
console.log();

// Calculate potential impact
if (bottlenecks.length > 0) {
  const top2Bottlenecks = bottlenecks.slice(0, 2);
  const avgRevenue = customers.length > 0
    ? customers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0) / customers.length
    : 0;

  console.log('💰 POTENTIAL IMPACT IF YOU FIX THESE:\n');
  top2Bottlenecks.forEach((b, i) => {
    // If we improve conversion from current to 5%
    const currentCustomers = b.customers;
    const potentialAt5Pct = Math.round(b.total * 0.05);
    const additionalCustomers = potentialAt5Pct - currentCustomers;
    const additionalRevenue = additionalCustomers * avgRevenue;

    console.log(`${i+1}. ${b.stage}:`);
    console.log(`   If you improve conversion to just 5%:`);
    console.log(`   + ${additionalCustomers} more customers`);
    console.log(`   + $${additionalRevenue.toLocaleString('en-US', {minimumFractionDigits: 0})} additional revenue\n`);
  });
}

// =============================================================================
// INSIGHT 2: HIGH-PERFORMING STAGES - WHAT'S WORKING
// =============================================================================

console.log('='.repeat(90));
console.log('🌟 INSIGHT #2: WHAT\'S WORKING WELL');
console.log('='.repeat(90) + '\n');

const highPerformers = stageAnalysis
  .filter(s => s.conversionRate > 10) // High conversion
  .sort((a, b) => b.conversionRate - a.conversionRate);

if (highPerformers.length > 0) {
  console.log('These stages have GREAT conversion rates:\n');
  console.log('Stage                              | Volume | Conv % | Customers');
  console.log('-'.repeat(90));

  highPerformers.forEach(s => {
    console.log(
      `${s.stage.padEnd(35)} | ${s.total.toString().padStart(6)} | ${s.conversionRate.toFixed(1).padStart(6)}% | ${s.customers.toString().padStart(9)}`
    );
  });
  console.log();

  console.log('✅ WHAT TO DO:\n');
  console.log('   1. Get MORE people to these high-converting stages');
  console.log('   2. Study what makes these stages different (messaging, offer, timing)');
  console.log('   3. Apply those learnings to earlier stages');
  console.log('   4. Create urgency to move people FROM bottleneck stages TO these stages\n');
} else {
  console.log('No stages found with >10% conversion. Focus on fixing bottlenecks first.\n');
}

// =============================================================================
// INSIGHT 3: CUSTOMER VALUE TIERS
// =============================================================================

console.log('='.repeat(90));
console.log('💎 INSIGHT #3: WHO ARE YOUR BEST CUSTOMERS?');
console.log('='.repeat(90) + '\n');

const customersByValue = customers
  .map(c => ({
    email: c.email,
    name: `${c.first_name} ${c.last_name}`.trim() || 'Unknown',
    revenue: parseFloat(c.total_revenue || 0),
    source: c.source,
    stage: c.stage
  }))
  .sort((a, b) => b.revenue - a.revenue);

const whales = customersByValue.filter(c => c.revenue >= 3000);
const highValue = customersByValue.filter(c => c.revenue >= 2000 && c.revenue < 3000);
const midValue = customersByValue.filter(c => c.revenue >= 1000 && c.revenue < 2000);
const lowValue = customersByValue.filter(c => c.revenue < 1000);

const totalRevenue = customers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0);

console.log('Customer Value Segmentation:\n');
console.log('Tier                  | Count | Avg Revenue | Total Revenue | % of Total');
console.log('-'.repeat(90));

const tiers = [
  { name: 'Whales ($3,000+)', customers: whales },
  { name: 'High-Value ($2k-$3k)', customers: highValue },
  { name: 'Mid-Value ($1k-$2k)', customers: midValue },
  { name: 'Low-Value (<$1k)', customers: lowValue }
];

tiers.forEach(tier => {
  const tierRevenue = tier.customers.reduce((sum, c) => sum + c.revenue, 0);
  const avgRevenue = tier.customers.length > 0 ? tierRevenue / tier.customers.length : 0;
  const pctOfTotal = totalRevenue > 0 ? (tierRevenue / totalRevenue) * 100 : 0;

  console.log(
    `${tier.name.padEnd(20)} | ${tier.customers.length.toString().padStart(5)} | ` +
    `$${avgRevenue.toFixed(0).padStart(10)} | $${tierRevenue.toFixed(0).padStart(12)} | ${pctOfTotal.toFixed(1).padStart(9)}%`
  );
});
console.log();

console.log(`KEY FINDING: Your top ${whales.length + highValue.length} customers ($2k+) represent ` +
  `${(((whales.length + highValue.length) / customers.length) * 100).toFixed(1)}% of customers but ` +
  `${((tiers[0].customers.reduce((sum, c) => sum + c.revenue, 0) + tiers[1].customers.reduce((sum, c) => sum + c.revenue, 0)) / totalRevenue * 100).toFixed(1)}% of revenue.\n`);

console.log('✅ WHAT TO DO:\n');
console.log('   1. RETENTION: Set up quarterly check-ins with high-value customers');
console.log('   2. UPSELL: Offer premium/VIP program to mid-value customers');
console.log('   3. ACQUISITION: Create Facebook lookalike audiences from whale emails');
console.log('   4. REFERRALS: Ask whales for referrals (offer $500 credit for each referral)\n');

// =============================================================================
// INSIGHT 4: TIME TO PURCHASE PATTERNS
// =============================================================================

console.log('='.repeat(90));
console.log('⏱️  INSIGHT #4: HOW LONG DOES IT TAKE TO CONVERT?');
console.log('='.repeat(90) + '\n');

const timeToPurchase = [];

customers.forEach(row => {
  const subDate = parseDate(row.subscription_date);
  const purchaseDate = parseDate(row.purchase_date);

  if (subDate && purchaseDate) {
    const days = Math.round((purchaseDate - subDate) / (1000 * 60 * 60 * 24));
    if (days >= 0 && days <= 365) { // Filter outliers
      timeToPurchase.push({
        days,
        revenue: parseFloat(row.total_revenue || 0)
      });
    }
  }
});

if (timeToPurchase.length > 20) { // Need enough data
  timeToPurchase.sort((a, b) => a.days - b.days);

  const median = timeToPurchase[Math.floor(timeToPurchase.length / 2)].days;
  const avg = timeToPurchase.reduce((sum, t) => sum + t.days, 0) / timeToPurchase.length;

  console.log(`Data available for ${timeToPurchase.length} customers:\n`);
  console.log(`  Average time to purchase: ${avg.toFixed(1)} days`);
  console.log(`  Median time to purchase:  ${median} days`);
  console.log();

  // Speed tiers
  const fast = timeToPurchase.filter(t => t.days <= 7);
  const medium = timeToPurchase.filter(t => t.days > 7 && t.days <= 30);
  const slow = timeToPurchase.filter(t => t.days > 30);

  console.log('Speed Tiers:\n');
  console.log('Tier           | Count | % of Total | Avg Revenue');
  console.log('-'.repeat(90));

  const speedTiers = [
    { name: 'Fast (0-7 days)', customers: fast },
    { name: 'Medium (8-30 days)', customers: medium },
    { name: 'Slow (31+ days)', customers: slow }
  ];

  speedTiers.forEach(tier => {
    const pct = (tier.customers.length / timeToPurchase.length) * 100;
    const avgRev = tier.customers.length > 0
      ? tier.customers.reduce((sum, t) => sum + t.revenue, 0) / tier.customers.length
      : 0;

    console.log(
      `${tier.name.padEnd(20)} | ${tier.customers.length.toString().padStart(5)} | ${pct.toFixed(1).padStart(9)}% | $${avgRev.toFixed(0).padStart(10)}`
    );
  });
  console.log();

  console.log('✅ WHAT TO DO:\n');
  console.log(`   1. ${fast.length} customers bought within 7 days - identify what triggered urgency`);
  console.log(`   2. ${slow.length} customers took 30+ days - this is lost momentum`);
  console.log('   3. Create urgency: "Limited spots available this month"');
  console.log('   4. Add scarcity: "Only 3 packages left at this price"');
  console.log('   5. First-week focus: Heavy follow-up in days 1-7 while interest is hot\n');
} else {
  console.log('Not enough timing data available for analysis.\n');
}

// =============================================================================
// INSIGHT 5: REVENUE CONCENTRATION
// =============================================================================

console.log('='.repeat(90));
console.log('📊 INSIGHT #5: WHERE IS YOUR REVENUE COMING FROM?');
console.log('='.repeat(90) + '\n');

const sourceRevenue = {};
customers.forEach(c => {
  const source = c.source || 'unknown';
  if (!sourceRevenue[source]) {
    sourceRevenue[source] = { count: 0, revenue: 0 };
  }
  sourceRevenue[source].count++;
  sourceRevenue[source].revenue += parseFloat(c.total_revenue || 0);
});

console.log('Revenue by Source:\n');
console.log('Source                | Customers | Total Revenue | % of Revenue | Avg per Customer');
console.log('-'.repeat(90));

Object.entries(sourceRevenue)
  .sort((a, b) => b[1].revenue - a[1].revenue)
  .forEach(([source, data]) => {
    const pct = (data.revenue / totalRevenue) * 100;
    const avg = data.revenue / data.count;

    console.log(
      `${source.padEnd(20)} | ${data.count.toString().padStart(9)} | $${data.revenue.toFixed(0).padStart(12)} | ` +
      `${pct.toFixed(1).padStart(11)}% | $${avg.toFixed(0).padStart(15)}`
    );
  });
console.log();

const topSource = Object.entries(sourceRevenue).sort((a, b) => b[1].revenue - a[1].revenue)[0];

console.log(`KEY FINDING: ${topSource[1].count} customers from "${topSource[0]}" generated ` +
  `$${topSource[1].revenue.toFixed(0)} (${((topSource[1].revenue/totalRevenue)*100).toFixed(1)}% of total revenue)\n`);

console.log('✅ WHAT TO DO:\n');
console.log(`   1. ${topSource[0]} is your best source - double down on this channel`);
console.log('   2. Study what makes this source different (quality, intent, awareness level)');
console.log('   3. Test increasing budget/effort on this source by 50%\n');

// =============================================================================
// EXECUTIVE SUMMARY & TOP 5 ACTIONS
// =============================================================================

console.log('='.repeat(90));
console.log('🎯 TOP 5 ACTIONS TO TAKE THIS WEEK');
console.log('='.repeat(90) + '\n');

let actionNum = 1;

// Action from bottlenecks
if (bottlenecks.length > 0) {
  const topBottleneck = bottlenecks[0];
  console.log(`${actionNum}. FIX YOUR BIGGEST BOTTLENECK: ${topBottleneck.stage}`);
  console.log(`   - ${topBottleneck.total} contacts stuck, only ${topBottleneck.conversionRate.toFixed(1)}% converting`);
  console.log(`   - Add 3-email nurture sequence over 7 days`);
  console.log(`   - Offer time-limited incentive\n`);
  actionNum++;
}

// Action from high performers
if (highPerformers.length > 0) {
  console.log(`${actionNum}. GET MORE PEOPLE TO HIGH-CONVERTING STAGE: ${highPerformers[0].stage}`);
  console.log(`   - ${highPerformers[0].conversionRate.toFixed(1)}% conversion rate at this stage`);
  console.log(`   - Study what makes this stage work, apply to earlier stages\n`);
  actionNum++;
}

// Action from whales
console.log(`${actionNum}. CREATE LOOKALIKE AUDIENCES FROM YOUR BEST ${whales.length + highValue.length} CUSTOMERS`);
console.log(`   - Upload their emails to Facebook/Instagram ads`);
console.log(`   - Target people similar to your $2k+ customers\n`);
actionNum++;

// Action from timing
if (timeToPurchase.length > 20) {
  const fast = timeToPurchase.filter(t => t.days <= 7);
  if (fast.length > 0) {
    console.log(`${actionNum}. CREATE URGENCY IN FIRST 7 DAYS`);
    console.log(`   - ${fast.length} customers bought within a week`);
    console.log(`   - Heavy follow-up days 1-7 while interest is hot`);
    console.log(`   - "Limited spots" or "Price increase next week"\n`);
    actionNum++;
  }
}

// Action from source
console.log(`${actionNum}. DOUBLE DOWN ON ${topSource[0].toUpperCase()}`);
console.log(`   - Your best revenue source: $${topSource[1].revenue.toFixed(0)}`);
console.log(`   - Increase effort/budget by 50%\n`);

console.log('='.repeat(90));
console.log('✅ ANALYSIS COMPLETE');
console.log('='.repeat(90));
console.log();
