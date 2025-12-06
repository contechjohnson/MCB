#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Get date range from args or default to last 7 days
const startDateArg = process.argv[2];
const endDateArg = process.argv[3];

let startDate, endDate;

if (startDateArg) {
  startDate = new Date(startDateArg);
  endDate = endDateArg ? new Date(endDateArg) : new Date();
} else {
  // Default: last 7 days
  endDate = new Date();
  startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
}

const startStr = startDate.toISOString().split('T')[0];
const endStr = endDate.toISOString().split('T')[0];

async function generateReport() {
  console.log('📊 Generating Weekly Business Report...');
  console.log(`   Date Range: ${startStr} to ${endStr}`);
  console.log();

  // Get all contacts (excluding historical)
  const { data: allContacts } = await supabase
    .from('contacts')
    .select('*')
    .neq('source', 'instagram_historical');

  // Get PAYMENTS data (more accurate than contacts.purchase_amount)
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .gte('payment_date', startStr)
    .lt('payment_date', endStr);

  const weeklyRevenue = payments ? payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) : 0;
  const stripeRevenue = payments ? payments.filter(p => p.payment_source === 'stripe').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) : 0;
  const denefitsRevenue = payments ? payments.filter(p => p.payment_source === 'denefits').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) : 0;
  const totalPayments = payments ? payments.length : 0;

  // PART 1: ACTIVITY-BASED (What happened this week)
  // Use Supabase filters for accurate date filtering (not JavaScript string comparison)
  const { count: dmQualifiedCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .gte('dm_qualified_date', startStr)
    .lt('dm_qualified_date', endStr)
    .neq('source', 'instagram_historical');

  const { count: linkSentCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .gte('link_send_date', startStr)
    .lt('link_send_date', endStr)
    .neq('source', 'instagram_historical');

  const { count: formFilledCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .gte('form_submit_date', startStr)
    .lt('form_submit_date', endStr)
    .neq('source', 'instagram_historical');

  const { count: meetingHeldCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .gte('appointment_held_date', startStr)
    .lt('appointment_held_date', endStr)
    .neq('source', 'instagram_historical');

  const { count: purchasedCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .gte('purchase_date', startStr)
    .lt('purchase_date', endStr)
    .neq('source', 'instagram_historical');

  const activityMetrics = {
    dmQualified: dmQualifiedCount || 0,
    linkSent: linkSentCount || 0,
    formFilled: formFilledCount || 0,
    meetingHeld: meetingHeldCount || 0,
    purchased: purchasedCount || 0
  };

  // PART 2: COHORT-BASED (New contacts acquired this week)
  const newContacts = allContacts.filter(c => c.created_at >= startStr && c.created_at < endStr);

  const cohortMetrics = {
    total: newContacts.length,
    dmQualified: newContacts.filter(c => c.dm_qualified_date).length,
    linkSent: newContacts.filter(c => c.link_send_date).length,
    formFilled: newContacts.filter(c => c.form_submit_date).length,
    meetingHeld: newContacts.filter(c => c.appointment_held_date).length,
    purchased: newContacts.filter(c => c.purchase_date).length,
    withAdId: newContacts.filter(c => c.ad_id).length,
    withoutAdId: newContacts.filter(c => !c.ad_id).length
  };

  // PART 3: AD PERFORMANCE
  // Get lifetime spend from meta_ads
  const { data: metaAds } = await supabase
    .from('meta_ads')
    .select('ad_id, ad_name, is_active, spend');

  // Get creative themes
  const { data: creatives } = await supabase
    .from('meta_ad_creatives')
    .select('ad_id, transformation_theme');

  const adTheme = {};
  if (creatives) {
    creatives.forEach(c => {
      adTheme[c.ad_id] = c.transformation_theme || 'Unknown';
    });
  }

  const adLifetimeSpend = {};
  const adIdToName = {};
  let totalLifetimeSpend = 0;

  if (metaAds) {
    metaAds.forEach(ad => {
      adLifetimeSpend[ad.ad_id] = Number(ad.spend) || 0;
      totalLifetimeSpend += Number(ad.spend) || 0;
      adIdToName[ad.ad_id] = {
        name: ad.ad_name,
        active: ad.is_active,
        theme: adTheme[ad.ad_id] || 'Unknown'
      };
    });
  }

  // Get weekly spend from most recent insights snapshot
  // Note: Meta's last_7d data is the most recent 7 days, not necessarily matching our report date range
  // So we use the most recent snapshot as our "weekly spend" approximation
  const { data: allInsights } = await supabase
    .from('meta_ad_insights')
    .select('ad_id, spend, snapshot_date')
    .order('snapshot_date', { ascending: false });

  const adWeeklySpend = {};
  const adMostRecentSnapshot = {};
  let totalWeeklySpend = 0;

  if (allInsights) {
    // Get most recent snapshot date
    const mostRecentDate = allInsights.length > 0 ? allInsights[0].snapshot_date : null;

    allInsights.forEach(insight => {
      const spend = Number(insight.spend) || 0;

      // Track most recent snapshot per ad
      if (!adMostRecentSnapshot[insight.ad_id]) {
        adMostRecentSnapshot[insight.ad_id] = spend;
      }

      // Use most recent snapshot for weekly spend (best approximation of current weekly spend)
      if (insight.snapshot_date === mostRecentDate) {
        adWeeklySpend[insight.ad_id] = spend;
        totalWeeklySpend += spend;
      }
    });

    // Fallback: If meta_ads.spend is 0, use most recent snapshot as estimate
    Object.keys(adMostRecentSnapshot).forEach(adId => {
      if (adLifetimeSpend[adId] === 0 && adMostRecentSnapshot[adId] > 0) {
        adLifetimeSpend[adId] = adMostRecentSnapshot[adId];
        totalLifetimeSpend += adMostRecentSnapshot[adId];
      }
    });
  }

  // Calculate performance by ad_id
  const adPerformance = {};

  // Contacts by ad_id - track BOTH weekly activity AND lifetime revenue for cumulative ROAS
  allContacts.forEach(c => {
    if (!c.ad_id) return;

    if (!adPerformance[c.ad_id]) {
      adPerformance[c.ad_id] = {
        contacts: 0,           // New contacts this week
        dmQualified: 0,        // Activity this week
        linkSent: 0,           // Activity this week
        formFilled: 0,         // Activity this week
        meetingHeld: 0,        // Activity this week
        purchased: 0,          // Purchases this week
        weeklyRevenue: 0,      // Revenue this week
        lifetimePurchases: 0,  // Total purchases ever
        lifetimeRevenue: 0     // Total revenue ever (for cumulative ROAS)
      };
    }

    // Count if they hit each stage THIS WEEK (for weekly metrics)
    if (c.created_at >= startStr && c.created_at < endStr) adPerformance[c.ad_id].contacts++;
    if (c.dm_qualified_date >= startStr && c.dm_qualified_date < endStr) adPerformance[c.ad_id].dmQualified++;
    if (c.link_send_date >= startStr && c.link_send_date < endStr) adPerformance[c.ad_id].linkSent++;
    if (c.form_submit_date >= startStr && c.form_submit_date < endStr) adPerformance[c.ad_id].formFilled++;
    if (c.appointment_held_date >= startStr && c.appointment_held_date < endStr) adPerformance[c.ad_id].meetingHeld++;

    // Weekly purchases
    if (c.purchase_date >= startStr && c.purchase_date < endStr) {
      adPerformance[c.ad_id].purchased++;
      adPerformance[c.ad_id].weeklyRevenue += parseFloat(c.purchase_amount) || 0;
    }

    // LIFETIME purchases (for cumulative ROAS)
    if (c.purchase_date) {
      adPerformance[c.ad_id].lifetimePurchases++;
      adPerformance[c.ad_id].lifetimeRevenue += parseFloat(c.purchase_amount) || 0;
    }
  });

  // Add spend data and calculate metrics
  Object.keys(adPerformance).forEach(adId => {
    const perf = adPerformance[adId];

    // Spend: use weekly for CPL, lifetime for ROAS
    perf.weeklySpend = adWeeklySpend[adId] || 0;
    perf.lifetimeSpend = adLifetimeSpend[adId] || 0;

    // CPL: based on new contacts acquired this week / weekly spend
    perf.cpl = perf.contacts > 0 && perf.weeklySpend > 0
      ? perf.weeklySpend / perf.contacts
      : 0;

    // ROAS: CUMULATIVE (lifetime revenue / lifetime spend)
    perf.roas = perf.lifetimeSpend > 0
      ? perf.lifetimeRevenue / perf.lifetimeSpend
      : 0;

    perf.name = adIdToName[adId]?.name || `AD ${adId}`;
    perf.active = adIdToName[adId]?.active || false;
    perf.theme = adIdToName[adId]?.theme || 'Unknown';
  });

  // Calculate performance by creative theme
  const themePerformance = {};
  Object.entries(adPerformance).forEach(([adId, perf]) => {
    const theme = perf.theme;
    if (!themePerformance[theme]) {
      themePerformance[theme] = {
        contacts: 0,
        purchased: 0,
        weeklySpend: 0,
        lifetimeSpend: 0,
        lifetimeRevenue: 0
      };
    }
    themePerformance[theme].contacts += perf.contacts;
    themePerformance[theme].purchased += perf.purchased;
    themePerformance[theme].weeklySpend += perf.weeklySpend;
    themePerformance[theme].lifetimeSpend += perf.lifetimeSpend;
    themePerformance[theme].lifetimeRevenue += perf.lifetimeRevenue;
  });

  // Calculate theme ROAS
  Object.keys(themePerformance).forEach(theme => {
    const perf = themePerformance[theme];
    perf.roas = perf.lifetimeSpend > 0 ? perf.lifetimeRevenue / perf.lifetimeSpend : 0;
    perf.conversionRate = perf.contacts > 0 ? (perf.purchased / perf.contacts * 100).toFixed(1) : '0.0';
  });

  // Calculate overall ROAS - use WEEKLY metrics for the weekly report overview
  const overallRoas = totalWeeklySpend > 0 ? weeklyRevenue / totalWeeklySpend : 0;

  // Sort ads by different metrics
  const adsByRevenue = Object.entries(adPerformance)
    .filter(([_, perf]) => perf.weeklyRevenue > 0)
    .sort((a, b) => b[1].weeklyRevenue - a[1].weeklyRevenue);

  const adsByVolume = Object.entries(adPerformance)
    .filter(([_, perf]) => perf.contacts > 0)
    .sort((a, b) => b[1].contacts - a[1].contacts);

  const adsByRoas = Object.entries(adPerformance)
    .filter(([_, perf]) => perf.roas > 0)
    .sort((a, b) => b[1].roas - a[1].roas);

  const adsByCpl = Object.entries(adPerformance)
    .filter(([_, perf]) => perf.contacts > 0 && perf.weeklySpend > 0)
    .sort((a, b) => a[1].cpl - b[1].cpl);

  const adsWithNoRevenue = Object.entries(adPerformance)
    .filter(([_, perf]) => perf.contacts > 0 && perf.lifetimeRevenue === 0)
    .sort((a, b) => b[1].weeklySpend - a[1].weeklySpend);

  // Generate markdown report
  const report = generateMarkdownReport({
    startStr,
    endStr,
    activityMetrics,
    weeklyRevenue,
    totalPayments,
    stripeRevenue,
    denefitsRevenue,
    cohortMetrics,
    totalWeeklySpend,
    overallRoas,
    adsByRevenue,
    adsByVolume,
    adsByRoas,
    adsByCpl,
    adsWithNoRevenue,
    themePerformance
  });

  // Save report
  const reportPath = `reports/weekly_report_${endStr}.md`;
  fs.writeFileSync(reportPath, report);

  console.log('✅ Report Generated!');
  console.log(`   Saved to: ${reportPath}`);
  console.log();
  console.log('📊 Quick Summary:');
  console.log(`   Revenue: $${weeklyRevenue.toLocaleString()}`);
  console.log(`   Ad Spend: $${totalWeeklySpend.toFixed(2)}`);
  console.log(`   ROAS: ${overallRoas.toFixed(2)}x`);
  console.log(`   New Contacts: ${cohortMetrics.total}`);
  console.log(`   Purchases: ${activityMetrics.purchased}`);
  console.log();

  // Also print to console
  console.log('---');
  console.log(report);
}

function generateMarkdownReport(data) {
  const {
    startStr,
    endStr,
    activityMetrics,
    weeklyRevenue,
    totalPayments,
    stripeRevenue,
    denefitsRevenue,
    cohortMetrics,
    totalWeeklySpend,
    overallRoas,
    adsByRevenue,
    adsByVolume,
    adsByRoas,
    adsByCpl,
    adsWithNoRevenue,
    themePerformance
  } = data;

  const meetingToPurchaseRate = activityMetrics.meetingHeld > 0 ? ((activityMetrics.purchased / activityMetrics.meetingHeld) * 100).toFixed(0) : 0;

  return `📊 WEEKLY BUSINESS REPORT
Week of ${startStr} to ${endStr}

---

💰 REVENUE & ACTIVITY THIS WEEK
(What happened across ALL customers - new and existing)

Total Revenue: $${weeklyRevenue.toLocaleString()}
Total Payments: ${totalPayments}
Average Order Value: $${totalPayments > 0 ? Math.round(weeklyRevenue / totalPayments).toLocaleString() : 0}

Payment Split:
  • Stripe (Full Pay): $${stripeRevenue.toLocaleString()}
  • Denefits (BNPL): $${denefitsRevenue.toLocaleString()}

| Stage          | Count |
|----------------|-------|
| DM Qualified   | ${activityMetrics.dmQualified} |
| Link Sent      | ${activityMetrics.linkSent} |
| Form Submitted | ${activityMetrics.formFilled} |
| Meeting Held   | ${activityMetrics.meetingHeld} |
| Purchased      | ${activityMetrics.purchased} |

Key Conversions:
  • Form → Meeting: ${activityMetrics.formFilled > 0 ? ((activityMetrics.meetingHeld / activityMetrics.formFilled) * 100).toFixed(0) : 0}% ${activityMetrics.formFilled > 0 && (activityMetrics.meetingHeld / activityMetrics.formFilled) < 0.25 ? '⚠️' : '✅'}
  • Meeting → Purchase: ${meetingToPurchaseRate}% ${meetingToPurchaseRate > 15 ? '✅' : '⚠️'}

---

🌱 NEW LEAD QUALITY THIS WEEK
(Performance of the ${cohortMetrics.total} people who joined THIS WEEK)

Funnel Progression:
  ${cohortMetrics.total} New Contacts
     ↓ ${((cohortMetrics.dmQualified / cohortMetrics.total) * 100).toFixed(0)}%
  ${cohortMetrics.dmQualified} DM Qualified (${((cohortMetrics.dmQualified / cohortMetrics.total) * 100).toFixed(0)}% of total)
     ↓ ${cohortMetrics.dmQualified > 0 ? ((cohortMetrics.linkSent / cohortMetrics.dmQualified) * 100).toFixed(0) : 0}%
  ${cohortMetrics.linkSent} Link Sent (${((cohortMetrics.linkSent / cohortMetrics.total) * 100).toFixed(0)}% of total)
     ↓ ${cohortMetrics.linkSent > 0 ? ((cohortMetrics.formFilled / cohortMetrics.linkSent) * 100).toFixed(0) : 0}%
  ${cohortMetrics.formFilled} Form Submitted (${((cohortMetrics.formFilled / cohortMetrics.total) * 100).toFixed(0)}% of total)
     ↓ ${cohortMetrics.formFilled > 0 ? ((cohortMetrics.meetingHeld / cohortMetrics.formFilled) * 100).toFixed(0) : 0}%
  ${cohortMetrics.meetingHeld} Meeting Held (${((cohortMetrics.meetingHeld / cohortMetrics.total) * 100).toFixed(0)}% of total)
     ↓ ${cohortMetrics.meetingHeld > 0 ? ((cohortMetrics.purchased / cohortMetrics.meetingHeld) * 100).toFixed(0) : 0}%
  ${cohortMetrics.purchased} Purchased (${((cohortMetrics.purchased / cohortMetrics.total) * 100).toFixed(1)}% of total)

Early Performance:
  • Purchases So Far: ${cohortMetrics.purchased} (${((cohortMetrics.purchased / cohortMetrics.total) * 100).toFixed(1)}% conversion)
  • Attribution: ${cohortMetrics.withAdId} with AD_ID (${((cohortMetrics.withAdId / cohortMetrics.total) * 100).toFixed(0)}%), ${cohortMetrics.withoutAdId} without ${cohortMetrics.withoutAdId / cohortMetrics.total > 0.5 ? '⚠️' : ''}

Note: These leads are still early. Watch next week for full performance.

---

💸 AD PERFORMANCE & SPEND ANALYSIS

Overall Performance:
  • Total Ad Spend: $${totalWeeklySpend.toFixed(2)}
  • Total Revenue: $${weeklyRevenue.toLocaleString()}
  • Overall ROAS: ${overallRoas.toFixed(2)}x ${overallRoas >= 3 ? '🔥' : overallRoas >= 2 ? '✅' : overallRoas >= 1 ? '⚠️' : '❌'}
  • ROI: ${((overallRoas - 1) * 100).toFixed(0)}%
  • New Contacts: ${cohortMetrics.total}
  • Cost Per Lead: $${(totalWeeklySpend / cohortMetrics.total).toFixed(2)}

---

🏆 TOP 5 ADS BY REVENUE (This Week)
${adsByRevenue.length > 0 ? adsByRevenue.slice(0, 5).map(([adId, perf], i) => `
${i + 1}. ${perf.name} (${perf.theme})
   Revenue: $${perf.weeklyRevenue.toLocaleString()} | Spend: $${perf.weeklySpend.toFixed(2)} | ROAS: ${perf.roas.toFixed(2)}x
   Contacts: ${perf.contacts} | Purchases: ${perf.purchased} (${perf.contacts > 0 ? ((perf.purchased / perf.contacts) * 100).toFixed(1) : 0}%)
   CPL: $${perf.cpl.toFixed(2)}
`).join(''): 'No revenue this week'}

---

📈 TOP 5 ADS BY VOLUME (Most Contacts)
${adsByVolume.length > 0 ? adsByVolume.slice(0, 5).map(([adId, perf], i) => `
${i + 1}. ${perf.name} (${perf.theme})
   Contacts: ${perf.contacts} | Spend: $${perf.weeklySpend.toFixed(2)} | CPL: $${perf.cpl.toFixed(2)}
   Purchases: ${perf.purchased} (${perf.contacts > 0 ? ((perf.purchased / perf.contacts) * 100).toFixed(1) : 0}%)
   Revenue: $${perf.weeklyRevenue.toLocaleString()}
`).join('') : 'No ads with contacts'}

---

💎 TOP 5 ADS BY ROAS (Return on Ad Spend)
${adsByRoas.length > 0 ? adsByRoas.slice(0, 5).map(([adId, perf], i) => `
${i + 1}. ${perf.name} (${perf.theme})
   ROAS: ${perf.roas.toFixed(2)}x | Revenue: $${perf.lifetimeRevenue.toLocaleString()} | Spend: $${perf.lifetimeSpend.toFixed(2)}
   Contacts: ${perf.contacts} | Purchases: ${perf.lifetimePurchases}
`).join('') : 'No profitable ads yet'}

---

💡 TOP 5 LOWEST COST PER LEAD
${adsByCpl.length > 0 ? adsByCpl.slice(0, 5).map(([adId, perf], i) => `
${i + 1}. ${perf.name} (${perf.theme})
   CPL: $${perf.cpl.toFixed(2)} | Contacts: ${perf.contacts} | Spend: $${perf.weeklySpend.toFixed(2)}
   Purchases: ${perf.purchased} ${perf.purchased > 0 ? `| Lifetime ROAS: ${perf.roas.toFixed(2)}x` : ''}
`).join('') : 'No ad data available'}

---

🎨 PERFORMANCE BY CREATIVE THEME
${Object.entries(themePerformance).map(([theme, perf]) => `
${theme}:
  • Contacts: ${perf.contacts} | Purchases: ${perf.purchased} (${perf.conversionRate}%)
  • Spend: $${perf.lifetimeSpend.toFixed(2)} | Revenue: $${perf.lifetimeRevenue.toLocaleString()}
  • ROAS: ${perf.roas.toFixed(2)}x
`).join('')}

---

🎯 KEY INSIGHTS & RECOMMENDATIONS

✅ WHAT'S WORKING:
${adsByRevenue.length > 0 ? `  • ${adsByRevenue[0][1].name} is crushing it with $${adsByRevenue[0][1].weeklyRevenue.toLocaleString()} revenue and ${adsByRevenue[0][1].roas.toFixed(2)}x ROAS` : '  • Need to identify winning ads'}
${activityMetrics.dmQualified / cohortMetrics.total > 0.45 ? `  • ${((activityMetrics.dmQualified / cohortMetrics.total) * 100).toFixed(0)}% DM qualification rate is solid` : ''}

⚠️ NEEDS ATTENTION:
${overallRoas < 2 ? `  • ROAS of ${overallRoas.toFixed(2)}x is below target (need 2x+)` : ''}
${activityMetrics.formFilled > 0 && (activityMetrics.meetingHeld / activityMetrics.formFilled) < 0.25 ? `  • Only ${((activityMetrics.meetingHeld / activityMetrics.formFilled) * 100).toFixed(0)}% of form submits are showing up to meetings` : ''}
${cohortMetrics.withoutAdId / cohortMetrics.total > 0.5 ? `  • ${((cohortMetrics.withoutAdId / cohortMetrics.total) * 100).toFixed(0)}% of contacts missing AD_ID attribution` : ''}

🎬 ACTION ITEMS:
${adsByRevenue.length > 0 ? `  1. SCALE: Increase budget on ${adsByRevenue[0][1].name} (best performer)` : ''}
${adsByRevenue.length > 0 && adsByRevenue[0][1].theme !== 'Unknown' ? `  2. TEST: Create variations of ${adsByRevenue[0][1].theme} theme` : ''}
${adsWithNoRevenue.length > 5 ? `  3. PAUSE: Turn off ${adsWithNoRevenue.length} underperforming ads (ROAS < 1x)` : ''}
${cohortMetrics.withoutAdId / cohortMetrics.total > 0.5 ? `  4. FIX: Improve AD_ID capture (currently missing on ${((cohortMetrics.withoutAdId / cohortMetrics.total) * 100).toFixed(0)}%)` : ''}

---

📎 Attached: weekly_data_${endStr}.csv (${cohortMetrics.total} contacts with full details)

Report generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
`;
}

generateReport().catch(console.error);
