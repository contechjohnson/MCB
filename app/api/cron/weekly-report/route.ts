/**
 * Vercel Cron Job - PPCU Weekly Report
 *
 * Simple activity-based weekly report:
 * - Funnel: Leads → Qualified → Link Clicked → Form Submit → Meeting Held → Purchased
 * - Ad metrics: Spend, CPL, CPA, ROAS
 * - Top performing ads
 *
 * Schedule: Every Thursday at 5 PM EST (10 PM UTC)
 * Cron: 0 22 * * 4
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

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

async function fetchWeekActivity(startDate: string, endDate: string) {
  const endDateTime = endDate + 'T23:59:59';
  const [leads, qualified, linkClicked, formSubmitted, meetingHeld, purchased, payments] = await Promise.all([
    supabase.from('contacts').select('id, ad_id').neq('source', 'instagram_historical').gte('subscribe_date', startDate).lte('subscribe_date', endDateTime),
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
    revenue: payments.data?.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0
  };
}

async function fetchAdSpend() {
  const { data: latestSnapshot } = await supabase.from('meta_ad_insights').select('snapshot_date').order('snapshot_date', { ascending: false }).limit(1);
  if (!latestSnapshot?.length) return 0;
  const { data: insights } = await supabase.from('meta_ad_insights').select('spend').eq('snapshot_date', latestSnapshot[0].snapshot_date);
  return insights?.reduce((sum, i) => sum + parseFloat(i.spend || '0'), 0) || 0;
}

async function fetchTopAds(startDate: string, endDate: string) {
  const { data: contacts } = await supabase.from('contacts').select('ad_id').neq('source', 'instagram_historical').not('ad_id', 'is', null).gte('subscribe_date', startDate).lte('subscribe_date', endDate + 'T23:59:59');
  const adCounts: Record<string, number> = {};
  for (const c of contacts || []) { if (c.ad_id) adCounts[c.ad_id] = (adCounts[c.ad_id] || 0) + 1; }
  const sorted = Object.entries(adCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topAds = [];
  for (const [adId, count] of sorted) {
    const { data: ad } = await supabase.from('meta_ads').select('ad_name').eq('ad_id', adId).single();
    topAds.push({ ad_name: ad?.ad_name || `Ad ${adId}`, leads: count });
  }
  return topAds;
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

export async function GET() {
  try {
    console.log('🚀 Weekly Report Cron');
    const week = getThisWeek();
    const activity = await fetchWeekActivity(week.start, week.end);
    const adSpend = await fetchAdSpend();
    const topAds = await fetchTopAds(week.start, week.end);

    const cpl = activity.leads > 0 ? adSpend / activity.leads : 0;
    const cpa = activity.purchased > 0 ? adSpend / activity.purchased : 0;
    const roas = adSpend > 0 ? activity.revenue / adSpend : 0;
    const funnelChartUrl = generateFunnelChartUrl(activity);

    const { error } = await resend.emails.send({
      from: 'Clara Analytics <onboarding@resend.dev>',
      to: ['connor@columnline.com'],
      subject: `PPCU Weekly: ${week.label} - $${activity.revenue.toLocaleString()} Revenue`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:16px;">
        <div style="background:#1f2937;padding:20px;border-radius:8px 8px 0 0;text-align:center;"><h1 style="color:white;margin:0;font-size:20px;">PPCU Weekly Report</h1><p style="color:#9ca3af;margin:4px 0 0 0;font-size:13px;">Week of ${week.label}</p></div>
        <div style="background:#eff6ff;padding:16px;"><table style="width:100%;"><tr><td style="text-align:center;"><div style="font-size:24px;font-weight:700;color:#1e40af;">${activity.leads}</div><div style="font-size:12px;color:#6b7280;">Leads</div></td><td style="text-align:center;"><div style="font-size:24px;font-weight:700;color:#1e40af;">${activity.purchased}</div><div style="font-size:12px;color:#6b7280;">Purchased</div></td><td style="text-align:center;"><div style="font-size:24px;font-weight:700;color:${COLORS.success};">$${activity.revenue.toLocaleString()}</div><div style="font-size:12px;color:#6b7280;">Revenue</div></td></tr></table></div>
        <div style="background:white;padding:16px;"><p style="margin:0 0 8px 0;font-weight:600;">Funnel This Week</p><img src="${funnelChartUrl}" alt="Funnel" style="width:100%;height:auto;"/></div>
        <div style="background:#f3f4f6;padding:16px;"><p style="margin:0 0 12px 0;font-weight:600;">Ad Performance</p><table style="width:100%;font-size:13px;"><tr><td style="color:#6b7280;">Ad Spend</td><td style="text-align:right;font-weight:600;">$${adSpend.toLocaleString()}</td></tr><tr><td style="color:#6b7280;">CPL</td><td style="text-align:right;font-weight:600;">$${cpl.toFixed(2)}</td></tr><tr><td style="color:#6b7280;">CPA</td><td style="text-align:right;font-weight:600;">$${cpa.toFixed(2)}</td></tr><tr><td style="color:#6b7280;">ROAS</td><td style="text-align:right;font-weight:600;color:${roas >= 1 ? COLORS.success : '#dc2626'};">${roas.toFixed(2)}x</td></tr></table></div>
        <div style="background:white;padding:16px;"><p style="margin:0 0 8px 0;font-weight:600;">Top Ads</p>${topAds.length > 0 ? topAds.map((ad, i) => `<div style="padding:4px 0;">${i + 1}. ${ad.ad_name} - ${ad.leads} leads</div>`).join('') : '<p style="color:#6b7280;">No attributed ads</p>'}</div>
        <div style="text-align:center;padding:12px;background:#1f2937;border-radius:0 0 8px 8px;"><span style="color:#6b7280;font-size:11px;">Clara Analytics</span></div>
      </div></body></html>`
    });

    if (error) {
      console.error('Email error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    console.log('✅ Weekly report sent');
    return NextResponse.json({ success: true, week: week.label });
  } catch (err) {
    console.error('Cron error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
