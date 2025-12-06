// Weekly Funnel Breakdown - Go Forward Campaign
// Shows week-by-week progression and recent activity

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function getWeekNumber(date) {
  const d = new Date(date);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - jan1) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + jan1.getDay() + 1) / 7);
}

function getWeekLabel(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekNum = getWeekNumber(dateStr);

  // Get start of week (Sunday)
  const dayOfWeek = date.getDay();
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - dayOfWeek);

  const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][startOfWeek.getMonth()];

  return `Week ${weekNum} (${monthName} ${startOfWeek.getDate()})`;
}

async function analyzeWeekly() {
  console.log('\n📅 WEEKLY FUNNEL BREAKDOWN - Go Forward Campaign\n');
  console.log('=' .repeat(80));

  // Get all contacts (Go Forward only)
  const { data: allContacts, error } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', '2024-11-01')
    .neq('source', 'historical_import')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`\n📊 Total Contacts: ${allContacts.length}`);
  console.log(`Date Range: ${allContacts[0]?.created_at?.split('T')[0]} to ${allContacts[allContacts.length - 1]?.created_at?.split('T')[0]}`);

  // Group by week
  const weeklyData = {};

  allContacts.forEach(contact => {
    const weekLabel = getWeekLabel(contact.created_at);

    if (!weeklyData[weekLabel]) {
      weeklyData[weekLabel] = {
        total: 0,
        new_lead: 0,
        dm_qualified: 0,
        link_clicked: 0,
        booked: 0,
        meeting_held: 0,
        package_sent: 0,
        purchased: 0,
        revenue: 0,
        contacts: []
      };
    }

    weeklyData[weekLabel].total++;
    weeklyData[weekLabel][contact.stage] = (weeklyData[weekLabel][contact.stage] || 0) + 1;

    if (contact.stage === 'purchased' && contact.purchase_amount) {
      weeklyData[weekLabel].revenue += contact.purchase_amount;
    }

    weeklyData[weekLabel].contacts.push(contact);
  });

  console.log('\n\n📈 WEEK-BY-WEEK BREAKDOWN\n');
  console.log('='.repeat(80));

  const weeks = Object.keys(weeklyData).sort();

  weeks.forEach(week => {
    const data = weeklyData[week];
    const dmQualifiedCount = data.dm_qualified + data.link_clicked + data.booked + data.meeting_held + data.package_sent + data.purchased;
    const linkClickedCount = data.link_clicked + data.booked + data.meeting_held + data.package_sent + data.purchased;
    const bookedCount = data.booked + data.meeting_held + data.package_sent + data.purchased;

    console.log(`\n${week}`);
    console.log('-'.repeat(80));
    console.log(`  New Contacts: ${data.total}`);
    console.log(`  DM Qualified: ${dmQualifiedCount} (${((dmQualifiedCount/data.total)*100).toFixed(1)}%)`);
    console.log(`  Link Clicked: ${linkClickedCount} (${dmQualifiedCount > 0 ? ((linkClickedCount/dmQualifiedCount)*100).toFixed(1) : '0.0'}%)`);
    console.log(`  Booked: ${bookedCount}`);
    console.log(`  Meeting Held: ${data.meeting_held + data.package_sent + data.purchased}`);
    console.log(`  Purchased: ${data.purchased}`);
    console.log(`  Revenue: $${data.revenue.toLocaleString()}`);
  });

  // Recent Activity (Last 7 days)
  console.log('\n\n🔥 RECENT ACTIVITY (Last 7 Days)\n');
  console.log('='.repeat(80));

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentContacts = allContacts.filter(c => new Date(c.created_at) >= sevenDaysAgo);

  console.log(`\nNew Contacts: ${recentContacts.length}`);

  const recentByStage = {};
  recentContacts.forEach(c => {
    recentByStage[c.stage] = (recentByStage[c.stage] || 0) + 1;
  });

  console.log('\nStage Distribution:');
  Object.entries(recentByStage).sort((a, b) => b[1] - a[1]).forEach(([stage, count]) => {
    console.log(`  ${stage.padEnd(20)}: ${count}`);
  });

  // Last 48 hours
  console.log('\n\n⚡ LAST 48 HOURS\n');
  console.log('='.repeat(80));

  const twoDaysAgo = new Date();
  twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

  const last48Hours = allContacts.filter(c => new Date(c.created_at) >= twoDaysAgo);

  console.log(`\nNew Contacts: ${last48Hours.length}\n`);

  if (last48Hours.length > 0) {
    console.log('Recent Activity:');
    last48Hours.reverse().slice(0, 20).forEach(c => {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
      const email = c.email_primary || c.email_booking || c.email_payment || 'No email';
      const date = new Date(c.created_at).toLocaleString();
      console.log(`  ${date} - ${name} (${email}) - ${c.stage}`);
    });
  } else {
    console.log('  No new contacts in the last 48 hours');
  }

  // Activity by day (last 14 days)
  console.log('\n\n📊 DAILY ACTIVITY (Last 14 Days)\n');
  console.log('='.repeat(80));

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const dailyData = {};
  allContacts
    .filter(c => new Date(c.created_at) >= fourteenDaysAgo)
    .forEach(c => {
      const day = c.created_at.split('T')[0];
      if (!dailyData[day]) {
        dailyData[day] = { total: 0, purchased: 0, revenue: 0 };
      }
      dailyData[day].total++;
      if (c.stage === 'purchased') {
        dailyData[day].purchased++;
        dailyData[day].revenue += c.purchase_amount || 0;
      }
    });

  const days = Object.keys(dailyData).sort().reverse();

  console.log('\n' + 'Date'.padEnd(15) + 'New Contacts'.padEnd(15) + 'Purchases'.padEnd(12) + 'Revenue');
  console.log('-'.repeat(80));

  days.forEach(day => {
    const data = dailyData[day];
    const dateStr = new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    console.log(
      dateStr.padEnd(15) +
      data.total.toString().padEnd(15) +
      data.purchased.toString().padEnd(12) +
      `$${data.revenue.toLocaleString()}`
    );
  });

  console.log('\n' + '='.repeat(80) + '\n');
}

analyzeWeekly().catch(console.error);
