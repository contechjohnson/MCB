#!/usr/bin/env node

/**
 * Final Weekly Report Generator
 * Generates a clean, comprehensive weekly report with all metrics corrected
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function generateFinalReport() {
  const startStr = '2025-11-13';
  const endStr = '2025-11-21';  // Include Nov 20

  console.log('📊 Generating Final Weekly Report (Nov 13-21)...\n');

  // Get all contacts
  const { data: allContacts } = await supabase
    .from('contacts')
    .select('*')
    .neq('source', 'instagram_historical');

  // Get new contacts this week
  const { data: newContacts } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', startStr)
    .lt('created_at', endStr)
    .neq('source', 'instagram_historical');

  // Get payments
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .gte('payment_date', startStr)
    .lt('payment_date', endStr);

  // Activity metrics using proper Supabase date queries
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

  // Revenue calculations
  const weeklyRevenue = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const stripeRevenue = payments.filter(p => p.payment_source === 'stripe').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const denefitsRevenue = payments.filter(p => p.payment_source === 'denefits').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  // Get purchases with attribution data
  const { data: purchasesWithAttribution } = await supabase
    .from('contacts')
    .select('id, purchase_amount, ad_id')
    .gte('purchase_date', startStr)
    .lt('purchase_date', endStr)
    .neq('source', 'instagram_historical');

  const attributedPurchases = purchasesWithAttribution.filter(p => p.ad_id);
  const unattributedPurchases = purchasesWithAttribution.filter(p => !p.ad_id);
  const attributedRevenue = attributedPurchases.reduce((sum, p) => sum + (parseFloat(p.purchase_amount) || 0), 0);
  const unattributedRevenue = unattributedPurchases.reduce((sum, p) => sum + (parseFloat(p.purchase_amount) || 0), 0);
  const contactRevenue = attributedRevenue + unattributedRevenue;

  // Get weekly ad spend from insights
  const { data: insights } = await supabase
    .from('meta_ad_insights')
    .select('*')
    .order('snapshot_date', { ascending: false });

  const mostRecentDate = insights && insights.length > 0 ? insights[0].snapshot_date : null;
  const weeklyInsights = mostRecentDate ? insights.filter(i => i.snapshot_date === mostRecentDate) : [];
  const totalAdSpend = weeklyInsights.reduce((sum, i) => sum + (parseFloat(i.spend) || 0), 0);

  // Traffic breakdown
  const tofMof = newContacts.filter(c => c.mc_id);
  const directToForm = newContacts.filter(c => !c.mc_id);
  const leadMagnetAdSetIds = ['120236928026440652', '120236942069970652', '120236927208710652', '120233842485330652'];
  const leadMagnet = directToForm.filter(c => c.ad_id && leadMagnetAdSetIds.includes(c.ad_id));
  const website = directToForm.filter(c => !c.ad_id);
  const bof = directToForm.filter(c => c.ad_id && !leadMagnetAdSetIds.includes(c.ad_id));

  // Funnel comparison by source - use Supabase queries for accuracy
  // Instagram (main funnel)
  const { data: igPurchases } = await supabase.from('contacts').select('purchase_amount')
    .eq('source', 'instagram').gte('purchase_date', startStr).lt('purchase_date', endStr);
  const { count: igForms } = await supabase.from('contacts').select('*', { count: 'exact', head: true })
    .eq('source', 'instagram').gte('form_submit_date', startStr).lt('form_submit_date', endStr);
  const { count: igMeetings } = await supabase.from('contacts').select('*', { count: 'exact', head: true })
    .eq('source', 'instagram').gte('appointment_held_date', startStr).lt('appointment_held_date', endStr);

  const mainFunnelMetrics = {
    total: newContacts.filter(c => c.source === 'instagram').length,
    formSubmitThisWeek: igForms || 0,
    meetingHeldThisWeek: igMeetings || 0,
    purchasedThisWeek: igPurchases ? igPurchases.length : 0,
    purchasedRevenue: igPurchases ? igPurchases.reduce((s, c) => s + (parseFloat(c.purchase_amount) || 0), 0) : 0
  };

  // Lead magnet funnel
  const { data: lmPurchases } = await supabase.from('contacts').select('purchase_amount')
    .eq('source', 'instagram_lm').gte('purchase_date', startStr).lt('purchase_date', endStr);
  const { count: lmForms } = await supabase.from('contacts').select('*', { count: 'exact', head: true })
    .eq('source', 'instagram_lm').gte('form_submit_date', startStr).lt('form_submit_date', endStr);
  const { count: lmMeetings } = await supabase.from('contacts').select('*', { count: 'exact', head: true })
    .eq('source', 'instagram_lm').gte('appointment_held_date', startStr).lt('appointment_held_date', endStr);

  const lmFunnelMetrics = {
    total: newContacts.filter(c => c.source === 'instagram_lm').length,
    formSubmitThisWeek: lmForms || 0,
    meetingHeldThisWeek: lmMeetings || 0,
    purchasedThisWeek: lmPurchases ? lmPurchases.length : 0,
    purchasedRevenue: lmPurchases ? lmPurchases.reduce((s, c) => s + (parseFloat(c.purchase_amount) || 0), 0) : 0
  };

  // Website funnel
  const { data: webPurchases } = await supabase.from('contacts').select('purchase_amount')
    .eq('source', 'website').gte('purchase_date', startStr).lt('purchase_date', endStr);
  const { count: webForms } = await supabase.from('contacts').select('*', { count: 'exact', head: true })
    .eq('source', 'website').gte('form_submit_date', startStr).lt('form_submit_date', endStr);
  const { count: webMeetings } = await supabase.from('contacts').select('*', { count: 'exact', head: true })
    .eq('source', 'website').gte('appointment_held_date', startStr).lt('appointment_held_date', endStr);

  const websiteFunnelMetrics = {
    total: newContacts.filter(c => c.source === 'website').length,
    formSubmitThisWeek: webForms || 0,
    meetingHeldThisWeek: webMeetings || 0,
    purchasedThisWeek: webPurchases ? webPurchases.length : 0,
    purchasedRevenue: webPurchases ? webPurchases.reduce((s, c) => s + (parseFloat(c.purchase_amount) || 0), 0) : 0
  };

  const mainFormToMeeting = mainFunnelMetrics.formSubmitThisWeek > 0 ? (mainFunnelMetrics.meetingHeldThisWeek / mainFunnelMetrics.formSubmitThisWeek * 100).toFixed(0) : '0';
  const lmFormToMeeting = lmFunnelMetrics.formSubmitThisWeek > 0 ? (lmFunnelMetrics.meetingHeldThisWeek / lmFunnelMetrics.formSubmitThisWeek * 100).toFixed(0) : '0';
  const websiteFormToMeeting = websiteFunnelMetrics.formSubmitThisWeek > 0 ? (websiteFunnelMetrics.meetingHeldThisWeek / websiteFunnelMetrics.formSubmitThisWeek * 100).toFixed(0) : '0';

  // Attribution rates
  const tofInstagram = tofMof.filter(c => c.source === 'instagram' || c.source === 'instagram_lm');
  const tofWithAdId = tofInstagram.filter(c => c.ad_id).length;
  const tofAttribution = tofInstagram.length > 0 ? (tofWithAdId / tofInstagram.length * 100).toFixed(1) : '0';

  // Cohort metrics for new leads
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

  // Calculate conversions
  const formToMeeting = formFilledCount > 0 ? (meetingHeldCount / formFilledCount * 100).toFixed(0) : '0';
  const meetingToPurchase = meetingHeldCount > 0 ? (purchasedCount / meetingHeldCount * 100).toFixed(0) : '0';
  const roas = totalAdSpend > 0 ? (weeklyRevenue / totalAdSpend).toFixed(2) : 'N/A';

  // A/B test check
  const chatbotA = tofMof.filter(c => c.chatbot_ab === 'A' && c.created_at >= '2025-11-18');
  const chatbotB = tofMof.filter(c => c.chatbot_ab === 'B' && c.created_at >= '2025-11-18');
  const hasAbTest = chatbotA.length > 0 || chatbotB.length > 0;

  // Generate report
  const report = `📊 WEEKLY BUSINESS REPORT
Week of November 13-20, 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 💰 BOTTOM LINE

**Revenue: $${weeklyRevenue.toLocaleString()}** | **ROAS: ${totalAdSpend > 0 ? (contactRevenue / totalAdSpend).toFixed(1) : 'N/A'}x** | **Purchases: ${purchasedCount}**

Ad Spend: $${totalAdSpend.toLocaleString()} | Meetings: ${meetingHeldCount} | New Leads: ${newContacts.length}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📊 VS AD TEAM REPORT

The ad team reported $31,175 revenue (2.08x ROAS). Here's the full picture:

| Metric | Ad Team (Meta) | Us (Click-Attributed) | Us (Total) |
|--------|----------------|----------------------|------------|
| Revenue | $31,175 | $${attributedRevenue.toLocaleString()} | **$${contactRevenue.toLocaleString()}** |
| Purchases | 12 | ${attributedPurchases.length} | **${purchasesWithAttribution.length}** |
| ROAS | 2.08x | ${totalAdSpend > 0 ? (attributedRevenue / totalAdSpend).toFixed(2) : 'N/A'}x | **${totalAdSpend > 0 ? (contactRevenue / totalAdSpend).toFixed(1) : 'N/A'}x** |

**Why the difference?**
- Meta only tracks conversions their pixel can see (view-through + click-through)
- We only capture ad_id on click-throughs (not view-through)
- Our total includes ALL revenue regardless of attribution

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔥 CONVERSION BY SOURCE

| Source | Forms | Meetings | Sales | Revenue | Form→Meeting |
|--------|-------|----------|-------|---------|--------------|
| **Instagram** | ${mainFunnelMetrics.formSubmitThisWeek} | ${mainFunnelMetrics.meetingHeldThisWeek} | ${mainFunnelMetrics.purchasedThisWeek} | $${mainFunnelMetrics.purchasedRevenue.toLocaleString()} | **${mainFormToMeeting}%** |
| **Website** | ${websiteFunnelMetrics.formSubmitThisWeek} | ${websiteFunnelMetrics.meetingHeldThisWeek} | ${websiteFunnelMetrics.purchasedThisWeek} | $${websiteFunnelMetrics.purchasedRevenue.toLocaleString()} | **${websiteFormToMeeting}%** |
| **Lead Magnet** | ${lmFunnelMetrics.formSubmitThisWeek} | ${lmFunnelMetrics.meetingHeldThisWeek} | ${lmFunnelMetrics.purchasedThisWeek} | $${lmFunnelMetrics.purchasedRevenue.toLocaleString()} | **${lmFormToMeeting}%** |

${lmFunnelMetrics.purchasedThisWeek === 0 && lmFunnelMetrics.formSubmitThisWeek > 0 ? `🚨 **Lead Magnet Problem:** ${lmFunnelMetrics.formSubmitThisWeek} form submissions → 0 meetings → 0 sales
   These people just want free content and aren't converting.` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 ACTION ITEMS

1. **EVALUATE LEAD MAGNET:** ${lmFunnelMetrics.formSubmitThisWeek} leads, $0 revenue. Consider:
   - Adding qualification step before free content
   - Nurture sequence to warm them up
   - Or reduce ad spend on lead magnet campaigns

2. **IMPROVE FORM→MEETING:** Currently at ${formToMeeting}%
   - Instagram: ${mainFormToMeeting}% | Website: ${websiteFormToMeeting}%
   - Add SMS reminders, confirmation calls, or reduce no-shows

3. **PROTECT CLOSE RATE:** ${meetingToPurchase}% meeting→purchase is excellent
   - Keep doing what's working on sales calls

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📈 FUNNEL THIS WEEK

| Stage | Count | Conversion |
|-------|-------|------------|
| DM Qualified | ${dmQualifiedCount} | - |
| Link Sent | ${linkSentCount} | - |
| Form Submitted | ${formFilledCount} | - |
| Meeting Held | ${meetingHeldCount} | ${formToMeeting}% of forms |
| **Purchased** | **${purchasedCount}** | **${meetingToPurchase}%** of meetings |

Payment Split: Stripe $${stripeRevenue.toLocaleString()} (${weeklyRevenue > 0 ? (stripeRevenue/weeklyRevenue*100).toFixed(0) : 0}%) | Denefits $${denefitsRevenue.toLocaleString()} (${weeklyRevenue > 0 ? (denefitsRevenue/weeklyRevenue*100).toFixed(0) : 0}%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Report generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Data: Server-side tracking (ManyChat → Supabase → Stripe/Denefits)
`;

  // Save report
  fs.writeFileSync('reports/weekly_report_2025-11-21_FINAL.md', report);

  console.log('✅ Final report generated!\n');
  console.log('📊 Summary:');
  console.log(`   Revenue: $${weeklyRevenue.toLocaleString()}`);
  console.log(`   Ad Spend: $${totalAdSpend.toLocaleString()}`);
  console.log(`   ROAS: ${roas}x`);
  console.log(`   New Contacts: ${newContacts.length}`);
  console.log(`   Meetings Held: ${meetingHeldCount}`);
  console.log(`   Purchases: ${purchasedCount}`);
  console.log(`\n📄 Saved to: reports/weekly_report_2025-11-20_FINAL.md`);

  return report;
}

generateFinalReport().then(report => {
  console.log('\n' + '='.repeat(60));
  console.log(report);
}).catch(console.error);
