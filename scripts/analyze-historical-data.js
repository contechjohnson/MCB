require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function analyzeHistoricalData() {
  console.log('📊 Analyzing Historical Data (536 Contacts from Airtable)...\n');

  // 1. Overall conversion stats
  const { data: historical } = await supabase
    .from('contacts')
    .select('*')
    .like('source', '%_historical%');

  const totalHistorical = historical.length;
  const customers = historical.filter(c => c.purchase_amount > 0);
  const totalRevenue = customers.reduce((sum, c) => sum + parseFloat(c.purchase_amount || 0), 0);
  const avgOrderValue = totalRevenue / customers.length;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('OVERALL HISTORICAL PERFORMANCE\n');
  console.log(`Total Contacts: ${totalHistorical}`);
  console.log(`Total Customers: ${customers.length} (${(customers.length / totalHistorical * 100).toFixed(1)}% conversion)`);
  console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`Average Order Value: $${avgOrderValue.toFixed(2)}`);
  console.log('');

  // 2. Trigger word performance
  const triggerWords = {};
  historical.forEach(contact => {
    const trigger = contact.trigger_word;
    if (trigger && trigger !== 'unknown') {
      if (!triggerWords[trigger]) {
        triggerWords[trigger] = { contacts: 0, customers: 0, revenue: 0 };
      }
      triggerWords[trigger].contacts++;
      if (contact.purchase_amount > 0) {
        triggerWords[trigger].customers++;
        triggerWords[trigger].revenue += parseFloat(contact.purchase_amount);
      }
    }
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TRIGGER WORD PERFORMANCE\n');

  Object.entries(triggerWords)
    .map(([word, stats]) => ({
      word,
      ...stats,
      convRate: (stats.customers / stats.contacts * 100).toFixed(1),
      aov: stats.customers > 0 ? (stats.revenue / stats.customers).toFixed(2) : 0
    }))
    .sort((a, b) => parseFloat(b.convRate) - parseFloat(a.convRate))
    .slice(0, 10)
    .forEach((item, i) => {
      console.log(`[${i + 1}] "${item.word}"`);
      console.log(`    Contacts: ${item.contacts} | Customers: ${item.customers} | Conv Rate: ${item.convRate}%`);
      if (item.customers > 0) {
        console.log(`    Revenue: $${item.revenue.toFixed(2)} | AOV: $${item.aov}`);
      }
      console.log('');
    });

  // 3. Payment method breakdown
  const stripeCustomers = customers.filter(c => c.purchase_amount >= 2000);
  const denefitsCustomers = customers.filter(c => c.purchase_amount < 2000 && c.purchase_amount > 0);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('PAYMENT METHOD INSIGHTS\n');
  console.log(`Premium Buyers (≥$2,000): ${stripeCustomers.length} customers`);
  console.log(`  Revenue: $${stripeCustomers.reduce((sum, c) => sum + parseFloat(c.purchase_amount), 0).toFixed(2)}`);
  console.log(`  Avg: $${(stripeCustomers.reduce((sum, c) => sum + parseFloat(c.purchase_amount), 0) / stripeCustomers.length).toFixed(2)}`);
  console.log('');
  console.log(`BNPL/Lower Tier (<$2,000): ${denefitsCustomers.length} customers`);
  console.log(`  Revenue: $${denefitsCustomers.reduce((sum, c) => sum + parseFloat(c.purchase_amount), 0).toFixed(2)}`);
  console.log(`  Avg: $${(denefitsCustomers.reduce((sum, c) => sum + parseFloat(c.purchase_amount), 0) / denefitsCustomers.length).toFixed(2)}`);
  console.log('');

  // 4. Qualification insights
  const qualified = historical.filter(c => c.dm_qualified_date);
  const qualifyRate = (qualified.length / totalHistorical * 100).toFixed(1);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('QUALIFICATION INSIGHTS\n');
  console.log(`Qualified Contacts: ${qualified.length}/${totalHistorical} (${qualifyRate}%)`);
  console.log(`Qualified → Customer Rate: ${(customers.length / qualified.length * 100).toFixed(1)}%`);
  console.log('');

  // 5. Top revenue months (if we have dates)
  const customersWithDates = customers.filter(c => c.purchase_date);
  if (customersWithDates.length > 10) {
    const byMonth = {};
    customersWithDates.forEach(c => {
      const month = c.purchase_date.substring(0, 7); // YYYY-MM
      if (!byMonth[month]) {
        byMonth[month] = { customers: 0, revenue: 0 };
      }
      byMonth[month].customers++;
      byMonth[month].revenue += parseFloat(c.purchase_amount);
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TOP REVENUE MONTHS\n');

    Object.entries(byMonth)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .forEach(([ month, stats], i) => {
        console.log(`[${i + 1}] ${month}: ${stats.customers} customers, $${stats.revenue.toFixed(2)}`);
      });
    console.log('');
  }
}

analyzeHistoricalData().catch(console.error);
