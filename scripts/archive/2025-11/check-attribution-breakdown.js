#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkAttribution() {
  const startStr = '2025-11-13';
  const endStr = '2025-11-21';

  // Get all purchases this week
  const { data: purchases } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, purchase_amount, purchase_date, ad_id, source, mc_id')
    .gte('purchase_date', startStr)
    .lt('purchase_date', endStr)
    .neq('source', 'instagram_historical');

  const withAdId = purchases.filter(p => p.ad_id);
  const withoutAdId = purchases.filter(p => !p.ad_id);

  const attributedRev = withAdId.reduce((s, p) => s + (parseFloat(p.purchase_amount) || 0), 0);
  const unattributedRev = withoutAdId.reduce((s, p) => s + (parseFloat(p.purchase_amount) || 0), 0);
  const totalRev = attributedRev + unattributedRev;
  const adSpend = 12828;

  console.log('=== REVENUE ATTRIBUTION BREAKDOWN (Nov 13-21) ===\n');

  console.log('📊 THREE-WAY BREAKDOWN:\n');
  console.log('1️⃣  AD-ATTRIBUTED (has ad_id):');
  console.log('    Purchases: ' + withAdId.length);
  console.log('    Revenue: $' + attributedRev.toLocaleString());
  console.log('    % of Total: ' + (attributedRev/totalRev*100).toFixed(0) + '%');
  console.log('    Attributed ROAS: ' + (attributedRev / adSpend).toFixed(2) + 'x');
  console.log('');

  console.log('2️⃣  UNATTRIBUTED (no ad_id):');
  console.log('    Purchases: ' + withoutAdId.length);
  console.log('    Revenue: $' + unattributedRev.toLocaleString());
  console.log('    % of Total: ' + (unattributedRev/totalRev*100).toFixed(0) + '%');
  console.log('');

  console.log('3️⃣  TOTAL:');
  console.log('    Purchases: ' + purchases.length);
  console.log('    Revenue: $' + totalRev.toLocaleString());
  console.log('    Full ROAS: ' + (totalRev / adSpend).toFixed(2) + 'x');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📈 COMPARISON WITH AD TEAM:\n');
  console.log('| Metric | Ad Team (Meta) | Us (Attributed) | Us (Total) |');
  console.log('|--------|----------------|-----------------|------------|');
  console.log('| Revenue | $31,175 | $' + attributedRev.toLocaleString() + ' | $' + totalRev.toLocaleString() + ' |');
  console.log('| ROAS | 2.08x | ' + (attributedRev / adSpend).toFixed(2) + 'x | ' + (totalRev / adSpend).toFixed(2) + 'x |');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📋 ATTRIBUTED PURCHASES (with ad_id):\n');
  withAdId.forEach(p => {
    console.log('  • ' + p.first_name + ' ' + (p.last_name || '').slice(0,1) + ': $' + (p.purchase_amount || 0).toLocaleString());
  });

  console.log('\n📋 UNATTRIBUTED PURCHASES (no ad_id):\n');
  withoutAdId.forEach(p => {
    const src = p.mc_id ? 'ManyChat (pre-tracking)' : (p.source || 'unknown');
    console.log('  • ' + p.first_name + ' ' + (p.last_name || '').slice(0,1) + ': $' + (p.purchase_amount || 0).toLocaleString() + ' [' + src + ']');
  });
}

checkAttribution().catch(console.error);
