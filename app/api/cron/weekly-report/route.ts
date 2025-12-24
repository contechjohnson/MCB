/**
 * Vercel Cron Job - PPCU Weekly Report
 *
 * Simple activity-based weekly report:
 * - Funnel: Leads → Qualified → Link Clicked → Form Submit → Meeting Held → Purchased
 * - Ad metrics: Spend, CPL, CPA, ROAS
 * - Top performing ads
 * - CSV attachment with active contacts for validation
 *
 * Schedule: Every Thursday at 5 PM EST (10 PM UTC)
 * Cron: 0 22 * * 4
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { getTenantBySlug, getReportRecipients, getActiveTenants } from '@/lib/tenants/config';
import { main as syncMetaAds } from '@/execution/sync-meta-ads';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

const COLORS = { primary: '#2563eb', success: '#059669' };

function getThisWeek() {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    label: `${months[weekStart.getMonth()]} ${weekStart.getDate()}-${today.getDate()}`,
    start: weekStart.toISOString().split('T')[0],
    end: today.toISOString().split('T')[0]
  };
}

async function fetchWeekActivity(tenantId: string, startDate: string, endDate: string) {
  const endDateTime = endDate + 'T23:59:59';
  const [leads, qualified, linkClicked, formSubmitted, meetingHeld, purchased, payments] = await Promise.all([
    supabase.from('contacts').select('id, ad_id').eq('tenant_id', tenantId).neq('source', 'instagram_historical').gte('subscribe_date', startDate).lte('subscribe_date', endDateTime),
    supabase.from('contacts').select('id').eq('tenant_id', tenantId).neq('source', 'instagram_historical').gte('dm_qualified_date', startDate).lte('dm_qualified_date', endDateTime),
    supabase.from('contacts').select('id').eq('tenant_id', tenantId).neq('source', 'instagram_historical').gte('link_click_date', startDate).lte('link_click_date', endDateTime),
    supabase.from('contacts').select('id').eq('tenant_id', tenantId).neq('source', 'instagram_historical').gte('form_submit_date', startDate).lte('form_submit_date', endDateTime),
    supabase.from('contacts').select('id').eq('tenant_id', tenantId).neq('source', 'instagram_historical').gte('appointment_held_date', startDate).lte('appointment_held_date', endDateTime),
    supabase.from('contacts').select('id').eq('tenant_id', tenantId).neq('source', 'instagram_historical').gte('purchase_date', startDate).lte('purchase_date', endDateTime),
    supabase.from('payments').select('amount').eq('tenant_id', tenantId).gte('payment_date', startDate).lte('payment_date', endDateTime)
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

async function fetchAdSpend(tenantId: string) {
  const { data: latestSnapshot } = await supabase.from('meta_ad_insights').select('snapshot_date').eq('tenant_id', tenantId).order('snapshot_date', { ascending: false }).limit(1);
  if (!latestSnapshot?.length) return 0;
  const { data: insights } = await supabase.from('meta_ad_insights').select('spend').eq('tenant_id', tenantId).eq('snapshot_date', latestSnapshot[0].snapshot_date);
  return insights?.reduce((sum, i) => sum + parseFloat(i.spend || '0'), 0) || 0;
}

async function fetchTopAds(tenantId: string, startDate: string, endDate: string) {
  // Get contacts with meetings held (not just leads)
  const { data: contacts } = await supabase
    .from('contacts')
    .select('ad_id')
    .eq('tenant_id', tenantId)
    .neq('source', 'instagram_historical')
    .not('ad_id', 'is', null)
    .not('appointment_held_date', 'is', null)  // Only contacts with meetings held
    .gte('appointment_held_date', startDate)
    .lte('appointment_held_date', endDate + 'T23:59:59');

  const adCounts: Record<string, number> = {};
  for (const c of contacts || []) {
    if (c.ad_id) adCounts[c.ad_id] = (adCounts[c.ad_id] || 0) + 1;
  }
  const sorted = Object.entries(adCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topAds = [];
  for (const [adId, count] of sorted) {
    const { data: ad } = await supabase.from('meta_ads').select('ad_name').eq('tenant_id', tenantId).eq('ad_id', adId).single();
    let name = ad?.ad_name || `Ad ${adId}`;
    if (name.length > 40) name = name.substring(0, 37) + '...';
    topAds.push({ ad_name: name, meetings_held: count });
  }
  return topAds;
}

// Fetch active contacts (anyone with activity this week)
async function fetchActiveContacts(tenantId: string, startDate: string, endDate: string) {
  const endDateTime = endDate + 'T23:59:59';

  // Get all contacts with any activity in the date range
  const { data: contacts } = await supabase
    .from('contacts')
    .select('first_name, last_name, subscribe_date, dm_qualified_date, link_click_date, form_submit_date, appointment_held_date, purchase_date, q1_question, q2_question, objections, source, ad_id')
    .eq('tenant_id', tenantId)
    .neq('source', 'instagram_historical')
    .or(`subscribe_date.gte.${startDate},dm_qualified_date.gte.${startDate},link_click_date.gte.${startDate},form_submit_date.gte.${startDate},appointment_held_date.gte.${startDate},purchase_date.gte.${startDate}`)
    .or(`subscribe_date.lte.${endDateTime},dm_qualified_date.lte.${endDateTime},link_click_date.lte.${endDateTime},form_submit_date.lte.${endDateTime},appointment_held_date.lte.${endDateTime},purchase_date.lte.${endDateTime}`);

  // Filter to only those with activity in the week (at least one date in range)
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

function generateFunnelChartUrl(data: { leads: number; qualified: number; link_clicked: number; form_submitted: number; meeting_held: number; purchased: number }) {
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
    data: { labels: stages.map(s => s.name), datasets: [{ data: stages.map(s => s.count), backgroundColor: ['#3b82f6', '#2563eb', '#0891b2', '#0d9488', '#059669', '#065f46'] }] },
    options: { plugins: { legend: { display: false }, datalabels: { display: true, anchor: 'end', align: 'end', font: { weight: 'bold' } } }, scales: { x: { beginAtZero: true }, y: { grid: { display: false } } } }
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=550&h=220&bkg=white`;
}

export async function GET(request: Request) {
  try {
    console.log('🚀 Weekly Report Cron');
    const url = new URL(request.url);
    const showIntro = url.searchParams.get('intro') === 'true';
    const testMode = url.searchParams.get('test') === 'true';
    const tenantSlug = url.searchParams.get('tenant') || 'ppcu'; // Default to PPCU for backward compatibility
    const allTenants = url.searchParams.get('all') === 'true'; // Run for all active tenants

    // If all=true, run for all active tenants
    if (allTenants) {
      const tenants = await getActiveTenants();
      const results = [];

      for (const tenant of tenants) {
        try {
          const result = await generateWeeklyReport(tenant.id, tenant.slug, tenant.name, testMode, showIntro);
          results.push({ tenant: tenant.slug, ...result });
        } catch (err) {
          console.error(`Error generating report for ${tenant.slug}:`, err);
          results.push({ tenant: tenant.slug, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      return NextResponse.json({ success: true, reports: results });
    }

    // Single tenant mode
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: `Tenant '${tenantSlug}' not found` }, { status: 404 });
    }

    const result = await generateWeeklyReport(tenant.id, tenant.slug, tenant.name, testMode, showIntro);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Cron error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * Generate weekly report for a single tenant
 */
