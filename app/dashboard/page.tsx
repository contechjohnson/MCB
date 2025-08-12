import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DateFilterMinimal } from './date-filter-minimal';
import { CycleMetricsCard, calculateCycleMetrics } from './cycle-metrics';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getDashboardData(startDate?: string, endDate?: string) {
  console.log('Getting dashboard data for date range:', startDate, 'to', endDate);

  // For large datasets, use count queries instead of fetching all rows
  let baseQuery = supabase.from('contacts').select('*', { count: 'exact', head: false });
  let countQuery = supabase.from('contacts').select('*', { count: 'exact', head: true });
  
  // Apply date filters if provided - use subscription_date (when they entered the funnel)
  if (startDate && endDate) {
    // Filter by when contacts subscribed/entered the funnel
    baseQuery = baseQuery
      .gte('subscription_date', startDate)
      .lte('subscription_date', endDate + 'T23:59:59');
    countQuery = countQuery
      .gte('subscription_date', startDate)
      .lte('subscription_date', endDate + 'T23:59:59');
  }
  
  // Get total count first
  const { count: totalCount } = await countQuery;
  
  console.log('Total contacts in date range:', totalCount);
  
  // For metrics, use aggregated queries instead of loading all data
  const getStageCount = async (column: string) => {
    let query = supabase.from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq(column, true);
    
    if (startDate && endDate) {
      query = query
        .gte('subscription_date', startDate)
        .lte('subscription_date', endDate + 'T23:59:59');
    }
    
    const { count } = await query;
    return count || 0;
  };
  
  // Calculate funnel metrics using count queries
  const metrics = {
    total: totalCount || 0,
    lead: await getStageCount('lead'),
    leadContact: await getStageCount('lead_contact'),
    sentLink: await getStageCount('sent_link'),
    clickedLink: await getStageCount('clicked_link'),
    booked: await getStageCount('booked'),
    attended: await getStageCount('attended'),
    sentPackage: await getStageCount('sent_package'),
    boughtPackage: await getStageCount('bought_package'),
  };

  // Get hot leads - last 100 interactions in target stages
  const isValidEmail = (email: string) => {
    return email && 
           email.trim() !== '' && 
           email.toLowerCase() !== 'none' && 
           email.includes('@');
  };
  
  const isValidPhone = (phone: string) => {
    return phone && 
           phone.trim() !== '' && 
           phone.toLowerCase() !== 'none' &&
           phone.replace(/\D/g, '').length >= 10;
  };
  
  // Fetch hot leads - simply get the 100 most recently updated contacts who haven't bought
  // Filter out null and 'none' emails (case insensitive)
  let hotLeadsQuery = supabase.from('contacts')
    .select('*')
    .eq('bought_package', false)
    .not('email_address', 'is', null)  // Must have email
    .neq('email_address', 'none')  // Filter out 'none' emails
    .neq('email_address', 'None')  // Filter out 'None' emails  
    .neq('email_address', 'NONE')  // Filter out 'NONE' emails
    .order('updated_at', { ascending: false })
    .limit(100); // Get exactly 100
  
  // Apply date filter separately for hot leads
  if (startDate && endDate) {
    // Filter by subscription date - when they entered the funnel
    hotLeadsQuery = hotLeadsQuery
      .gte('subscription_date', startDate)
      .lte('subscription_date', endDate + 'T23:59:59');
  }
  
  const { data: hotLeads, error: hotLeadsError } = await hotLeadsQuery;
  
  if (hotLeadsError) {
    console.error('Error fetching hot leads:', hotLeadsError);
    console.error('Hot leads query details:', JSON.stringify(hotLeadsError));
  }

  // Calculate total revenue - fetch in batches if needed, respecting date filters
  let totalRevenue = 0;
  let revenueOffset = 0;
  const revenueLimit = 1000;
  let hasMore = true;
  
  while (hasMore) {
    let revenueQuery = supabase
      .from('contacts')
      .select('total_purchased', { count: 'exact' })
      .not('total_purchased', 'is', null);
    
    // Apply date filter for revenue - only count revenue from contacts who subscribed in this period
    if (startDate && endDate) {
      revenueQuery = revenueQuery
        .gte('subscription_date', startDate)
        .lte('subscription_date', endDate + 'T23:59:59');
    }
    
    const { data: revenueData, count } = await revenueQuery
      .range(revenueOffset, revenueOffset + revenueLimit - 1);
    
    if (revenueData && revenueData.length > 0) {
      totalRevenue += revenueData.reduce((sum, c) => sum + (c.total_purchased || 0), 0);
      revenueOffset += revenueLimit;
      hasMore = revenueData.length === revenueLimit;
    } else {
      hasMore = false;
    }
  }

  // Get month-over-month data
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  const { count: thisMonthContacts } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .gte('subscription_date', startOfMonth.toISOString());
  
  const { count: lastMonthContacts } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .gte('subscription_date', startOfLastMonth.toISOString())
    .lt('subscription_date', startOfMonth.toISOString());

  // Skip monthly trend data for now - it's too slow
  const monthlyData = [];

  // For cycle metrics, fetch a sample of recent contacts with purchases
  const { data: cycleMetricsContacts } = await supabase
    .from('contacts')
    .select('*')
    .not('total_purchased', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(500); // Sample for cycle metrics
  
  const cycleMetrics = calculateCycleMetrics(cycleMetricsContacts || []);

  return {
    metrics,
    hotLeads: hotLeads || [],
    totalRevenue,
    thisMonthContacts: thisMonthContacts || 0,
    lastMonthContacts: lastMonthContacts || 0,
    monthlyData,
    cycleMetrics,
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
          <span className="text-sm font-bold">{value.toLocaleString()}</span>
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
  const formatTimestamp = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getLatestInteraction = (contact: any) => {
    const dates = [
      contact.updated_at,
      contact.last_ig_interaction,
      contact.last_fb_interaction
    ].filter(Boolean);
    
    if (dates.length === 0) return contact.created_at;
    
    return dates.reduce((latest, date) => {
      return new Date(date) > new Date(latest) ? date : latest;
    });
  };

  const getStageLabel = (contact: any) => {
    if (contact.sent_package) return 'Sent Package';
    if (contact.attended) return 'Attended';
    if (contact.booked) return 'Booked';
    if (contact.clicked_link) return 'Clicked';
    if (contact.sent_link) return 'Link Sent';
    if (contact.lead_contact) return 'Contact';
    if (contact.lead) return 'Lead';
    return 'New';
  };

  const getStageVariant = (contact: any) => {
    if (contact.sent_package || contact.attended) return 'destructive';
    if (contact.booked) return 'default';
    if (contact.clicked_link || contact.sent_link) return 'secondary';
    return 'outline';
  };

  return (
    <div className="p-3 border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-sm">
              {contact.first_name} {contact.last_name}
            </p>
            <Badge variant={getStageVariant(contact)} className="text-xs">
              {getStageLabel(contact)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(getLatestInteraction(contact))}
            </span>
          </div>
          
          <div className="space-y-1">
            {contact.phone_number && (
              <div className="flex items-center gap-2">
                <a href={`tel:${contact.phone_number}`} className="text-xs text-primary hover:underline">
                  📱 {contact.phone_number}
                </a>
              </div>
            )}
            {contact.email_address && (
              <div className="flex items-center gap-2">
                <a href={`mailto:${contact.email_address}`} className="text-xs text-primary hover:underline truncate">
                  ✉️ {contact.email_address}
                </a>
              </div>
            )}
            {(contact.instagram_name || contact.facebook_name) && (
              <div className="text-xs text-muted-foreground">
                {contact.instagram_name && `IG: @${contact.instagram_name}`}
                {contact.instagram_name && contact.facebook_name && ' • '}
                {contact.facebook_name && `FB: ${contact.facebook_name}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params.startDate, params.endDate);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">ManyChat Dashboard</h1>
        <DateFilterMinimal currentStart={params.startDate} currentEnd={params.endDate} />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-2xl">
              ${data.totalRevenue.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {params.startDate && params.endDate ? 'Filtered period' : 'All time'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Contacts</CardDescription>
            <CardTitle className="text-2xl">{data.metrics.total.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {params.startDate && params.endDate 
                ? `Contacts added in selected period`
                : 'All contacts from all time'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lead → Booked</CardDescription>
            <CardTitle className="text-2xl">
              {data.metrics.lead > 0 
                ? ((data.metrics.booked / data.metrics.lead) * 100).toFixed(1) 
                : '0'}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Booking rate</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Booked → Purchase</CardDescription>
            <CardTitle className="text-2xl">
              {data.metrics.booked > 0 
                ? ((data.metrics.boughtPackage / data.metrics.booked) * 100).toFixed(1) 
                : '0'}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Close rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Funnel Overview</CardTitle>
            <CardDescription>Conversion funnel performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FunnelItem label="Lead" value={data.metrics.lead} total={data.metrics.total} />
            <FunnelItem label="Lead with Contact Info" value={data.metrics.leadContact} total={data.metrics.total} prevValue={data.metrics.lead} />
            <FunnelItem label="Sent Link" value={data.metrics.sentLink} total={data.metrics.total} prevValue={data.metrics.leadContact} />
            <FunnelItem label="Clicked Link" value={data.metrics.clickedLink} total={data.metrics.total} prevValue={data.metrics.sentLink} />
            <FunnelItem label="Booked Discovery Call" value={data.metrics.booked} total={data.metrics.total} prevValue={data.metrics.clickedLink} />
            <FunnelItem label="Attended Discovery Call" value={data.metrics.attended} total={data.metrics.total} prevValue={data.metrics.booked} />
            <FunnelItem label="Sent Package" value={data.metrics.sentPackage} total={data.metrics.total} prevValue={data.metrics.attended} />
            <FunnelItem label="Bought Package" value={data.metrics.boughtPackage} total={data.metrics.total} prevValue={data.metrics.sentPackage} />
          </CardContent>
        </Card>

        {/* Hot Leads */}
        <Card>
          <CardHeader>
            <CardTitle>Hot Leads 🔥</CardTitle>
            <CardDescription>
              {(data.hotLeads || []).length} priority contacts to follow up
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto" style={{ maxHeight: '500px' }}>
            {data.hotLeads && data.hotLeads.length > 0 ? (
              <>
                {data.hotLeads.map((contact: any) => (
                  <ContactCard key={contact.user_id} contact={contact} />
                ))}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No hot leads at the moment</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cycle Metrics */}
      <CycleMetricsCard metrics={data.cycleMetrics} />
    </div>
  );
}