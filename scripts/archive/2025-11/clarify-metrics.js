// Clarify Metrics - What Actually Counts As What?
// User is confused about purchases, meetings, and historical imports
// Let's show EXACTLY what the data looks like

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function clarifyMetrics() {
  console.log('\n🔍 CLARIFYING METRICS - What Actually Is What?\n');
  console.log('=' .repeat(80));

  const { data: allContacts, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n📊 Total Contacts in Database: ${allContacts.length}\n`);

  // 1. PURCHASES - What counts as a purchase?
  console.log('💳 WHAT IS A PURCHASE?\n');
  console.log('-'.repeat(80));

  const purchasedStage = allContacts.filter(c => c.stage === 'purchased');
  const hasPurchaseDate = allContacts.filter(c => c.purchase_date);
  const hasPurchaseAmount = allContacts.filter(c => c.purchase_amount && c.purchase_amount > 0);

  console.log(`Contacts with stage = 'purchased': ${purchasedStage.length}`);
  console.log(`Contacts with purchase_date set: ${hasPurchaseDate.length}`);
  console.log(`Contacts with purchase_amount > 0: ${hasPurchaseAmount.length}`);

  console.log('\n🔬 Let me show you 5 "purchased" contacts:\n');

  purchasedStage.slice(0, 5).forEach((c, i) => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
    console.log(`${i + 1}. ${name}`);
    console.log(`   Email: ${c.email_primary || c.email_booking || c.email_payment || 'none'}`);
    console.log(`   Stage: ${c.stage}`);
    console.log(`   Source: ${c.source || 'not set'}`);
    console.log(`   Created: ${c.created_at.split('T')[0]}`);
    console.log(`   Purchase Date: ${c.purchase_date || 'NOT SET'}`);
    console.log(`   Purchase Amount: $${c.purchase_amount || 0}`);
    console.log(`   Appointment Held Date: ${c.appointment_held_date || 'NOT SET'}`);
    console.log('');
  });

  // 2. MEETINGS - What's the difference between booked and held?
  console.log('\n📅 MEETINGS - Booked vs Held\n');
  console.log('-'.repeat(80));

  // These are the various meeting-related stages and fields
  const hasAppointmentDate = allContacts.filter(c => c.appointment_date);
  const hasAppointmentHeldDate = allContacts.filter(c => c.appointment_held_date);
  const stageBooked = allContacts.filter(c => c.stage === 'booked');
  const stageMeetingHeld = allContacts.filter(c => c.stage === 'meeting_held');

  console.log(`Contacts with appointment_date (BOOKED a meeting): ${hasAppointmentDate.length}`);
  console.log(`Contacts with appointment_held_date (ATTENDED): ${hasAppointmentHeldDate.length}`);
  console.log(`Contacts with stage = 'booked': ${stageBooked.length}`);
  console.log(`Contacts with stage = 'meeting_held': ${stageMeetingHeld.length}`);

  console.log('\n🔬 Let me show you contacts with appointment data:\n');

  const withAppointments = allContacts.filter(c => c.appointment_date || c.appointment_held_date).slice(0, 5);

  withAppointments.forEach((c, i) => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
    console.log(`${i + 1}. ${name}`);
    console.log(`   Stage: ${c.stage}`);
    console.log(`   Source: ${c.source || 'not set'}`);
    console.log(`   Appointment Date (booked): ${c.appointment_date || 'NOT SET'}`);
    console.log(`   Appointment Held Date (attended): ${c.appointment_held_date || 'NOT SET'}`);
    console.log(`   Purchase Date: ${c.purchase_date || 'NOT SET'}`);
    console.log(`   Purchase Amount: $${c.purchase_amount || 0}`);
    console.log('');
  });

  // 3. HISTORICAL IMPORTS - What did they actually do?
  console.log('\n📦 HISTORICAL IMPORTS - What Are They?\n');
  console.log('-'.repeat(80));

  const historicalImport = allContacts.filter(c => c.source === 'historical_import');
  const instagramHistorical = allContacts.filter(c => c.source === 'instagram_historical');

  console.log(`Source = 'historical_import': ${historicalImport.length}`);
  console.log(`Source = 'instagram_historical': ${instagramHistorical.length}`);

  console.log('\n🔬 Sample historical_import contacts:\n');

  historicalImport.slice(0, 3).forEach((c, i) => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
    console.log(`${i + 1}. ${name}`);
    console.log(`   Stage: ${c.stage}`);
    console.log(`   Source: ${c.source}`);
    console.log(`   Created: ${c.created_at.split('T')[0]}`);
    console.log(`   Purchase Date: ${c.purchase_date || 'NOT SET'}`);
    console.log(`   Purchase Amount: $${c.purchase_amount || 0}`);
    console.log('');
  });

  console.log('\n🔬 Sample instagram_historical contacts:\n');

  instagramHistorical.slice(0, 3).forEach((c, i) => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
    console.log(`${i + 1}. ${name}`);
    console.log(`   Stage: ${c.stage}`);
    console.log(`   Source: ${c.source}`);
    console.log(`   Created: ${c.created_at.split('T')[0]}`);
    console.log(`   Purchase Date: ${c.purchase_date || 'NOT SET'}`);
    console.log(`   Purchase Amount: $${c.purchase_amount || 0}`);
    console.log('');
  });

  // 4. ALL SOURCES - Show what sources exist
  console.log('\n📋 ALL SOURCES IN DATABASE\n');
  console.log('-'.repeat(80));

  const sourceCounts = {};
  allContacts.forEach(c => {
    const source = c.source || 'null/not set';
    sourceCounts[source] = (sourceCounts[source] || 0) + 1;
  });

  Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).forEach(([source, count]) => {
    console.log(`${source.padEnd(25)}: ${count}`);
  });

  // 5. STAGE DISTRIBUTION
  console.log('\n\n📊 ALL STAGES IN DATABASE\n');
  console.log('-'.repeat(80));

  const stageCounts = {};
  allContacts.forEach(c => {
    stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;
  });

  Object.entries(stageCounts).sort((a, b) => b[1] - a[1]).forEach(([stage, count]) => {
    console.log(`${stage.padEnd(25)}: ${count}`);
  });

  // 6. THE REAL QUESTION - How many REAL purchases from REAL meetings?
  console.log('\n\n🎯 THE REAL QUESTION: Discovery Calls → Purchases\n');
  console.log('-'.repeat(80));

  console.log('\nLet me find contacts who:');
  console.log('  1. Actually had a discovery call (appointment_held_date is set)');
  console.log('  2. Made a purchase (purchase_date and purchase_amount)');

  const hadDiscoveryCall = allContacts.filter(c => c.appointment_held_date);
  const discoveryCallAndPurchased = allContacts.filter(c =>
    c.appointment_held_date && c.purchase_date && c.purchase_amount > 0
  );

  console.log(`\nContacts who had discovery call: ${hadDiscoveryCall.length}`);
  console.log(`Contacts who had discovery call AND purchased: ${discoveryCallAndPurchased.length}`);

  const realCloseRate = hadDiscoveryCall.length > 0
    ? ((discoveryCallAndPurchased.length / hadDiscoveryCall.length) * 100).toFixed(1)
    : '0.0';

  console.log(`\n💰 REAL CLOSE RATE: ${discoveryCallAndPurchased.length}/${hadDiscoveryCall.length} = ${realCloseRate}%`);

  console.log('\n\n🔬 All contacts with discovery calls:\n');

  hadDiscoveryCall.forEach((c, i) => {
    const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
    const purchased = c.purchase_date && c.purchase_amount > 0 ? `✅ PURCHASED $${c.purchase_amount}` : '❌ NO PURCHASE';
    console.log(`${i + 1}. ${name.padEnd(25)} - ${c.appointment_held_date.split('T')[0]} - ${purchased}`);
  });

  console.log('\n' + '='.repeat(80) + '\n');
}

clarifyMetrics().catch(console.error);
