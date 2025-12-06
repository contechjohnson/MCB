#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  const daysBack = parseInt(process.argv[2]) || 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const endDate = new Date();

  const reportDate = endDate.toISOString().split('T')[0];

  console.log('\n🚀 GENERATING WEEKLY TEAM REPORT...\n');

  // ========================================
  // PART 1: REVENUE & ACTIVITY THIS WEEK
  // ========================================

  // Get ALL payments this week (regardless of when contact was created)
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .gte('payment_date', startDate.toISOString())
    .in('status', ['paid', 'active']);

  const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const stripeRevenue = payments?.filter(p => p.payment_source === 'stripe').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const denefitsRevenue = payments?.filter(p => p.payment_source === 'denefits').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const avgOrderValue = payments?.length > 0 ? totalRevenue / payments.length : 0;

  // Get ALL meetings held this week
  const { data: meetingsHeld } = await supabase
    .from('contacts')
    .select('*')
    .gte('appointment_held_date', startDate.toISOString())
    .neq('source', 'instagram_historical');

  // Get ALL form submissions this week
  const { data: formsSubmitted } = await supabase
    .from('contacts')
    .select('*')
    .gte('form_submit_date', startDate.toISOString())
    .neq('source', 'instagram_historical');

  // ========================================
  // PART 2: NEW LEAD QUALITY THIS WEEK
  // ========================================

  // Get contacts CREATED this week
  const { data: newContacts } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .neq('source', 'instagram_historical');

  const totalNew = newContacts.length;
  const dmQualified = newContacts.filter(c => c.dm_qualified_date).length;
  const linkSent = newContacts.filter(c => c.link_send_date).length;
  const formSubmitted = newContacts.filter(c => c.form_submit_date).length;
  const meetingHeld = newContacts.filter(c => c.appointment_held_date).length;
  const purchased = newContacts.filter(c => c.purchase_date).length;
  const newContactRevenue = newContacts
    .filter(c => c.purchase_amount)
    .reduce((sum, c) => sum + Number(c.purchase_amount), 0);

  // Attribution
  const withAdId = newContacts.filter(c => c.ad_id).length;
  const withoutAdId = newContacts.filter(c => !c.ad_id).length;

  // ========================================
  // PART 3: AD PERFORMANCE & SPEND
  // ========================================

  // Get weekly ad spend from meta_ad_insights
  const { data: adSpend } = await supabase
    .from('meta_ad_insights')
    .select('ad_id, spend, snapshot_date')
    .gte('snapshot_date', startDate.toISOString().split('T')[0]);

  const spendByAd = {};
  let totalWeeklySpend = 0;

  if (adSpend) {
    adSpend.forEach(insight => {
      spendByAd[insight.ad_id] = (spendByAd[insight.ad_id] || 0) + Number(insight.spend);
    });
    totalWeeklySpend = Object.values(spendByAd).reduce((sum, s) => sum + s, 0);
  }

  // Get ad names from meta_ads table
  const { data: metaAds } = await supabase
    .from('meta_ads')
    .select('ad_id, ad_name');

  const adNames = {};
  metaAds?.forEach(ad => {
    adNames[ad.ad_id] = ad.ad_name;
  });

  // Get ad creatives for theme analysis
  const { data: adCreatives } = await supabase
    .from('meta_ad_creatives')
    .select('ad_id, transformation_theme, symptom_focus, media_type');

  const adThemes = {};
  adCreatives?.forEach(creative => {
    adThemes[creative.ad_id] = {
      theme: creative.transformation_theme,
      symptoms: creative.symptom_focus,
      media: creative.media_type
    };
  });

  // Count contacts by ad_id
  const contactsByAd = {};
  const purchasesByAd = {};
  const revenueByAd = {};

  newContacts.forEach(c => {
    if (c.ad_id) {
      contactsByAd[c.ad_id] = (contactsByAd[c.ad_id] || 0) + 1;
      if (c.purchase_date) {
        purchasesByAd[c.ad_id] = (purchasesByAd[c.ad_id] || 0) + 1;
        revenueByAd[c.ad_id] = (revenueByAd[c.ad_id] || 0) + Number(c.purchase_amount || 0);
      }
    }
  });

  // Build comprehensive ad performance
  const adPerformance = [];
  const allAdIds = new Set([...Object.keys(spendByAd), ...Object.keys(contactsByAd)]);

  allAdIds.forEach(adId => {
    const contacts = contactsByAd[adId] || 0;
    const spend = spendByAd[adId] || 0;
    const purchases = purchasesByAd[adId] || 0;
    const revenue = revenueByAd[adId] || 0;
    const cpl = contacts > 0 ? spend / contacts : 0;
    const conversionRate = contacts > 0 ? (purchases / contacts) * 100 : 0;
    const roas = spend > 0 ? revenue / spend : 0;

    adPerformance.push({
      adId,
      name: adNames[adId] || 'Unknown',
      theme: adThemes[adId]?.theme || 'Unknown',
      media: adThemes[adId]?.media || 'Unknown',
      contacts,
      spend,
      cpl,
      purchases,
      revenue,
      conversionRate,
      roas
    });
  });

  // Sort by revenue descending
  adPerformance.sort((a, b) => b.revenue - a.revenue);

  const topByRevenue = adPerformance.filter(a => a.revenue > 0).slice(0, 5);
  const topByContacts = [...adPerformance].sort((a, b) => b.contacts - a.contacts).slice(0, 5);
  const topByROAS = adPerformance.filter(a => a.roas > 0).sort((a, b) => b.roas - a.roas).slice(0, 5);
  const lowestCPL = adPerformance.filter(a => a.cpl > 0).sort((a, b) => a.cpl - b.cpl).slice(0, 5);

  // Overall ROAS
  const overallROAS = totalWeeklySpend > 0 ? totalRevenue / totalWeeklySpend : 0;
  const overallCPL = totalNew > 0 ? totalWeeklySpend / totalNew : 0;

  // Theme performance
  const themeStats = {};
  adPerformance.forEach(ad => {
    if (!themeStats[ad.theme]) {
      themeStats[ad.theme] = { contacts: 0, spend: 0, revenue: 0, purchases: 0 };
    }
    themeStats[ad.theme].contacts += ad.contacts;
    themeStats[ad.theme].spend += ad.spend;
    themeStats[ad.theme].revenue += ad.revenue;
    themeStats[ad.theme].purchases += ad.purchases;
  });

  const themePerformance = Object.entries(themeStats).map(([theme, stats]) => ({
    theme,
    ...stats,
    conversionRate: stats.contacts > 0 ? (stats.purchases / stats.contacts) * 100 : 0,
    roas: stats.spend > 0 ? stats.revenue / stats.spend : 0
  })).sort((a, b) => b.revenue - a.revenue);

  // ========================================
  // GENERATE MARKDOWN REPORT
  // ========================================

  let report = `# Weekly Performance Report
**Week of ${startDate.toISOString().split('T')[0]} to ${reportDate}**

---

## 📊 PART 1: Revenue & Activity This Week
*What actually happened across ALL customers (new and existing)*

### 💰 Revenue Performance
- **Total Revenue:** $${totalRevenue.toLocaleString()}
- **Total Payments:** ${payments?.length || 0} payments
- **Average Order Value:** $${Math.round(avgOrderValue).toLocaleString()}
- **Payment Split:**
  - Stripe (Full Pay): $${stripeRevenue.toLocaleString()}
  - Denefits (BNPL): $${denefitsRevenue.toLocaleString()}

### 🎯 Team Activity
- **Meetings Held:** ${meetingsHeld?.length || 0} meetings
- **Forms Submitted:** ${formsSubmitted?.length || 0} forms
- **Meeting → Purchase Rate:** ${meetingsHeld?.length > 0 ? Math.round((payments?.length / meetingsHeld.length) * 100) : 0}%

---

## 🌱 PART 2: New Lead Quality This Week
*Performance of the ${totalNew} people who joined THIS WEEK*

### Funnel Progression (New Leads Only)
\`\`\`
${totalNew.toString().padStart(5)} New Contacts
  ↓ ${Math.round(dmQualified/totalNew*100)}%
${dmQualified.toString().padStart(5)} DM Qualified (${Math.round(dmQualified/totalNew*100)}% of total)
  ↓ ${dmQualified > 0 ? Math.round(linkSent/dmQualified*100) : 0}%
${linkSent.toString().padStart(5)} Link Sent (${Math.round(linkSent/totalNew*100)}% of total)
  ↓ ${linkSent > 0 ? Math.round(formSubmitted/linkSent*100) : 0}%
${formSubmitted.toString().padStart(5)} Form Submitted (${Math.round(formSubmitted/totalNew*100)}% of total)
  ↓ ${formSubmitted > 0 ? Math.round(meetingHeld/formSubmitted*100) : 0}%
${meetingHeld.toString().padStart(5)} Meeting Held (${Math.round(meetingHeld/totalNew*100)}% of total)
  ↓ ${meetingHeld > 0 ? Math.round(purchased/meetingHeld*100) : 0}%
${purchased.toString().padStart(5)} Purchased (${Math.round(purchased/totalNew*100)}% of total)
\`\`\`

### Early Performance Metrics
- **Purchases So Far:** ${purchased} (${(purchased/totalNew*100).toFixed(1)}% conversion)
- **Revenue from New Leads:** $${newContactRevenue.toLocaleString()}
- **Attribution Rate:** ${withAdId} with AD_ID (${Math.round(withAdId/totalNew*100)}%), ${withoutAdId} without

---

## 💸 PART 3: Ad Performance & Spend Analysis

### Overall Ad Performance
- **Total Ad Spend:** $${totalWeeklySpend.toFixed(2)}
- **Total Revenue:** $${totalRevenue.toLocaleString()}
- **Overall ROAS:** ${overallROAS.toFixed(2)}x ${overallROAS >= 3 ? '✅ EXCELLENT' : overallROAS >= 2 ? '✅ GOOD' : overallROAS >= 1 ? '⚠️ BREAK-EVEN' : '❌ LOSING MONEY'}
- **Overall ROI:** ${Math.round((overallROAS - 1) * 100)}%
- **Cost Per Lead:** $${overallCPL.toFixed(2)}
- **New Contacts:** ${totalNew}

### 🏆 Top 5 Ads by Revenue

${topByRevenue.length > 0 ? topByRevenue.map((ad, i) => `${i + 1}. **${ad.name}** (${ad.theme})
   - Revenue: $${ad.revenue.toLocaleString()}
   - Spend: $${ad.spend.toFixed(2)}
   - ROAS: ${ad.roas.toFixed(2)}x
   - Contacts: ${ad.contacts} | Purchases: ${ad.purchases} (${ad.conversionRate.toFixed(1)}%)
   - CPL: $${ad.cpl.toFixed(2)}
