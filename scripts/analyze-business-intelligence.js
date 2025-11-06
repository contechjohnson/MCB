#!/usr/bin/env node
/**
 * BUSINESS INTELLIGENCE DEEP DIVE
 *
 * Actionable insights for marketing optimization, bottleneck identification,
 * and revenue growth opportunities
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
console.log('🎯 BUSINESS INTELLIGENCE DEEP DIVE - ACTIONABLE INSIGHTS');
console.log('='.repeat(90) + '\n');

const data = parseCSV(path.join(__dirname, '..', 'historical_data', 'unified_contacts_v2.csv'));
const customers = data.filter(row => row.has_purchase === 'TRUE');

console.log(`Dataset: ${data.length.toLocaleString()} contacts, ${customers.length} customers\n`);

// =============================================================================
// SECTION 1: MARKETING COPY EFFECTIVENESS - TRIGGER WORD DEEP DIVE
// =============================================================================

console.log('='.repeat(90));
console.log('📝 SECTION 1: MARKETING COPY EFFECTIVENESS');
console.log('='.repeat(90) + '\n');

console.log('🎯 TRIGGER WORD PERFORMANCE ANALYSIS\n');
console.log('What messaging actually converts? Which words drive revenue?\n');

const contactsWithTriggerWords = data.filter(row => row.trigger_word && row.trigger_word.trim() &&
  row.trigger_word.toLowerCase() !== 'unknown' && row.trigger_word.toLowerCase() !== 'null');

console.log(`Contacts with trigger word data: ${contactsWithTriggerWords.length} (${((contactsWithTriggerWords.length/data.length)*100).toFixed(1)}%)\n`);

const triggerPerformance = {};

contactsWithTriggerWords.forEach(row => {
  const trigger = row.trigger_word.trim();

  if (!triggerPerformance[trigger]) {
    triggerPerformance[trigger] = {
      contacts: 0,
      customers: 0,
      revenue: 0,
      purchaseAmounts: [],
      timeToPurchase: []
    };
  }

  triggerPerformance[trigger].contacts++;

  if (row.has_purchase === 'TRUE') {
    triggerPerformance[trigger].customers++;
    const revenue = parseFloat(row.total_revenue || 0);
    triggerPerformance[trigger].revenue += revenue;
    triggerPerformance[trigger].purchaseAmounts.push(revenue);

    // Calculate time to purchase
    const subDate = parseDate(row.subscription_date);
    const purchaseDate = parseDate(row.purchase_date);
    if (subDate && purchaseDate) {
      const days = Math.round((purchaseDate - subDate) / (1000 * 60 * 60 * 24));
      if (days >= 0) {
        triggerPerformance[trigger].timeToPurchase.push(days);
      }
    }
  }
});

// Calculate metrics
const triggerAnalysis = Object.entries(triggerPerformance)
  .map(([word, data]) => ({
    word,
    contacts: data.contacts,
    customers: data.customers,
    revenue: data.revenue,
    conversionRate: data.contacts > 0 ? (data.customers / data.contacts) * 100 : 0,
    avgOrderValue: data.customers > 0 ? data.revenue / data.customers : 0,
    avgTimeToPurchase: data.timeToPurchase.length > 0
      ? data.timeToPurchase.reduce((a, b) => a + b, 0) / data.timeToPurchase.length
      : null
  }))
  .filter(t => t.contacts >= 20); // Minimum 20 contacts for statistical significance

// Sort by total revenue
const topByRevenue = [...triggerAnalysis].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
const topByConversion = [...triggerAnalysis].sort((a, b) => b.conversionRate - a.conversionRate).slice(0, 10);
const topByAOV = [...triggerAnalysis].sort((a, b) => b.avgOrderValue - a.avgOrderValue).slice(0, 10);

console.log('💰 TOP 10 TRIGGER WORDS BY TOTAL REVENUE:\n');
console.log('Rank | Trigger Word          | Contacts | Customers | Conv Rate | AOV       | Total Revenue');
console.log('-'.repeat(90));
topByRevenue.forEach((t, i) => {
  console.log(
    `${(i+1).toString().padStart(2)}   | ` +
    `${t.word.padEnd(20)} | ${t.contacts.toString().padStart(8)} | ${t.customers.toString().padStart(9)} | ` +
    `${t.conversionRate.toFixed(1).padStart(9)}% | $${t.avgOrderValue.toFixed(0).padStart(8)} | $${t.revenue.toFixed(0).padStart(10)}`
  );
});
console.log();

console.log('🎯 TOP 10 TRIGGER WORDS BY CONVERSION RATE:\n');
console.log('Rank | Trigger Word          | Contacts | Conv Rate | Customers | Total Revenue');
console.log('-'.repeat(90));
topByConversion.forEach((t, i) => {
  console.log(
    `${(i+1).toString().padStart(2)}   | ` +
    `${t.word.padEnd(20)} | ${t.contacts.toString().padStart(8)} | ` +
    `${t.conversionRate.toFixed(1).padStart(9)}% | ${t.customers.toString().padStart(9)} | $${t.revenue.toFixed(0).padStart(10)}`
  );
});
console.log();

console.log('💎 TOP 10 TRIGGER WORDS BY AVERAGE ORDER VALUE:\n');
console.log('Rank | Trigger Word          | Customers | AOV       | Total Revenue');
console.log('-'.repeat(90));
topByAOV.forEach((t, i) => {
  console.log(
    `${(i+1).toString().padStart(2)}   | ` +
    `${t.word.padEnd(20)} | ${t.customers.toString().padStart(9)} | ` +
    `$${t.avgOrderValue.toFixed(0).padStart(8)} | $${t.revenue.toFixed(0).padStart(10)}`
  );
});
console.log();

// Find the "golden" trigger words - high on all metrics
console.log('🏆 "GOLDEN" TRIGGER WORDS - HIGH PERFORMANCE ACROSS ALL METRICS:\n');
console.log('(Top 20% in conversion rate AND top 30% in revenue)\n');

const sortedByRevenue = [...triggerAnalysis].sort((a, b) => b.revenue - a.revenue);
const sortedByConversion = [...triggerAnalysis].sort((a, b) => b.conversionRate - a.conversionRate);

const top20PctConversion = sortedByConversion.slice(0, Math.ceil(sortedByConversion.length * 0.2));
const top30PctRevenue = sortedByRevenue.slice(0, Math.ceil(sortedByRevenue.length * 0.3));

const goldenTriggers = top20PctConversion.filter(t => top30PctRevenue.some(r => r.word === t.word));

if (goldenTriggers.length > 0) {
  console.log('Trigger Word          | Conv Rate | AOV       | Revenue    | Speed (days)');
  console.log('-'.repeat(90));
  goldenTriggers
    .sort((a, b) => b.revenue - a.revenue)
    .forEach(t => {
      const speed = t.avgTimeToPurchase !== null ? t.avgTimeToPurchase.toFixed(0) : 'N/A';
      console.log(
        `${t.word.padEnd(20)} | ` +
        `${t.conversionRate.toFixed(1).padStart(9)}% | ` +
        `$${t.avgOrderValue.toFixed(0).padStart(8)} | ` +
        `$${t.revenue.toFixed(0).padStart(9)} | ${speed.padStart(12)}`
      );
    });
  console.log();

  console.log('✅ ACTIONABLE INSIGHT #1: DOUBLE DOWN ON THESE TRIGGER WORDS\n');
  console.log('These trigger words have both high conversion AND high revenue.');
  console.log('Recommendation: Increase ad spend on campaigns using these words.\n');
  goldenTriggers.slice(0, 3).forEach((t, i) => {
    console.log(`   ${i+1}. "${t.word}" - ${t.conversionRate.toFixed(1)}% conversion, $${t.revenue.toFixed(0)} total revenue`);
  });
  console.log();
} else {
  console.log('No trigger words found that excel across all metrics.\n');
}

// Find underperformers
const bottomByConversion = [...triggerAnalysis]
  .filter(t => t.contacts >= 50) // Only consider words with significant volume
  .sort((a, b) => a.conversionRate - b.conversionRate)
  .slice(0, 5);

console.log('⚠️  UNDERPERFORMING TRIGGER WORDS (with 50+ contacts):\n');
console.log('Trigger Word          | Contacts | Conv Rate | Revenue');
console.log('-'.repeat(90));
bottomByConversion.forEach(t => {
  console.log(
    `${t.word.padEnd(20)} | ${t.contacts.toString().padStart(8)} | ` +
    `${t.conversionRate.toFixed(1).padStart(9)}% | $${t.revenue.toFixed(0).padStart(10)}`
  );
});
console.log();

console.log('✅ ACTIONABLE INSIGHT #2: STOP OR REVISE THESE CAMPAIGNS\n');
console.log('These trigger words have high volume but low conversion.');
console.log('Recommendation: Pause campaigns or test new messaging.\n');

// =============================================================================
// SECTION 2: FUNNEL BOTTLENECK ANALYSIS
// =============================================================================

console.log('='.repeat(90));
console.log('🔍 SECTION 2: FUNNEL BOTTLENECK ANALYSIS');
console.log('='.repeat(90) + '\n');

console.log('Where are people getting stuck? What stages need optimization?\n');

// Get contacts with stage data (primarily from supabase export)
const contactsWithStages = data.filter(row => row.stage && row.stage.trim() &&
  row.stage.toLowerCase() !== 'unknown' && row.stage.toLowerCase() !== 'null');

console.log(`Contacts with funnel stage data: ${contactsWithStages.length}\n`);

// Count contacts at each stage
const stageDistribution = {};
contactsWithStages.forEach(row => {
  const stage = row.stage.trim();
  if (!stageDistribution[stage]) {
    stageDistribution[stage] = { total: 0, customers: 0, revenue: 0 };
  }
  stageDistribution[stage].total++;
  if (row.has_purchase === 'TRUE') {
    stageDistribution[stage].customers++;
    stageDistribution[stage].revenue += parseFloat(row.total_revenue || 0);
  }
});

// Calculate conversion rates
const stageAnalysis = Object.entries(stageDistribution)
  .map(([stage, data]) => ({
    stage,
    total: data.total,
    customers: data.customers,
    conversionRate: data.total > 0 ? (data.customers / data.total) * 100 : 0,
    revenue: data.revenue
  }))
  .sort((a, b) => b.total - a.total);

console.log('📊 FUNNEL STAGE DISTRIBUTION:\n');
console.log('Stage                              | Contacts | Customers | Conv Rate |   Revenue');
console.log('-'.repeat(90));
stageAnalysis.forEach(s => {
  console.log(
    `${s.stage.padEnd(35)} | ${s.total.toString().padStart(8)} | ${s.customers.toString().padStart(9)} | ` +
    `${s.conversionRate.toFixed(1).padStart(9)}% | $${s.revenue.toFixed(0).padStart(9)}`
  );
});
console.log();

// Find bottlenecks (stages with lots of contacts but low conversion)
const bottlenecks = stageAnalysis
  .filter(s => s.total >= 100) // Significant volume
  .filter(s => s.conversionRate < 5) // Low conversion
  .sort((a, b) => b.total - a.total);

if (bottlenecks.length > 0) {
  console.log('🚨 CRITICAL BOTTLENECKS IDENTIFIED:\n');
  console.log('These stages have high volume but low conversion - FIX THESE FIRST!\n');
  console.log('Stage                              | Contacts | Conv Rate | Potential Revenue');
  console.log('-'.repeat(90));

  bottlenecks.forEach(b => {
    // Calculate potential revenue if we improved conversion to average
    const avgConversion = stageAnalysis.reduce((sum, s) => sum + s.conversionRate, 0) / stageAnalysis.length;
    const currentCustomers = b.customers;
    const potentialCustomers = Math.round((b.total * avgConversion) / 100);
    const additionalCustomers = potentialCustomers - currentCustomers;
    const avgRevenue = customers.length > 0
      ? customers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0) / customers.length
      : 0;
    const potentialRevenue = additionalCustomers * avgRevenue;

    console.log(
      `${b.stage.padEnd(35)} | ${b.total.toString().padStart(8)} | ` +
      `${b.conversionRate.toFixed(1).padStart(9)}% | $${potentialRevenue.toFixed(0).padStart(12)}`
    );
  });
  console.log();

  console.log('✅ ACTIONABLE INSIGHT #3: FIX THESE BOTTLENECKS\n');
  bottlenecks.slice(0, 2).forEach((b, i) => {
    console.log(`   ${i+1}. ${b.stage}`);
    console.log(`      - ${b.total} contacts stuck here (${b.conversionRate.toFixed(1)}% conversion)`);
    console.log(`      - Recommendation: Add follow-up sequence, remove friction, or offer incentive\n`);
  });
}

// Identify high-performing stages
const topStages = stageAnalysis
  .filter(s => s.total >= 20)
  .sort((a, b) => b.conversionRate - a.conversionRate)
  .slice(0, 5);

console.log('🌟 HIGHEST CONVERTING STAGES:\n');
console.log('These stages have the best conversion rates:\n');
console.log('Stage                              | Contacts | Conv Rate | Customers');
console.log('-'.repeat(90));
topStages.forEach(s => {
  console.log(
    `${s.stage.padEnd(35)} | ${s.total.toString().padStart(8)} | ` +
    `${s.conversionRate.toFixed(1).padStart(9)}% | ${s.customers.toString().padStart(9)}`
  );
});
console.log();

console.log('✅ ACTIONABLE INSIGHT #4: MOVE MORE PEOPLE TO HIGH-CONVERTING STAGES\n');
console.log('Recommendation: Design your funnel to get more people to these stages.\n');

// =============================================================================
// SECTION 3: PAID VS ORGANIC PERFORMANCE
// =============================================================================

console.log('='.repeat(90));
console.log('💰 SECTION 3: PAID VS ORGANIC PERFORMANCE');
console.log('='.repeat(90) + '\n');

console.log('Should you invest more in paid ads or focus on organic?\n');

const paidContacts = data.filter(r => r.paid_vs_organic && r.paid_vs_organic.toUpperCase() === 'PAID');
const organicContacts = data.filter(r => r.paid_vs_organic && r.paid_vs_organic.toUpperCase() === 'ORGANIC');

const paidCustomers = paidContacts.filter(r => r.has_purchase === 'TRUE');
const organicCustomers = organicContacts.filter(r => r.has_purchase === 'TRUE');

const paidRevenue = paidCustomers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0);
const organicRevenue = organicCustomers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0);

const paidConversion = paidContacts.length > 0 ? (paidCustomers.length / paidContacts.length) * 100 : 0;
const organicConversion = organicContacts.length > 0 ? (organicCustomers.length / organicContacts.length) * 100 : 0;

const paidAOV = paidCustomers.length > 0 ? paidRevenue / paidCustomers.length : 0;
const organicAOV = organicCustomers.length > 0 ? organicRevenue / organicCustomers.length : 0;

console.log('Metric                    |        PAID |     ORGANIC |   Difference');
console.log('-'.repeat(90));
console.log(`Contacts                  | ${paidContacts.length.toString().padStart(11)} | ${organicContacts.length.toString().padStart(11)} | ${organicContacts.length > paidContacts.length ? 'Organic +' + (organicContacts.length - paidContacts.length) : 'Paid +' + (paidContacts.length - organicContacts.length)}`);
console.log(`Customers                 | ${paidCustomers.length.toString().padStart(11)} | ${organicCustomers.length.toString().padStart(11)} | ${organicCustomers.length > paidCustomers.length ? 'Organic +' + (organicCustomers.length - paidCustomers.length) : 'Paid +' + (paidCustomers.length - organicCustomers.length)}`);
console.log(`Conversion Rate           | ${paidConversion.toFixed(2).padStart(10)}% | ${organicConversion.toFixed(2).padStart(10)}% | ${organicConversion > paidConversion ? 'Organic +' + (organicConversion - paidConversion).toFixed(2) + '%' : 'Paid +' + (paidConversion - organicConversion).toFixed(2) + '%'}`);
console.log(`Total Revenue             | $${paidRevenue.toFixed(0).padStart(10)} | $${organicRevenue.toFixed(0).padStart(10)} | ${organicRevenue > paidRevenue ? 'Organic +$' + (organicRevenue - paidRevenue).toFixed(0) : 'Paid +$' + (paidRevenue - organicRevenue).toFixed(0)}`);
console.log(`Avg Order Value           | $${paidAOV.toFixed(0).padStart(10)} | $${organicAOV.toFixed(0).padStart(10)} | ${organicAOV > paidAOV ? 'Organic +$' + (organicAOV - paidAOV).toFixed(0) : 'Paid +$' + (paidAOV - organicAOV).toFixed(0)}`);
console.log();

console.log('✅ ACTIONABLE INSIGHT #5: CHANNEL INVESTMENT STRATEGY\n');

if (organicConversion > paidConversion * 1.2) {
  console.log('⚠️  Organic significantly outperforms paid (20%+ better conversion)\n');
  console.log('Recommendations:');
  console.log('   1. Reduce paid ad spend and invest in organic growth (SEO, content, referrals)');
  console.log('   2. Analyze why paid underperforms - wrong targeting? Poor landing pages?');
  console.log('   3. Test whether paid ads can achieve similar quality as organic leads\n');
} else if (paidConversion > organicConversion * 1.2) {
  console.log('✅ Paid ads outperform organic (20%+ better conversion)\n');
  console.log('Recommendations:');
  console.log('   1. Increase paid ad budget - this channel is working!');
  console.log('   2. Scale winning campaigns');
  console.log('   3. Find ways to improve organic to match paid quality\n');
} else {
  console.log('📊 Paid and organic perform similarly\n');
  console.log('Recommendations:');
  console.log('   1. Maintain current mix');
  console.log('   2. Test incremental increases in both channels');
  console.log('   3. Focus on improving overall conversion rate\n');
}

// =============================================================================
// SECTION 4: CUSTOMER VALUE SEGMENTATION
// =============================================================================

console.log('='.repeat(90));
console.log('💎 SECTION 4: CUSTOMER VALUE SEGMENTATION');
console.log('='.repeat(90) + '\n');

console.log('Who are your most valuable customers? What do they have in common?\n');

// Segment customers by purchase amount
const segments = {
  'Whales ($3,000+)': customers.filter(c => parseFloat(c.total_revenue || 0) >= 3000),
  'High-Value ($2,000-$2,999)': customers.filter(c => {
    const rev = parseFloat(c.total_revenue || 0);
    return rev >= 2000 && rev < 3000;
  }),
  'Mid-Value ($1,000-$1,999)': customers.filter(c => {
    const rev = parseFloat(c.total_revenue || 0);
    return rev >= 1000 && rev < 2000;
  }),
  'Low-Value ($0-$999)': customers.filter(c => parseFloat(c.total_revenue || 0) < 1000)
};

console.log('Segment                    | Customers | Avg Revenue | Total Revenue | % of Revenue');
console.log('-'.repeat(90));

const totalRevenue = customers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0);

Object.entries(segments).forEach(([name, custs]) => {
  const segmentRevenue = custs.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0);
  const avgRevenue = custs.length > 0 ? segmentRevenue / custs.length : 0;
  const revPct = totalRevenue > 0 ? (segmentRevenue / totalRevenue) * 100 : 0;

  console.log(
    `${name.padEnd(25)} | ${custs.length.toString().padStart(9)} | ` +
    `$${avgRevenue.toFixed(0).padStart(10)} | $${segmentRevenue.toFixed(0).padStart(12)} | ${revPct.toFixed(1).padStart(11)}%`
  );
});
console.log();

// Analyze characteristics of high-value customers
const whales = segments['Whales ($3,000+)'];
const highValue = segments['High-Value ($2,000-$2,999)'];
const topTier = [...whales, ...highValue];

console.log('🔍 CHARACTERISTICS OF HIGH-VALUE CUSTOMERS ($2,000+):\n');

// Trigger words
const topTierTriggers = {};
topTier.forEach(c => {
  if (c.trigger_word && c.trigger_word.trim()) {
    const trigger = c.trigger_word.trim();
    topTierTriggers[trigger] = (topTierTriggers[trigger] || 0) + 1;
  }
});

if (Object.keys(topTierTriggers).length > 0) {
  console.log('Common trigger words among high-value customers:');
  Object.entries(topTierTriggers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([trigger, count]) => {
      console.log(`   - "${trigger}": ${count} customers`);
    });
  console.log();
}

// Paid vs Organic
const topTierPaid = topTier.filter(c => c.paid_vs_organic && c.paid_vs_organic.toUpperCase() === 'PAID').length;
const topTierOrganic = topTier.filter(c => c.paid_vs_organic && c.paid_vs_organic.toUpperCase() === 'ORGANIC').length;

if (topTierPaid + topTierOrganic > 0) {
  console.log('Attribution:');
  console.log(`   - Paid: ${topTierPaid} (${((topTierPaid/(topTierPaid+topTierOrganic))*100).toFixed(1)}%)`);
  console.log(`   - Organic: ${topTierOrganic} (${((topTierOrganic/(topTierPaid+topTierOrganic))*100).toFixed(1)}%)`);
  console.log();
}

console.log('✅ ACTIONABLE INSIGHT #6: TARGET HIGH-VALUE CUSTOMER PROFILES\n');
console.log('Recommendations:');
console.log('   1. Create lookalike audiences based on high-value customers');
console.log('   2. Use trigger words that resonate with this segment');
console.log('   3. Test premium pricing with these audiences\n');

// =============================================================================
// SECTION 5: QUICK WINS
// =============================================================================

console.log('='.repeat(90));
console.log('⚡ SECTION 5: QUICK WINS - IMPLEMENT THESE FIRST');
console.log('='.repeat(90) + '\n');

console.log('Low-hanging fruit that can drive immediate results:\n');

let quickWinCounter = 1;

// Quick Win: Best trigger words
if (goldenTriggers.length > 0) {
  console.log(`${quickWinCounter}. INCREASE AD SPEND ON TOP TRIGGER WORDS\n`);
  console.log('   ACTION: Create more ad campaigns using these winning trigger words:');
  goldenTriggers.slice(0, 3).forEach(t => {
    console.log(`      - "${t.word}" (${t.conversionRate.toFixed(1)}% conversion, $${t.avgOrderValue.toFixed(0)} AOV)`);
  });
  console.log(`   IMPACT: High conversion + high AOV = maximum ROI\n`);
  quickWinCounter++;
}

// Quick Win: Bottleneck fixes
if (bottlenecks.length > 0) {
  console.log(`${quickWinCounter}. FIX CRITICAL FUNNEL BOTTLENECKS\n`);
  console.log('   ACTION: Add automated follow-up sequences at these stages:');
  bottlenecks.slice(0, 2).forEach(b => {
    console.log(`      - ${b.stage}: ${b.total} contacts, only ${b.conversionRate.toFixed(1)}% converting`);
  });
  console.log(`   IMPACT: Converting even 5% more from these stages = significant revenue\n`);
  quickWinCounter++;
}

// Quick Win: Stop underperformers
if (bottomByConversion.length > 0) {
  console.log(`${quickWinCounter}. PAUSE UNDERPERFORMING TRIGGER WORDS\n`);
  console.log('   ACTION: Stop spending on these low-converting campaigns:');
  bottomByConversion.slice(0, 3).forEach(t => {
    console.log(`      - "${t.word}" (${t.contacts} contacts, only ${t.conversionRate.toFixed(1)}% conversion)`);
  });
  console.log(`   IMPACT: Reallocate budget to winning campaigns, reduce wasted ad spend\n`);
  quickWinCounter++;
}

// Quick Win: High-value customer targeting
if (topTier.length > 0) {
  console.log(`${quickWinCounter}. CREATE LOOKALIKE AUDIENCES FOR HIGH-VALUE CUSTOMERS\n`);
  console.log(`   ACTION: Upload emails of your ${topTier.length} customers who spent $2,000+ to Facebook/Instagram`);
  console.log(`   IMPACT: Find more people like your best customers, increase AOV\n`);
  quickWinCounter++;
}

// =============================================================================
// FINAL SUMMARY
// =============================================================================

console.log('='.repeat(90));
console.log('📋 EXECUTIVE SUMMARY');
console.log('='.repeat(90) + '\n');

console.log('KEY METRICS:\n');
console.log(`   Total Contacts: ${data.length.toLocaleString()}`);
console.log(`   Total Customers: ${customers.length}`);
console.log(`   Overall Conversion Rate: ${((customers.length/data.length)*100).toFixed(2)}%`);
console.log(`   Total Revenue: $${customers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
console.log(`   Average Order Value: $${(customers.reduce((sum, c) => sum + parseFloat(c.total_revenue || 0), 0) / customers.length).toFixed(2)}`);
console.log();

console.log('TOP PRIORITIES:\n');
console.log('   1. Double down on high-performing trigger words');
console.log('   2. Fix critical funnel bottlenecks');
console.log('   3. Pause underperforming campaigns');
console.log('   4. Target high-value customer profiles');
console.log();

console.log('='.repeat(90));
console.log('✅ ANALYSIS COMPLETE - IMPLEMENT THESE INSIGHTS FOR MAXIMUM ROI');
console.log('='.repeat(90));
console.log();
