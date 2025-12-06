#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const startDateArg = process.argv[2];
const endDateArg = process.argv[3];

async function getTrafficBreakdown() {
  const startStr = startDateArg || '2025-11-13';
  const endStr = endDateArg || '2025-11-20';

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .gte('created_at', startStr)
    .lt('created_at', endStr)
    .neq('source', 'instagram_historical');

  const tofMof = contacts.filter(c => c.mc_id);
  const directToForm = contacts.filter(c => !c.mc_id);

  const leadMagnetAdSetIds = [
    '120236928026440652',
    '120236942069970652',
    '120236927208710652',
    '120233842485330652'
  ];

  const leadMagnet = directToForm.filter(c => c.ad_id && leadMagnetAdSetIds.includes(c.ad_id));
  const website = directToForm.filter(c => !c.ad_id);
  const bof = directToForm.filter(c => c.ad_id && !leadMagnetAdSetIds.includes(c.ad_id));

  console.log(`TRAFFIC BREAKDOWN (${startStr} to ${endStr}):\n`);
  console.log(`Total Contacts: ${contacts.length}`);
  console.log(`  TOF/MOF (ManyChat): ${tofMof.length} (${(tofMof.length/contacts.length*100).toFixed(1)}%)`);
  console.log(`  Lead Magnet (Free Gift): ${leadMagnet.length} (${(leadMagnet.length/contacts.length*100).toFixed(1)}%)`);
  console.log(`  BOF (Direct to Purchase): ${bof.length} (${(bof.length/contacts.length*100).toFixed(1)}%)`);
  console.log(`  Website/Organic: ${website.length} (${(website.length/contacts.length*100).toFixed(1)}%)\n`);

  console.log('ATTRIBUTION RATES:');
  const tofInstagram = tofMof.filter(c => c.source === 'instagram' || c.source === 'instagram_lm');
  console.log(`  TOF/MOF: ${tofInstagram.filter(c => c.ad_id).length} of ${tofInstagram.length} have ad_id (${(tofInstagram.filter(c => c.ad_id).length/tofInstagram.length*100).toFixed(1)}%)`);
  console.log(`  Lead Magnet: ${leadMagnet.length} of ${leadMagnet.length} have ad_id (100%)`);
  if (bof.length > 0) {
    console.log(`  BOF: ${bof.length} of ${bof.length} have ad_id (100%)`);
  } else {
    console.log(`  BOF: 0 contacts`);
  }
  console.log('');

  // Check for A/B test
  const chatbotA = tofMof.filter(c => c.chatbot_ab === 'A' && c.created_at >= '2025-11-18');
  const chatbotB = tofMof.filter(c => c.chatbot_ab === 'B' && c.created_at >= '2025-11-18');

  if (chatbotA.length > 0 || chatbotB.length > 0) {
    console.log('A/B TEST (Started Monday Nov 18):');
    console.log(`  Chatbot A (Link Upfront): ${chatbotA.length} contacts`);
    console.log(`  Chatbot B (Control): ${chatbotB.length} contacts`);
    console.log('  Note: Test just started, need 2 weeks of data for conclusions\n');
  }
}

getTrafficBreakdown().catch(console.error);
