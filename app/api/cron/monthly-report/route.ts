/**
 * Vercel Cron Job - PPCU Monthly Report (4-Week Overview)
 *
 * Schedule: 1st of month at 9 AM EST (2 PM UTC)
 * Cron: 0 14 1 * *
 *
 * Includes CSV attachment with all active contacts for validation
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

// PPCU tenant (hardcoded for now - TODO: make multi-tenant)
const PPCU_TENANT_ID = '2cb58664-a84a-4d74-844a-4ccd49fcef5a';

const COLORS = { primary: '#2563eb', success: '#059669' };

// All report recipients
const REPORT_RECIPIENTS = [
  'eric@ppcareusa.com',
  'connor@columnline.com',
  'yulia@theadgirls.com',
  'hannah@theadgirls.com',
  'jennifer@theadgirls.com',
  'team@theadgirls.com',
  'courtney@theadgirls.com',
  'kristen@columnline.com'
];

function formatShortDate(dateStr: string) {
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

async function fetchWeekActivity(startDate: string, endDate: string) {
  const endDateTime = endDate + 'T23:59:59';
  const [leads, qualified, linkClicked, formSubmitted, meetingHeld, purchased, payments] = await Promise.all([
    supabase.from('contacts').select('id').eq('tenant_id', PPCU_TENANT_ID).neq('source', 'instagram_historical').gte('subscribe_date', startDate).lte('subscribe_date', endDateTime),
    supabase.from('contacts').select('id').eq('tenant_id', PPCU_TENANT_ID).neq('source', 'instagram_historical').gte('dm_qualified_date', startDate).lte('dm_qualified_date', endDateTime),
    supabase.from('contacts').select('id').eq('tenant_id', PPCU_TENANT_ID).neq('source', 'instagram_historical').gte('link_click_date', startDate).lte('link_click_date', endDateTime),
    supabase.from('contacts').select('id').eq('tenant_id', PPCU_TENANT_ID).neq('source', 'instagram_historical').gte('form_submit_date', startDate).lte('form_submit_date', endDateTime),
    supabase.from('contacts').select('id').eq('tenant_id', PPCU_TENANT_ID).neq('source', 'instagram_historical').gte('appointment_held_date', startDate).lte('appointment_held_date', endDateTime),
    supabase.from('contacts').select('id').eq('tenant_id', PPCU_TENANT_ID).neq('source', 'instagram_historical').gte('purchase_date', startDate).lte('purchase_date', endDateTime),
    supabase.from('payments').select('amount').eq('tenant_id', PPCU_TENANT_ID).gte('payment_date', startDate).lte('payment_date', endDateTime)
  ]);
  return {
    leads: leads.data?.length || 0,
    qualified: qualified.data?.length || 0,
    link_clicked: linkClicked.data?.length || 0,
    form_submitted: formSubmitted.data?.length || 0,
    meeting_held: meetingHeld.data?.length || 0,
    purchased: purchased.data?.length || 0,
    revenue: payments.data?.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0
  };
}

async function fetchAdSpend() {
  // Get actual 28-day spend (not 7-day estimate)
  const { data: latestSnapshot } = await supabase.from('meta_ad_insights').select('snapshot_date').eq('tenant_id', PPCU_TENANT_ID).order('snapshot_date', { ascending: false }).limit(1);
  if (!latestSnapshot?.length) return { spend7d: 0, spend28d: 0 };
  const { data: insights } = await supabase.from('meta_ad_insights').select('spend, spend_28d').eq('tenant_id', PPCU_TENANT_ID).eq('snapshot_date', latestSnapshot[0].snapshot_date);
  return {
    spend7d: insights?.reduce((sum, i) => sum + parseFloat(i.spend || '0'), 0) || 0,
    spend28d: insights?.reduce((sum, i) => sum + parseFloat(i.spend_28d || '0'), 0) || 0
  };
}

// Fetch active contacts for the full 4-week period
async function fetchActiveContacts(startDate: string, endDate: string) {
  const endDateTime = endDate + 'T23:59:59';

  const { data: contacts } = await supabase
    .from('contacts')
    .select('first_name, last_name, subscribe_date, dm_qualified_date, link_click_date, form_submit_date, appointment_held_date, purchase_date, q1_question, q2_question, objections, source, ad_id')
    .eq('tenant_id', PPCU_TENANT_ID)
    .neq('source', 'instagram_historical')
    .or(`subscribe_date.gte.${startDate},dm_qualified_date.gte.${startDate},link_click_date.gte.${startDate},form_submit_date.gte.${startDate},appointment_held_date.gte.${startDate},purchase_date.gte.${startDate}`)
    .or(`subscribe_date.lte.${endDateTime},dm_qualified_date.lte.${endDateTime},link_click_date.lte.${endDateTime},form_submit_date.lte.${endDateTime},appointment_held_date.lte.${endDateTime},purchase_date.lte.${endDateTime}`);

  return (contacts || []).filter(c => {
    const dates = [c.subscribe_date, c.dm_qualified_date, c.link_click_date, c.form_submit_date, c.appointment_held_date, c.purchase_date];
    return dates.some(d => d && d >= startDate && d <= endDateTime);
  });
}

// Generate CSV content
function generateCSV(contacts: any[]) {
  const headers = ['Name', 'Subscribe Date', 'Qualified Date', 'Link Click Date', 'Form Submit Date', 'Meeting Held Date', 'Purchase Date', 'Q1', 'Q2', 'Objections', 'Source', 'Ad ID'];

  const escapeCSV = (val: string) => {
    if (!val) return '';
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = contacts.map(c => [
    escapeCSV(`${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown'),
    c.subscribe_date ? new Date(c.subscribe_date).toLocaleDateString() : '',
    c.dm_qualified_date ? new Date(c.dm_qualified_date).toLocaleDateString() : '',
    c.link_click_date ? new Date(c.link_click_date).toLocaleDateString() : '',
    c.form_submit_date ? new Date(c.form_submit_date).toLocaleDateString() : '',
    c.appointment_held_date ? new Date(c.appointment_held_date).toLocaleDateString() : '',
    c.purchase_date ? new Date(c.purchase_date).toLocaleDateString() : '',
    escapeCSV(c.q1_question || ''),
    escapeCSV(c.q2_question || ''),
    escapeCSV(c.objections || ''),
    c.source || '',
    c.ad_id || ''
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

function generateRevenueChartUrl(weeks: { label: string; is_current: boolean }[], weekData: { revenue: number }[]) {
  const chartConfig = {
    type: 'bar',
    data: { labels: weeks.map(w => w.label), datasets: [{ label: 'Revenue', data: weekData.map(d => Math.round(d.revenue)), backgroundColor: weeks.map(w => w.is_current ? COLORS.primary : '#93c5fd') }] },
    options: { plugins: { title: { display: true, text: 'Weekly Revenue', font: { size: 14, weight: 'bold' } }, legend: { display: false }, datalabels: { display: true, anchor: 'end', align: 'end', formatter: (v: number) => '$' + v.toLocaleString() } }, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } }
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=550&h=220&bkg=white`;
}

function generateFunnelChartUrl(totals: { leads: number; qualified: number; link_clicked: number; form_submitted: number; meeting_held: number; purchased: number }) {
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
    data: { labels: stages.map(s => s.name), datasets: [{ data: stages.map(s => s.count), backgroundColor: ['#3b82f6', '#2563eb', '#0891b2', '#0d9488', '#059669', '#065f46'] }] },
    options: { plugins: { title: { display: true, text: '4-Week Funnel', font: { size: 14, weight: 'bold' } }, legend: { display: false }, datalabels: { display: true, anchor: 'end', align: 'end', font: { weight: 'bold' } } }, scales: { x: { beginAtZero: true }, y: { grid: { display: false } } } }
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=550&h=220&bkg=white`;
}

export async function GET(request: Request) {
  try {
    console.log('🚀 Monthly Report Cron');
    const url = new URL(request.url);
    const showIntro = url.searchParams.get('intro') === 'true';
    const testMode = url.searchParams.get('test') === 'true';
    const weeks = getTrailing4Weeks();

    const weekData = [];
    for (const week of weeks) {
      weekData.push(await fetchWeekActivity(week.start, week.end));
    }

    const totals = {
      leads: weekData.reduce((s, d) => s + d.leads, 0),
      qualified: weekData.reduce((s, d) => s + d.qualified, 0),
      link_clicked: weekData.reduce((s, d) => s + d.link_clicked, 0),
      form_submitted: weekData.reduce((s, d) => s + d.form_submitted, 0),
      meeting_held: weekData.reduce((s, d) => s + d.meeting_held, 0),
      purchased: weekData.reduce((s, d) => s + d.purchased, 0),
      revenue: weekData.reduce((s, d) => s + d.revenue, 0)
    };

    // Fetch ad spend and active contacts
    const [adSpend, activeContacts] = await Promise.all([
      fetchAdSpend(),
      fetchActiveContacts(weeks[0].start, weeks[3].end)
    ]);

    const monthlySpend = adSpend.spend28d; // Use actual 28-day spend
    const cpl = totals.leads > 0 ? monthlySpend / totals.leads : 0;
    const cpa = totals.purchased > 0 ? monthlySpend / totals.purchased : 0;
    const roas = monthlySpend > 0 ? totals.revenue / monthlySpend : 0;

    const revenueChartUrl = generateRevenueChartUrl(weeks, weekData);
    const funnelChartUrl = generateFunnelChartUrl(totals);

    // Generate CSV attachment
    const csvContent = generateCSV(activeContacts);
    const filename = `PPCU_Monthly_Data_${weeks[0].start}_to_${weeks[3].end}.csv`;

    // Test mode: only send to Connor
    const recipients = testMode ? ['connor@columnline.com'] : REPORT_RECIPIENTS;

    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Clara Analytics <connor@columnline.app>',
      to: recipients,
      subject: `${testMode ? '[TEST] ' : ''}PPCU Monthly: $${totals.revenue.toLocaleString()} Revenue | ${totals.purchased} Sales`,
      attachments: [
        {
          filename,
          content: Buffer.from(csvContent).toString('base64')
        }
      ],
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:16px;">
        <div style="background:#1f2937;padding:20px;border-radius:8px 8px 0 0;text-align:center;"><h1 style="color:white;margin:0;font-size:20px;">PPCU Monthly Report</h1><p style="color:#9ca3af;margin:4px 0 0 0;font-size:13px;">4-Week Overview: ${weeks[0].label} to ${weeks[3].label}</p></div>
        ${showIntro ? `<div style="background:#fef3c7;padding:16px;border-left:4px solid #f59e0b;"><p style="margin:0;font-size:14px;color:#92400e;"><strong>This report is now automated!</strong> You'll receive this monthly summary on the 1st of each month with a 4-week overview, revenue trends, and a CSV of all active contacts. Weekly reports arrive every Thursday at 5 PM EST.</p></div>` : ''}
        <div style="background:#eff6ff;padding:20px;"><table style="width:100%;"><tr><td style="text-align:center;padding:8px;"><div style="font-size:28px;font-weight:700;color:#1e40af;">${totals.leads.toLocaleString()}</div><div style="font-size:12px;color:#6b7280;">Total Leads</div></td><td style="text-align:center;padding:8px;"><div style="font-size:28px;font-weight:700;color:#1e40af;">${totals.purchased}</div><div style="font-size:12px;color:#6b7280;">Purchased</div></td><td style="text-align:center;padding:8px;"><div style="font-size:28px;font-weight:700;color:${COLORS.success};">$${totals.revenue.toLocaleString()}</div><div style="font-size:12px;color:#6b7280;">Revenue</div></td></tr></table></div>
        <div style="background:white;padding:16px;"><img src="${revenueChartUrl}" alt="Revenue" style="width:100%;height:auto;"/></div>
        <div style="background:white;padding:16px;border-top:1px solid #e5e7eb;"><img src="${funnelChartUrl}" alt="Funnel" style="width:100%;height:auto;"/></div>
        <div style="background:white;padding:16px;border-top:1px solid #e5e7eb;"><p style="margin:0 0 8px 0;font-weight:600;">Week-by-Week</p><table style="width:100%;font-size:11px;border-collapse:collapse;"><tr style="background:#f3f4f6;"><th style="padding:6px 4px;text-align:left;">Week</th><th style="padding:6px 4px;text-align:right;">Leads</th><th style="padding:6px 4px;text-align:right;">Qual</th><th style="padding:6px 4px;text-align:right;">Click</th><th style="padding:6px 4px;text-align:right;">Form</th><th style="padding:6px 4px;text-align:right;">Held</th><th style="padding:6px 4px;text-align:right;">Purch</th><th style="padding:6px 4px;text-align:right;">Rev</th></tr>${weeks.map((w, i) => `<tr style="border-bottom:1px solid #e5e7eb;${w.is_current ? 'background:#eff6ff;' : ''}"><td style="padding:6px 4px;font-size:10px;">${w.label}</td><td style="padding:6px 4px;text-align:right;">${weekData[i].leads}</td><td style="padding:6px 4px;text-align:right;">${weekData[i].qualified}</td><td style="padding:6px 4px;text-align:right;">${weekData[i].link_clicked}</td><td style="padding:6px 4px;text-align:right;">${weekData[i].form_submitted}</td><td style="padding:6px 4px;text-align:right;">${weekData[i].meeting_held}</td><td style="padding:6px 4px;text-align:right;">${weekData[i].purchased}</td><td style="padding:6px 4px;text-align:right;">$${weekData[i].revenue.toLocaleString()}</td></tr>`).join('')}<tr style="background:#f9fafb;font-weight:600;"><td style="padding:6px 4px;">Total</td><td style="padding:6px 4px;text-align:right;">${totals.leads}</td><td style="padding:6px 4px;text-align:right;">${totals.qualified}</td><td style="padding:6px 4px;text-align:right;">${totals.link_clicked}</td><td style="padding:6px 4px;text-align:right;">${totals.form_submitted}</td><td style="padding:6px 4px;text-align:right;">${totals.meeting_held}</td><td style="padding:6px 4px;text-align:right;">${totals.purchased}</td><td style="padding:6px 4px;text-align:right;">$${totals.revenue.toLocaleString()}</td></tr></table></div>
        <div style="background:#f3f4f6;padding:16px;"><p style="margin:0 0 12px 0;font-weight:600;">Ad Performance (28-Day)</p><table style="width:100%;font-size:13px;"><tr><td style="color:#6b7280;">Ad Spend</td><td style="text-align:right;font-weight:600;">$${monthlySpend.toLocaleString()}</td></tr><tr><td style="color:#6b7280;">CPL</td><td style="text-align:right;font-weight:600;">$${cpl.toFixed(2)}</td></tr><tr><td style="color:#6b7280;">CPA</td><td style="text-align:right;font-weight:600;">$${cpa.toFixed(2)}</td></tr><tr><td style="color:#6b7280;">ROAS</td><td style="text-align:right;font-weight:600;color:${roas >= 1 ? COLORS.success : '#dc2626'};">${roas.toFixed(2)}x</td></tr></table></div>
        <div style="background:white;padding:16px;border-top:1px solid #e5e7eb;"><p style="margin:0 0 8px 0;font-weight:600;">Conversion Rates</p><table style="width:100%;font-size:12px;"><tr><td style="color:#6b7280;">Lead → Qualified</td><td style="text-align:right;">${totals.leads > 0 ? Math.round(totals.qualified / totals.leads * 100) : 0}%</td></tr><tr><td style="color:#6b7280;">Qualified → Click</td><td style="text-align:right;">${totals.qualified > 0 ? Math.round(totals.link_clicked / totals.qualified * 100) : 0}%</td></tr><tr><td style="color:#6b7280;">Form → Held</td><td style="text-align:right;">${totals.form_submitted > 0 ? Math.round(totals.meeting_held / totals.form_submitted * 100) : 0}%</td></tr><tr><td style="color:#6b7280;"><strong>Lead → Purchase</strong></td><td style="text-align:right;font-weight:600;">${totals.leads > 0 ? (totals.purchased / totals.leads * 100).toFixed(1) : 0}%</td></tr></table></div>
        <div style="background:#eff6ff;padding:12px;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#1e40af;">📎 CSV file attached with ${activeContacts.length} active contacts</p></div>
        <div style="text-align:center;padding:12px;background:#1f2937;border-radius:0 0 8px 8px;"><span style="color:#6b7280;font-size:11px;">Clara Analytics</span></div>
      </div></body></html>`
    });

    if (error) {
      console.error('Email error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    console.log(`✅ Monthly report sent with ${activeContacts.length} contacts attached`);
    return NextResponse.json({ success: true, weeks: `${weeks[0].label} to ${weeks[3].label}`, contactsExported: activeContacts.length });
  } catch (err) {
    console.error('Cron error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
