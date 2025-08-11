import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getAbandonedCheckouts() {
  // Get hot abandoned leads
  const { data: hotLeads } = await supabase
    .from('hot_abandoned_leads')
    .select('*')
    .limit(50);

  // Get analytics
  const { data: analytics } = await supabase
    .from('abandonment_analytics')
    .select('*')
    .limit(7);

  // Get recent conversions
  const { data: conversions } = await supabase
    .from('abandoned_to_converted')
    .select('*')
    .limit(10);

  return { hotLeads, analytics, conversions };
}

export default async function AbandonedCheckoutsPage() {
  const { hotLeads, analytics, conversions } = await getAbandonedCheckouts();

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      expired: "outline",
      failed: "destructive",
      bnpl_rejected: "secondary",
      bnpl_pending: "default",
      converted: "default"
    };
    return <Badge variant={variants[status] || "outline"}>{status.replace('_', ' ')}</Badge>;
  };

  const getUrgencyColor = (hours: number) => {
    if (hours < 1) return 'text-red-600 font-bold'; // Less than 1 hour - HOT!
    if (hours < 24) return 'text-orange-600'; // Less than 24 hours - warm
    if (hours < 72) return 'text-yellow-600'; // Less than 3 days - cooling
    return 'text-gray-600'; // Older - cold
  };

  const formatTimeSince = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} minutes ago`;
    if (hours < 24) return `${Math.round(hours)} hours ago`;
    return `${Math.round(hours / 24)} days ago`;
  };

  // Calculate summary stats
  const todayStats = analytics?.[0];
  const totalAtRisk = analytics?.reduce((sum, day) => sum + (day.total_value_at_risk || 0), 0) || 0;
  const totalRecovered = analytics?.reduce((sum, day) => sum + (day.recovered_value || 0), 0) || 0;
  const avgRecoveryRate = analytics?.length 
    ? analytics.reduce((sum, day) => sum + (day.recovery_rate || 0), 0) / analytics.length
    : 0;

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-black">Abandoned Checkouts</h1>
          <p className="text-gray-600 mt-1">Hot leads who were ready to pay but didn't complete</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Today's Abandonments</CardDescription>
              <CardTitle className="text-2xl text-red-600">
                {todayStats?.total_abandonments || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Value at Risk (7d)</CardDescription>
              <CardTitle className="text-2xl">
                {formatAmount(totalAtRisk)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Recovered (7d)</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                {formatAmount(totalRecovered)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Recovery Rate</CardDescription>
              <CardTitle className="text-2xl">
                {avgRecoveryRate.toFixed(1)}%
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Hot Leads - Most Important Section */}
        <Card className="border-2 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">🔥 Hot Abandoned Leads - Follow Up NOW!</CardTitle>
            <CardDescription>
              These people entered payment info but didn't complete. They're your hottest leads!
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hotLeads || hotLeads.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No abandoned checkouts to follow up on</p>
            ) : (
              <div className="space-y-3">
                {hotLeads.map((lead: any) => (
                  <div key={lead.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold">
                            {lead.customer_name || 'Unknown'}
                          </p>
                          {getStatusBadge(lead.status)}
                          <span className={getUrgencyColor(lead.hours_since_abandoned)}>
                            {formatTimeSince(lead.hours_since_abandoned)}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-700">
                            📧 {lead.customer_email}
                          </p>
                          {lead.customer_phone && (
                            <p className="text-gray-700">
                              📱 {lead.customer_phone}
                            </p>
                          )}
                          {lead.matched_contact_id && (
                            <p className="text-gray-500">
                              Existing contact: {lead.first_name} {lead.last_name}
                              {lead.instagram_name && ` • IG: @${lead.instagram_name}`}
                            </p>
                          )}
                          <p className="text-gray-500">
                            Reason: {lead.abandonment_reason?.replace(/_/g, ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{formatAmount(lead.amount_attempted)}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {lead.payment_method_type}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recovery Success Stories */}
        {conversions && conversions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>✅ Recovery Success Stories</CardTitle>
              <CardDescription>Abandoned checkouts that converted after follow-up</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {conversions.map((conv: any) => (
                  <div key={conv.checkout_session_id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium">{conv.customer_name || conv.customer_email}</p>
                      <p className="text-sm text-gray-600">
                        Recovered after {Math.round(conv.hours_to_conversion)} hours
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatAmount(conv.amount_attempted)}</p>
                      <p className="text-xs text-gray-500">
                        {conv.initial_status} → converted
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Analytics */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Abandonment Trends</CardTitle>
            <CardDescription>Last 7 days of checkout abandonment data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm">
                    <th className="text-left py-2">Date</th>
                    <th className="text-center py-2">Total</th>
                    <th className="text-center py-2">Expired</th>
                    <th className="text-center py-2">Failed</th>
                    <th className="text-center py-2">BNPL Rejected</th>
                    <th className="text-center py-2">Recovered</th>
                    <th className="text-right py-2">At Risk</th>
                    <th className="text-center py-2">Recovery %</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics?.map((day: any) => (
                    <tr key={day.date} className="border-b hover:bg-gray-50">
                      <td className="py-2 text-sm">
                        {new Date(day.date).toLocaleDateString()}
                      </td>
                      <td className="text-center py-2">{day.total_abandonments}</td>
                      <td className="text-center py-2">{day.expired_checkouts}</td>
                      <td className="text-center py-2">{day.failed_payments}</td>
                      <td className="text-center py-2">{day.bnpl_rejections}</td>
                      <td className="text-center py-2 text-green-600 font-semibold">
                        {day.recovered_sales}
                      </td>
                      <td className="text-right py-2">
                        {formatAmount(day.total_value_at_risk)}
                      </td>
                      <td className="text-center py-2">
                        <span className={day.recovery_rate > 20 ? 'text-green-600 font-semibold' : ''}>
                          {day.recovery_rate?.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}