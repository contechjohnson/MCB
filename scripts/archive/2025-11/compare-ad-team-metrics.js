#!/usr/bin/env node

/**
 * Compare our metrics to the ad team's report
 * Helps identify discrepancies in definitions and attribution
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function compareMetrics() {
  const startStr = '2025-11-13';
  const endStr = '2025-11-20';  // Match their date range (Nov 13-19, exclusive end)

  console.log('=== COMPARING TO AD TEAM METRICS (Nov 13-19) ===\n');

  // Get contacts with appointment_held_date in range
  const { data: meetingsHeld } = await supabase
    .from('contacts')
    .select('*')
    .gte('appointment_held_date', startStr)
    .lt('appointment_held_date', endStr)
    .neq('source', 'instagram_historical');

  const meetingsWithAdId = meetingsHeld.filter(c => c.ad_id);
  const meetingsWithoutAdId = meetingsHeld.filter(c => !c.ad_id);

  console.log('DISCOVERY CALLS (Meetings Held Nov 13-19):');
  console.log('  Total meetings held:', meetingsHeld.length);
  console.log('  With ad_id (attributed):', meetingsWithAdId.length);
  console.log('  Without ad_id:', meetingsWithoutAdId.length);
  console.log('  Ad Team reports: 37');
  console.log('');

  // Get purchases in range
  const { data: purchases } = await supabase
    .from('contacts')
    .select('*')
    .gte('purchase_date', startStr)
    .lt('purchase_date', endStr)
    .neq('source', 'instagram_historical');

  const purchasesWithAdId = purchases.filter(c => c.ad_id);
  const purchasesWithoutAdId = purchases.filter(c => !c.ad_id);

  // Calculate attributed revenue from contacts
  const attributedPurchaseRevenue = purchasesWithAdId.reduce((sum, c) => sum + (parseFloat(c.purchase_amount) || 0), 0);
  const totalPurchaseRevenue = purchases.reduce((sum, c) => sum + (parseFloat(c.purchase_amount) || 0), 0);

  console.log('PACKAGE SALES (Purchases Nov 13-19):');
  console.log('  Total purchases:', purchases.length);
  console.log('  With ad_id (attributed):', purchasesWithAdId.length);
  console.log('  Without ad_id:', purchasesWithoutAdId.length);
  console.log('  Ad Team reports: 12');
  console.log('');

  // Get revenue from payments table
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .gte('payment_date', startStr)
    .lt('payment_date', endStr);

  const totalRevenue = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  console.log('REVENUE (Nov 13-19):');
  console.log('  Total revenue (payments):', '$' + totalRevenue.toLocaleString());
  console.log('  Attributed revenue (contacts w/ ad_id):', '$' + attributedPurchaseRevenue.toLocaleString());
  console.log('  Ad Team reports: $31,175');
  console.log('');

  // New contacts (messaging conversations equivalent)
  const { data: newContacts } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', startStr)
    .lt('created_at', endStr)
    .neq('source', 'instagram_historical');

  const newWithMcId = newContacts.filter(c => c.mc_id);
  const newWithAdId = newContacts.filter(c => c.ad_id);

  console.log('NEW CONTACTS (Nov 13-19):');
  console.log('  Total new contacts:', newContacts.length);
  console.log('  With mc_id (ManyChat):', newWithMcId.length);
  console.log('  With ad_id (attributed):', newWithAdId.length);
  console.log('  Ad Team reports: 747 "Messaging Conversations"');
  console.log('');

  console.log('=== EXPLANATION OF DIFFERENCES ===\n');
  console.log('1. "Messaging Conversations" (747) vs "New Contacts" (' + newContacts.length + ')');
  console.log('   - Their number is from Meta API (anyone who clicked "Send Message")');
  console.log('   - Our number is subscribers who completed ManyChat flow');
  console.log('   - Gap: ~' + (747 - newContacts.length) + ' people clicked but did not complete flow');
  console.log('');
  console.log('2. "Discovery Calls" (37) vs "Meetings Held" (' + meetingsHeld.length + ')');
  console.log('   - Their number is ad-attributed calls only');
  console.log('   - Our number includes ALL meetings (organic + website + attributed)');
  console.log('   - We have ' + meetingsWithAdId.length + ' with ad_id attribution');
  console.log('');
  console.log('3. "Revenue attributed to ads" ($31,175) vs "Total Revenue" ($' + totalRevenue.toLocaleString() + ')');
  console.log('   - Their number filters to attributed purchases only');
  console.log('   - Our number includes ALL payments');
  console.log('');
}

compareMetrics().catch(console.error);
