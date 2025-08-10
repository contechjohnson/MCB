import { supabaseAdmin } from '@/lib/supabase';

// Types for our metrics
interface FunnelMetrics {
  dmStarted: number;
  leadCaptured: number;
  bookingShown: number;
  bookingClicked: number;
  booked: number;
  attended: number;
  purchased: number;
}

interface SegmentedMetrics {
  total: FunnelMetrics;
  last30Days: FunnelMetrics;
  byVariant: Record<string, FunnelMetrics>;
  bySource: Record<string, FunnelMetrics>;
}

interface ConversionRates {
  dmToLead: number;
  leadToBookingShown: number;
  bookingShownToClicked: number;
  bookingClickedToBooked: number;
  bookedToAttended: number;
  attendedToPurchased: number;
  overallConversion: number;
}

async function getContactsData() {
  try {
    // Get all contacts with relevant timestamp data
    const { data: contacts, error } = await supabaseAdmin
      .from('contacts')
      .select(`
        dm_started_at,
        lead_captured_at,
        booking_shown_at,
        booking_clicked_at,
        booked_at,
        attended_at,
        purchased_at,
        ab_variant,
        acquisition_source,
        created_at
      `);

    if (error) {
      console.error('Error fetching contacts:', error);
      return null;
    }

    return contacts || [];
  } catch (error) {
    console.error('Error in getContactsData:', error);
    return null;
  }
}

function calculateFunnelMetrics(contacts: any[], dateFilter?: Date): FunnelMetrics {
  const filterByDate = (timestamp: string | null) => {
    if (!timestamp) return false;
    if (!dateFilter) return true;
    return new Date(timestamp) >= dateFilter;
  };

  return {
    dmStarted: contacts.filter(c => c.dm_started_at && filterByDate(c.dm_started_at)).length,
    leadCaptured: contacts.filter(c => c.lead_captured_at && filterByDate(c.lead_captured_at)).length,
    bookingShown: contacts.filter(c => c.booking_shown_at && filterByDate(c.booking_shown_at)).length,
    bookingClicked: contacts.filter(c => c.booking_clicked_at && filterByDate(c.booking_clicked_at)).length,
    booked: contacts.filter(c => c.booked_at && filterByDate(c.booked_at)).length,
    attended: contacts.filter(c => c.attended_at && filterByDate(c.attended_at)).length,
    purchased: contacts.filter(c => c.purchased_at && filterByDate(c.purchased_at)).length,
  };
}

function calculateConversionRates(metrics: FunnelMetrics): ConversionRates {
  const safeRate = (numerator: number, denominator: number): number => {
    return denominator > 0 ? (numerator / denominator) * 100 : 0;
  };

  return {
    dmToLead: safeRate(metrics.leadCaptured, metrics.dmStarted),
    leadToBookingShown: safeRate(metrics.bookingShown, metrics.leadCaptured),
    bookingShownToClicked: safeRate(metrics.bookingClicked, metrics.bookingShown),
    bookingClickedToBooked: safeRate(metrics.booked, metrics.bookingClicked),
    bookedToAttended: safeRate(metrics.attended, metrics.booked),
    attendedToPurchased: safeRate(metrics.purchased, metrics.attended),
    overallConversion: safeRate(metrics.purchased, metrics.dmStarted),
  };
}

