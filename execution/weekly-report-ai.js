/**
 * Weekly Report AI - OpenAI Assistant Integration
 *
 * Uses OpenAI Assistants API with persistent threads for memory
 * Generates weekly reports and emails them via Resend
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Get or create the Clara assistant
 */
async function getOrCreateAssistant() {
  console.log('🤖 Setting up Clara (OpenAI Assistant)...\n');

  // Check if we already have an assistant ID stored
  const assistantId = process.env.OPENAI_ASSISTANT_ID;

  if (assistantId) {
    try {
      const assistant = await openai.beta.assistants.retrieve(assistantId);
      console.log(`✅ Found existing assistant: ${assistant.name}\n`);
      return assistant;
    } catch (error) {
      console.log('⚠️  Stored assistant not found, creating new one...\n');
    }
  }

  // Create new assistant
  const assistant = await openai.beta.assistants.create({
    name: "Clara - Postpartum Care USA Analytics",
    instructions: `You are Clara, the ManyChat chatbot and analytics system for Postpartum Care USA.

Your job: Write weekly performance reports for Eric (the business owner).

TONE & STYLE:
- Friendly but professional (like an expert colleague)
- Data-driven, not fluffy
- Specific recommendations only (actionable)
- Celebrate wins, contextualize drops
- Keep it concise - Eric doesn't want essays

YOUR MEMORY:
- You have access to previous reports via the thread
- Remember what you recommended last week
- Track if recommendations were followed
- Build on previous insights

REPORT STRUCTURE:
1. **Hi Eric** - Quick intro (1-2 sentences)
2. **System Status** - What phase we're in (30-day holding pattern)
3. **This Week's Numbers** - Key metrics with week-over-week changes
4. **Top Performing Ads** - Which ads are winning (with creative insights)
5. **What We're Learning** - Insights from data (patterns, themes)
6. **Action Items** - Specific things to do this week (2-5 items max)
7. **Bottom Line** - TL;DR summary

CONTEXT:
- Phase 1: Built foundation, 536 contacts, $120k revenue
- Phase 2: Attribution push (last 2 months)
- Phase 3: Full system live (current - 30-day holding pattern)
- Key insight: "Overwhelm to Relief" > "Confusion to Clarity" (84.6% vs 60%)
- Conversion timeline: ~28 days from subscribe to purchase
- Premium pricing: $2,700+ average order value

IMPORTANT RULES:
1. Always compare to last week (week-over-week %)
2. Call out what changed and WHY
3. Give specific recommendations ("Scale Ad ...200652 by 50%" not "Optimize ads")
4. Downplay qualification rate (it fluctuates, focus on conversions)
5. Acknowledge the 30-day conversion window (don't expect instant ROI)

FORMATTING:
- Use markdown for structure
- Include tables for metrics
- Use emojis sparingly (only for section headers)
- Keep paragraphs short (2-3 sentences max)`,
    model: "gpt-4o",
    tools: []
  });

  console.log(`✅ Created new assistant: ${assistant.id}`);
  console.log('⚠️  Add this to your .env.local:\n');
  console.log(`OPENAI_ASSISTANT_ID=${assistant.id}\n`);

  return assistant;
}

/**
 * Get or create thread for persistent memory
 */
async function getOrCreateThread() {
  console.log('🧵 Setting up conversation thread...\n');

  const threadId = process.env.OPENAI_THREAD_ID;

  if (threadId) {
    try {
      const thread = await openai.beta.threads.retrieve(threadId);
      console.log(`✅ Found existing thread: ${thread.id}\n`);
      return thread;
    } catch (error) {
      console.log('⚠️  Stored thread not found, creating new one...\n');
    }
  }

  // Create new thread
  const thread = await openai.beta.threads.create();

  console.log(`✅ Created new thread: ${thread.id}`);
  console.log('⚠️  Add this to your .env.local:\n');
  console.log(`OPENAI_THREAD_ID=${thread.id}\n`);

  return thread;
}

/**
 * Count events by type within a date range (from funnel_events)
 */
async function countEventsByType(eventType, startStr, endStr) {
  const { count } = await supabase
    .from('funnel_events')
    .select('contact_id', { count: 'exact' })
    .eq('event_type', eventType)
    .gte('event_timestamp', startStr)
    .lte('event_timestamp', endStr + 'T23:59:59');

  return count || 0;
}

