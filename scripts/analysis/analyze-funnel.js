#!/usr/bin/env node
/**
 * Funnel Progression Analysis
 *
 * Analyzes how far contacts progressed through your funnel stages
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
console.log('📊 FUNNEL PROGRESSION ANALYSIS');
console.log('='.repeat(80) + '\n');

// Load data
const data = parseCSV(path.join(__dirname, '..', 'historical_data', 'unified_contacts_v2.csv'));

console.log(`Total contacts: ${data.length.toLocaleString()}`);
console.log();

// =============================================================================
// FUNNEL STAGES
// =============================================================================

console.log('🔍 FUNNEL STAGE DISTRIBUTION\n');

const stages = {};
data.forEach(row => {
  const stage = row.stage || 'Unknown';
  stages[stage] = (stages[stage] || 0) + 1;
});

const sortedStages = Object.entries(stages).sort((a, b) => b[1] - a[1]);

sortedStages.forEach(([stage, count]) => {
  const pct = (count / data.length) * 100;
  const bar = '█'.repeat(Math.round(pct / 2));
  console.log(`${stage.padEnd(35)} ${count.toString().padStart(5)} (${pct.toFixed(1).padStart(5)}%) ${bar}`);
});
console.log();

// =============================================================================
// CONVERSION BY STAGE
// =============================================================================

console.log('='.repeat(80));
console.log('💰 CONVERSION RATE BY STAGE\n');

const stageConversion = {};
sortedStages.forEach(([stage]) => {
  const contactsInStage = data.filter(r => r.stage === stage);
  const customers = contactsInStage.filter(r => r.has_purchase === 'TRUE');
  const conversionRate = contactsInStage.length > 0 ? (customers.length / contactsInStage.length) * 100 : 0;

  stageConversion[stage] = {
    total: contactsInStage.length,
    customers: customers.length,
    rate: conversionRate
  };
});

Object.entries(stageConversion)
  .sort((a, b) => b[1].rate - a[1].rate)
  .forEach(([stage, data]) => {
    console.log(`${stage.padEnd(35)} ${data.customers.toString().padStart(4)}/${data.total.toString().padStart(5)} (${data.rate.toFixed(1).padStart(5)}%)`);
  });
console.log();

// =============================================================================
// PAID VS ORGANIC FUNNEL
// =============================================================================

console.log('='.repeat(80));
console.log('🎯 PAID VS ORGANIC PERFORMANCE\n');

const paidContacts = data.filter(r => r.paid_vs_organic && r.paid_vs_organic.toUpperCase() === 'PAID');
const organicContacts = data.filter(r => r.paid_vs_organic && r.paid_vs_organic.toUpperCase() === 'ORGANIC');
const unknownAttribution = data.filter(r => !r.paid_vs_organic || (r.paid_vs_organic.toUpperCase() !== 'PAID' && r.paid_vs_organic.toUpperCase() !== 'ORGANIC'));

console.log('Contact Distribution:');
console.log(`  Paid:     ${paidContacts.length.toLocaleString()} (${((paidContacts.length/data.length)*100).toFixed(1)}%)`);
console.log(`  Organic:  ${organicContacts.length.toLocaleString()} (${((organicContacts.length/data.length)*100).toFixed(1)}%)`);
console.log(`  Unknown:  ${unknownAttribution.length.toLocaleString()} (${((unknownAttribution.length/data.length)*100).toFixed(1)}%)`);
console.log();

const paidCustomers = paidContacts.filter(r => r.has_purchase === 'TRUE');
const organicCustomers = organicContacts.filter(r => r.has_purchase === 'TRUE');

const paidConversion = paidContacts.length > 0 ? (paidCustomers.length / paidContacts.length) * 100 : 0;
const organicConversion = organicContacts.length > 0 ? (organicCustomers.length / organicContacts.length) * 100 : 0;

console.log('Conversion Rates:');
console.log(`  Paid:     ${paidCustomers.length}/${paidContacts.length} = ${paidConversion.toFixed(2)}%`);
console.log(`  Organic:  ${organicCustomers.length}/${organicContacts.length} = ${organicConversion.toFixed(2)}%`);
console.log();

const paidRevenue = paidCustomers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0);
const organicRevenue = organicCustomers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0);

console.log('Revenue:');
console.log(`  Paid:     $${paidRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`  Organic:  $${organicRevenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log();

if (paidCustomers.length > 0) {
  console.log(`  Paid Avg Order Value:    $${(paidRevenue/paidCustomers.length).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
}
if (organicCustomers.length > 0) {
  console.log(`  Organic Avg Order Value: $${(organicRevenue/organicCustomers.length).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
}
console.log();

// =============================================================================
// TRIGGER WORD ANALYSIS
// =============================================================================

console.log('='.repeat(80));
console.log('🎪 TOP TRIGGER WORDS\n');

const triggerWords = {};
data.forEach(row => {
  const trigger = row.trigger_word || 'Unknown';
  if (!triggerWords[trigger]) {
    triggerWords[trigger] = { total: 0, customers: 0, revenue: 0 };
  }
  triggerWords[trigger].total++;
  if (row.has_purchase === 'TRUE') {
    triggerWords[trigger].customers++;
    triggerWords[trigger].revenue += parseFloat(row.total_revenue || 0);
  }
});

const sortedTriggers = Object.entries(triggerWords)
  .map(([word, data]) => ({
    word,
    total: data.total,
    customers: data.customers,
    revenue: data.revenue,
    conversion: data.total > 0 ? (data.customers / data.total) * 100 : 0
  }))
  .sort((a, b) => b.revenue - a.revenue)
  .slice(0, 15);

console.log('By Revenue:\n');
sortedTriggers.forEach((t, i) => {
  console.log(`${(i+1).toString().padStart(2)}. ${t.word.padEnd(25)} $${t.revenue.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0}).padStart(8)} (${t.customers}/${t.total} = ${t.conversion.toFixed(1)}%)`);
});
console.log();

console.log('By Conversion Rate:\n');
const sortedByConversion = sortedTriggers
  .filter(t => t.total >= 10) // At least 10 contacts to be meaningful
  .sort((a, b) => b.conversion - a.conversion)
  .slice(0, 10);

sortedByConversion.forEach((t, i) => {
  console.log(`${(i+1).toString().padStart(2)}. ${t.word.padEnd(25)} ${t.conversion.toFixed(1).padStart(5)}% (${t.customers}/${t.total} contacts)`);
});
console.log();

// =============================================================================
// DROP-OFF ANALYSIS
// =============================================================================

console.log('='.repeat(80));
console.log('📉 FUNNEL DROP-OFF POINTS\n');

// Define logical funnel order (you may need to adjust this based on your stages)
const funnelOrder = [
  'LEAD_CONTACT',
  'SHOWED_INTEREST',
  'SENT_LINK',
  'CLICKED_LINK',
  'DM_QUALIFIED',
  'READY_TO_BOOK',
  'BOOKED',
  'ATTENDED',
  'BOUGHT_PACKAGE',
  'PAID'
];

console.log('Stage-by-stage progression:\n');

let previousCount = data.length;
funnelOrder.forEach((stageName, index) => {
  const stageCount = data.filter(r => r.stage === stageName).length;
  if (stageCount > 0) {
    const dropOff = previousCount - stageCount;
    const dropOffPct = previousCount > 0 ? (dropOff / previousCount) * 100 : 0;

    console.log(`${(index + 1).toString().padStart(2)}. ${stageName.padEnd(25)} ${stageCount.toString().padStart(5)} contacts`);
    if (index > 0) {
      console.log(`    ↓ Drop-off: ${dropOff.toLocaleString()} (${dropOffPct.toFixed(1)}%)`);
    }
    console.log();

    previousCount = stageCount;
  }
});

console.log('='.repeat(80));
console.log('✅ FUNNEL ANALYSIS COMPLETE');
console.log('='.repeat(80));
console.log();