`).join('\n') : 'No revenue-generating ads this week'}

### 📈 Top 5 Ads by Volume (Most Contacts)

${topByContacts.map((ad, i) => `${i + 1}. **${ad.name}** (${ad.theme})
   - Contacts: ${ad.contacts}
   - Spend: $${ad.spend.toFixed(2)}
   - CPL: $${ad.cpl.toFixed(2)}
   - Purchases: ${ad.purchases} (${ad.conversionRate.toFixed(1)}%)
   - Revenue: $${ad.revenue.toLocaleString()}
`).join('\n')}

### 💎 Top 5 Ads by ROAS (Return on Ad Spend)

${topByROAS.length > 0 ? topByROAS.map((ad, i) => `${i + 1}. **${ad.name}** (${ad.theme})
   - ROAS: ${ad.roas.toFixed(2)}x
   - Revenue: $${ad.revenue.toLocaleString()}
   - Spend: $${ad.spend.toFixed(2)}
   - Contacts: ${ad.contacts} | Purchases: ${ad.purchases}
`).join('\n') : 'No ROAS data available yet'}

### 🎯 Lowest Cost Per Lead

${lowestCPL.map((ad, i) => `${i + 1}. **${ad.name}** (${ad.theme})
   - CPL: $${ad.cpl.toFixed(2)}
   - Contacts: ${ad.contacts}
   - Spend: $${ad.spend.toFixed(2)}
   - Purchases: ${ad.purchases}
