import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface CycleMetrics {
  avgDaysToFirstPurchase: number | null;
  avgDaysFirstToPackage: number | null;
  avgDaysLastContactToPackage: number | null;
  avgDaysEngaged: number | null;
  medianDaysToFirstPurchase: number | null;
  medianDaysFirstToPackage: number | null;
  totalSubscriptions: number;
  totalFirstPurchases: number;
  totalPackagePurchases: number;
  firstPurchaseRate: number;
  packagePurchaseRate: number;
}

interface CycleMetricsCardProps {
  metrics: CycleMetrics;
}

export function CycleMetricsCard({ metrics }: CycleMetricsCardProps) {
  const formatDays = (days: number | null) => {
    if (days === null) return 'N/A';
    if (days < 1) return '<1 day';
    if (days === 1) return '1 day';
    return `${Math.round(days)} days`;
  };

  const formatPercent = (percent: number | null) => {
    if (percent === null) return 'N/A';
    return `${percent.toFixed(1)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Journey Cycle Times</CardTitle>
        <CardDescription>Average time between key milestones</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Primary Metrics */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Conversion Times</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Subscription → First Purchase</p>
                <p className="text-lg font-bold text-gray-900">{formatDays(metrics.avgDaysToFirstPurchase)}</p>
                <p className="text-xs text-gray-400">Median: {formatDays(metrics.medianDaysToFirstPurchase)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">First → Package Purchase</p>
                <p className="text-lg font-bold text-gray-900">{formatDays(metrics.avgDaysFirstToPackage)}</p>
                <p className="text-xs text-gray-400">Median: {formatDays(metrics.medianDaysFirstToPackage)}</p>
              </div>
            </div>
          </div>

          {/* Secondary Metrics */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Engagement Metrics</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Last Contact → Package</p>
                <p className="text-lg font-bold text-gray-900">{formatDays(metrics.avgDaysLastContactToPackage)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Total Engagement (Buyers)</p>
                <p className="text-lg font-bold text-gray-900">{formatDays(metrics.avgDaysEngaged)}</p>
              </div>
            </div>
          </div>

          {/* Conversion Rates */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Conversion Rates</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Total Contacts</p>
                <p className="text-lg font-bold">{metrics.totalSubscriptions}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">First Purchase</p>
                <p className="text-lg font-bold">{metrics.totalFirstPurchases}</p>
                <p className="text-xs text-gray-400">{formatPercent(metrics.firstPurchaseRate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Package</p>
                <p className="text-lg font-bold">{metrics.totalPackagePurchases}</p>
                <p className="text-xs text-gray-400">{formatPercent(metrics.packagePurchaseRate)}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to calculate cycle metrics from contacts
export function calculateCycleMetrics(contacts: any[]): CycleMetrics {
  const validContacts = contacts.filter(c => c.subscription_date);
  
  // Calculate days between dates
  const getDaysBetween = (date1: string | null, date2: string | null) => {
    if (!date1 || !date2) return null;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
  };

  // Calculate metrics for each contact
  const contactMetrics = validContacts.map(contact => ({
    daysToFirstPurchase: getDaysBetween(contact.subscription_date, contact.first_purchase_date),
    daysFirstToPackage: getDaysBetween(contact.first_purchase_date, contact.package_purchase_date),
    daysLastContactToPackage: getDaysBetween(contact.last_interaction_date, contact.package_purchase_date),
    daysEngaged: contact.first_purchase_date || contact.package_purchase_date
      ? getDaysBetween(contact.subscription_date, contact.last_interaction_date)
      : null,
    hasFirstPurchase: !!contact.first_purchase_date,
    hasPackagePurchase: !!contact.package_purchase_date,
  }));

  // Filter out outliers (>365 days)
  const filterOutliers = (values: (number | null)[]) => 
    values.filter(v => v !== null && v < 365) as number[];

  // Calculate averages
  const avg = (values: number[]) => 
    values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

  // Calculate median
  const median = (values: number[]) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const daysToFirstPurchase = filterOutliers(contactMetrics.map(m => m.daysToFirstPurchase));
  const daysFirstToPackage = filterOutliers(contactMetrics.map(m => m.daysFirstToPackage));
  const daysLastContactToPackage = filterOutliers(contactMetrics.map(m => m.daysLastContactToPackage));
  const daysEngaged = filterOutliers(contactMetrics.map(m => m.daysEngaged));

  const totalFirstPurchases = contactMetrics.filter(m => m.hasFirstPurchase).length;
  const totalPackagePurchases = contactMetrics.filter(m => m.hasPackagePurchase).length;

  return {
    avgDaysToFirstPurchase: avg(daysToFirstPurchase),
    avgDaysFirstToPackage: avg(daysFirstToPackage),
    avgDaysLastContactToPackage: avg(daysLastContactToPackage),
    avgDaysEngaged: avg(daysEngaged),
    medianDaysToFirstPurchase: median(daysToFirstPurchase),
    medianDaysFirstToPackage: median(daysFirstToPackage),
    totalSubscriptions: validContacts.length,
    totalFirstPurchases,
    totalPackagePurchases,
    firstPurchaseRate: validContacts.length > 0 ? (totalFirstPurchases / validContacts.length) * 100 : 0,
    packagePurchaseRate: validContacts.length > 0 ? (totalPackagePurchases / validContacts.length) * 100 : 0,
  };
}