/**
 * PPCU Weekly Report
 *
 * Single week snapshot with:
 * - Funnel: Leads → Qualified → Link Clicked → Form Submitted → Meeting Held → Purchased
 * - Revenue & ad spend
 * - Cost per lead, cost per acquisition
 * - Top performing ads this week
 *
 * Schedule: Every Thursday 5 PM EST (cron: 0 22 * * 4)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const COLORS = {
  primary: '#2563eb',
  success: '#059669',
  muted: '#6b7280'
};

function getThisWeek() {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const label = `${months[weekStart.getMonth()]} ${weekStart.getDate()}-${today.getDate()}`;

  return {
    label,
    start: weekStart.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0]
  };
}

/**
 * Count UNIQUE CONTACTS with a specific event type in date range
 * Uses funnel_events table as primary source
 * Returns distinct contact count, not total events
 */
async function countEventsByType(eventType, startDate, endDate, tenantId = null) {
  let query = supabase
    .from('funnel_events')
    .select('contact_id')
    .eq('event_type', eventType)
    .gte('event_timestamp', startDate)
    .lte('event_timestamp', endDate + 'T23:59:59');

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data } = await query;
  // Return UNIQUE contact count (not total events)
  const uniqueContacts = [...new Set(data?.map(e => e.contact_id) || [])];
  return uniqueContacts.length;
}

/**
 * Get unique contacts who had a specific event in date range
 */
async function getContactsWithEvent(eventType, startDate, endDate, tenantId = null) {
  let query = supabase
    .from('funnel_events')
    .select('contact_id')
    .eq('event_type', eventType)
    .gte('event_timestamp', startDate)
    .lte('event_timestamp', endDate + 'T23:59:59');

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data } = await query;
  // Return unique contact IDs
  const uniqueContacts = [...new Set(data?.map(e => e.contact_id) || [])];
  return uniqueContacts;
}