`).join('\n')}

### 🎨 Performance by Creative Theme

${themePerformance.map(theme => `**${theme.theme}**
- Contacts: ${theme.contacts} | Purchases: ${theme.purchases} (${theme.conversionRate.toFixed(1)}%)
- Spend: $${theme.spend.toFixed(2)} | Revenue: $${theme.revenue.toLocaleString()}
- ROAS: ${theme.roas.toFixed(2)}x
`).join('\n')}

---

## 🎯 Key Insights & Recommendations

### What's Working ✅
${topByRevenue.length > 0 ? `- **${topByRevenue[0].name}** is crushing it with $${topByRevenue[0].revenue.toLocaleString()} in revenue and ${topByRevenue[0].roas.toFixed(2)}x ROAS` : '- Need more conversion data'}
${overallROAS >= 2 ? `- Overall ROAS of ${overallROAS.toFixed(2)}x is strong - keep scaling` : ''}
${dmQualified/totalNew >= 0.4 ? `- ${Math.round(dmQualified/totalNew*100)}% DM qualification rate is solid` : ''}

### What Needs Attention ⚠️
${overallROAS < 2 ? `- ROAS of ${overallROAS.toFixed(2)}x is below target (need 2x+)` : ''}
${formSubmitted > 0 && meetingHeld/formSubmitted < 0.3 ? `- Only ${Math.round(meetingHeld/formSubmitted*100)}% of form submits are showing up to meetings` : ''}
${withoutAdId/totalNew > 0.4 ? `- ${Math.round(withoutAdId/totalNew*100)}% of contacts missing AD_ID attribution` : ''}
${adPerformance.filter(a => a.spend > 100 && a.contacts === 0).length > 0 ? `- ${adPerformance.filter(a => a.spend > 100 && a.contacts === 0).length} ads spending with 0 contacts (attribution issue)` : ''}

### Action Items 🎬
${topByRevenue.length > 0 ? `1. **SCALE:** Increase budget on ${topByRevenue[0].name} (best performer)` : '1. Run Meta Ads sync to get attribution data'}
${topByROAS.length > 0 && topByROAS[0].roas > 3 ? `2. **TEST:** Create variations of ${topByROAS[0].name} theme (${topByROAS[0].theme})` : ''}
${adPerformance.filter(a => a.roas < 1 && a.spend > 50).length > 0 ? `3. **PAUSE:** Turn off ${adPerformance.filter(a => a.roas < 1 && a.spend > 50).length} underperforming ads (ROAS < 1x)` : ''}
${withoutAdId/totalNew > 0.5 ? `4. **FIX:** Improve AD_ID capture (currently missing on ${Math.round(withoutAdId/totalNew*100)}%)` : ''}

---

**Report Generated:** ${new Date().toISOString()}
**Data Excludes:** Historical imports (instagram_historical source)
`;

  // Save to file
  const reportPath = `reports/weekly_team_report_${reportDate}.md`;
  fs.writeFileSync(reportPath, report);

  console.log('✅ Report Generated Successfully!\n');
  console.log(`📄 Saved to: ${reportPath}\n`);
  console.log('═'.repeat(70));
  console.log('QUICK SUMMARY FOR TEAM EMAIL:');
  console.log('═'.repeat(70));
  console.log(`💰 Revenue: $${totalRevenue.toLocaleString()} (${payments?.length} payments)`);
  console.log(`🌱 New Leads: ${totalNew} contacts`);
  console.log(`💸 Ad Spend: $${totalWeeklySpend.toFixed(2)}`);
  console.log(`📊 ROAS: ${overallROAS.toFixed(2)}x`);
  console.log(`🎯 Meetings Held: ${meetingsHeld?.length} | Purchased: ${payments?.length}`);
  if (topByRevenue.length > 0) {
    console.log(`🏆 Best Ad: ${topByRevenue[0].name} ($${topByRevenue[0].revenue.toLocaleString()} revenue)`);
  }
  console.log('═'.repeat(70));
  console.log(`\n📧 Send ${reportPath} to the team!\n`);
})();