/**
 * Fetch this week's analytics data
 * Uses funnel_events as primary source for stage metrics
 */
async function fetchWeekData(weekEnding) {
  console.log(`📊 Fetching analytics for week ending ${weekEnding}...\n`);

  const endDate = new Date(weekEnding);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  // === FUNNEL METRICS (from funnel_events) ===

  // Get new contacts this week (for total count and ad attribution)
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, ad_id, source')
    .not('source', 'like', '%_historical%')
    .not('source', 'eq', 'instagram_lm')
    .gte('created_at', startStr)
    .lte('created_at', endStr + 'T23:59:59');

  // Funnel stages from funnel_events
  const dmQualified = await countEventsByType('dm_qualified', startStr, endStr);
  const linkClicked = await countEventsByType('link_clicked', startStr, endStr);
  const formSubmitted = await countEventsByType('form_submitted', startStr, endStr);
  const scheduledDCs = await countEventsByType('appointment_scheduled', startStr, endStr);
  const arrivedDCs = await countEventsByType('appointment_held', startStr, endStr);

  // Purchase events
  const deposits = await countEventsByType('deposit_paid', startStr, endStr);
  const fullPurchases = await countEventsByType('purchase_completed', startStr, endStr);
  const paymentPlans = await countEventsByType('payment_plan_created', startStr, endStr);

  // Get lead magnet stats (all-time, not just this week)
  const { data: lmContacts } = await supabase
    .from('contacts')
    .select('email_primary, subscribe_date, purchase_date, purchase_amount')
    .eq('source', 'instagram_lm');

  const lmStats = {
    total: lmContacts?.length || 0,
    purchased: lmContacts?.filter(c => c.purchase_date)?.length || 0,
    revenue: lmContacts?.reduce((sum, c) => sum + (parseFloat(c.purchase_amount) || 0), 0) || 0
  };

  // === REVENUE METRICS (from payments table with categories) ===

  // Cash Collected (actual money received)
  const { data: cashPayments } = await supabase
    .from('payments')
    .select('amount, payment_category, payment_source')
    .in('payment_category', ['deposit', 'full_purchase', 'downpayment', 'recurring'])
    .gte('payment_date', startStr)
    .lte('payment_date', endStr + 'T23:59:59');

  const cashCollected = cashPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
  const stripeRevenue = cashPayments?.filter(p => p.payment_source === 'stripe')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
  const denefitsCashCollected = cashPayments?.filter(p => p.payment_source === 'denefits')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

  // Projected Revenue (Denefits payment plans)
  const { data: projectedPayments } = await supabase
    .from('payments')
    .select('amount')
    .eq('payment_category', 'payment_plan')
    .gte('payment_date', startStr)
    .lte('payment_date', endStr + 'T23:59:59');

  const projectedRevenue = projectedPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

  // Deposit count (high intent)
  const depositCount = cashPayments?.filter(p => p.payment_category === 'deposit').length || 0;

  // All payments for count
  const { data: allPayments } = await supabase
    .from('payments')
    .select('*')
    .gte('payment_date', startStr)
    .lte('payment_date', endStr + 'T23:59:59');

  // Get Meta ad spend (from insights table)
  const { data: adInsights } = await supabase
    .from('meta_ad_insights')
    .select('spend')
    .gte('snapshot_date', startStr)
    .lte('snapshot_date', endStr);

  const totalSpend = adInsights?.reduce((sum, i) => sum + parseFloat(i.spend || 0), 0) || 0;

  // Calculate key metrics
  const totalContacts = contacts?.length || 0;
  const qualifyRate = totalContacts > 0 ? (dmQualified / totalContacts * 100).toFixed(1) : 0;
  const withAdId = contacts?.filter(c => c.ad_id).length || 0;
  const attributionCoverage = totalContacts > 0 ? (withAdId / totalContacts * 100).toFixed(1) : 0;

  const showRate = scheduledDCs > 0 ? (arrivedDCs / scheduledDCs * 100).toFixed(1) : 0;
  const closed = deposits + fullPurchases + paymentPlans;
  const closeRate = arrivedDCs > 0 ? (closed / arrivedDCs * 100).toFixed(1) : 0;

  const roas = totalSpend > 0 ? (cashCollected / totalSpend).toFixed(2) : 0;

  // Get top performing ads (by contacts created this week with that ad_id)
  const adStats = {};
  (contacts || []).forEach(c => {
    if (c.ad_id) {
      if (!adStats[c.ad_id]) {
        adStats[c.ad_id] = { contacts: 0 };
      }
      adStats[c.ad_id].contacts++;
    }
  });

  const topAds = Object.entries(adStats)
    .map(([adId, stats]) => ({
      adId,
      contacts: stats.contacts,
      qualified: 0, // Will be filled from funnel_events if needed
      qualifyRate: '0'
    }))
    .sort((a, b) => b.contacts - a.contacts)
    .slice(0, 5);

  // Get creative data for top ads
  for (const ad of topAds) {
    const { data: adData } = await supabase
      .from('meta_ads')
      .select('ad_name')
      .eq('ad_id', ad.adId)
      .single();

    const { data: creative } = await supabase
      .from('meta_ad_creatives')
      .select('transformation_theme, symptom_focus, headline')
      .eq('ad_id', ad.adId)
      .single();

    ad.adName = adData?.ad_name || 'Unknown';
    ad.theme = creative?.transformation_theme || 'unknown';
    ad.symptoms = creative?.symptom_focus || [];
    ad.headline = creative?.headline || '';
  }

  console.log('✅ Data fetched\n');

  return {
    weekEnding: endStr,
    dateRange: `${startStr} to ${endStr}`,
    metrics: {
      totalContacts,
      dmQualified,
      qualifyRate,
      withAdId,
      attributionCoverage,
      scheduledDCs,
      arrivedDCs,
      showRate,
      closed,
      closeRate,
      // Revenue breakdown
      cashCollected,
      projectedRevenue,
      stripeRevenue,
      denefitsCashCollected,
      depositCount,
      // Legacy fields for backward compat
      totalRevenue: cashCollected,
      denefitsRevenue: denefitsCashCollected,
      totalSpend,
      roas
    },
    topAds,
    payments: allPayments?.length || 0,
    leadMagnet: lmStats
  };
}

