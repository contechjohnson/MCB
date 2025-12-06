// Funnel Health Analysis - Go Forward Campaign Only
// Excludes historical imports, shows current campaign performance

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function analyzeFunnelHealth() {
  console.log('\n🎯 FUNNEL HEALTH ANALYSIS - Go Forward Campaign\n');
  console.log('=' .repeat(60));

  // 1. Discovery Calls This Month (January 2025)
  const { data: discoveryCalls, error: dcError } = await supabase
    .from('contacts')
    .select('id, email_primary, email_booking, appointment_held_date, stage, first_name, last_name')
    .gte('appointment_held_date', '2025-01-01')
    .lt('appointment_held_date', '2025-02-01')
    .in('stage', ['meeting_held', 'package_sent', 'purchased'])
    .gte('created_at', '2024-11-01') // Exclude historical
    .neq('source', 'historical_import');

  if (dcError) {
    console.error('Error fetching discovery calls:', dcError);
  } else {
    console.log('\n📅 DISCOVERY CALLS - JANUARY 2025');
    console.log('-'.repeat(60));
    console.log(`Total Calls Attended: ${discoveryCalls.length}`);

    const uniqueEmails = new Set();
    discoveryCalls.forEach(c => {
      if (c.email_primary) uniqueEmails.add(c.email_primary.toLowerCase());
      if (c.email_booking) uniqueEmails.add(c.email_booking.toLowerCase());
    });
    console.log(`Unique Contacts: ${uniqueEmails.size}`);

    if (discoveryCalls.length > 0) {
      const dates = discoveryCalls.map(c => c.appointment_held_date).filter(d => d).sort();
      console.log(`First Meeting: ${dates[0] || 'N/A'}`);
      console.log(`Last Meeting: ${dates[dates.length - 1] || 'N/A'}`);

      console.log('\nRecent Calls:');
      discoveryCalls.slice(0, 10).forEach(c => {
        const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
        const email = c.email_primary || c.email_booking || 'No email';
        console.log(`  - ${c.appointment_held_date}: ${name} (${email}) - ${c.stage}`);
      });
    }
  }

  // 2. Full Funnel Breakdown (Go Forward campaign only)
  const { data: allContacts, error: allError } = await supabase
    .from('contacts')
    .select('id, stage, purchase_amount, created_at, source')
    .gte('created_at', '2024-11-01')
    .neq('source', 'historical_import');

  if (allError) {
    console.error('Error fetching contacts:', allError);
    return;
  }

  console.log('\n\n📊 FULL FUNNEL BREAKDOWN');
  console.log('='.repeat(60));

  // Stage counts
  const stageOrder = [
    'new_lead',
    'dm_qualified',
    'dm_engaged',
    'link_clicked',
    'booked',
    'meeting_held',
    'package_sent',
    'purchased'
  ];

  const stageCounts = {};
  let totalRevenue = 0;

  allContacts.forEach(contact => {
    const stage = contact.stage;
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;

    if (stage === 'purchased' && contact.purchase_amount) {
      totalRevenue += contact.purchase_amount;
    }
  });

  console.log(`\nTotal Contacts: ${allContacts.length}`);
  console.log('\nStage Breakdown:');
  console.log('-'.repeat(60));

  let cumulativeCount = allContacts.length;
  stageOrder.forEach((stage, index) => {
    const count = stageCounts[stage] || 0;
    const percentage = cumulativeCount > 0
      ? ((count / cumulativeCount) * 100).toFixed(1)
      : '0.0';

    console.log(`${stage.padEnd(20)} ${count.toString().padStart(4)} contacts  (${percentage}% conversion from prev)`);
  });

  console.log('\n\n💰 REVENUE METRICS');
  console.log('-'.repeat(60));
  console.log(`Total Revenue: $${totalRevenue.toLocaleString()}`);
  console.log(`Purchases: ${stageCounts.purchased || 0}`);
  console.log(`Average Deal Size: $${stageCounts.purchased ? (totalRevenue / stageCounts.purchased).toFixed(2) : '0'}`);

  // 3. Conversion Rates
  console.log('\n\n📈 CONVERSION RATES');
  console.log('-'.repeat(60));

  const dmQualified = Object.entries(stageCounts)
    .filter(([stage]) => stageOrder.indexOf(stage) >= stageOrder.indexOf('dm_qualified'))
    .reduce((sum, [_, count]) => sum + count, 0);

  const linkClicked = Object.entries(stageCounts)
    .filter(([stage]) => stageOrder.indexOf(stage) >= stageOrder.indexOf('link_clicked'))
    .reduce((sum, [_, count]) => sum + count, 0);

  const booked = Object.entries(stageCounts)
    .filter(([stage]) => stageOrder.indexOf(stage) >= stageOrder.indexOf('booked'))
    .reduce((sum, [_, count]) => sum + count, 0);

  const meetingHeld = Object.entries(stageCounts)
    .filter(([stage]) => stageOrder.indexOf(stage) >= stageOrder.indexOf('meeting_held'))
    .reduce((sum, [_, count]) => sum + count, 0);

  const packageSent = Object.entries(stageCounts)
    .filter(([stage]) => stageOrder.indexOf(stage) >= stageOrder.indexOf('package_sent'))
    .reduce((sum, [_, count]) => sum + count, 0);

  const purchased = stageCounts.purchased || 0;

  console.log(`Lead → DM Qualified: ${dmQualified}/${allContacts.length} (${((dmQualified/allContacts.length)*100).toFixed(1)}%)`);
  console.log(`DM Qualified → Link Clicked: ${linkClicked}/${dmQualified} (${((linkClicked/dmQualified)*100).toFixed(1)}%)`);
  console.log(`Link Clicked → Booked: ${booked}/${linkClicked} (${((booked/linkClicked)*100).toFixed(1)}%)`);
  console.log(`Booked → Meeting Held: ${meetingHeld}/${booked} (${((meetingHeld/booked)*100).toFixed(1)}%)`);
  console.log(`Meeting Held → Package Sent: ${packageSent}/${meetingHeld} (${((packageSent/meetingHeld)*100).toFixed(1)}%)`);
  console.log(`Package Sent → Purchased: ${purchased}/${packageSent} (${((purchased/packageSent)*100).toFixed(1)}%)`);

  // 4. Funnel Health Score
  console.log('\n\n🏥 FUNNEL HEALTH INDICATORS');
  console.log('-'.repeat(60));

  const dmQualifiedRate = (dmQualified/allContacts.length)*100;
  const bookingRate = booked > 0 ? (booked/linkClicked)*100 : 0;
  const showRate = meetingHeld > 0 ? (meetingHeld/booked)*100 : 0;
  const closeRate = purchased > 0 ? (purchased/meetingHeld)*100 : 0;

  console.log(`DM Qualification Rate: ${dmQualifiedRate.toFixed(1)}% ${dmQualifiedRate > 50 ? '✅' : '⚠️'}`);
  console.log(`Booking Rate (Link → Booked): ${bookingRate.toFixed(1)}% ${bookingRate > 20 ? '✅' : '⚠️'}`);
  console.log(`Show Rate (Booked → Attended): ${showRate.toFixed(1)}% ${showRate > 50 ? '✅' : '⚠️'}`);
  console.log(`Close Rate (Meeting → Purchase): ${closeRate.toFixed(1)}% ${closeRate > 30 ? '✅' : '⚠️'}`);

  console.log('\n' + '='.repeat(60) + '\n');
}

analyzeFunnelHealth().catch(console.error);
