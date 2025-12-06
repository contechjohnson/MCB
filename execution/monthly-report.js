/**
 * PPCU Monthly Report (4-Week Overview)
 *
 * Trailing 4 weeks with:
 * - Week-by-week breakdown
 * - Funnel: Leads → Qualified → Link Clicked → Form Submitted → Meeting Held → Purchased
 * - Revenue trend chart
 * - Ad spend, CPL, CPA, ROAS
 *
 * Schedule: 1st of each month at 9 AM EST (cron: 0 14 1 * *)
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

function formatShortDate(dateStr) {
  const date = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function getTrailing4Weeks() {
  const weeks = [];
  const today = new Date();

  for (let i = 0; i < 4; i++) {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - (i * 7));
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);

    weeks.push({
      label: `${formatShortDate(weekStart.toISOString().split('T')[0])}-${weekEnd.getDate()}`,
      start: weekStart.toISOString().split('T')[0],
      end: weekEnd.toISOString().split('T')[0],
      is_current: i === 0
    });
  }

  return weeks.reverse();
}

async function fetchWeekActivity(startDate, endDate) {
  const endDateTime = endDate + 'T23:59:59';

  const [leads, qualified, linkClicked, formSubmitted, meetingHeld, purchased, payments] = await Promise.all([
    supabase.from('contacts').select('id').neq('source', 'instagram_historical').gte('subscribe_date', startDate).lte('subscribe_date', endDateTime),
    supabase.from('contacts').select('id').neq('source', 'instagram_historical').gte('dm_qualified_date', startDate).lte('dm_qualified_date', endDateTime),
    supabase.from('contacts').select('id').neq('source', 'instagram_historical').gte('link_click_date', startDate).lte('link_click_date', endDateTime),
    supabase.from('contacts').select('id').neq('source', 'instagram_historical').gte('form_submit_date', startDate).lte('form_submit_date', endDateTime),
    supabase.from('contacts').select('id').neq('source', 'instagram_historical').gte('appointment_held_date', startDate).lte('appointment_held_date', endDateTime),
    supabase.from('contacts').select('id').neq('source', 'instagram_historical').gte('purchase_date', startDate).lte('purchase_date', endDateTime),
    supabase.from('payments').select('amount').gte('payment_date', startDate).lte('payment_date', endDateTime)
  ]);

  return {
    leads: leads.data?.length || 0,
    qualified: qualified.data?.length || 0,
    link_clicked: linkClicked.data?.length || 0,
    form_submitted: formSubmitted.data?.length || 0,
    meeting_held: meetingHeld.data?.length || 0,
    purchased: purchased.data?.length || 0,
    revenue: payments.data?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0
  };
}

async function fetchAdSpend() {
  const { data: latestSnapshot } = await supabase
    .from('meta_ad_insights')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1);

  if (!latestSnapshot?.length) return 0;

  const { data: insights } = await supabase
    .from('meta_ad_insights')
    .select('spend')
    .eq('snapshot_date', latestSnapshot[0].snapshot_date);

  return insights?.reduce((sum, i) => sum + parseFloat(i.spend || 0), 0) || 0;
}

function generateRevenueChartUrl(weeks, weekData) {
  const chartConfig = {
    type: 'bar',
    data: {
      labels: weeks.map(w => w.label),
      datasets: [{
        label: 'Revenue',
        data: weekData.map(d => Math.round(d.revenue)),
        backgroundColor: weeks.map(w => w.is_current ? COLORS.primary : '#93c5fd')
      }]
    },
    options: {
      plugins: {
        title: { display: true, text: 'Weekly Revenue', font: { size: 14, weight: 'bold' } },
        legend: { display: false },
        datalabels: { display: true, anchor: 'end', align: 'end', formatter: (v) => '$' + v.toLocaleString() }
      },
      scales: {
        y: { beginAtZero: true },
        x: { grid: { display: false } }
      }
    }
  };

  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=550&h=220&bkg=white`;
}

function generateFunnelChartUrl(totals) {
  const stages = [
    { name: 'Leads', count: totals.leads },
    { name: 'Qualified', count: totals.qualified },
    { name: 'Link Clicked', count: totals.link_clicked },
    { name: 'Form Submit', count: totals.form_submitted },
    { name: 'Meeting Held', count: totals.meeting_held },
    { name: 'Purchased', count: totals.purchased }
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
        title: { display: true, text: '4-Week Funnel', font: { size: 14, weight: 'bold' } },
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
  console.log('📊 PPCU Monthly Report (4-Week Overview)\n');
  console.log('═'.repeat(60) + '\n');

  const weeks = getTrailing4Weeks();
  console.log('Weeks:');
  weeks.forEach(w => console.log(`  ${w.label}${w.is_current ? ' ← This Week' : ''}`));
  console.log();

  // Fetch data for each week
  console.log('Fetching activity data...');
  const weekData = [];
  for (const week of weeks) {
    const data = await fetchWeekActivity(week.start, week.end);
    weekData.push(data);
    console.log(`  ${week.label}: ${data.leads} leads, ${data.purchased} purchased, $${data.revenue.toLocaleString()}`);
  }

  // Totals
  const totals = {
    leads: weekData.reduce((s, d) => s + d.leads, 0),
    qualified: weekData.reduce((s, d) => s + d.qualified, 0),
    link_clicked: weekData.reduce((s, d) => s + d.link_clicked, 0),
    form_submitted: weekData.reduce((s, d) => s + d.form_submitted, 0),
    meeting_held: weekData.reduce((s, d) => s + d.meeting_held, 0),
    purchased: weekData.reduce((s, d) => s + d.purchased, 0),
    revenue: weekData.reduce((s, d) => s + d.revenue, 0)
  };

  console.log(`\nTotals: ${totals.leads} leads, ${totals.purchased} purchased, $${totals.revenue.toLocaleString()}`);

  // Ad spend
  console.log('Fetching ad spend...');
  const weeklySpend = await fetchAdSpend();
  const monthlySpend = weeklySpend * 4; // Estimate (7-day spend * 4)
  console.log(`  Estimated 4-week spend: $${monthlySpend.toLocaleString()}`);

  // Calculate metrics
  const cpl = totals.leads > 0 ? monthlySpend / totals.leads : 0;
  const cpa = totals.purchased > 0 ? monthlySpend / totals.purchased : 0;
  const roas = monthlySpend > 0 ? totals.revenue / monthlySpend : 0;

  // Generate charts
  console.log('Generating charts...');
  const revenueChartUrl = generateRevenueChartUrl(weeks, weekData);
  const funnelChartUrl = generateFunnelChartUrl(totals);

  // Send email
  console.log('Sending email...');

  const { data, error } = await resend.emails.send({
    from: 'Clara Analytics <onboarding@resend.dev>',
    to: ['connor@columnline.com'],
    subject: `PPCU Monthly: $${totals.revenue.toLocaleString()} Revenue | ${totals.purchased} Sales`,
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 16px;">

          <!-- Header -->
          <div style="background: #1f2937; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">PPCU Monthly Report</h1>
            <p style="color: #9ca3af; margin: 4px 0 0 0; font-size: 13px;">4-Week Overview: ${weeks[0].label} to ${weeks[3].label}</p>
          </div>

          <!-- Key Metrics -->
          <div style="background: #eff6ff; padding: 20px;">
            <table style="width: 100%;">
              <tr>
                <td style="text-align: center; padding: 8px;">
                  <div style="font-size: 28px; font-weight: 700; color: #1e40af;">${totals.leads.toLocaleString()}</div>
                  <div style="font-size: 12px; color: #6b7280;">Total Leads</div>
                </td>
                <td style="text-align: center; padding: 8px;">
                  <div style="font-size: 28px; font-weight: 700; color: #1e40af;">${totals.purchased}</div>
                  <div style="font-size: 12px; color: #6b7280;">Purchased</div>
                </td>
                <td style="text-align: center; padding: 8px;">
                  <div style="font-size: 28px; font-weight: 700; color: ${COLORS.success};">$${totals.revenue.toLocaleString()}</div>
                  <div style="font-size: 12px; color: #6b7280;">Revenue</div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Revenue Chart -->
          <div style="background: white; padding: 16px;">
            <img src="${revenueChartUrl}" alt="Revenue Trend" style="width: 100%; height: auto;" />
          </div>

          <!-- Funnel Chart -->
          <div style="background: white; padding: 16px; border-top: 1px solid #e5e7eb;">
            <img src="${funnelChartUrl}" alt="Funnel" style="width: 100%; height: auto;" />
          </div>

          <!-- Week by Week Table -->
          <div style="background: white; padding: 16px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">Week-by-Week Breakdown</p>
            <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
              <tr style="background: #f3f4f6;">
                <th style="padding: 6px 4px; text-align: left;">Week</th>
                <th style="padding: 6px 4px; text-align: right;">Leads</th>
                <th style="padding: 6px 4px; text-align: right;">Qual</th>
                <th style="padding: 6px 4px; text-align: right;">Click</th>
                <th style="padding: 6px 4px; text-align: right;">Form</th>
                <th style="padding: 6px 4px; text-align: right;">Held</th>
                <th style="padding: 6px 4px; text-align: right;">Purch</th>
                <th style="padding: 6px 4px; text-align: right;">Rev</th>
              </tr>
              ${weeks.map((w, i) => `
              <tr style="border-bottom: 1px solid #e5e7eb; ${w.is_current ? 'background: #eff6ff;' : ''}">
                <td style="padding: 6px 4px; font-size: 10px;">${w.label}</td>
                <td style="padding: 6px 4px; text-align: right;">${weekData[i].leads}</td>
                <td style="padding: 6px 4px; text-align: right;">${weekData[i].qualified}</td>
                <td style="padding: 6px 4px; text-align: right;">${weekData[i].link_clicked}</td>
                <td style="padding: 6px 4px; text-align: right;">${weekData[i].form_submitted}</td>
                <td style="padding: 6px 4px; text-align: right;">${weekData[i].meeting_held}</td>
                <td style="padding: 6px 4px; text-align: right;">${weekData[i].purchased}</td>
                <td style="padding: 6px 4px; text-align: right;">$${weekData[i].revenue.toLocaleString()}</td>
              </tr>
              `).join('')}
              <tr style="background: #f9fafb; font-weight: 600;">
                <td style="padding: 6px 4px;">Total</td>
                <td style="padding: 6px 4px; text-align: right;">${totals.leads}</td>
                <td style="padding: 6px 4px; text-align: right;">${totals.qualified}</td>
                <td style="padding: 6px 4px; text-align: right;">${totals.link_clicked}</td>
                <td style="padding: 6px 4px; text-align: right;">${totals.form_submitted}</td>
                <td style="padding: 6px 4px; text-align: right;">${totals.meeting_held}</td>
                <td style="padding: 6px 4px; text-align: right;">${totals.purchased}</td>
                <td style="padding: 6px 4px; text-align: right;">$${totals.revenue.toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <!-- Ad Performance -->
          <div style="background: #f3f4f6; padding: 16px;">
            <p style="margin: 0 0 12px 0; font-weight: 600; color: #1f2937;">Ad Performance (4-Week Estimate)</p>
            <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 6px 0; color: #6b7280;">Est. Ad Spend</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">$${monthlySpend.toLocaleString()}</td>
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

          <!-- Conversion Rates -->
          <div style="background: white; padding: 16px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">Conversion Rates</p>
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 6px 0; color: #6b7280;">Lead → Qualified</td>
                <td style="padding: 6px 0; text-align: right;">${totals.leads > 0 ? Math.round(totals.qualified / totals.leads * 100) : 0}%</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 6px 0; color: #6b7280;">Qualified → Link Clicked</td>
                <td style="padding: 6px 0; text-align: right;">${totals.qualified > 0 ? Math.round(totals.link_clicked / totals.qualified * 100) : 0}%</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 6px 0; color: #6b7280;">Form → Meeting Held</td>
                <td style="padding: 6px 0; text-align: right;">${totals.form_submitted > 0 ? Math.round(totals.meeting_held / totals.form_submitted * 100) : 0}%</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #6b7280;"><strong>Lead → Purchase</strong></td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">${totals.leads > 0 ? (totals.purchased / totals.leads * 100).toFixed(1) : 0}%</td>
              </tr>
            </table>
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
  console.log('📧 Monthly report sent to connor@columnline.com');
  console.log('═'.repeat(60) + '\n');
}

main().catch(console.error);
