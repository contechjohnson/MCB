const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function getMeetingsData() {
  // Query meetings held in last 7 days
  const { data: meetingsSummary, error: summaryError } = await supabase
    .from('contacts')
    .select('*')
    .not('source', 'eq', 'instagram_historical')
    .gte('appointment_held_date', '2025-11-06')
    .lte('appointment_held_date', '2025-11-13')
    .order('appointment_held_date', { ascending: false });

  if (summaryError) {
    console.error('Summary Error:', summaryError);
    return;
  }

  console.log('=== MEETINGS HELD SUMMARY ===');
  console.log(JSON.stringify(meetingsSummary, null, 2));
  console.log('');
  console.log('Total meetings:', meetingsSummary.length);
  
  // Calculate conversions
  const conversions = meetingsSummary.filter(c => c.purchase_date !== null);
  console.log('Converted to purchases:', conversions.length);
  console.log('Conversion rate:', meetingsSummary.length > 0 ? ((conversions.length / meetingsSummary.length) * 100).toFixed(2) + '%' : 'N/A');
  
  // Calculate average days to convert
  let totalDays = 0;
  let validConversions = 0;
  conversions.forEach(c => {
    if (c.appointment_held_date && c.purchase_date) {
      const meetingDate = new Date(c.appointment_held_date);
      const purchaseDate = new Date(c.purchase_date);
      const days = Math.floor((purchaseDate - meetingDate) / (1000 * 60 * 60 * 24));
      totalDays += days;
      validConversions++;
    }
  });
  console.log('Average days to convert:', validConversions > 0 ? (totalDays / validConversions).toFixed(1) : 'N/A');
  
  // Source breakdown
  const bySource = {};
  meetingsSummary.forEach(c => {
    const source = c.source || 'unknown';
    if (!bySource[source]) {
      bySource[source] = { total: 0, conversions: 0 };
    }
    bySource[source].total++;
    if (c.purchase_date) {
      bySource[source].conversions++;
    }
  });
  
  console.log('');
  console.log('=== BY SOURCE ===');
  Object.keys(bySource).forEach(source => {
    const data = bySource[source];
    const rate = data.total > 0 ? ((data.conversions / data.total) * 100).toFixed(2) : '0.00';
    console.log(source + ': ' + data.total + ' meetings, ' + data.conversions + ' conversions (' + rate + '%)');
  });
}

getMeetingsData().catch(console.error);
