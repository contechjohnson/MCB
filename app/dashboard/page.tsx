import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DateFilterMinimal } from './date-filter-minimal';
import { TrendChart } from './trend-chart';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getDashboardData(startDate?: string, endDate?: string) {
  // Build query
  let query = supabase.from('contacts').select('*');
  
  // Apply date filters if provided
  if (startDate && endDate) {
    query = query
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59');
  }
  
  const { data: contacts } = await query.order('updated_at', { ascending: false });

  // Calculate funnel metrics
  const metrics = {
    total: contacts?.length || 0,
    leadContact: contacts?.filter(c => c.lead_contact).length || 0,
    lead: contacts?.filter(c => c.lead).length || 0,
    sentLink: contacts?.filter(c => c.sent_link).length || 0,
    clickedLink: contacts?.filter(c => c.clicked_link).length || 0,
    booked: contacts?.filter(c => c.booked).length || 0,
    attended: contacts?.filter(c => c.attended).length || 0,
    sentPackage: contacts?.filter(c => c.sent_package).length || 0,
    boughtPackage: contacts?.filter(c => c.bought_package).length || 0,
  };

  // Get hot leads (only contacts with email for outreach)
  const hotLeads = contacts?.filter(c => 
    c.email_address && // Must have email
    (c.lead_contact || c.lead || c.sent_link || c.clicked_link || c.booked || c.attended) &&
    !c.bought_package
  ).slice(0, 10) || [];

  // Calculate revenue
  const totalRevenue = contacts?.reduce((sum, c) => sum + (c.total_purchased || 0), 0) || 0;

  // Get month-over-month data
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  const thisMonthContacts = contacts?.filter(c => 
    new Date(c.created_at) >= startOfMonth
  ).length || 0;
  
  const lastMonthContacts = contacts?.filter(c => {
    const created = new Date(c.created_at);
    return created >= startOfLastMonth && created < startOfMonth;
  }).length || 0;

  // Get monthly trend data (last 6 months)
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    
    const { data: monthContacts } = await supabase
      .from('contacts')
      .select('*')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());
    
    if (monthContacts) {
      monthlyData.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        total: monthContacts.length,
        lead: monthContacts.filter(c => c.lead).length,
        booked: monthContacts.filter(c => c.booked).length,
        attended: monthContacts.filter(c => c.attended).length,
        bought: monthContacts.filter(c => c.bought_package).length,
      });
    }
  }

  return {
    metrics,
    hotLeads,
    totalRevenue,
    thisMonthContacts,
    lastMonthContacts,
    monthlyData,
  };
}

// Funnel Item Component
function FunnelItem({ 
  label, 
  value, 
  total, 
  prevValue 
}: { 
  label: string; 
  value: number; 
  total: number; 
  prevValue?: number;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const conversionRate = prevValue && prevValue > 0 ? (value / prevValue) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold">{value}</span>
          {conversionRate > 0 && (
            <span className="text-xs text-gray-500">
              {conversionRate.toFixed(0)}% of prev
            </span>
          )}
        </div>
      </div>
      <Progress value={percentage} max={100} />
    </div>
  );
}

