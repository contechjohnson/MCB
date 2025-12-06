require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyOrphans() {
  console.log('=== VERIFYING ALL PAYMENTS ===\n');

  // Get ALL payments (orphan and linked)
  const { data: allPayments } = await supabase
    .from('payments')
    .select('*')
    .order('payment_date', { ascending: false });

  const orphans = allPayments.filter(p => !p.contact_id);
  const linked = allPayments.filter(p => p.contact_id);

  console.log('TOTAL PAYMENTS IN DATABASE:');
  console.log(`  Total: ${allPayments.length}`);
  console.log(`  Linked: ${linked.length}`);
  console.log(`  Orphaned: ${orphans.length}`);
  console.log('');

  const orphanTotal = orphans.reduce((sum, p) => sum + Number(p.amount), 0);
  const linkedTotal = linked.reduce((sum, p) => sum + Number(p.amount), 0);
  const grandTotal = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  console.log('REVENUE TOTALS:');
  console.log(`  Linked Revenue: $${linkedTotal.toLocaleString()}`);
  console.log(`  Orphan Revenue: $${orphanTotal.toLocaleString()}`);
  console.log(`  Grand Total: $${grandTotal.toLocaleString()}`);
  console.log('');

  console.log(`ORPHAN RATE: ${((orphans.length / allPayments.length) * 100).toFixed(1)}%`);
  console.log('');

  // Breakdown by source
  const orphansBySource = {};
  const linkedBySource = {};

  orphans.forEach(p => {
    orphansBySource[p.payment_source] = (orphansBySource[p.payment_source] || 0) + Number(p.amount);
  });

  linked.forEach(p => {
    linkedBySource[p.payment_source] = (linkedBySource[p.payment_source] || 0) + Number(p.amount);
  });

  console.log('BY SOURCE:');
  console.log('Orphaned:');
  Object.entries(orphansBySource).forEach(([source, total]) => {
    console.log(`  ${source}: $${total.toLocaleString()}`);
  });
  console.log('Linked:');
  Object.entries(linkedBySource).forEach(([source, total]) => {
    console.log(`  ${source}: $${total.toLocaleString()}`);
  });
  console.log('');

  console.log('=== ALL ORPHAN PAYMENTS (DETAILED) ===\n');
  orphans.forEach((p, i) => {
    console.log(`${i + 1}. ${p.customer_email}`);
    console.log(`   Name: ${p.customer_name}`);
    console.log(`   Amount: $${p.amount}`);
    console.log(`   Date: ${p.payment_date.substring(0, 10)}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   Source: ${p.payment_source}`);
    if (p.denefits_contract_code) {
      console.log(`   Denefits Contract: ${p.denefits_contract_code}`);
    }
    if (p.stripe_session_id) {
      console.log(`   Stripe Session: ${p.stripe_session_id}`);
    }
    console.log('');
  });
}

verifyOrphans().catch(console.error);
