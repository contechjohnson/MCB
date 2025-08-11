import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Funnel stage configuration with proper order
const FUNNEL_STAGES = [
  { key: 'total', label: 'Total Contacts', color: 'bg-gray-200' },
  { key: 'lead_contact', label: 'Lead Contact', color: 'bg-blue-200' },
  { key: 'lead', label: 'Lead (Info)', color: 'bg-blue-300' },
  { key: 'sent_link', label: 'Sent Link', color: 'bg-indigo-300' },
  { key: 'clicked_link', label: 'Clicked Link', color: 'bg-indigo-400' },
  { key: 'booked', label: 'Booked', color: 'bg-purple-400' },
  { key: 'attended', label: 'Attended', color: 'bg-purple-500' },
  { key: 'sent_package', label: 'Sent Package', color: 'bg-pink-400' },
  { key: 'bought_package', label: 'Bought Package', color: 'bg-green-500' },
];

async function getFunnelData() {
  // Get current month data
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Current month funnel
  const { data: currentMonth } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', startOfMonth.toISOString());

  // Last month funnel  
  const { data: lastMonth } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', startOfLastMonth.toISOString())
    .lte('created_at', endOfLastMonth.toISOString());

  // Calculate funnel metrics
  const calculateFunnel = (contacts: any[]) => {
    if (!contacts) return {};
    return {
      total: contacts.length,
      lead_contact: contacts.filter(c => c.lead_contact).length,
      lead: contacts.filter(c => c.lead).length,
      sent_link: contacts.filter(c => c.sent_link).length,
      clicked_link: contacts.filter(c => c.clicked_link).length,
      booked: contacts.filter(c => c.booked).length,
      attended: contacts.filter(c => c.attended).length,
      sent_package: contacts.filter(c => c.sent_package).length,
      bought_package: contacts.filter(c => c.bought_package).length,
    };
  };

  return {
    current: calculateFunnel(currentMonth || []),
    last: calculateFunnel(lastMonth || []),
  };
}

async function getHotLeads() {
  // Get contacts in the "actionable" stages (lead_contact through attended)
  const { data: hotLeads } = await supabase
    .from('contacts')
    .select('user_id, first_name, last_name, email_address, phone_number, stage, updated_at, summary')
    .or('lead_contact.eq.true,lead.eq.true,sent_link.eq.true,clicked_link.eq.true,booked.eq.true,attended.eq.true')
    .not('bought_package', 'eq', true)
    .order('updated_at', { ascending: false })
    .limit(10);

  return hotLeads || [];
}

async function getTotalRevenue() {
  const { data } = await supabase
    .from('contacts')
    .select('total_purchased');

  const total = data?.reduce((sum, contact) => sum + (contact.total_purchased || 0), 0) || 0;
  return total;
}

// Funnel Visualization Component - Horizontal Bars
function FunnelChart({ data, lastMonth }: { data: any; lastMonth: any }) {
  const maxValue = data.total || 1;

  return (
    <div className="space-y-4">
      {FUNNEL_STAGES.map((stage, index) => {
        const value = data[stage.key] || 0;
        const lastValue = lastMonth[stage.key] || 0;
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const change = lastValue > 0 ? ((value - lastValue) / lastValue * 100) : 0;
        
        // Calculate conversion rate from previous stage
        const prevStageKey = index > 0 ? FUNNEL_STAGES[index - 1].key : null;
        const prevValue = prevStageKey ? (data[prevStageKey] || 0) : 0;
        const conversionRate = prevValue > 0 ? ((value / prevValue) * 100) : 0;

        return (
          <div key={stage.key} className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{stage.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-900">{value}</span>
                {index > 0 && prevValue > 0 && (
                  <span className="text-xs text-gray-500">
                    {conversionRate.toFixed(0)}% of prev
                  </span>
                )}
                {change !== 0 && (
                  <span className={`text-xs font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change > 0 ? '↑' : '↓'} {Math.abs(change).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-8 overflow-hidden">
              <div 
                className={`h-full ${stage.color} transition-all duration-700 ease-out`}
                style={{ width: `${percentage}%`, minWidth: value > 0 ? '40px' : '0' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Stage Badge Component  
function StageBadge({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    'LEAD_CONTACT': 'bg-blue-100 text-blue-800',
    'LEAD': 'bg-blue-200 text-blue-900',
    'SENT_LINK': 'bg-indigo-100 text-indigo-800',
    'CLICKED_LINK': 'bg-indigo-200 text-indigo-900',
    'READY_TO_BOOK': 'bg-purple-100 text-purple-800',
    'BOOKED': 'bg-purple-100 text-purple-800',
    'ATTENDED': 'bg-purple-200 text-purple-900',
  };

  const displayName = stage.replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${colors[stage] || 'bg-gray-100 text-gray-800'}`}>
      {displayName}
    </span>
  );
}

export default async function DashboardPage() {
  const funnelData = await getFunnelData();
  const hotLeads = await getHotLeads();
  const totalRevenue = await getTotalRevenue();

  // Calculate key metrics
  const conversionRate = funnelData.current.total > 0 
    ? ((funnelData.current.bought_package / funnelData.current.total) * 100)
    : 0;
    
  const bookingRate = funnelData.current.sent_link > 0
    ? ((funnelData.current.booked / funnelData.current.sent_link) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Minimal Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-gray-900">Funnel Dashboard</h1>
        </div>

        {/* Key Metrics - Minimal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              ${totalRevenue.toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {conversionRate.toFixed(1)}%
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Booking Rate</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {bookingRate.toFixed(1)}%
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Hot Leads</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {hotLeads.length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Funnel Visualization - Clean Design */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900">Funnel Performance</h2>
              <p className="mt-1 text-sm text-gray-500">
                Month-over-month comparison
              </p>
            </div>
            <FunnelChart data={funnelData.current} lastMonth={funnelData.last} />
          </div>

          {/* Hot Leads List - Action Focused */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900">Action Required</h2>
              <p className="mt-1 text-sm text-gray-500">
                Contacts ready for outreach
              </p>
            </div>
            <div className="space-y-3 max-h-[480px] overflow-y-auto">
              {hotLeads.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No hot leads at the moment
                </p>
              ) : (
                hotLeads.map((lead) => (
                  <div 
                    key={lead.user_id} 
                    className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-900 truncate">
                            {lead.first_name} {lead.last_name}
                          </p>
                          <StageBadge stage={lead.stage} />
                        </div>
                        {lead.email_address && (
                          <p className="text-sm text-gray-600 truncate">
                            ✉ {lead.email_address}
                          </p>
                        )}
                        {lead.phone_number && (
                          <p className="text-sm text-gray-600">
                            ☎ {lead.phone_number}
                          </p>
                        )}
                        {lead.summary && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                            {lead.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Month Comparison Summary */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Month-over-Month Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'New Contacts', current: funnelData.current.total, last: funnelData.last.total },
              { label: 'Bookings', current: funnelData.current.booked, last: funnelData.last.booked },
              { label: 'Attended', current: funnelData.current.attended, last: funnelData.last.attended },
              { label: 'Purchases', current: funnelData.current.bought_package, last: funnelData.last.bought_package },
            ].map((metric) => {
              const change = metric.last > 0 
                ? ((metric.current - metric.last) / metric.last * 100)
                : 0;
              
              return (
                <div key={metric.label}>
                  <p className="text-xs text-gray-500">{metric.label}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-lg font-semibold text-gray-900">
                      {metric.current}
                    </span>
                    <span className={`text-xs ${change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {change > 0 ? '+' : ''}{change.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}// Force redeploy Sun Aug 10 22:32:46 MDT 2025
