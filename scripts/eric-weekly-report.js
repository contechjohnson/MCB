require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function generateEricReport(weekEnding) {
  // Calculate week start (7 days before week ending)
  const endDate = new Date(weekEnding);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  console.log(`\n📊 WEEKLY REPORT FOR ERIC`);
  console.log(`Week Ending: ${endStr}\n`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get all contacts for the week (live data only)
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .not('source', 'like', '%_historical%')
    .gte('subscribe_date', startStr)
    .lte('subscribe_date', endStr);

  // ERIC'S CORE METRICS TABLE
  const scheduledDCs = contacts.filter(c => c.meeting_booked_date).length;
  const arrivedDCs = contacts.filter(c => c.meeting_held_date).length;
  const showRate = scheduledDCs > 0 ? ((arrivedDCs / scheduledDCs) * 100).toFixed(1) : 0;
  const closed = contacts.filter(c => c.purchase_amount > 0).length;
  const closeRate = arrivedDCs > 0 ? ((closed / arrivedDCs) * 100).toFixed(1) : 0;
  const adAttributedDCs = contacts.filter(c => c.meeting_booked_date && c.ad_id).length;
  const adAttributedSales = contacts
    .filter(c => c.purchase_amount > 0 && c.ad_id)
    .reduce((sum, c) => sum + parseFloat(c.purchase_amount), 0);
  const totalSales = contacts
    .filter(c => c.purchase_amount > 0)
    .reduce((sum, c) => sum + parseFloat(c.purchase_amount), 0);

  // Get Meta ad spend (if available)
  const { data: adInsights } = await supabase
    .from('meta_ad_insights')
    .select('spend')
    .gte('snapshot_date', startStr)
    .lte('snapshot_date', endStr);

  const adSpend = adInsights?.reduce((sum, insight) => sum + parseFloat(insight.spend || 0), 0) || 0;
  const roasDirect = adSpend > 0 ? (adAttributedSales / adSpend).toFixed(2) : 'N/A';
  const roasTotal = adSpend > 0 ? (totalSales / adSpend).toFixed(2) : 'N/A';
  const cac = closed > 0 && adSpend > 0 ? (adSpend / closed).toFixed(2) : 'N/A';

  console.log('🎯 ERIC\'S WEEKLY TRACKING TABLE\n');
  console.log(`Week Ending:                    ${endStr}`);
  console.log(`Scheduled DCs:                  ${scheduledDCs}`);
  console.log(`Arrived DCs:                    ${arrivedDCs}`);
  console.log(`Show Rate:                      ${showRate}%`);
  console.log(`Closed:                         ${closed}`);
  console.log(`Close Rate:                     ${closeRate}%`);
  console.log(`Ad Spend:                       $${adSpend.toFixed(2) || '[Sync Meta]'}`);
  console.log(`Ad Attributed DCs:              ${adAttributedDCs}`);
  console.log(`Ad Attributed Sales $:          $${adAttributedSales.toFixed(2)}`);
  console.log(`ROAS (direct Ad Attributed):    ${roasDirect}`);
  console.log(`Total Company Package Sales:    $${totalSales.toFixed(2)}`);
  console.log(`ROAS (total company):           ${roasTotal}`);
  console.log(`Marketing Spend:                $${adSpend.toFixed(2) || '[Sync Meta]'}`);
  console.log(`CAC:                            $${cac}`);

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  // CLARA'S QUALIFICATION FUNNEL
  console.log('🤖 CLARA\'S PERFORMANCE (Chatbot Qualification)\n');

  const newSubscribers = contacts.length;
  const dmQualified = contacts.filter(c => c.dm_qualified_date).length;
  const formFilled = contacts.filter(c => c.form_filled_date).length;
  const linkSent = contacts.filter(c => c.link_sent_date).length;
  const linkClicked = contacts.filter(c => c.link_clicked_date).length;

  const qualifyRate = newSubscribers > 0 ? (dmQualified / newSubscribers * 100).toFixed(1) : 0;
  const formFillRate = newSubscribers > 0 ? (formFilled / newSubscribers * 100).toFixed(1) : 0;
  const linkSentRate = newSubscribers > 0 ? (linkSent / newSubscribers * 100).toFixed(1) : 0;

  console.log(`New Subscribers:                ${newSubscribers}`);
  console.log(`DM Qualified:                   ${dmQualified} (${qualifyRate}%)`);
  console.log(`  └─ (answered all questions)`);
  console.log(`Form Filled:                    ${formFilled} (${formFillRate}%)`);
  console.log(`  └─ (high intent leads)`);
  console.log(`Link Sent:                      ${linkSent} (${linkSentRate}%)`);
  console.log(`  └─ (made it through full flow)`);
  console.log(`Link Clicked:                   ${linkClicked}`);

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  // AD PERFORMANCE (Top 5)
  const withAdTracking = contacts.filter(c => c.ad_id).length;
  console.log(`🎯 AD ATTRIBUTION: ${withAdTracking}/${newSubscribers} contacts tracked (${(withAdTracking/newSubscribers*100).toFixed(1)}%)\n`);

  if (withAdTracking > 0) {
    const adStats = {};
    contacts.forEach(c => {
      if (c.ad_id) {
        if (!adStats[c.ad_id]) {
          adStats[c.ad_id] = {
            contacts: 0,
            qualified: 0,
            formFilled: 0,
            booked: 0,
            showed: 0,
            purchased: 0,
            revenue: 0
          };
        }
        adStats[c.ad_id].contacts++;
        if (c.dm_qualified_date) adStats[c.ad_id].qualified++;
        if (c.form_filled_date) adStats[c.ad_id].formFilled++;
        if (c.meeting_booked_date) adStats[c.ad_id].booked++;
        if (c.meeting_held_date) adStats[c.ad_id].showed++;
        if (c.purchase_amount > 0) {
          adStats[c.ad_id].purchased++;
          adStats[c.ad_id].revenue += parseFloat(c.purchase_amount);
        }
      }
    });

    console.log('Top Performing Ads:\n');
    Object.entries(adStats)
      .sort((a, b) => b[1].contacts - a[1].contacts)
      .slice(0, 5)
      .forEach(([adId, stats], i) => {
        const qualifyRate = (stats.qualified / stats.contacts * 100).toFixed(1);
        console.log(`[${i + 1}] Ad ...${adId.slice(-6)}`);
        console.log(`    ${stats.contacts} contacts → ${stats.qualified} qualified (${qualifyRate}%)`);
        console.log(`    ${stats.booked} booked → ${stats.showed} showed → ${stats.purchased} purchased`);
        if (stats.purchased > 0) {
          console.log(`    💰 Revenue: $${stats.revenue.toFixed(2)}`);
        }
        console.log('');
      });
  }

  console.log('═══════════════════════════════════════════════════════════════\n');

  // REVENUE BREAKDOWN
  console.log('💰 PAYMENT TRACKING\n');

  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .gte('payment_date', startStr)
    .lte('payment_date', endStr);

  const stripePayments = payments?.filter(p => p.payment_source === 'stripe') || [];
  const denefitsPayments = payments?.filter(p => p.payment_source === 'denefits') || [];

  const stripeRevenue = stripePayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const denefitsRevenue = denefitsPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const totalRevenue = stripeRevenue + denefitsRevenue;

  console.log(`Total Payments:    ${payments?.length || 0}`);
  console.log(`Stripe:            ${stripePayments.length} payments, $${stripeRevenue.toFixed(2)}`);
  console.log(`Denefits:          ${denefitsPayments.length} payments, $${denefitsRevenue.toFixed(2)}`);
  console.log(`Total Revenue:     $${totalRevenue.toFixed(2)}`);

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// Run for this week (Nov 1-7)
const weekEnding = process.argv[2] || '2025-11-07';
generateEricReport(weekEnding).catch(console.error);
