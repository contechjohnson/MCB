/**
 * Weekly Analytics Report - Email Generation
 *
 * This endpoint:
 * 1. Fetches weekly data from database
 * 2. Uses OpenAI to generate a formatted report
 * 3. Sends email via Resend
 *
 * Can be triggered:
 * - Manually: GET /api/reports/weekly?send=true
 * - Via cron: POST /api/cron/weekly-report
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import nodemailer from 'nodemailer';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// System prompt for report generation
const REPORT_PROMPT = `You are Clara, the analytics system for Manychatbot / Postpartum Care USA.

Your job: Write a weekly performance report for the business owner.

TONE & STYLE:
- Friendly but professional (like an expert colleague)
- Data-driven, not fluffy
- Specific recommendations only (actionable)
- Celebrate wins, contextualize drops
- Keep it concise

REPORT STRUCTURE:
1. **Hi Eric** - Quick intro (1-2 sentences)
2. **This Week's Numbers** - Key metrics with week-over-week changes
3. **Top Performing Ads** - Which ads are winning (with creative insights)
4. **What We're Learning** - Insights from data (patterns, themes)
5. **Action Items** - Specific things to do this week (2-5 items max)
6. **Bottom Line** - TL;DR summary

CONTEXT:
- System is live and collecting real data
- Attribution coverage is ~35% (Meta permission issues)
- Conversion timeline: ~28 days from subscribe to purchase
- Premium pricing: $2,700+ average order value

IMPORTANT RULES:
1. Always compare to last week when data exists
2. Call out what changed and WHY
3. Give specific recommendations ("Scale Ad X by 50%" not "Optimize ads")
4. Acknowledge the 30-day conversion window (don't expect instant ROI)
5. Focus on trends, not single data points

FORMATTING:
- Use markdown for structure
- Include tables for metrics
- Use emojis sparingly (only for section headers)
- Keep paragraphs short (2-3 sentences max)

Generate the weekly report based on the provided data.`;

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
        message: 'Report generated and sent',
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

  // Fetch contacts for the week
  const { data: contacts } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .neq('source', 'instagram_historical')
    .gte('created_at', startStr)
    .lte('created_at', endStr);

  // Fetch Meta ad spend
  const { data: adInsights } = await supabaseAdmin
    .from('meta_ad_insights')
    .select('*')
    .gte('snapshot_date', startStr)
    .lte('snapshot_date', endStr);

  // Calculate metrics
  const totalContacts = contacts?.length || 0;
  const dmQualified = contacts?.filter(c => c.dm_qualified_date).length || 0;
  const qualifyRate = totalContacts > 0
    ? parseFloat((dmQualified / totalContacts * 100).toFixed(1))
    : 0;

  const withAdId = contacts?.filter(c => c.ad_id).length || 0;
  const attributionCoverage = totalContacts > 0
    ? parseFloat((withAdId / totalContacts * 100).toFixed(1))
    : 0;

  const meetingsBooked = contacts?.filter(c => c.meeting_booked_date).length || 0;
  const meetingsHeld = contacts?.filter(c => c.meeting_held_date).length || 0;
  const showRate = meetingsBooked > 0
    ? parseFloat((meetingsHeld / meetingsBooked * 100).toFixed(1))
    : 0;

  const purchased = contacts?.filter(c => c.purchase_date && c.purchase_amount).length || 0;
  const closeRate = meetingsHeld > 0
    ? parseFloat((purchased / meetingsHeld * 100).toFixed(1))
    : 0;

  const totalRevenue = contacts
    ?.filter(c => c.purchase_amount)
    .reduce((sum, c) => sum + parseFloat(c.purchase_amount || '0'), 0) || 0;

  const totalSpend = adInsights?.reduce((sum, i) => sum + parseFloat(i.spend || '0'), 0) || 0;

  const roas = totalSpend > 0
    ? parseFloat((totalRevenue / totalSpend).toFixed(2))
    : 0;

  // Get top performing ads
  const adStats: Record<string, { contacts: number; qualified: number }> = {};

  contacts?.forEach(c => {
    if (c.ad_id) {
      if (!adStats[c.ad_id]) {
        adStats[c.ad_id] = { contacts: 0, qualified: 0 };
      }
      adStats[c.ad_id].contacts++;
      if (c.dm_qualified_date) adStats[c.ad_id].qualified++;
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
        ad_name: adData?.ad_name || 'Unknown',
        contacts: stats.contacts,
        qualified: stats.qualified,
        qualify_rate: qualifyRate,
        theme: creative?.transformation_theme || 'unknown',
        symptoms: creative?.symptom_focus || [],
        headline: creative?.headline || ''
      };
    })
  );

  // Get previous week for comparison
  const prevWeekEnding = new Date(endDate);
  prevWeekEnding.setDate(prevWeekEnding.getDate() - 7);
  const prevWeekStartStr = new Date(prevWeekEnding.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const prevWeekEndStr = prevWeekEnding.toISOString().split('T')[0];

  const { data: prevContacts } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .neq('source', 'instagram_historical')
    .gte('created_at', prevWeekStartStr)
    .lte('created_at', prevWeekEndStr);

  const prevTotalContacts = prevContacts?.length || 0;
  const prevRevenue = prevContacts
    ?.filter(c => c.purchase_amount)
    .reduce((sum, c) => sum + parseFloat(c.purchase_amount || '0'), 0) || 0;

  const contactsChange = totalContacts - prevTotalContacts;
  const contactsChangePct = prevTotalContacts > 0
    ? parseFloat(((totalContacts - prevTotalContacts) / prevTotalContacts * 100).toFixed(1))
    : null;

  const revenueChange = totalRevenue - prevRevenue;
  const revenueChangePct = prevRevenue > 0
    ? parseFloat(((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1))
    : null;

  return {
    week_ending: endStr,
    date_range: `${startStr} to ${endStr}`,
    metrics: {
      total_contacts: totalContacts,
      dm_qualified: dmQualified,
      qualify_rate: qualifyRate,
      attribution_coverage: attributionCoverage,
      meetings_booked: meetingsBooked,
      meetings_held: meetingsHeld,
      show_rate: showRate,
      purchased: purchased,
      close_rate: closeRate,
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      total_spend: parseFloat(totalSpend.toFixed(2)),
      roas: roas
    },
    top_ads: topAds,
    comparison: {
      contacts_change: contactsChange,
      contacts_change_pct: contactsChangePct,
      revenue_change: revenueChange,
      revenue_change_pct: revenueChangePct
    }
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
  const info = await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: 'connor@columnline.com',
    subject: `📊 Weekly Analytics Report - Week Ending ${weekEnding}`,
    text: report,
  });

  console.log('Email sent successfully:', info.messageId);
  return { id: info.messageId };
}

function getLastSunday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek);
  return lastSunday.toISOString().split('T')[0];
}