async function generateWeeklyReport(
  tenantId: string,
  tenantSlug: string,
  tenantName: string,
  testMode: boolean,
  showIntro: boolean
) {
  const week = getThisWeek();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) {
    throw new Error(`Tenant ${tenantSlug} not found`);
  }

  // Sync latest Meta Ads data before generating report
  console.log(`🔄 Syncing Meta Ads data for ${tenantSlug}...`);
  try {
    await syncMetaAds();
    console.log(`✅ Meta Ads sync complete for ${tenantSlug}`);
  } catch (error) {
    console.error(`⚠️  Meta Ads sync failed for ${tenantSlug}:`, error);
    // Continue with report generation even if sync fails
  }

    const [activity, adSpend, topAds, activeContacts] = await Promise.all([
      fetchWeekActivity(tenantId, week.start, week.end),
      fetchAdSpend(tenantId),
      fetchTopAds(tenantId, week.start, week.end),
      fetchActiveContacts(tenantId, week.start, week.end)
    ]);

    const cpl = activity.leads > 0 ? adSpend / activity.leads : 0;
    const cpa = activity.purchased > 0 ? adSpend / activity.purchased : 0;
    const roas = adSpend > 0 ? activity.revenue / adSpend : 0;
    const funnelChartUrl = generateFunnelChartUrl(activity);

    // Generate CSV attachment
    const csvContent = generateCSV(activeContacts);
    const filename = `${tenantSlug.toUpperCase()}_Weekly_Data_${week.start}_to_${week.end}.csv`;

    // Test mode: only send to Connor, otherwise use tenant's configured recipients
    const recipients = testMode ? ['connor@columnline.com'] : getReportRecipients(tenant);

    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Clara Analytics <connor@columnline.app>',
      to: recipients,
      subject: `${testMode ? '[TEST] ' : ''}${tenantName} Weekly: ${week.label} - $${activity.revenue.toLocaleString()} Revenue`,
      attachments: [
        {
          filename,
          content: Buffer.from(csvContent).toString('base64')
        }
      ],
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:16px;">
        <div style="background:#1f2937;padding:20px;border-radius:8px 8px 0 0;text-align:center;"><h1 style="color:white;margin:0;font-size:20px;">${tenantName} Weekly Report</h1><p style="color:#9ca3af;margin:4px 0 0 0;font-size:13px;">Week of ${week.label}</p></div>
        ${showIntro ? `<div style="background:#fef3c7;padding:16px;border-left:4px solid #f59e0b;"><p style="margin:0;font-size:14px;color:#92400e;"><strong>This report is now automated!</strong> You'll receive this weekly summary every Thursday at 5 PM EST with the latest funnel metrics, ad performance, and a CSV of all active contacts. Monthly reports arrive on the 1st of each month.</p></div>` : ''}
        <div style="background:#eff6ff;padding:16px;"><table style="width:100%;"><tr><td style="text-align:center;"><div style="font-size:24px;font-weight:700;color:#1e40af;">${activity.leads}</div><div style="font-size:12px;color:#6b7280;">Leads</div></td><td style="text-align:center;"><div style="font-size:24px;font-weight:700;color:#1e40af;">${activity.purchased}</div><div style="font-size:12px;color:#6b7280;">Purchased</div></td><td style="text-align:center;"><div style="font-size:24px;font-weight:700;color:${COLORS.success};">$${activity.revenue.toLocaleString()}</div><div style="font-size:12px;color:#6b7280;">Revenue</div></td></tr></table></div>
        <div style="background:white;padding:16px;"><p style="margin:0 0 8px 0;font-weight:600;">Funnel This Week</p><img src="${funnelChartUrl}" alt="Funnel" style="width:100%;height:auto;"/></div>
        <div style="background:#f3f4f6;padding:16px;"><p style="margin:0 0 12px 0;font-weight:600;">Ad Performance</p><table style="width:100%;font-size:13px;"><tr><td style="color:#6b7280;">Ad Spend</td><td style="text-align:right;font-weight:600;">$${adSpend.toLocaleString()}</td></tr><tr><td style="color:#6b7280;">CPL</td><td style="text-align:right;font-weight:600;">$${cpl.toFixed(2)}</td></tr><tr><td style="color:#6b7280;">CPA</td><td style="text-align:right;font-weight:600;">$${cpa.toFixed(2)}</td></tr><tr><td style="color:#6b7280;">ROAS</td><td style="text-align:right;font-weight:600;color:${roas >= 1 ? COLORS.success : '#dc2626'};">${roas.toFixed(2)}x</td></tr></table></div>
        <div style="background:white;padding:16px;"><p style="margin:0 0 8px 0;font-weight:600;">Top Ads</p>${topAds.length > 0 ? `<table style="width:100%;font-size:13px;border-collapse:collapse;">${topAds.map((ad, i) => `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:6px 0;">${i + 1}. ${ad.ad_name}</td><td style="text-align:right;padding:6px 0;font-weight:600;">${ad.meetings_held} meetings held</td></tr>`).join('')}</table>` : '<p style="color:#6b7280;">No attributed ads</p>'}</div>
        <div style="background:#eff6ff;padding:12px;text-align:center;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#1e40af;">📎 CSV file attached with ${activeContacts.length} active contacts</p></div>
        <div style="text-align:center;padding:12px;background:#1f2937;border-radius:0 0 8px 8px;"><span style="color:#6b7280;font-size:11px;">Clara Analytics</span></div>
      </div></body></html>`
    });

    if (error) {
      console.error('Email error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    console.log(`✅ Weekly report sent with ${activeContacts.length} contacts attached`);
    return NextResponse.json({ success: true, week: week.label, contactsExported: activeContacts.length });
  } catch (err) {
    console.error('Cron error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
