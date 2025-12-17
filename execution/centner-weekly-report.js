/**
 * Centner Wellness Weekly Report
 *
 * Simplified weekly snapshot with:
 * - Content reach (Instagram impressions + reach)
 * - ManyChat leads
 * - Calls held
 * - Purchases
 * - Total revenue
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

const CENTNER_TENANT_ID = '4b8c38aa-969f-4fb6-846e-f59436bda9d4';

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

  // ManyChat Leads
  const { data: leads } = await supabase
    .from('contacts')
    .select('id')
    .eq('tenant_id', CENTNER_TENANT_ID)
    .gte('subscribe_date', startDate)
    .lte('subscribe_date', endDateTime);

  // Calls Held (prioritize held over scheduled)
  const { data: callsHeld } = await supabase
    .from('contacts')
    .select('id')
    .eq('tenant_id', CENTNER_TENANT_ID)
    .gte('appointment_held_date', startDate)
    .lte('appointment_held_date', endDateTime);

  // Purchases
  const { data: purchases } = await supabase
    .from('contacts')
    .select('id')
    .eq('tenant_id', CENTNER_TENANT_ID)
    .gte('purchase_date', startDate)
    .lte('purchase_date', endDateTime);

  // Revenue
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .eq('tenant_id', CENTNER_TENANT_ID)
    .gte('payment_date', startDate)
    .lte('payment_date', endDateTime);

  const revenue = payments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

  return {
    leads: leads?.length || 0,
    calls_held: callsHeld?.length || 0,
    purchases: purchases?.length || 0,
    revenue,
    payment_count: payments?.length || 0
  };
}

async function getWeeklyInstagramReach(startDate, endDate) {
  try {
    // Get Instagram credentials from tenant_integrations
    const { data: integration } = await supabase
      .from('tenant_integrations')
      .select('credentials')
      .eq('tenant_id', CENTNER_TENANT_ID)
      .eq('provider', 'instagram')
      .eq('is_active', true)
      .single();

    if (!integration) {
      console.warn('No Instagram integration found');
      return { impressions: 0, reach: 0 };
    }

    const { access_token, business_account_id } = integration.credentials;

    if (!access_token || !business_account_id) {
      console.warn('Missing Instagram credentials');
      return { impressions: 0, reach: 0 };
    }

    // Convert to Unix timestamps
    const sinceTimestamp = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000);
    const untilTimestamp = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000);

    // Call Instagram Graph API
    const url = `https://graph.facebook.com/v18.0/${business_account_id}/insights`;
    const params = new URLSearchParams({
      metric: 'impressions,reach',
      period: 'day',
      since: sinceTimestamp.toString(),
      until: untilTimestamp.toString(),
      access_token
    });

    const response = await fetch(`${url}?${params}`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Instagram API error:', errorData);
      return { impressions: 0, reach: 0 };
    }

    const data = await response.json();

    if (!data.data || data.data.length < 2) {
      console.warn('Unexpected Instagram API response');
      return { impressions: 0, reach: 0 };
    }

    // Sum daily metrics
    const impressionsData = data.data.find(metric => metric.name === 'impressions');
    const reachData = data.data.find(metric => metric.name === 'reach');

    const impressions = impressionsData?.values?.reduce((sum, v) => sum + (v.value || 0), 0) || 0;
    const reach = reachData?.values?.reduce((sum, v) => sum + (v.value || 0), 0) || 0;

    return { impressions, reach };

  } catch (error) {
    console.error('Error fetching Instagram reach:', error);
    return { impressions: 0, reach: 0 };
  }
}

function generateReportHTML(metrics, week) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 16px;">

        <!-- Header -->
        <div style="background: #1f2937; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 20px;">Centner Wellness Weekly Report</h1>
          <p style="color: #9ca3af; margin: 4px 0 0 0; font-size: 13px;">Week of ${week.label}</p>
        </div>

        <!-- Key Metrics -->
        <div style="background: white; padding: 20px;">
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 0; color: #6b7280;">Content Reach (Instagram)</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 16px;">${metrics.content_reach.toLocaleString()}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 0; color: #6b7280;">Content Impressions</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 16px;">${metrics.content_impressions.toLocaleString()}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 0; color: #6b7280;">ManyChat Leads</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 16px; color: ${COLORS.primary};">${metrics.leads}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 0; color: #6b7280;">Calls Held</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 16px; color: ${COLORS.primary};">${metrics.calls_held}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="padding: 12px 0; color: #6b7280;">Purchases</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 600; font-size: 16px; color: ${COLORS.success};">${metrics.purchases}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #6b7280; font-weight: 600;">Total Revenue</td>
              <td style="padding: 12px 0; text-align: right; font-weight: 700; font-size: 20px; color: ${COLORS.success};">$${metrics.revenue.toLocaleString()}</td>
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
  `;
}

async function main() {
  console.log('📊 Centner Wellness Weekly Report\\n');
  console.log('═'.repeat(60) + '\\n');

  const week = getThisWeek();
  console.log(`Week: ${week.label} (${week.start} to ${week.end})\\n`);

  // Fetch data
  console.log('Fetching activity...');
  const activity = await fetchWeekActivity(week.start, week.end);
  console.log(`  Leads: ${activity.leads}, Calls Held: ${activity.calls_held}, Purchases: ${activity.purchases}, Revenue: $${activity.revenue.toLocaleString()}`);

  console.log('Fetching Instagram reach...');
  const instagram = await getWeeklyInstagramReach(week.start, week.end);
  console.log(`  Impressions: ${instagram.impressions.toLocaleString()}, Reach: ${instagram.reach.toLocaleString()}`);

  const metrics = {
    ...activity,
    content_impressions: instagram.impressions,
    content_reach: instagram.reach
  };

  // Send email
  console.log('Sending email...');

  const { data, error } = await resend.emails.send({
    from: 'Clara Analytics <onboarding@resend.dev>',
    to: ['connor@columnline.com'],
    subject: `Centner Weekly: ${week.label} - $${metrics.revenue.toLocaleString()} Revenue`,
    html: generateReportHTML(metrics, week)
  });

  if (error) {
    console.error('❌ Email error:', error);
    process.exit(1);
  }

  console.log('✅ Email sent! ID:', data?.id);
  console.log('\\n' + '═'.repeat(60));
  console.log('📧 Weekly report sent to connor@columnline.com');
  console.log('═'.repeat(60) + '\\n');
}

main().catch(console.error);
