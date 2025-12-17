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

async function fetchWeekActivity(startDate, endDate) {
  const endDateTime = endDate + 'T23:59:59';

  // Leads
  const { data: leads } = await supabase
    .from('contacts')
    .select('id, ad_id')
    .neq('source', 'instagram_historical')
    .gte('subscribe_date', startDate)
    .lte('subscribe_date', endDateTime);

  // Qualified
  const { data: qualified } = await supabase
    .from('contacts')
    .select('id')
    .neq('source', 'instagram_historical')
    .gte('dm_qualified_date', startDate)
    .lte('dm_qualified_date', endDateTime);

  // Link Clicked
  const { data: linkClicked } = await supabase
    .from('contacts')
    .select('id')
    .neq('source', 'instagram_historical')
    .gte('link_click_date', startDate)
    .lte('link_click_date', endDateTime);

  // Form Submitted
  const { data: formSubmitted } = await supabase
    .from('contacts')
    .select('id')
    .neq('source', 'instagram_historical')
    .gte('form_submit_date', startDate)
    .lte('form_submit_date', endDateTime);

  // Meeting Held
  const { data: meetingHeld } = await supabase
    .from('contacts')
    .select('id')
    .neq('source', 'instagram_historical')
    .gte('appointment_held_date', startDate)
    .lte('appointment_held_date', endDateTime);

  // Purchased
  const { data: purchased } = await supabase
    .from('contacts')
    .select('id')
    .neq('source', 'instagram_historical')
    .gte('purchase_date', startDate)
    .lte('purchase_date', endDateTime);

  // Revenue
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .gte('payment_date', startDate)
    .lte('payment_date', endDateTime);

  const revenue = payments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

  return {
    leads: leads?.length || 0,
    leads_with_ad: leads?.filter(l => l.ad_id).length || 0,
    qualified: qualified?.length || 0,
    link_clicked: linkClicked?.length || 0,
    form_submitted: formSubmitted?.length || 0,
    meeting_held: meetingHeld?.length || 0,
    purchased: purchased?.length || 0,
    revenue,
    payment_count: payments?.length || 0
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
  // Get ads with most calls (meetings held) this week (by ad_id count in contacts)
  const week = getThisWeek();

  const { data: contacts } = await supabase
    .from('contacts')
    .select('ad_id')
    .neq('source', 'instagram_historical')
    .not('ad_id', 'is', null)
    .gte('appointment_held_date', week.start)
    .lte('appointment_held_date', week.end + 'T23:59:59');

  // Count by ad_id
  const adCounts = {};
  for (const c of contacts || []) {
    adCounts[c.ad_id] = (adCounts[c.ad_id] || 0) + 1;
  }

  // Sort and get top
  const sorted = Object.entries(adCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  // Get ad names
  const topAds = [];
  for (const [adId, count] of sorted) {
    const { data: ad } = await supabase
      .from('meta_ads')
      .select('ad_name')
      .eq('ad_id', adId)
      .single();

    topAds.push({
      ad_id: adId,
      ad_name: ad?.ad_name || `Ad ${adId}`,
      calls: count
    });
  }

  return topAds;
}

function generateFunnelChartUrl(data) {
  const stages = [
    { name: 'Leads', count: data.leads },
    { name: 'Qualified', count: data.qualified },
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
        backgroundColor: ['#3b82f6', '#2563eb', '#0891b2', '#0d9488', '#059669', '#065f46']
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
          <div style="background: #eff6ff; padding: 16px; display: flex; justify-content: space-between;">
            <div style="text-align: center; flex: 1;">
              <div style="font-size: 24px; font-weight: 700; color: #1e40af;">${activity.leads}</div>
              <div style="font-size: 12px; color: #6b7280;">Leads</div>
            </div>
            <div style="text-align: center; flex: 1;">
              <div style="font-size: 24px; font-weight: 700; color: #1e40af;">${activity.purchased}</div>
              <div style="font-size: 12px; color: #6b7280;">Purchased</div>
            </div>
            <div style="text-align: center; flex: 1;">
              <div style="font-size: 24px; font-weight: 700; color: ${COLORS.success};">$${activity.revenue.toLocaleString()}</div>
              <div style="font-size: 12px; color: #6b7280;">Revenue</div>
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
