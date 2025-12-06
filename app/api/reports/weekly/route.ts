/**
 * Weekly Analytics Report - Email Generation
 *
 * This endpoint:
 * 1. Fetches weekly data from database (full funnel stages)
 * 2. Uses OpenAI to generate a formatted report
 * 3. Sends email via Resend
 *
 * Can be triggered:
 * - Manually: GET /api/reports/weekly?send=true
 * - Via cron: POST /api/cron/weekly-report (every Thursday 5 PM EST)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

// System prompt for report generation
const REPORT_PROMPT = `You are Clara, the analytics system for Postpartum Care USA.

Your job: Write a weekly performance report for Eric (the business owner).

TONE & STYLE:
- Friendly, professional, conversational
- Data-driven, specific, actionable
- Celebrate wins, contextualize any drops
- Keep it concise - this is read on mobile

REPORT STRUCTURE:
1. **Hi Eric!** - 1-2 sentence summary of the week
2. **💰 Revenue This Week** - Total revenue, payment count, Stripe vs Denefits breakdown
3. **📊 Full Funnel** - Each stage with count and conversion % to next stage
4. **📈 Ad Performance** - Total spend, attributed spend, ROAS (both total and attributed), top ads
5. **✅ Action Items** - 2-3 specific things to do (be concrete)
6. **🎯 Bottom Line** - TL;DR in 1 sentence

FUNNEL STAGES (show all 9):
1. New Leads → 2. DM Qualified → 3. Link Sent → 4. Link Clicked → 5. Form Submitted → 6. Meeting Booked → 7. Meeting Held → 8. Package Sent → 9. Purchased

FORMATTING RULES:
- DO NOT use markdown tables - they render poorly in email
- Use simple lists instead of tables
- Use **bold** for key numbers
- Keep paragraphs 2-3 sentences max
- Each funnel stage on its own line with number and conversion %

Example funnel format:
- **New Leads:** 45
- **DM Qualified:** 32 (71% of leads)
- **Link Sent:** 28 (88% of qualified)
...etc

CONTEXT:
- Premium pricing: $2,700+ average order value
- Conversion timeline: ~28 days subscribe to purchase
- Attribution coverage varies by source

Generate the report based on the provided data.`;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shouldSend = searchParams.get('send') === 'true';
    const weekEnding = searchParams.get('week_ending') || getLastSunday();

    // Fetch weekly data
    const weeklyData = await fetchWeeklyData(weekEnding);

    // Generate report using OpenAI
    const report = await generateReport(weeklyData);

    // Send email if requested
    if (shouldSend) {
      await sendEmail(report, weekEnding);

      return NextResponse.json({
        success: true,
        message: 'Report generated and sent via Resend',
        week_ending: weekEnding,
        report_preview: report.substring(0, 200) + '...'
      });
    }

    // Otherwise just return the report
    return NextResponse.json({
      success: true,
      week_ending: weekEnding,
      report,
      data: weeklyData
    });

  } catch (error: any) {
    console.error('Error generating weekly report:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}

async function fetchWeeklyData(weekEnding: string) {
  // Calculate date range
  const endDate = new Date(weekEnding);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);

  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  // Fetch contacts for the week (excluding historical and lead magnet)
  const { data: contacts } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .neq('source', 'instagram_historical')
    .neq('source', 'instagram_lm')
    .gte('subscribe_date', startStr)
    .lte('subscribe_date', endStr);

  // Fetch payments for the week (from payments table for accuracy)
  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('*')
    .gte('payment_date', startStr)
    .lte('payment_date', endStr);

  // Fetch Meta ad spend - try week range first, fall back to most recent snapshot
  let { data: adInsights } = await supabaseAdmin
    .from('meta_ad_insights')
    .select('*')
    .gte('snapshot_date', startStr)
    .lte('snapshot_date', endStr);

  let spendDataNote = '';
  if (!adInsights || adInsights.length === 0) {
    // Fall back to most recent snapshot
    const { data: latestInsights } = await supabaseAdmin
      .from('meta_ad_insights')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(100);
    adInsights = latestInsights;
    if (latestInsights && latestInsights.length > 0) {
      spendDataNote = `(using latest data from ${latestInsights[0].snapshot_date})`;
    }
  }

  // Calculate full funnel metrics
  // Note: appointment_date = meeting booked, appointment_held_date = meeting held
  const totalContacts = contacts?.length || 0;
  const dmQualified = contacts?.filter(c => c.dm_qualified_date).length || 0;
  const linkSent = contacts?.filter(c => c.link_send_date).length || 0;
  const linkClicked = contacts?.filter(c => c.link_click_date).length || 0;
  const formSubmitted = contacts?.filter(c => c.form_submit_date).length || 0;
  const meetingsBooked = contacts?.filter(c => c.appointment_date).length || 0;
  const meetingsHeld = contacts?.filter(c => c.appointment_held_date).length || 0;
  const packageSent = contacts?.filter(c => c.package_sent_date).length || 0;
  const purchased = contacts?.filter(c => c.purchase_date).length || 0;

  // Calculate conversion rates between stages
  const calcRate = (num: number, denom: number) =>
    denom > 0 ? parseFloat((num / denom * 100).toFixed(1)) : 0;

  const conversionRates = {
    subscribe_to_dm_qualified: calcRate(dmQualified, totalContacts),
    dm_qualified_to_link_sent: calcRate(linkSent, dmQualified),
    link_sent_to_clicked: calcRate(linkClicked, linkSent),
    clicked_to_form: calcRate(formSubmitted, linkClicked),
    form_to_meeting_booked: calcRate(meetingsBooked, formSubmitted),
    meeting_booked_to_held: calcRate(meetingsHeld, meetingsBooked),
    meeting_held_to_package: calcRate(packageSent, meetingsHeld),
    package_to_purchased: calcRate(purchased, packageSent),
    overall: calcRate(purchased, totalContacts)
  };

  // Attribution coverage
  const withAdId = contacts?.filter(c => c.ad_id).length || 0;
  const attributionCoverage = calcRate(withAdId, totalContacts);

  // Revenue from payments table (more accurate)
  const paymentCount = payments?.length || 0;
  const totalRevenue = payments?.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0;
  const stripeRevenue = payments
    ?.filter(p => p.payment_source === 'stripe')
    .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0;
  const denefitsRevenue = payments
    ?.filter(p => p.payment_source === 'denefits')
    .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0;

  // Ad spend - TOTAL (all active ads)
  const totalSpend = adInsights?.reduce((sum, i) => sum + parseFloat(i.spend || '0'), 0) || 0;
  const totalRoas = totalSpend > 0 ? parseFloat((totalRevenue / totalSpend).toFixed(2)) : 0;

  // Ad spend - ATTRIBUTED (only ads that generated contacts this week)
  const contactAdIds = [...new Set((contacts || []).filter(c => c.ad_id).map(c => c.ad_id))];
  const attributedSpend = adInsights
    ?.filter(i => contactAdIds.includes(i.ad_id))
    .reduce((sum, i) => sum + parseFloat(i.spend || '0'), 0) || 0;
  const attributedRoas = attributedSpend > 0 ? parseFloat((totalRevenue / attributedSpend).toFixed(2)) : 0;

  // Ad ID freshness check - find ad_ids in contacts not in meta_ads
  const adIdFreshness = await checkAdIdFreshness(contacts || []);

  // Get top performing ads
  const topAds = await getTopPerformingAds(contacts || []);

  // Get previous week for comparison
  const comparison = await getPreviousWeekComparison(startDate, totalContacts, totalRevenue, purchased);

  return {
    week_ending: endStr,
    date_range: `${startStr} to ${endStr}`,
    funnel: {
      new_leads: totalContacts,
      dm_qualified: dmQualified,
      link_sent: linkSent,
      link_clicked: linkClicked,
      form_submitted: formSubmitted,
      meeting_booked: meetingsBooked,
      meeting_held: meetingsHeld,
      package_sent: packageSent,
      purchased: purchased
    },
    conversion_rates: conversionRates,
    revenue: {
      total: parseFloat(totalRevenue.toFixed(2)),
      payment_count: paymentCount,
      stripe: parseFloat(stripeRevenue.toFixed(2)),
      denefits: parseFloat(denefitsRevenue.toFixed(2))
    },
    ads: {
      total_spend: parseFloat(totalSpend.toFixed(2)),
      attributed_spend: parseFloat(attributedSpend.toFixed(2)),
      total_roas: totalRoas,
      attributed_roas: attributedRoas,
      attribution_coverage: attributionCoverage,
      attributed_ad_count: contactAdIds.length
    },
    ad_id_freshness: adIdFreshness,
    top_ads: topAds,
    comparison: comparison
  };
}

async function checkAdIdFreshness(contacts: any[]) {
  // Get unique ad_ids from contacts
  const adIds = [...new Set(contacts.filter(c => c.ad_id).map(c => c.ad_id))];

  if (adIds.length === 0) {
    return { total: 0, known: 0, orphan_count: 0 };
  }

  // Check which ones exist in meta_ads
  const { data: knownAds } = await supabaseAdmin
    .from('meta_ads')
    .select('ad_id')
    .in('ad_id', adIds);

  const knownAdIds = new Set(knownAds?.map(a => a.ad_id) || []);
  const orphanCount = adIds.filter(id => !knownAdIds.has(id)).length;

  return {
    total: adIds.length,
    known: knownAdIds.size,
    orphan_count: orphanCount
  };
}

async function getTopPerformingAds(contacts: any[]) {
  const adStats: Record<string, { contacts: number; qualified: number; purchased: number }> = {};

  contacts.forEach(c => {
    if (c.ad_id) {
      if (!adStats[c.ad_id]) {
        adStats[c.ad_id] = { contacts: 0, qualified: 0, purchased: 0 };
      }
      adStats[c.ad_id].contacts++;
      if (c.dm_qualified_date) adStats[c.ad_id].qualified++;
      if (c.purchase_date) adStats[c.ad_id].purchased++;
    }
  });

  const topAdIds = Object.entries(adStats)
    .sort((a, b) => b[1].contacts - a[1].contacts)
    .slice(0, 5)
    .map(([adId]) => adId);

  // Fetch ad details
  const topAds = await Promise.all(
    topAdIds.map(async (adId) => {
      const stats = adStats[adId];
      const qualifyRate = stats.contacts > 0
        ? parseFloat((stats.qualified / stats.contacts * 100).toFixed(1))
        : 0;

      const { data: adData } = await supabaseAdmin
        .from('meta_ads')
        .select('ad_name, spend')
        .eq('ad_id', adId)
        .single();

      const { data: creative } = await supabaseAdmin
        .from('meta_ad_creatives')
        .select('transformation_theme, symptom_focus, headline')
        .eq('ad_id', adId)
        .single();

      return {
        ad_id: adId,
        ad_name: adData?.ad_name || 'Unknown',
        contacts: stats.contacts,
        qualified: stats.qualified,
        purchased: stats.purchased,
        qualify_rate: qualifyRate,
        theme: creative?.transformation_theme || 'unknown',
        symptoms: creative?.symptom_focus || [],
        headline: creative?.headline || ''
      };
    })
  );

  return topAds;
}

async function getPreviousWeekComparison(currentWeekStart: Date, currentContacts: number, currentRevenue: number, currentPurchased: number) {
  const prevWeekEnd = new Date(currentWeekStart);
  const prevWeekStart = new Date(currentWeekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const prevStartStr = prevWeekStart.toISOString().split('T')[0];
  const prevEndStr = prevWeekEnd.toISOString().split('T')[0];

  const { data: prevContacts } = await supabaseAdmin
    .from('contacts')
    .select('subscribe_date, purchase_date, purchase_amount')
    .neq('source', 'instagram_historical')
    .neq('source', 'instagram_lm')
    .gte('subscribe_date', prevStartStr)
    .lt('subscribe_date', prevEndStr);

  const { data: prevPayments } = await supabaseAdmin
    .from('payments')
    .select('amount')
    .gte('payment_date', prevStartStr)
    .lt('payment_date', prevEndStr);

  const prevTotal = prevContacts?.length || 0;
  const prevRevenue = prevPayments?.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0;
  const prevPurchased = prevContacts?.filter(c => c.purchase_date).length || 0;

  const calcChange = (current: number, prev: number) => ({
    value: current - prev,
    pct: prev > 0 ? parseFloat(((current - prev) / prev * 100).toFixed(1)) : null
  });

  return {
    contacts: calcChange(currentContacts, prevTotal),
    revenue: calcChange(currentRevenue, prevRevenue),
    purchases: calcChange(currentPurchased, prevPurchased)
  };
}

async function generateReport(data: any): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: REPORT_PROMPT },
      {
        role: 'user',
        content: `Generate this week's report.\n\nWeek Ending: ${data.week_ending}\n\nData:\n${JSON.stringify(data, null, 2)}`
      }
    ],
    temperature: 0.7,
  });

  return completion.choices[0].message.content || 'Error generating report';
}

async function sendEmail(report: string, weekEnding: string) {
  // Convert markdown to HTML
  let htmlReport = report
    // First: Remove any markdown table separator rows (|---|---|)
    .replace(/^\|[\s\-:|]+\|$/gm, '')
    // Remove any remaining table-like rows if they sneak through
    .replace(/^\|[^|]+(\|[^|]+)+\|$/gm, (match) => {
      // Convert pipe-separated values to a simple list
      const cells = match.split('|').filter(c => c.trim());
      return cells.map(c => `• ${c.trim()}`).join('<br>');
    })
    // Headers
    .replace(/^# (.*?)$/gm, '<h1 style="color: #1f2937; margin-top: 24px; margin-bottom: 16px; font-size: 22px; border-bottom: 2px solid #667eea; padding-bottom: 8px;">$1</h1>')
    .replace(/^## (.*?)$/gm, '<h2 style="color: #374151; margin-top: 24px; margin-bottom: 12px; font-size: 18px; font-weight: 600;">$1</h2>')
    .replace(/^### (.*?)$/gm, '<h3 style="color: #4b5563; margin-top: 16px; margin-bottom: 8px; font-size: 16px; font-weight: 600;">$1</h3>')
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1f2937;">$1</strong>')
    // List items
    .replace(/^- (.*?)$/gm, '<li style="margin: 6px 0; padding-left: 4px;">$1</li>')
    .replace(/^• (.*?)$/gm, '<li style="margin: 6px 0; padding-left: 4px;">$1</li>')
    // Wrap consecutive list items in ul
    .replace(/(<li[^>]*>.*?<\/li>\s*)+/gs, '<ul style="margin: 12px 0; padding-left: 24px; list-style-type: disc;">$&</ul>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p style="margin: 14px 0; line-height: 1.7;">')
    .replace(/\n/g, '<br>');

  // Use Resend's default domain until updates.columnline.com is verified
  const { data, error } = await resend.emails.send({
    from: 'Clara <onboarding@resend.dev>',
    to: ['connor@columnline.com'],
    subject: `Weekly Analytics Report - Week Ending ${weekEnding}`,
    text: report,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 680px; margin: 0 auto; padding: 20px;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Weekly Analytics Report</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Week Ending ${weekEnding}</p>
          </div>

          <!-- Content -->
          <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="color: #374151; font-size: 15px; line-height: 1.7;">
              ${htmlReport}
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">Generated by Clara Analytics</p>
            <p style="margin: 4px 0 0 0;">Columnline | Postpartum Care USA</p>
          </div>
        </div>
      </body>
      </html>
    `
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error(`Email failed: ${error.message}`);
  }

  console.log('Email sent via Resend:', data?.id);
  return { id: data?.id };
}

function getLastSunday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek);
  return lastSunday.toISOString().split('T')[0];
}
