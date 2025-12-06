require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeOrphanDates() {
  console.log('=== ORPHAN PAYMENT DATE ANALYSIS ===\n');

  const systemLaunchDate = new Date('2025-11-01'); // System went live early November

  // Get all orphan payments
  const { data: orphans } = await supabase
    .from('payments')
    .select('*')
    .is('contact_id', null)
    .order('payment_date', { ascending: false });

  const beforeLaunch = [];
  const afterLaunch = [];

  orphans.forEach(p => {
    const paymentDate = new Date(p.payment_date);
    if (paymentDate < systemLaunchDate) {
      beforeLaunch.push(p);
    } else {
      afterLaunch.push(p);
    }
  });

  const beforeTotal = beforeLaunch.reduce((sum, p) => sum + Number(p.amount), 0);
  const afterTotal = afterLaunch.reduce((sum, p) => sum + Number(p.amount), 0);

  console.log('TRACKING SYSTEM LAUNCH: ~November 1, 2025\n');

  console.log('═══════════════════════════════════════════════════════');
  console.log('BEFORE TRACKING (Expected Orphans)');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Count: ${beforeLaunch.length}`);
  console.log(`Total: $${beforeTotal.toLocaleString()}`);
  console.log(`Date Range: ${beforeLaunch[beforeLaunch.length - 1]?.payment_date.substring(0, 10)} to ${beforeLaunch[0]?.payment_date.substring(0, 10)}`);
  console.log('\nThese are EXPECTED - system wasn\'t tracking yet.\n');

  if (beforeLaunch.length > 0) {
    console.log('List:');
    beforeLaunch.forEach((p, i) => {
      console.log(`${i + 1}. ${p.customer_email} - $${p.amount} - ${p.payment_date.substring(0, 10)}`);
    });
  }

  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('AFTER TRACKING LAUNCH (Unexpected Orphans) ⚠️');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Count: ${afterLaunch.length}`);
  console.log(`Total: $${afterTotal.toLocaleString()}`);
  if (afterLaunch.length > 0) {
    console.log(`Date Range: ${afterLaunch[afterLaunch.length - 1]?.payment_date.substring(0, 10)} to ${afterLaunch[0]?.payment_date.substring(0, 10)}`);
  }
  console.log('\nThese are CONCERNING - system should have tracked them!\n');

  if (afterLaunch.length > 0) {
    console.log('List:');
    afterLaunch.forEach((p, i) => {
      console.log(`${i + 1}. ${p.customer_email} - $${p.amount} - ${p.payment_date.substring(0, 10)}`);
    });
  }

  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total Orphans: ${orphans.length} ($${(beforeTotal + afterTotal).toLocaleString()})`);
  console.log(`  Expected (pre-tracking): ${beforeLaunch.length} ($${beforeTotal.toLocaleString()})`);
  console.log(`  Unexpected (post-tracking): ${afterLaunch.length} ($${afterTotal.toLocaleString()})`);
  console.log('');
  console.log('RECOMMENDATION:');
  console.log('  • Expected orphans: Import from historical data OR create contacts');
  console.log('  • Unexpected orphans: Investigate why tracking failed + create contacts');
}

analyzeOrphanDates().catch(console.error);
