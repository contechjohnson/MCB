import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * Weekly Analytics Data API
 *
 * Returns formatted JSON for AI assistant to generate reports
 * Called by Make.com workflow every Monday
 */
export async function GET(request: NextRequest) {
  try {
    // Security: Verify cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get week_ending from query params (defaults to last Sunday)
    const { searchParams } = new URL(request.url);
    const weekEnding = searchParams.get('week_ending') || getLastSunday();

    // Calculate date range
    const endDate = new Date(weekEnding);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch contacts for the week
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .not('source', 'like', '%_historical%')
      .gte('subscribe_date', startStr)
      .lte('subscribe_date', endStr);

    if (contactsError) throw contactsError;

    // Fetch payments for the week
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .gte('payment_date', startStr)
      .lte('payment_date', endStr);

    if (paymentsError) throw paymentsError;

    // Fetch Meta ad spend
    const { data: adInsights, error: insightsError } = await supabaseAdmin
      .from('meta_ad_insights')
      .select('spend')
      .gte('snapshot_date', startStr)
      .lte('snapshot_date', endStr);

    if (insightsError) throw insightsError;

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

    const scheduledDCs = contacts?.filter(c => c.meeting_booked_date).length || 0;
    const arrivedDCs = contacts?.filter(c => c.meeting_held_date).length || 0;
    const showRate = scheduledDCs > 0
      ? parseFloat((arrivedDCs / scheduledDCs * 100).toFixed(1))
      : 0;

    const closed = contacts?.filter(c => c.purchase_amount && parseFloat(c.purchase_amount) > 0).length || 0;
    const closeRate = arrivedDCs > 0
      ? parseFloat((closed / arrivedDCs * 100).toFixed(1))
      : 0;

    const totalSpend = adInsights?.reduce((sum, i) => sum + parseFloat(i.spend || '0'), 0) || 0;

    const stripeRevenue = payments?.filter(p => p.payment_source === 'stripe')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;
    const denefitsRevenue = payments?.filter(p => p.payment_source === 'denefits')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;
    const totalRevenue = stripeRevenue + denefitsRevenue;

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

    // Fetch ad details and creative data
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
          .select('transformation_theme, symptom_focus, headline, primary_text')
          .eq('ad_id', adId)
          .single();

        return {
          ad_id: adId,
          ad_name: adData?.ad_name || 'Unknown',
          contacts: stats.contacts,
          qualified: stats.qualified,
          qualify_rate: qualifyRate,
          theme: creative?.transformation_theme || 'unknown',
          symptoms: creative?.symptom_focus || [],
          headline: creative?.headline || '',
          spend: parseFloat(adData?.spend || '0')
        };
      })
    );

    // Get previous week for comparison (if exists)
    const prevWeekEnding = new Date(endDate);
    prevWeekEnding.setDate(prevWeekEnding.getDate() - 7);
    const prevWeekStr = prevWeekEnding.toISOString().split('T')[0];

    const { data: previousWeek } = await supabaseAdmin
      .from('weekly_snapshots')
      .select('*')
      .eq('week_ending', prevWeekStr)
      .single();

    const comparison = previousWeek ? {
      previous_week_exists: true,
      contacts_change: totalContacts - previousWeek.total_contacts,
      contacts_change_pct: previousWeek.total_contacts > 0
        ? parseFloat(((totalContacts - previousWeek.total_contacts) / previousWeek.total_contacts * 100).toFixed(1))
        : null,
      revenue_change: totalRevenue - parseFloat(previousWeek.total_revenue || '0'),
      revenue_change_pct: previousWeek.total_revenue > 0
        ? parseFloat(((totalRevenue - parseFloat(previousWeek.total_revenue)) / parseFloat(previousWeek.total_revenue) * 100).toFixed(1))
        : null,
      roas_change: roas - parseFloat(previousWeek.roas || '0'),
      qualify_rate_change: qualifyRate - parseFloat(previousWeek.qualify_rate || '0'),
      recommendations_from_last_week: previousWeek.recommendations_given || []
    } : {
      previous_week_exists: false,
      contacts_change: null,
      contacts_change_pct: null,
      revenue_change: null,
      revenue_change_pct: null,
      roas_change: null,
      qualify_rate_change: null,
      recommendations_from_last_week: []
    };

    // Format response
    const response = {
      week_ending: endStr,
      date_range: `${startStr} to ${endStr}`,
      metrics: {
        total_contacts: totalContacts,
        dm_qualified: dmQualified,
        qualify_rate: qualifyRate,
        attribution_coverage: attributionCoverage,
        scheduled_dcs: scheduledDCs,
        arrived_dcs: arrivedDCs,
        show_rate: showRate,
        closed: closed,
        close_rate: closeRate,
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        total_spend: parseFloat(totalSpend.toFixed(2)),
        roas: roas
      },
      top_ads: topAds,
      payments: {
        count: payments?.length || 0,
        stripe_revenue: parseFloat(stripeRevenue.toFixed(2)),
        denefits_revenue: parseFloat(denefitsRevenue.toFixed(2)),
        total_revenue: parseFloat(totalRevenue.toFixed(2))
      },
      comparison
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching weekly data:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get last Sunday's date
 */
function getLastSunday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - dayOfWeek);
  return lastSunday.toISOString().split('T')[0];
}

/**
 * GET endpoint for testing (no auth required in dev)
 */
export async function HEAD(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Weekly analytics data API',
    usage: 'GET /api/reports/weekly-data?week_ending=2025-11-07',
    auth: 'Required: Authorization: Bearer CRON_SECRET'
  });
}
