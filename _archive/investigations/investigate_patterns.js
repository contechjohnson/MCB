require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

(async () => {
  console.log('\n=== Q4: BOF Funnel Pattern Analysis ===\n');
  const { data: patterns } = await supabase.from('contacts').select('mc_id, ad_id, trigger_word, chatbot_ab, source').gte('created_at', '2025-11-07').neq('source', 'instagram_historical');
  
  const grouped = {};
  patterns.forEach(c => {
    const key = (c.mc_id ? 'MC' : 'NoMC') + '_' + (c.ad_id ? 'AD' : 'NoAD') + '_' + (c.trigger_word || 'null') + '_' + (c.chatbot_ab || 'null') + '_' + c.source;
    grouped[key] = (grouped[key] || 0) + 1;
  });
  
  const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 15);
  sorted.forEach(([k, v]) => {
    console.log(k.replace(/_/g, ' | '), ':', v);
  });
  
  console.log('\n=== Q5: Duplicate Ad Names ===\n');
  const { data: ads } = await supabase.from('meta_ads').select('ad_id, ad_name').eq('is_active', true);
  const nameMap = {};
  ads.forEach(a => {
    if (!nameMap[a.ad_name]) nameMap[a.ad_name] = [];
    nameMap[a.ad_name].push(a.ad_id);
  });
  const dupes = Object.entries(nameMap).filter(([n, ids]) => ids.length > 1);
  if (dupes.length === 0) {
    console.log('No duplicate ad names found.');
  } else {
    dupes.forEach(([name, ids]) => console.log(name + ':', ids.length + ' IDs'));
  }
  
  console.log('\n=== Q6: CPL Calculation (Our Contacts vs Meta Leads) ===\n');
  const { data: metaAds } = await supabase.from('meta_ads').select('*').eq('is_active', true);
  const { data: insights } = await supabase.from('meta_ad_insights').select('*').gte('snapshot_date', '2025-11-07');
  const { data: contacts } = await supabase.from('contacts').select('ad_id, created_at').gte('created_at', '2025-11-07').neq('source', 'instagram_historical').not('ad_id', 'is', null);
  
  const adStats = {};
  insights.forEach(i => {
    if (!adStats[i.ad_id]) {
      adStats[i.ad_id] = { spend: 0, meta_leads: 0, our_contacts: 0, ad_name: '' };
    }
    adStats[i.ad_id].spend += parseFloat(i.spend || 0);
    adStats[i.ad_id].meta_leads += parseInt(i.leads || 0);
  });
  
  contacts.forEach(c => {
    if (adStats[c.ad_id]) {
      adStats[c.ad_id].our_contacts++;
    }
  });
  
  metaAds.forEach(a => {
    if (adStats[a.ad_id]) {
      adStats[a.ad_id].ad_name = a.ad_name;
    }
  });
  
  const sorted2 = Object.entries(adStats).filter(([id, s]) => s.spend > 0).sort((a, b) => b[1].our_contacts - a[1].our_contacts).slice(0, 15);
  sorted2.forEach(([id, s]) => {
    const ourCPL = s.our_contacts > 0 ? (s.spend / s.our_contacts).toFixed(2) : 'N/A';
    const metaCPL = s.meta_leads > 0 ? (s.spend / s.meta_leads).toFixed(2) : 'N/A';
    console.log(s.ad_name || id);
    console.log('  Our Contacts:', s.our_contacts, '| Meta Leads:', s.meta_leads, '| Spend: $' + s.spend.toFixed(2));
    console.log('  Our CPL: $' + ourCPL, '| Meta CPL: $' + metaCPL);
    console.log('');
  });
})();
