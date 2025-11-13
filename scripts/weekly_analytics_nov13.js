const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  console.log('📊 Weekly Analytics Report: November 6-13, 2025\n');
  
  const results = {};
  
  // 1. New contacts this week
  const { count: newContactsThisWeek } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .neq('source', 'instagram_historical')
    .gte('created_at', '2025-11-06')
    .lt('created_at', '2025-11-14');
  
  console.log('✅ New Contacts This Week:', newContactsThisWeek || 0);
  results.newContactsThisWeek = newContactsThisWeek || 0;
  
  // 2. New contacts last week
  const { count: newContactsLastWeek } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .neq('source', 'instagram_historical')
    .gte('created_at', '2025-10-30')
    .lt('created_at', '2025-11-06');
  
  console.log('📈 New Contacts Last Week:', newContactsLastWeek || 0);
  results.newContactsLastWeek = newContactsLastWeek || 0;
  
  // 3. Purchases this week
  const { count: purchasesThisWeek } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .neq('source', 'instagram_historical')
    .gte('purchase_date', '2025-11-06')
    .lt('purchase_date', '2025-11-14')
    .not('purchase_date', 'is', null);
  
  console.log('💰 Purchases This Week:', purchasesThisWeek || 0);
  results.purchasesThisWeek = purchasesThisWeek || 0;
  
  // 4. Purchases last week
  const { count: purchasesLastWeek } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .neq('source', 'instagram_historical')
    .gte('purchase_date', '2025-10-30')
    .lt('purchase_date', '2025-11-06')
    .not('purchase_date', 'is', null);
  
  console.log('📊 Purchases Last Week:', purchasesLastWeek || 0);
  results.purchasesLastWeek = purchasesLastWeek || 0;
  
  // Get all contacts for detailed analysis
  const { data: allContacts } = await supabase
    .from('contacts')
    .select('*')
    .neq('source', 'instagram_historical');
  
  console.log('\n📋 Total Contacts (excl. historical):', allContacts?.length || 0);
  
  // Stage distribution
  const stageDistribution = {};
  allContacts?.forEach(c => {
    stageDistribution[c.stage] = (stageDistribution[c.stage] || 0) + 1;
  });
  results.stageDistribution = stageDistribution;
  
  // Contacts from this week
  const thisWeekContacts = allContacts?.filter(c => 
    c.created_at >= '2025-11-06' && c.created_at < '2025-11-14'
  ) || [];
  
  const weeklyFunnel = {
    total_new_leads: thisWeekContacts.length,
    reached_dm_qualified: thisWeekContacts.filter(c => c.dm_qualified_date).length,
    reached_call_booked: thisWeekContacts.filter(c => c.appointment_date).length,
    reached_meeting_held: thisWeekContacts.filter(c => c.appointment_held_date).length,
    reached_purchased: thisWeekContacts.filter(c => c.purchase_date).length
  };
  results.weeklyFunnel = weeklyFunnel;
  
  // Source attribution
  const sourceDistribution = {};
  thisWeekContacts.forEach(c => {
    sourceDistribution[c.source] = (sourceDistribution[c.source] || 0) + 1;
  });
  results.sourceDistribution = sourceDistribution;
  
  // Purchases by source this week
  const purchasesBySource = {};
  const thisWeekPurchases = allContacts?.filter(c => 
    c.purchase_date >= '2025-11-06' && c.purchase_date < '2025-11-14'
  ) || [];
  thisWeekPurchases.forEach(c => {
    purchasesBySource[c.source] = (purchasesBySource[c.source] || 0) + 1;
  });
  results.purchasesBySource = purchasesBySource;
  
  // Overall conversion by source
  const conversionBySource = {};
  ['instagram', 'website', 'instagram_lm'].forEach(source => {
    const sourceContacts = allContacts?.filter(c => c.source === source) || [];
    const purchases = sourceContacts.filter(c => c.purchase_date).length;
    conversionBySource[source] = {
      total: sourceContacts.length,
      purchases: purchases,
      conversion_rate: sourceContacts.length > 0 ? (purchases / sourceContacts.length * 100).toFixed(2) : '0.00'
    };
  });
  results.conversionBySource = conversionBySource;
  
  // AD_ID capture
  const instagramContacts = allContacts?.filter(c => c.source === 'instagram') || [];
  const withAdId = instagramContacts.filter(c => c.ad_id).length;
  results.adIdCapture = {
    total: instagramContacts.length,
    with_ad_id: withAdId,
    rate: instagramContacts.length > 0 ? (withAdId / instagramContacts.length * 100).toFixed(2) : '0.00'
  };
  
  // MC→GHL linkage
  const withMcId = allContacts?.filter(c => c.mc_id).length || 0;
  const withGhlId = allContacts?.filter(c => c.ghl_id).length || 0;
  const withBoth = allContacts?.filter(c => c.mc_id && c.ghl_id).length || 0;
  results.mcGhlLinkage = {
    total: allContacts?.length || 0,
    with_mc: withMcId,
    with_ghl: withGhlId,
    both: withBoth,
    rate: (allContacts?.length || 0) > 0 ? (withBoth / allContacts.length * 100).toFixed(2) : '0.00'
  };
  
  // Revenue metrics
  const totalRevenue = thisWeekPurchases.reduce((sum, c) => sum + parseFloat(c.purchase_amount || 0), 0);
  const avgOrderValue = thisWeekPurchases.length > 0 ? totalRevenue / thisWeekPurchases.length : 0;
  
  results.revenue = {
    purchases: thisWeekPurchases.length,
    total: totalRevenue,
    avg: avgOrderValue
  };
  
  // Revenue by source
  const revenueBySource = {};
  thisWeekPurchases.forEach(c => {
    if (!revenueBySource[c.source]) {
      revenueBySource[c.source] = { count: 0, revenue: 0 };
    }
    revenueBySource[c.source].count++;
    revenueBySource[c.source].revenue += parseFloat(c.purchase_amount || 0);
  });
  results.revenueBySource = revenueBySource;
  
  // Get payments data
  const { data: payments } = await supabase
    .from('payments')
    .select('*');
  
  const orphanPayments = payments?.filter(p => !p.contact_id).length || 0;
  results.orphanPayments = {
    total: payments?.length || 0,
    orphaned: orphanPayments,
    rate: (payments?.length || 0) > 0 ? (orphanPayments / payments.length * 100).toFixed(2) : '0.00'
  };
  
  // Payments this week
  const thisWeekPayments = payments?.filter(p => 
    p.payment_date >= '2025-11-06' && p.payment_date < '2025-11-14'
  ) || [];
  
  const paymentsByMethod = {};
  thisWeekPayments.forEach(p => {
    if (!paymentsByMethod[p.payment_source]) {
      paymentsByMethod[p.payment_source] = { count: 0, revenue: 0 };
    }
    paymentsByMethod[p.payment_source].count++;
    paymentsByMethod[p.payment_source].revenue += parseFloat(p.amount || 0);
  });
  results.paymentsByMethod = paymentsByMethod;
  
  // Data completeness
  const withEmail = allContacts?.filter(c => c.email_primary).length || 0;
  const withPhone = allContacts?.filter(c => c.phone).length || 0;
  results.dataCompleteness = {
    total: allContacts?.length || 0,
    email: withEmail,
    phone: withPhone,
    email_pct: (allContacts?.length || 0) > 0 ? (withEmail / allContacts.length * 100).toFixed(2) : '0.00',
    phone_pct: (allContacts?.length || 0) > 0 ? (withPhone / allContacts.length * 100).toFixed(2) : '0.00'
  };
  
  // Webhook activity
  const { data: webhookLogs } = await supabase
    .from('webhook_logs')
    .select('source, event_type')
    .gte('created_at', '2025-11-06')
    .lt('created_at', '2025-11-14');
  
  const webhookActivity = {};
  webhookLogs?.forEach(log => {
    const key = `${log.source}:${log.event_type}`;
    webhookActivity[key] = (webhookActivity[key] || 0) + 1;
  });
  
  const sortedActivity = Object.entries(webhookActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  results.webhookActivity = Object.fromEntries(sortedActivity);
  
  // Write results
  const fs = require('fs');
  const outputPath = '/tmp/weekly_report_data.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Results saved to ${outputPath}`);
  console.log('\n' + '='.repeat(60));
  console.log('FINAL RESULTS:');
  console.log('='.repeat(60));
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
