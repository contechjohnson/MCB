// Investigate Close Rate Discrepancy
// Real world: 1 in 3 to 1 in 7 close from discovery calls (14-33%)
// Data showing: 80%+ close rate
// Something is wrong - let's figure out what

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function investigateCloseRate() {
  console.log('\n🔍 INVESTIGATING CLOSE RATE DISCREPANCY\n');
  console.log('=' .repeat(80));
  console.log('Real World Experience: 1 in 3 to 1 in 7 close (14-33% close rate)');
  console.log('Data Showing: 80%+ close rate');
  console.log('=' .repeat(80));

  // Get ALL contacts (Go Forward only)
  const { data: allContacts, error } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', '2024-11-01')
    .neq('source', 'historical_import')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n📊 Total Contacts: ${allContacts.length}\n`);

  // 1. Check how many have appointment_held_date vs stage=meeting_held
  const hasAppointmentHeldDate = allContacts.filter(c => c.appointment_held_date).length;
  const stageMeetingHeld = allContacts.filter(c => c.stage === 'meeting_held').length;
  const stagePackageSent = allContacts.filter(c => c.stage === 'package_sent').length;
  const stagePurchased = allContacts.filter(c => c.stage === 'purchased').length;

  console.log('🎯 MEETING TRACKING COMPARISON\n');
  console.log('-'.repeat(80));
  console.log(`Contacts with appointment_held_date set: ${hasAppointmentHeldDate}`);
  console.log(`Contacts with stage = 'meeting_held': ${stageMeetingHeld}`);
  console.log(`Contacts with stage = 'package_sent': ${stagePackageSent}`);
  console.log(`Contacts with stage = 'purchased': ${stagePurchased}`);
  console.log(`\nTotal who "had a meeting" (meeting_held + package_sent + purchased): ${stageMeetingHeld + stagePackageSent + stagePurchased}`);

  // 2. Real close rate calculation
  const totalMeetings = stageMeetingHeld + stagePackageSent + stagePurchased;
  const totalPurchases = stagePurchased;
  const realCloseRate = totalMeetings > 0 ? (totalPurchases / totalMeetings * 100).toFixed(1) : '0.0';

  console.log(`\n💰 ACTUAL CLOSE RATE (Purchased / Total Meetings): ${totalPurchases}/${totalMeetings} = ${realCloseRate}%`);

  // 3. Show the stages breakdown
  console.log('\n\n📋 FULL STAGE BREAKDOWN\n');
  console.log('-'.repeat(80));

  const stageCounts = {};
  allContacts.forEach(c => {
    stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;
  });

  Object.entries(stageCounts).sort((a, b) => b[1] - a[1]).forEach(([stage, count]) => {
    const pct = ((count / allContacts.length) * 100).toFixed(1);
    console.log(`${stage.padEnd(20)}: ${count.toString().padStart(4)} (${pct}%)`);
  });

  // 4. Check for data issues
  console.log('\n\n⚠️  POTENTIAL DATA ISSUES\n');
  console.log('-'.repeat(80));

  // Issue 1: Contacts marked as purchased without appointment_held_date
  const purchasedNoMeetingDate = allContacts.filter(c =>
    c.stage === 'purchased' && !c.appointment_held_date
  );
  console.log(`\nContacts marked 'purchased' but no appointment_held_date: ${purchasedNoMeetingDate.length}`);

  if (purchasedNoMeetingDate.length > 0) {
    console.log('This suggests historical data or data migration issues.\n');
    console.log('Sample:');
    purchasedNoMeetingDate.slice(0, 5).forEach(c => {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
      console.log(`  - ${name}: purchased $${c.purchase_amount || 0}, source: ${c.source}, created: ${c.created_at.split('T')[0]}`);
    });
  }

  // Issue 2: Contacts at meeting_held stage but no purchased (these are the NO's)
  const meetingHeldNotPurchased = allContacts.filter(c => c.stage === 'meeting_held');
  console.log(`\n\nContacts at 'meeting_held' stage (HAD meeting, DIDN'T purchase): ${meetingHeldNotPurchased.length}`);

  // Issue 3: Check if historical imports are leaking through
  const historicalSource = allContacts.filter(c => c.source === 'historical_import');
  console.log(`\nHistorical imports that leaked through filter: ${historicalSource.length}`);

  // 5. Calculate REAL funnel with proper logic
  console.log('\n\n📊 CORRECTED FUNNEL ANALYSIS\n');
  console.log('-'.repeat(80));

  const newLeads = allContacts.filter(c => c.stage === 'new_lead').length;
  const dmQualified = allContacts.filter(c => ['dm_qualified', 'dm_engaged', 'link_clicked', 'booked', 'meeting_held', 'package_sent', 'purchased'].includes(c.stage)).length;
  const linkClicked = allContacts.filter(c => ['link_clicked', 'booked', 'meeting_held', 'package_sent', 'purchased'].includes(c.stage)).length;
  const booked = allContacts.filter(c => ['booked', 'meeting_held', 'package_sent', 'purchased'].includes(c.stage)).length;
  const hadMeeting = allContacts.filter(c => ['meeting_held', 'package_sent', 'purchased'].includes(c.stage)).length;
  const purchased = allContacts.filter(c => c.stage === 'purchased').length;

  console.log(`Total Contacts: ${allContacts.length}`);
  console.log(`DM Qualified: ${dmQualified} (${((dmQualified/allContacts.length)*100).toFixed(1)}%)`);
  console.log(`Link Clicked: ${linkClicked} (${dmQualified > 0 ? ((linkClicked/dmQualified)*100).toFixed(1) : '0.0'}% of qualified)`);
  console.log(`Booked: ${booked} (${linkClicked > 0 ? ((booked/linkClicked)*100).toFixed(1) : '0.0'}% of clicked)`);
  console.log(`Had Meeting: ${hadMeeting} (${booked > 0 ? ((hadMeeting/booked)*100).toFixed(1) : '0.0'}% show rate)`);
  console.log(`Purchased: ${purchased} (${hadMeeting > 0 ? ((purchased/hadMeeting)*100).toFixed(1) : '0.0'}% close rate) ⚠️`);

  console.log('\n\n🔍 THE PROBLEM:\n');
  console.log('-'.repeat(80));
  console.log(`If close rate should be 14-33%, we'd expect:`);
  console.log(`  - With ${hadMeeting} meetings:`);
  console.log(`    - At 33% close rate: ${Math.round(hadMeeting * 0.33)} purchases`);
  console.log(`    - At 20% close rate: ${Math.round(hadMeeting * 0.20)} purchases`);
  console.log(`    - At 14% close rate: ${Math.round(hadMeeting * 0.14)} purchases`);
  console.log(`\n  - But we're seeing: ${purchased} purchases (${((purchased/hadMeeting)*100).toFixed(1)}% close rate)`);

  if (purchased / hadMeeting > 0.5) {
    console.log('\n⚠️  LIKELY ISSUE: Historical imports or data migration');
    console.log('    - Most "purchased" contacts probably came from historical data');
    console.log('    - They were imported with stage=purchased already set');
    console.log('    - They never actually went through meeting_held in YOUR system');
    console.log('\n    This inflates the close rate because you\'re only seeing winners.');
  }

  // 6. Show recent purchases to verify
  console.log('\n\n💳 RECENT PURCHASES (Last 10)\n');
  console.log('-'.repeat(80));

  const recentPurchases = allContacts.filter(c => c.stage === 'purchased').slice(0, 10);

  recentPurchases.forEach(c => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
    const email = c.email_primary || c.email_booking || c.email_payment || 'No email';
    console.log(`\n${name} (${email})`);
    console.log(`  Source: ${c.source || 'unknown'}`);
    console.log(`  Created: ${c.created_at.split('T')[0]}`);
    console.log(`  Purchase Date: ${c.purchase_date || 'not set'}`);
    console.log(`  Appointment Held: ${c.appointment_held_date || 'not set'}`);
    console.log(`  Amount: $${c.purchase_amount || 0}`);
  });

  console.log('\n' + '='.repeat(80) + '\n');
}

investigateCloseRate().catch(console.error);