async function fetchWeekActivity(startDate, endDate) {
  const endDateTime = endDate + 'T23:59:59';

  // === FUNNEL METRICS (from funnel_events) ===

  // Leads (contact_subscribed or contact_created events)
  const subscribedCount = await countEventsByType('contact_subscribed', startDate, endDate);
  const createdCount = await countEventsByType('contact_created', startDate, endDate);
  const leads = subscribedCount + createdCount;

  // For ad attribution, we need to check contacts that were created this week
  const { data: newContacts } = await supabase
    .from('contacts')
    .select('id, ad_id')
    .neq('source', 'instagram_historical')
    .gte('created_at', startDate)
    .lte('created_at', endDateTime);

  const leads_with_ad = newContacts?.filter(c => c.ad_id).length || 0;

  // Funnel stages from funnel_events
  const qualified = await countEventsByType('dm_qualified', startDate, endDate);
  const link_clicked = await countEventsByType('link_clicked', startDate, endDate);
  const form_submitted = await countEventsByType('form_submitted', startDate, endDate);
  const meeting_held = await countEventsByType('appointment_held', startDate, endDate);

  // Purchase events (deposit_paid, purchase_completed, payment_plan_created)
  const deposits = await countEventsByType('deposit_paid', startDate, endDate);
  const fullPurchases = await countEventsByType('purchase_completed', startDate, endDate);
  const paymentPlans = await countEventsByType('payment_plan_created', startDate, endDate);
  const purchased = deposits + fullPurchases + paymentPlans;

  // === REVENUE METRICS (from payments table) ===
  //
  // Cash Collected = actual money in bank
  //   - Stripe full purchases
  //   - Stripe $100 deposits
  //   - Denefits downpayments
  //   - Denefits monthly installments
  //
  // Projected Revenue = total value from efforts this period
  //   - Stripe full purchases
  //   - Denefits contract value (new contracts only)

  // Stripe full purchases
  const { data: stripeFullPayments } = await supabase
    .from('payments')
    .select('amount')
    .eq('payment_source', 'stripe')
    .eq('payment_category', 'full_purchase')
    .gte('payment_date', startDate)
    .lte('payment_date', endDateTime);

  const stripeFullTotal = stripeFullPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

  // Stripe $100 deposits
  const { data: stripeDeposits } = await supabase
    .from('payments')
    .select('amount')
    .eq('payment_source', 'stripe')
    .eq('payment_category', 'deposit')
    .gte('payment_date', startDate)
    .lte('payment_date', endDateTime);

  const stripeDepositsTotal = stripeDeposits?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
  const stripeDepositsCount = stripeDeposits?.length || 0;

  // Total Stripe (for backward compatibility)
  const stripeTotal = stripeFullTotal + stripeDepositsTotal;

  // Denefits contracts (new BNPL contracts)
  const { data: denefitsContracts } = await supabase
    .from('payments')
    .select('amount, denefits_downpayment')
    .eq('payment_source', 'denefits')
    .eq('payment_category', 'payment_plan')
    .gte('payment_date', startDate)
    .lte('payment_date', endDateTime);

  const denefitsContractValue = denefitsContracts?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

  // Denefits downpayments (separate records with category='downpayment')
  const { data: denefitsDownpaymentRecords } = await supabase
    .from('payments')
    .select('amount')
    .eq('payment_source', 'denefits')
    .eq('payment_category', 'downpayment')
    .gte('payment_date', startDate)
    .lte('payment_date', endDateTime);

  const denefitsDownpayments = denefitsDownpaymentRecords?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

  // Denefits recurring payments (monthly installments toward existing contracts)
  const { data: denefitsRecurring } = await supabase
    .from('payments')
    .select('amount')
    .eq('payment_source', 'denefits')
    .eq('payment_category', 'recurring')
    .gte('payment_date', startDate)
    .lte('payment_date', endDateTime);

  const recurringPayments = denefitsRecurring?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
  const recurringCount = denefitsRecurring?.length || 0;

  // CASH COLLECTED = Stripe (full + deposits) + Denefits downpayments + recurring
  const cashCollected = stripeTotal + denefitsDownpayments + recurringPayments;

  // PROJECTED REVENUE = Stripe full purchases + Denefits contract value
  const projectedRevenue = stripeFullTotal + denefitsContractValue;

  // Total payments for count
  const { data: allPayments } = await supabase
    .from('payments')
    .select('id')
    .gte('payment_date', startDate)
    .lte('payment_date', endDateTime);

  // Link Sent (between qualified and link_clicked)
  const link_sent = await countEventsByType('link_sent', startDate, endDate);

  return {
    leads: leads || newContacts?.length || 0,
    leads_with_ad,
    qualified,
    link_sent,
    link_clicked,
    form_submitted,
    meeting_held,
    purchased,
    // Revenue breakdown
    cashCollected,            // Actual money in bank (Stripe full + deposits + BNPL down + recurring)
    projectedRevenue,         // Total value from efforts (Stripe full + BNPL contracts)
    stripeFullTotal,          // Stripe full purchases only
    stripeDepositsTotal,      // Stripe $100 deposits
    stripeDepositsCount,      // Count of $100 deposits
    stripeTotal,              // All Stripe (full + deposits)
    denefitsDownpayments,     // BNPL downpayments
    recurringPayments,        // BNPL recurring payments (monthly installments)
    recurringCount,
    // Total revenue = projected (value from this period's efforts)
    revenue: projectedRevenue,
    payment_count: allPayments?.length || 0
  };
}

async function fetchAdSpend() {
  // Get latest ad insights (last 7 days spend)
  const { data: insights } = await supabase
    .from('meta_ad_insights')
    .select('spend')
    .order('snapshot_date', { ascending: false })
    .limit(100);

  // Get unique snapshot_date to only count latest
  const { data: latestSnapshot } = await supabase
    .from('meta_ad_insights')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1);

  if (!latestSnapshot?.length) return { spend: 0, snapshot_date: null };

  const latestDate = latestSnapshot[0].snapshot_date;

  const { data: latestInsights } = await supabase
    .from('meta_ad_insights')
    .select('spend')
    .eq('snapshot_date', latestDate);

  const totalSpend = latestInsights?.reduce((sum, i) => sum + parseFloat(i.spend || 0), 0) || 0;

  return { spend: totalSpend, snapshot_date: latestDate };
}

