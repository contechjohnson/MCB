#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  // Get date range (last 7 days by default, or custom)
  const daysBack = parseInt(process.argv[2]) || 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  console.log('📊 WEEKLY FUNNEL REPORT');
  console.log('═'.repeat(70));
  console.log(`Date Range: Last ${daysBack} days (since ${startDate.toISOString().split('T')[0]})`);
  console.log('═'.repeat(70));
  console.log();

  // Get contacts (excluding historical)
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .neq('source', 'instagram_historical');

  const total = contacts.length;
  const dmQualified = contacts.filter(c => c.dm_qualified_date).length;
  const linkSent = contacts.filter(c => c.link_send_date).length;
  const formSubmitted = contacts.filter(c => c.form_submit_date).length;
  const meetingHeld = contacts.filter(c => c.appointment_held_date).length;
  const purchased = contacts.filter(c => c.purchase_date).length;

  console.log('🎯 FUNNEL METRICS');
  console.log('─'.repeat(70));
  console.log();
  console.log('New Contacts:          ', total.toString().padStart(5));
  console.log('  ↓ DM Qualified:      ', dmQualified.toString().padStart(5), `(${Math.round(dmQualified/total*100)}% of total)`);
  console.log('  ↓ Link Sent:         ', linkSent.toString().padStart(5), `(${Math.round(linkSent/dmQualified*100)}% of qualified)`);
  console.log('  ↓ Form Submitted:    ', formSubmitted.toString().padStart(5), `(${Math.round(formSubmitted/total*100)}% of total)`);
  console.log('  ↓ Meeting Held:      ', meetingHeld.toString().padStart(5), `(${Math.round(meetingHeld/formSubmitted*100)}% of forms)`);
  console.log('  ↓ Purchased:         ', purchased.toString().padStart(5), `(${Math.round(purchased/meetingHeld*100)}% of meetings)`);
  console.log();

  // Get payments for this period
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .gte('payment_date', startDate.toISOString())
    .in('status', ['paid', 'active']);

  const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const stripeRevenue = payments?.filter(p => p.payment_source === 'stripe').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const denefitsRevenue = payments?.filter(p => p.payment_source === 'denefits').reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  console.log('💰 REVENUE');
  console.log('─'.repeat(70));
  console.log('Total Payments:        ', payments?.length || 0);
  console.log('Total Revenue:         ', `$${totalRevenue.toLocaleString()}`);
  console.log('  Stripe (full pay):   ', `$${stripeRevenue.toLocaleString()}`);
  console.log('  Denefits (BNPL):     ', `$${denefitsRevenue.toLocaleString()}`);
  console.log('Average Order Value:   ', `$${Math.round(totalRevenue / (payments?.length || 1)).toLocaleString()}`);
  console.log();

  // Attribution
  const withAdId = contacts.filter(c => c.ad_id).length;
  const withoutAdId = contacts.filter(c => !c.ad_id).length;

  console.log('📍 ATTRIBUTION');
  console.log('─'.repeat(70));
  console.log('Contacts WITH AD_ID:   ', withAdId.toString().padStart(5), `(${Math.round(withAdId/total*100)}%)`);
  console.log('Contacts NO AD_ID:     ', withoutAdId.toString().padStart(5), `(${Math.round(withoutAdId/total*100)}%)`);
  console.log();

  // Top performing ads by contacts
  const adIdCounts = {};
  contacts.forEach(c => {
    if (c.ad_id) {
      adIdCounts[c.ad_id] = (adIdCounts[c.ad_id] || 0) + 1;
    }
  });

  const topAds = Object.entries(adIdCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  console.log('🏆 TOP 5 ADS BY CONTACTS:');
  console.log('─'.repeat(70));
  topAds.forEach(([adId, count], i) => {
    console.log(`${i + 1}. AD_ID ${adId}: ${count} contacts`);
  });
  console.log();

  // Get weekly ad spend from meta_ad_insights
  const { data: adSpend } = await supabase
    .from('meta_ad_insights')
    .select('ad_id, spend')
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: false });

  let weeklySpend = 0;
  const spendByAd = {};

  if (adSpend) {
    // Sum spend per ad
    adSpend.forEach(insight => {
      spendByAd[insight.ad_id] = (spendByAd[insight.ad_id] || 0) + Number(insight.spend);
    });
    weeklySpend = Object.values(spendByAd).reduce((sum, s) => sum + s, 0);
  }

  console.log('💸 AD SPEND (LAST 7 DAYS)');
  console.log('─'.repeat(70));
  console.log('Total Ad Spend:        ', `$${weeklySpend.toFixed(2)}`);
  console.log('Total Revenue:         ', `$${totalRevenue.toLocaleString()}`);
  console.log();
  console.log('📊 ROAS (Return on Ad Spend):');
  if (weeklySpend > 0) {
    const roas = totalRevenue / weeklySpend;
    console.log('  ROAS:                ', `${roas.toFixed(2)}x`);
    console.log('  ROI:                 ', `${Math.round((roas - 1) * 100)}%`);
    console.log();
    if (roas >= 3) {
      console.log('  ✅ EXCELLENT: ROAS > 3x');
    } else if (roas >= 2) {
      console.log('  ✅ GOOD: ROAS 2-3x');
    } else if (roas >= 1) {
      console.log('  ⚠️  BREAK-EVEN: ROAS 1-2x');
    } else {
      console.log('  ❌ LOSING MONEY: ROAS < 1x');
    }
  } else {
    console.log('  No ad spend data available');
  }
  console.log();

  // Top spending ads
  const topSpenders = Object.entries(spendByAd)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  console.log('💵 TOP 5 ADS BY SPEND (LAST 7 DAYS):');
  console.log('─'.repeat(70));
  topSpenders.forEach(([adId, spend], i) => {
    const contactCount = adIdCounts[adId] || 0;
    const cpl = contactCount > 0 ? spend / contactCount : 0;
    console.log(`${i + 1}. AD_ID ${adId}`);
    console.log(`   Spend: $${spend.toFixed(2)} | Contacts: ${contactCount} | CPL: $${cpl.toFixed(2)}`);
  });
  console.log();

  // Early winners analysis
  console.log('🌟 EARLY WINNER ANALYSIS');
  console.log('─'.repeat(70));
  console.log('Criteria: High contact volume + low cost per lead');
  console.log();

  const adPerformance = [];
  Object.keys(adIdCounts).forEach(adId => {
    const contactCount = adIdCounts[adId];
    const spend = spendByAd[adId] || 0;
    const cpl = spend > 0 ? spend / contactCount : 0;
    const purchased = payments?.filter(p => {
      const contact = contacts.find(c => c.id === p.contact_id);
      return contact && contact.ad_id === adId;
    }).length || 0;

    if (spend > 0) {
      adPerformance.push({
        adId,
        contacts: contactCount,
        spend,
        cpl,
        purchased,
        revenue: purchased > 0 ? totalRevenue / payments.length * purchased : 0
      });
    }
  });

  // Sort by CPL (ascending)
  adPerformance.sort((a, b) => a.cpl - b.cpl);

  adPerformance.slice(0, 5).forEach((ad, i) => {
    console.log(`${i + 1}. AD_ID ${ad.adId}`);
    console.log(`   Contacts: ${ad.contacts} | Spend: $${ad.spend.toFixed(2)} | CPL: $${ad.cpl.toFixed(2)}`);
    if (ad.purchased > 0) {
      console.log(`   ✅ Purchases: ${ad.purchased} | Revenue: $${ad.revenue.toFixed(2)}`);
    }
    console.log();
  });

  console.log('═'.repeat(70));
  console.log('Report generated:', new Date().toISOString());
  console.log('═'.repeat(70));
})();
