import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getStripeLogs() {
  // Get recent logs
  const { data: logs } = await supabase
    .from('stripe_webhook_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  // Get orphaned payments
  const { data: orphaned } = await supabase
    .from('orphaned_payments')
    .select('*')
    .limit(10);

  // Get payment analytics
  const { data: analytics } = await supabase
    .from('payment_analytics')
    .select('*')
    .limit(30);

  return { logs, orphaned, analytics };
}

export default async function StripeLogsPage() {
  const { logs, orphaned, analytics } = await getStripeLogs();

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      matched: "default",
      orphaned: "destructive",
      refunded: "secondary",
      failed: "outline"
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-black">Stripe Event Logs</h1>
          <p className="text-gray-600 mt-1">Monitor payment events and match rates</p>
        </div>

        {/* Summary Stats */}
        {analytics && analytics.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Today's Payments</CardDescription>
                <CardTitle className="text-2xl">
                  {analytics[0]?.total_payments || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Matched</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  {analytics[0]?.matched_payments || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Orphaned</CardDescription>
                <CardTitle className="text-2xl text-red-600">
                  {analytics[0]?.orphaned_payments || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Match Rate</CardDescription>
                <CardTitle className="text-2xl">
                  {analytics[0]?.total_payments > 0
                    ? Math.round((analytics[0].matched_payments / analytics[0].total_payments) * 100)
                    : 0}%
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {/* Orphaned Payments Alert */}
        {orphaned && orphaned.length > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">⚠️ Orphaned Payments</CardTitle>
              <CardDescription>Payments that couldn't be matched to contacts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {orphaned.map((payment: any) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium">{payment.customer_name || payment.customer_email || 'Unknown'}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatAmount(payment.amount)}</p>
                      <p className="text-xs text-gray-500">{payment.event_id}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Events */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Stripe Events</CardTitle>
            <CardDescription>Last 50 webhook events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Time</th>
                    <th className="text-left py-2">Event</th>
                    <th className="text-left py-2">Customer</th>
                    <th className="text-right py-2">Amount</th>
                    <th className="text-center py-2">Status</th>
                    <th className="text-center py-2">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {logs?.map((log: any) => (
                    <tr key={log.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 text-sm">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 text-sm">
                        {log.event_type.replace('_', ' ')}
                      </td>
                      <td className="py-2 text-sm">
                        <div>
                          <p>{log.customer_name || log.customer_email || 'Unknown'}</p>
                          {log.matched_contact_id && (
                            <p className="text-xs text-gray-500">→ {log.matched_contact_id}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-2 text-sm text-right">
                        {formatAmount(log.amount || 0)}
                      </td>
                      <td className="py-2 text-center">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="py-2 text-sm text-center">
                        {log.match_confidence > 0 && `${log.match_confidence}%`}
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