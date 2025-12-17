/**
 * Instagram Business API Integration
 *
 * Fetches content reach metrics (impressions, reach) for a given time period
 * using the Instagram Graph API.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface InstagramReachMetrics {
  impressions: number;
  reach: number;
}

/**
 * Fetch weekly Instagram reach metrics for a tenant
 *
 * @param tenantId - UUID of the tenant
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Object with impressions and reach totals
 */
export async function getWeeklyInstagramReach(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<InstagramReachMetrics> {
  try {
    // Get Instagram credentials from tenant_integrations
    const { data: integration, error: intError } = await supabaseAdmin
      .from('tenant_integrations')
      .select('credentials')
      .eq('tenant_id', tenantId)
      .eq('provider', 'instagram')
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      console.error('Failed to fetch Instagram integration:', intError);
      return { impressions: 0, reach: 0 };
    }

    const { access_token, business_account_id } = integration.credentials as {
      access_token: string;
      business_account_id: string;
    };

    if (!access_token || !business_account_id) {
      console.error('Missing Instagram credentials');
      return { impressions: 0, reach: 0 };
    }

    // Convert YYYY-MM-DD to Unix timestamp for Instagram API
    const sinceTimestamp = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000);
    const untilTimestamp = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000);

    // Call Instagram Graph API for insights
    const url = `https://graph.facebook.com/v18.0/${business_account_id}/insights`;
    const params = new URLSearchParams({
      metric: 'impressions,reach',
      period: 'day',
      since: sinceTimestamp.toString(),
      until: untilTimestamp.toString(),
      access_token,
    });

    const response = await fetch(`${url}?${params}`);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Instagram API error:', errorData);
      return { impressions: 0, reach: 0 };
    }

    const data = await response.json();

    if (!data.data || data.data.length < 2) {
      console.warn('Unexpected Instagram API response format:', data);
      return { impressions: 0, reach: 0 };
    }

    // Sum daily metrics across the time period
    const impressionsData = data.data.find((metric: any) => metric.name === 'impressions');
    const reachData = data.data.find((metric: any) => metric.name === 'reach');

    const impressions = impressionsData?.values?.reduce(
      (sum: number, v: any) => sum + (v.value || 0),
      0
    ) || 0;

    const reach = reachData?.values?.reduce(
      (sum: number, v: any) => sum + (v.value || 0),
      0
    ) || 0;

    return { impressions, reach };

  } catch (error) {
    console.error('Error fetching Instagram reach:', error);
    return { impressions: 0, reach: 0 };
  }
}