// Contact Card Component
function ContactCard({ contact }: { contact: any }) {
  const getStageVariant = (stage: string) => {
    if (stage === 'BOOKED' || stage === 'ATTENDED') return 'default';
    if (stage === 'SENT_LINK' || stage === 'CLICKED_LINK') return 'secondary';
    return 'outline';
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">
              {contact.first_name} {contact.last_name}
            </p>
            <Badge variant={getStageVariant(contact.stage)}>
              {contact.stage?.replace(/_/g, ' ')}
            </Badge>
          </div>
          {contact.email_address && (
            <p className="text-xs text-gray-600 mt-1">{contact.email_address}</p>
          )}
          {contact.phone_number && (
            <p className="text-xs text-gray-600">{contact.phone_number}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage({ 
  searchParams 
}: { 
  searchParams: { start?: string; end?: string } 
}) {
  const { metrics, hotLeads, totalRevenue, thisMonthContacts, lastMonthContacts, monthlyData } = 
    await getDashboardData(searchParams.start, searchParams.end);

  const conversionRate = metrics.total > 0 
    ? (metrics.boughtPackage / metrics.total * 100).toFixed(1)
    : '0';

  const monthGrowth = lastMonthContacts > 0 
    ? ((thisMonthContacts - lastMonthContacts) / lastMonthContacts * 100).toFixed(0)
    : '0';

  // Show date range in header if filtered
  const dateRangeText = searchParams.start && searchParams.end 
    ? ` (${new Date(searchParams.start).toLocaleDateString()} - ${new Date(searchParams.end).toLocaleDateString()})`
    : '';

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-black">PPCU{dateRangeText}</h1>
          <DateFilterMinimal currentStart={searchParams.start} currentEnd={searchParams.end} />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className="text-2xl">${totalRevenue.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Conversion Rate</CardDescription>
              <CardTitle className="text-2xl">{conversionRate}%</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>This Month</CardDescription>
              <CardTitle className="text-2xl">
                {thisMonthContacts}
                {monthGrowth !== '0' && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    {monthGrowth > '0' ? '+' : ''}{monthGrowth}%
                  </span>
                )}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Leads</CardDescription>
              <CardTitle className="text-2xl">{hotLeads.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funnel Visualization */}
          <Card>
              <CardHeader>
                <CardTitle>Funnel Performance</CardTitle>
                <CardDescription>Conversion through each stage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
              <FunnelItem 
                label="Total Contacts" 
                value={metrics.total} 
                total={metrics.total}
              />
              <FunnelItem 
                label="Lead (Contact Info)" 
                value={metrics.leadContact} 
                total={metrics.total}
                prevValue={metrics.total}
              />
              <FunnelItem 
                label="Lead" 
                value={metrics.lead} 
                total={metrics.total}
                prevValue={metrics.leadContact}
              />
              <FunnelItem 
                label="Sent Link" 
                value={metrics.sentLink} 
                total={metrics.total}
                prevValue={metrics.lead}
              />
              <FunnelItem 
                label="Clicked Link" 
                value={metrics.clickedLink} 
                total={metrics.total}
                prevValue={metrics.sentLink}
              />
              <FunnelItem 
                label="Booked" 
                value={metrics.booked} 
                total={metrics.total}
                prevValue={metrics.clickedLink}
              />
              <FunnelItem 
                label="Attended" 
                value={metrics.attended} 
                total={metrics.total}
                prevValue={metrics.booked}
              />
              <FunnelItem 
                label="Sent Package" 
                value={metrics.sentPackage} 
                total={metrics.total}
                prevValue={metrics.attended}
              />
              <FunnelItem 
                label="Bought Package" 
                value={metrics.boughtPackage} 
                total={metrics.total}
                prevValue={metrics.sentPackage}
              />
            </CardContent>
          </Card>

          {/* Hot Leads */}
          <Card>
            <CardHeader>
              <CardTitle>Hot Leads</CardTitle>
              <CardDescription>Contacts ready for outreach</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {hotLeads.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No active leads at the moment
                  </p>
                ) : (
                  hotLeads.map((contact: any) => (
                    <ContactCard key={contact.user_id} contact={contact} />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Lead Capture Rate</p>
                <p className="text-xl font-bold">
                  {metrics.total > 0 
                    ? (metrics.lead / metrics.total * 100).toFixed(0)
                    : 0}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Booking Rate</p>
                <p className="text-xl font-bold">
                  {metrics.sentLink > 0 
                    ? (metrics.booked / metrics.sentLink * 100).toFixed(0)
                    : 0}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Show Rate</p>
                <p className="text-xl font-bold">
                  {metrics.booked > 0 
                    ? (metrics.attended / metrics.booked * 100).toFixed(0)
                    : 0}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Close Rate</p>
                <p className="text-xl font-bold">
                  {metrics.attended > 0 
                    ? (metrics.boughtPackage / metrics.attended * 100).toFixed(0)
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trend Chart - Show when no filter active */}
        {!searchParams.start && !searchParams.end && (
          <TrendChart monthlyData={monthlyData} />
        )}
      </div>
    </div>
  );
}// Force deployment: 1754889006