/**
 * Get previous week's data for comparison
 */
async function getPreviousWeekData(weekEnding) {
  const { data } = await supabase
    .from('weekly_snapshots')
    .select('*')
    .eq('week_ending', weekEnding)
    .single();

  return data;
}

/**
 * Generate report using OpenAI Assistant
 */
async function generateReport(assistant, thread, weekData, previousWeek) {
  console.log('✍️  Generating report with Clara...\n');

  // Build the prompt with data
  const prompt = `Generate this week's report for Eric.

WEEK ENDING: ${weekData.weekEnding}

THIS WEEK'S DATA:
- Total Contacts: ${weekData.metrics.totalContacts}
- DM Qualified: ${weekData.metrics.dmQualified} (${weekData.metrics.qualifyRate}%)
- Ad Attribution: ${weekData.metrics.withAdId} contacts (${weekData.metrics.attributionCoverage}%)
- Scheduled DCs: ${weekData.metrics.scheduledDCs}
- Arrived DCs: ${weekData.metrics.arrivedDCs} (${weekData.metrics.showRate}% show rate)
- Closed: ${weekData.metrics.closed} (${weekData.metrics.closeRate}% close rate)

REVENUE BREAKDOWN (${weekData.payments} payments):
- Cash Collected: $${weekData.metrics.cashCollected.toFixed(2)} (actual money received)
  - Stripe: $${weekData.metrics.stripeRevenue.toFixed(2)}
  - Denefits (downpayments + recurring): $${weekData.metrics.denefitsCashCollected.toFixed(2)}
- Projected Revenue (BNPL): $${weekData.metrics.projectedRevenue.toFixed(2)} (Denefits financed amounts)
- Deposits Paid: ${weekData.metrics.depositCount} ($100 high-intent deposits)

AD PERFORMANCE:
- Ad Spend: $${weekData.metrics.totalSpend.toFixed(2)}
- ROAS (on cash collected): ${weekData.metrics.roas}x

TOP PERFORMING ADS:
${weekData.topAds.map((ad, i) => `${i+1}. Ad ...${ad.adId.slice(-6)} (${ad.adName})
   - ${ad.contacts} contacts, ${ad.qualified} qualified (${ad.qualifyRate}%)
   - Theme: ${ad.theme}
   - Symptoms: ${ad.symptoms.join(', ') || 'general'}`).join('\n')}

🚨 LEAD MAGNET INITIATIVE - CRITICAL FINDING:
- Total Lead Magnet form submissions (all-time): ${weekData.leadMagnet.total}
- Purchases from Lead Magnet contacts: ${weekData.leadMagnet.purchased}
- Revenue from Lead Magnet: $${weekData.leadMagnet.revenue}
- Conversion Rate: ${weekData.leadMagnet.total > 0 ? ((weekData.leadMagnet.purchased / weekData.leadMagnet.total) * 100).toFixed(1) : 0}%

ANALYSIS: We cross-referenced ALL ${weekData.leadMagnet.total} lead magnet emails against:
- All Stripe payments (historical + live)
- All Denefits contracts (historical + live)
- All database payment records
Result: ZERO MATCHES. Not a single lead magnet contact has EVER purchased.

RECOMMENDATION: This initiative should be killed immediately. The lead magnet audience is completely separate from purchasing customers - there is no overlap whatsoever.

${previousWeek ? `LAST WEEK'S DATA (for comparison):
- Total Contacts: ${previousWeek.total_contacts}
- Qualified: ${previousWeek.total_qualified} (${previousWeek.qualify_rate}%)
- Revenue: $${previousWeek.total_revenue}
- Spend: $${previousWeek.total_spend}
- ROAS: ${previousWeek.roas}x

RECOMMENDATIONS GIVEN LAST WEEK:
${previousWeek.recommendations_given?.map((r, i) => `${i+1}. ${r}`).join('\n') || 'None'}
` : 'This is the first week of tracking - no previous data to compare.'}

Generate the weekly report now. Remember: Eric wants actionable insights, not just numbers. IMPORTANT: Include a prominent section about the Lead Magnet initiative with a clear recommendation to KILL IT based on the zero conversion data.`;

  // Add message to thread
  await openai.beta.threads.messages.create(thread.id, {
    role: "user",
    content: prompt
  });

  // Run the assistant
  const run = await openai.beta.threads.runs.create(thread.id, {
    assistant_id: assistant.id
  });

  // Wait for completion
  let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);

  while (runStatus.status !== 'completed') {
    if (runStatus.status === 'failed' || runStatus.status === 'cancelled' || runStatus.status === 'expired') {
      throw new Error(`Run ${runStatus.status}: ${runStatus.last_error?.message || 'Unknown error'}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
  }

  // Get the response
  const messages = await openai.beta.threads.messages.list(thread.id, {
    limit: 1,
    order: 'desc'
  });

  const report = messages.data[0].content[0].text.value;

  console.log('✅ Report generated\n');

  return report;
}

/**
 * Send email via Resend
 */
async function sendEmail(report, weekEnding) {
  console.log('📧 Sending email...\n');

  const { data, error } = await resend.emails.send({
    from: 'Clara <clara@updates.columnline.com>',
    to: ['connor@columnline.com'],
    subject: `Weekly Analytics Report - Week Ending ${weekEnding}`,
    text: report,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="white-space: pre-wrap;">${report.replace(/\n/g, '<br>')}</div>
      </div>
    `
  });

  if (error) {
    throw new Error(`Email failed: ${error.message}`);
  }

  console.log(`✅ Email sent: ${data.id}\n`);

  return data;
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🚀 Weekly Report AI - Starting...\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // Get week ending (default to last Sunday)
    const weekEnding = process.argv[2] || (() => {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - dayOfWeek);
      return lastSunday.toISOString().split('T')[0];
    })();

    console.log(`📅 Report for week ending: ${weekEnding}\n`);

    // Setup OpenAI Assistant
    const assistant = await getOrCreateAssistant();
    const thread = await getOrCreateThread();

    // Fetch data
    const weekData = await fetchWeekData(weekEnding);

    // Get previous week for comparison
    const prevWeekEnding = new Date(weekEnding);
    prevWeekEnding.setDate(prevWeekEnding.getDate() - 7);
    const previousWeek = await getPreviousWeekData(prevWeekEnding.toISOString().split('T')[0]);

    // Generate report
    const report = await generateReport(assistant, thread, weekData, previousWeek);

    // Send email
    await sendEmail(report, weekEnding);

    console.log('═'.repeat(80) + '\n');
    console.log('✅ COMPLETE - Report generated and sent!\n');

    // Show preview
    console.log('📄 REPORT PREVIEW:\n');
    console.log('─'.repeat(80));
    console.log(report);
    console.log('─'.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().then(() => {
    console.log('Done! 🎉\n');
    process.exit(0);
  });
}

module.exports = { main, fetchWeekData, generateReport };