async function getDashboardData() {
  const contacts = await getContactsData();
  
  if (!contacts) {
    return {
      metrics: {
        total: { dmStarted: 0, leadCaptured: 0, bookingShown: 0, bookingClicked: 0, booked: 0, attended: 0, purchased: 0 },
        last30Days: { dmStarted: 0, leadCaptured: 0, bookingShown: 0, bookingClicked: 0, booked: 0, attended: 0, purchased: 0 },
        byVariant: {},
        bySource: {},
      },
      conversionRates: {
        total: { dmToLead: 0, leadToBookingShown: 0, bookingShownToClicked: 0, bookingClickedToBooked: 0, bookedToAttended: 0, attendedToPurchased: 0, overallConversion: 0 },
        last30Days: { dmToLead: 0, leadToBookingShown: 0, bookingShownToClicked: 0, bookingClickedToBooked: 0, bookedToAttended: 0, attendedToPurchased: 0, overallConversion: 0 },
      },
    };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Calculate total metrics
  const totalMetrics = calculateFunnelMetrics(contacts);
  const last30DaysMetrics = calculateFunnelMetrics(contacts, thirtyDaysAgo);

  // Calculate metrics by A/B variant
  const variants = [...new Set(contacts.filter(c => c.ab_variant).map(c => c.ab_variant))];
  const byVariant: Record<string, FunnelMetrics> = {};
  variants.forEach(variant => {
    const variantContacts = contacts.filter(c => c.ab_variant === variant);
    byVariant[variant] = calculateFunnelMetrics(variantContacts);
  });

  // Calculate metrics by acquisition source
  const sources = [...new Set(contacts.filter(c => c.acquisition_source).map(c => c.acquisition_source))];
  const bySource: Record<string, FunnelMetrics> = {};
  sources.forEach(source => {
    const sourceContacts = contacts.filter(c => c.acquisition_source === source);
    bySource[source] = calculateFunnelMetrics(sourceContacts);
  });

  return {
    metrics: {
      total: totalMetrics,
      last30Days: last30DaysMetrics,
      byVariant,
      bySource,
    },
    conversionRates: {
      total: calculateConversionRates(totalMetrics),
      last30Days: calculateConversionRates(last30DaysMetrics),
    },
  };
}

function MetricCard({ title, value, subtitle, gradient }: { title: string; value: number; subtitle?: string; gradient: string }) {
  return (
    <div className={`${gradient} rounded-xl p-6 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold">{value.toLocaleString()}</p>
          {subtitle && <p className="text-white/70 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
          <div className="h-6 w-6 bg-white/40 rounded"></div>
        </div>
      </div>
    </div>
  );
}

function ConversionRateCard({ title, rate, gradient }: { title: string; rate: number; gradient: string }) {
  return (
    <div className={`${gradient} rounded-xl p-6 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold">{rate.toFixed(1)}%</p>
        </div>
        <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
          <div className="h-6 w-6 bg-white/40 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}

function FunnelVisualization({ metrics }: { metrics: FunnelMetrics }) {
  const stages = [
    { name: 'DM Started', value: metrics.dmStarted, color: 'bg-blue-500' },
    { name: 'Lead Captured', value: metrics.leadCaptured, color: 'bg-indigo-500' },
    { name: 'Booking Shown', value: metrics.bookingShown, color: 'bg-purple-500' },
    { name: 'Booking Clicked', value: metrics.bookingClicked, color: 'bg-pink-500' },
    { name: 'Booked', value: metrics.booked, color: 'bg-red-500' },
    { name: 'Attended', value: metrics.attended, color: 'bg-orange-500' },
    { name: 'Purchased', value: metrics.purchased, color: 'bg-green-500' },
  ];

  const maxValue = Math.max(...stages.map(s => s.value));

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">Funnel Visualization</h3>
      <div className="space-y-4">
        {stages.map((stage, index) => {
          const width = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
          const prevStage = index > 0 ? stages[index - 1] : null;
          const conversionRate = prevStage && prevStage.value > 0 ? (stage.value / prevStage.value) * 100 : 100;

          return (
            <div key={stage.name} className="flex items-center space-x-4">
              <div className="w-32 text-sm font-medium text-gray-700">
                {stage.name}
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
                <div
                  className={`${stage.color} h-8 rounded-full flex items-center justify-end pr-3 text-white text-sm font-medium transition-all duration-500`}
                  style={{ width: `${Math.max(width, 8)}%` }}
                >
                  {stage.value.toLocaleString()}
                </div>
              </div>
              <div className="w-16 text-right text-sm text-gray-600">
                {index > 0 && `${conversionRate.toFixed(1)}%`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="h-10 bg-gray-300 rounded-lg w-96 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-64 mt-2 animate-pulse"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-300 h-32 rounded-xl animate-pulse"></div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-gray-300 h-96 rounded-xl animate-pulse"></div>
          <div className="bg-gray-300 h-96 rounded-xl animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}

export default async function Dashboard() {
  const data = await getDashboardData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            MCB Funnel Analytics
          </h1>
          <p className="text-gray-600">
            Track your conversion funnel performance and optimize your customer journey
          </p>
        </div>

        {/* Key Metrics - Total */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Overall Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="DM Started"
              value={data.metrics.total.dmStarted}
              subtitle="Total conversations initiated"
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <MetricCard
              title="Leads Captured"
              value={data.metrics.total.leadCaptured}
              subtitle="Contact information collected"
              gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
            />
            <MetricCard
              title="Booked"
              value={data.metrics.total.booked}
              subtitle="Appointments scheduled"
              gradient="bg-gradient-to-br from-purple-500 to-purple-600"
            />
            <MetricCard
              title="Purchased"
              value={data.metrics.total.purchased}
              subtitle="Successful conversions"
              gradient="bg-gradient-to-br from-green-500 to-green-600"
            />
          </div>
        </div>

        {/* Conversion Rates */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Conversion Rates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ConversionRateCard
              title="DM → Lead"
              rate={data.conversionRates.total.dmToLead}
              gradient="bg-gradient-to-br from-cyan-500 to-cyan-600"
            />
            <ConversionRateCard
              title="Lead → Booking"
              rate={data.conversionRates.total.leadToBookingShown}
              gradient="bg-gradient-to-br from-teal-500 to-teal-600"
            />
            <ConversionRateCard
              title="Booking → Booked"
              rate={data.conversionRates.total.bookingClickedToBooked}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
            />
            <ConversionRateCard
              title="Overall Conversion"
              rate={data.conversionRates.total.overallConversion}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
            />
          </div>
        </div>

        {/* Funnel Visualization and Last 30 Days */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <FunnelVisualization metrics={data.metrics.total} />
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Last 30 Days Performance</h3>
            <div className="space-y-4">
              {[
                { name: 'DM Started', value: data.metrics.last30Days.dmStarted, color: 'text-blue-600' },
                { name: 'Lead Captured', value: data.metrics.last30Days.leadCaptured, color: 'text-indigo-600' },
                { name: 'Booking Clicked', value: data.metrics.last30Days.bookingClicked, color: 'text-purple-600' },
                { name: 'Booked', value: data.metrics.last30Days.booked, color: 'text-pink-600' },
                { name: 'Attended', value: data.metrics.last30Days.attended, color: 'text-orange-600' },
                { name: 'Purchased', value: data.metrics.last30Days.purchased, color: 'text-green-600' },
              ].map((metric) => (
                <div key={metric.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">{metric.name}</span>
                  <span className={`text-2xl font-bold ${metric.color}`}>
                    {metric.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                <p>Overall 30-day conversion: <span className="font-semibold text-green-600">
                  {data.conversionRates.last30Days.overallConversion.toFixed(1)}%
                </span></p>
              </div>
            </div>
          </div>
        </div>

        {/* A/B Testing & Acquisition Source */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* A/B Testing Results */}
          {Object.keys(data.metrics.byVariant).length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">A/B Test Performance</h3>
              <div className="space-y-4">
                {Object.entries(data.metrics.byVariant).map(([variant, metrics]) => {
                  const conversionRate = metrics.dmStarted > 0 ? (metrics.purchased / metrics.dmStarted) * 100 : 0;
                  return (
                    <div key={variant} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">Variant {variant}</h4>
                        <span className="text-sm font-semibold text-purple-600">
                          {conversionRate.toFixed(1)}% conversion
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">DM Started:</span>
                          <span className="font-medium ml-1">{metrics.dmStarted}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Booked:</span>
                          <span className="font-medium ml-1">{metrics.booked}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Purchased:</span>
                          <span className="font-medium ml-1">{metrics.purchased}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Acquisition Source Performance */}
          {Object.keys(data.metrics.bySource).length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Acquisition Source Performance</h3>
              <div className="space-y-4">
                {Object.entries(data.metrics.bySource).map(([source, metrics]) => {
                  const conversionRate = metrics.dmStarted > 0 ? (metrics.purchased / metrics.dmStarted) * 100 : 0;
                  return (
                    <div key={source} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 capitalize">{source}</h4>
                        <span className="text-sm font-semibold text-green-600">
                          {conversionRate.toFixed(1)}% conversion
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">DM Started:</span>
                          <span className="font-medium ml-1">{metrics.dmStarted}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Booked:</span>
                          <span className="font-medium ml-1">{metrics.booked}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Purchased:</span>
                          <span className="font-medium ml-1">{metrics.purchased}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Real-time Updates Notice */}
        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse mr-2"></div>
            <span className="text-sm font-medium text-gray-700">Dashboard refreshes automatically on new data</span>
          </div>
          <p className="text-xs text-gray-500">
            Metrics are calculated in real-time from your Supabase contacts table
          </p>
        </div>
      </div>
    </div>
  );
}