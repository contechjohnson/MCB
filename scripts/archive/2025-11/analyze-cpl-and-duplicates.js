#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function analyzeCplAndDuplicates() {
  const startStr = '2025-11-07';
  const endStr = '2025-11-14';

  console.log('🔍 ANALYZING CPL CALCULATION & DUPLICATE AD NAMES\n');

  // Get all meta ads
  const { data: metaAds } = await supabase
    .from('meta_ads')
    .select('ad_id, ad_name, is_active, spend');

  // Get weekly insights
  const { data: allInsights } = await supabase
    .from('meta_ad_insights')
    .select('ad_id, spend, snapshot_date')
    .order('snapshot_date', { ascending: false });

  // Calculate weekly spend per ad
  const adWeeklySpend = {};
  if (allInsights) {
    allInsights.forEach(insight => {
      const spend = Number(insight.spend) || 0;
      if (insight.snapshot_date >= startStr && insight.snapshot_date < endStr) {
        adWeeklySpend[insight.ad_id] = (adWeeklySpend[insight.ad_id] || 0) + spend;
      }
    });
  }

  // Get contacts created this week
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', startStr)
    .lt('created_at', endStr)
    .neq('source', 'instagram_historical');

  // Calculate contacts per ad
  const adContacts = {};
  contacts.forEach(c => {
    if (!c.ad_id) return;
    adContacts[c.ad_id] = (adContacts[c.ad_id] || 0) + 1;
  });

  console.log('📊 CPL CALCULATION BREAKDOWN:\n');
  console.log('CPL Formula: Weekly Ad Spend / New Contacts This Week\n');

  // Example: VSLQ2 ads
  const vslq2Ads = metaAds.filter(ad => ad.ad_name && ad.ad_name.includes('VSLQ2'));

  if (vslq2Ads.length > 0) {
    console.log(`Found ${vslq2Ads.length} ads with "VSLQ2" in name:\n`);
    vslq2Ads.forEach(ad => {
      const weeklySpend = adWeeklySpend[ad.ad_id] || 0;
      const newContacts = adContacts[ad.ad_id] || 0;
      const cpl = newContacts > 0 ? (weeklySpend / newContacts) : 0;

      console.log(`AD_ID: ${ad.ad_id}`);
      console.log(`Name: ${ad.ad_name}`);
      console.log(`Weekly Spend: $${weeklySpend.toFixed(2)}`);
      console.log(`New Contacts: ${newContacts}`);
      console.log(`Calculated CPL: $${cpl.toFixed(2)}`);
      console.log(`Active: ${ad.is_active}\n`);
    });
  }

  // Check for duplicate ad names (same name, different IDs)
  console.log('\n🔄 CHECKING FOR DUPLICATE AD NAMES:\n');
  const adNameToIds = {};
  metaAds.forEach(ad => {
    const name = ad.ad_name;
    if (!adNameToIds[name]) {
      adNameToIds[name] = [];
    }
    adNameToIds[name].push(ad.ad_id);
  });

  const duplicates = Object.entries(adNameToIds).filter(([name, ids]) => ids.length > 1);

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} ad names with multiple IDs:\n`);
    duplicates.slice(0, 10).forEach(([name, ids]) => {
      console.log(`"${name}"`);
      console.log(`  Has ${ids.length} different ad_ids:`);
      ids.forEach(id => {
        const weeklySpend = adWeeklySpend[id] || 0;
        const newContacts = adContacts[id] || 0;
        const cpl = newContacts > 0 ? (weeklySpend / newContacts) : 0;
        console.log(`    - ${id}: $${weeklySpend.toFixed(2)} spend, ${newContacts} contacts, $${cpl.toFixed(2)} CPL`);
      });
      console.log('');
    });
  } else {
    console.log('No duplicate ad names found.\n');
  }

  // Compare CPL to Meta's "Lead" metric
  console.log('\n💡 EXPLANATION:\n');
  console.log('Report CPL = Weekly Spend / New ManyChat/GHL Contacts This Week');
  console.log('Meta CPL = Weekly Spend / Meta "Leads" (form submissions or pixel events)');
  console.log('\nThese can differ because:');
  console.log('  1. Report counts ManyChat subscribers (DM flow)');
  console.log('  2. Meta counts form submissions or lead events');
  console.log('  3. Not all ManyChat subscribers fill forms');
  console.log('  4. BOF ads go direct to forms (no ManyChat)\n');
}

analyzeCplAndDuplicates().catch(console.error);