async function fetchTopAds(limit = 3) {
  // Get ads with most calls (meetings held) this week
  // Uses funnel_events joined with contacts for ad_id
  const week = getThisWeek();

  // Get contacts who had appointment_held events this week
  const { data: events } = await supabase
    .from('funnel_events')
    .select('contact_id')
    .eq('event_type', 'appointment_held')
    .gte('event_timestamp', week.start)
    .lte('event_timestamp', week.end + 'T23:59:59');

  if (!events?.length) return [];

  // Get ad_ids for these contacts
  const contactIds = [...new Set(events.map(e => e.contact_id))];

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, ad_id')
    .in('id', contactIds)
    .not('ad_id', 'is', null);

  // Count by ad_id
  const adCounts = {};
  for (const c of contacts || []) {
    adCounts[c.ad_id] = (adCounts[c.ad_id] || 0) + 1;
  }

  // Filter out invalid ad_ids and sort by count
  const validAdCounts = Object.entries(adCounts)
    .filter(([adId]) => {
      // Skip template variables and non-numeric IDs
      if (adId.includes('{{') || adId.includes('}}')) return false;
      if (adId === 'link_in_bio' || adId === 'organic') return false;
      return true;
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Get ad names
  const topAds = [];
  for (const [adId, count] of validAdCounts) {
    const { data: ad } = await supabase
      .from('meta_ads')
      .select('ad_name')
      .eq('ad_id', adId)
      .single();

    // Use actual name, or show truncated ID if not found
    let displayName = ad?.ad_name;
    if (!displayName) {
      // Show last 6 digits for readability: "Ad #500065"
      // Note: Avoid "..." as Gmail may interpret it as quoted content
      displayName = adId.length > 10 ? `Ad #${adId.slice(-6)}` : `Ad ${adId}`;
    }

    topAds.push({
      ad_id: adId,
      ad_name: displayName,
      calls: count
    });
  }

  return topAds;
}

function generateFunnelChartUrl(data) {
  // Correct funnel order: Lead → Qualified → Link Sent → Link Clicked → Form → Meeting → Purchase
  const stages = [
    { name: 'Leads', count: data.leads },
    { name: 'DM Qualified', count: data.qualified },
    { name: 'Link Sent', count: data.link_sent || 0 },
    { name: 'Link Clicked', count: data.link_clicked },
    { name: 'Form Submit', count: data.form_submitted },
    { name: 'Meeting Held', count: data.meeting_held },
    { name: 'Purchased', count: data.purchased }
  ];

  const chartConfig = {
    type: 'horizontalBar',
    data: {
      labels: stages.map(s => s.name),
      datasets: [{
        data: stages.map(s => s.count),
        backgroundColor: ['#3b82f6', '#2563eb', '#1d4ed8', '#0891b2', '#0d9488', '#059669', '#065f46']
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        datalabels: { display: true, anchor: 'end', align: 'end', font: { weight: 'bold' } }
      },
      scales: {
        x: { beginAtZero: true },
        y: { grid: { display: false } }
      }
    }
  };

  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=550&h=220&bkg=white`;
}

async function main() {
  console.log('📊 PPCU Weekly Report\n');
  console.log('═'.repeat(60) + '\n');

  const week = getThisWeek();
  console.log(`Week: ${week.label} (${week.start} to ${week.end})\n`);

  // Fetch data
  console.log('Fetching activity...');
  const activity = await fetchWeekActivity(week.start, week.end);
  console.log(`  Leads: ${activity.leads}, Purchased: ${activity.purchased}, Revenue: $${activity.revenue.toLocaleString()}`);

  console.log('Fetching ad spend...');
  const adData = await fetchAdSpend();
  console.log(`  Ad Spend (7-day): $${adData.spend.toLocaleString()}`);

  console.log('Fetching top ads by calls...');
  const topAds = await fetchTopAds(3);
  console.log(`  Top ads: ${topAds.map(a => a.ad_name.substring(0, 20)).join(', ')}`);

  // Calculate metrics
  const cpl = activity.leads > 0 ? adData.spend / activity.leads : 0;
  const cpa = activity.purchased > 0 ? adData.spend / activity.purchased : 0;
  const roas = adData.spend > 0 ? activity.revenue / adData.spend : 0;

  // Generate chart
  console.log('Generating chart...');
  const funnelChartUrl = generateFunnelChartUrl(activity);

  // Send email
  console.log('Sending email...');

  const { data, error } = await resend.emails.send({
    from: 'Clara Analytics <onboarding@resend.dev>',
    to: ['connor@columnline.com'],
    subject: `PPCU Weekly: ${week.label} - $${activity.revenue.toLocaleString()} Revenue`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 16px;">

          <!-- Header -->
          <div style="background: #1f2937; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">PPCU Weekly Report</h1>
            <p style="color: #9ca3af; margin: 4px 0 0 0; font-size: 13px;">Week of ${week.label}</p>
          </div>

          <!-- Key Metrics -->
          <div style="background: #eff6ff; padding: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="text-align: center; padding: 12px; width: 33%;">
                  <div style="font-size: 32px; font-weight: 700; color: #1e40af;">${activity.leads}</div>
                  <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Leads</div>
                </td>
                <td style="text-align: center; padding: 12px; width: 33%;">
                  <div style="font-size: 32px; font-weight: 700; color: #1e40af;">${activity.meeting_held}</div>
                  <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Meetings Held</div>
                </td>
                <td style="text-align: center; padding: 12px; width: 33%;">
                  <div style="font-size: 32px; font-weight: 700; color: #1e40af;">${activity.purchased}</div>
                  <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Purchased</div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Revenue Breakdown -->
          <div style="background: #ecfdf5; padding: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="text-align: center; padding: 12px; width: 50%;">
                  <div style="font-size: 32px; font-weight: 700; color: ${COLORS.success};">$${activity.cashCollected.toLocaleString()}</div>
                  <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Cash Collected</div>
                </td>
                <td style="text-align: center; padding: 12px; width: 50%;">
                  <div style="font-size: 32px; font-weight: 700; color: #1e40af;">$${activity.projectedRevenue.toLocaleString()}</div>
                  <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Projected Revenue</div>
                </td>
              </tr>
            </table>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #d1fae5;">
              <table style="width: 100%; font-size: 12px; color: #6b7280;">
                <tr>
                  <td>Stripe: $${(activity.stripeFullTotal || 0).toLocaleString()}</td>
                  <td style="text-align: center;">$100 Deposits: $${(activity.stripeDepositsTotal || 0).toLocaleString()} (${activity.stripeDepositsCount || 0})</td>
                  <td style="text-align: right;">BNPL Recurring: $${(activity.recurringPayments || 0).toLocaleString()}</td>
                </tr>
              </table>
            </div>
          </div>

          <!-- Funnel Chart -->
          <div style="background: white; padding: 16px;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">Funnel This Week</p>
            <img src="${funnelChartUrl}" alt="Funnel" style="width: 100%; height: auto;" />
          </div>

          <!-- Ad Performance -->
          <div style="background: #f3f4f6; padding: 16px;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #1f2937;">Ad Performance</p>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 6px 0; color: #6b7280;">Ad Spend (7-day)</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">$${adData.spend.toLocaleString()}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 6px 0; color: #6b7280;">Cost per Lead</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">$${cpl.toFixed(2)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 6px 0; color: #6b7280;">Cost per Acquisition</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">$${cpa.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;">ROAS</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${roas >= 1 ? COLORS.success : '#dc2626'};">${roas.toFixed(2)}x</td>
              </tr>
            </table>
          </div>

          <!-- Top Ads -->
          <div style="background: white; padding: 16px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">Top Ads by Calls Booked</p>
            ${topAds.length > 0 ? `
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              ${topAds.map((ad, i) => `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 0;">${i + 1}. ${ad.ad_name}</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${ad.calls} calls</td>
              </tr>
              `).join('')}
            </table>
            ` : '<p style="color: #6b7280; font-size: 13px;">No attributed calls this week</p>'}
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding: 12px; background: #1f2937; border-radius: 0 0 8px 8px;">
            <span style="color: #6b7280; font-size: 11px;">Clara Analytics • ${new Date().toISOString().split('T')[0]}</span>
          </div>

        </div>
      </body>
      </html>
    `
  });

  if (error) {
    console.error('❌ Email error:', error);
    process.exit(1);
  }

  console.log('✅ Email sent! ID:', data?.id);
  console.log('\n' + '═'.repeat(60));
  console.log('📧 Weekly report sent to connor@columnline.com');
  console.log('═'.repeat(60) + '\n');
}

main().catch(console.error);
