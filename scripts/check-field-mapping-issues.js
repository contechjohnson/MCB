/**
 * Check Field Mapping Issues
 *
 * Investigates Q1, Q2, objections, and chatbot_AB data quality
 * to understand where the field swapping is happening
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkFieldMappingIssues() {
  console.log('🔍 Checking field mapping issues...\n');

  // Check live data (non-historical)
  console.log('=== LIVE DATA (Non-Historical) ===\n');
  const { data: liveContacts, error: liveError } = await supabaseAdmin
    .from('contacts')
    .select('id, first_name, source, chatbot_ab, q1_question, q2_question, objections, subscribe_date, stage')
    .not('source', 'like', '%_historical%')
    .not('q1_question', 'is', null)
    .order('subscribe_date', { ascending: false })
    .limit(10);

  if (liveError) {
    console.error('Error fetching live contacts:', liveError);
    return;
  }

  console.log(`Found ${liveContacts.length} live contacts with Q1/Q2 data:\n`);

  liveContacts.forEach(contact => {
    console.log(`Contact: ${contact.first_name || 'Unknown'} (${contact.id})`);
    console.log(`  Source: ${contact.source}`);
    console.log(`  Chatbot AB: ${contact.chatbot_ab || 'NULL'}`);
    console.log(`  Q1: ${contact.q1_question || 'NULL'}`);
    console.log(`  Q2: ${contact.q2_question || 'NULL'}`);
    console.log(`  Objections: ${contact.objections || 'NULL'}`);
    console.log(`  Stage: ${contact.stage}`);
    console.log(`  Subscribe Date: ${contact.subscribe_date}\n`);
  });

  // Check historical data
  console.log('\n=== HISTORICAL DATA ===\n');
  const { data: historicalContacts, error: historicalError } = await supabaseAdmin
    .from('contacts')
    .select('id, first_name, source, chatbot_ab, q1_question, q2_question, objections, subscribe_date')
    .like('source', '%_historical%')
    .not('q1_question', 'is', null)
    .limit(10);

  if (historicalError) {
    console.error('Error fetching historical contacts:', historicalError);
    return;
  }

  console.log(`Found ${historicalContacts.length} historical contacts with Q1/Q2 data:\n`);

  historicalContacts.forEach(contact => {
    console.log(`Contact: ${contact.first_name || 'Unknown'} (${contact.id})`);
    console.log(`  Source: ${contact.source}`);
    console.log(`  Chatbot AB: ${contact.chatbot_ab || 'NULL'}`);
    console.log(`  Q1: ${contact.q1_question || 'NULL'}`);
    console.log(`  Q2: ${contact.q2_question || 'NULL'}`);
    console.log(`  Objections: ${contact.objections || 'NULL'}`);
    console.log(`  Subscribe Date: ${contact.subscribe_date}\n`);
  });

  // Analyze chatbot_AB values
  console.log('\n=== CHATBOT AB VALUE ANALYSIS ===\n');
  const { data: chatbotABValues, error: chatbotError } = await supabaseAdmin
    .from('contacts')
    .select('chatbot_ab')
    .not('chatbot_ab', 'is', null);

  if (chatbotError) {
    console.error('Error analyzing chatbot_AB:', chatbotError);
    return;
  }

  const chatbotCounts = {};
  chatbotABValues.forEach(c => {
    const val = c.chatbot_ab;
    chatbotCounts[val] = (chatbotCounts[val] || 0) + 1;
  });

  console.log('Chatbot AB value distribution:');
  Object.entries(chatbotCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([value, count]) => {
      const isValid = value === 'A-OCT30' || value === 'B-OCT30';
      console.log(`  ${value}: ${count} ${isValid ? '✅' : '❌ INVALID'}`);
    });

  // Check for common mismatches
  console.log('\n=== PATTERN DETECTION ===\n');

  // Pattern 1: Is Q1 actually symptoms (should be months postpartum)?
  const { data: q1Patterns, error: q1Error } = await supabaseAdmin
    .from('contacts')
    .select('q1_question')
    .not('q1_question', 'is', null)
    .limit(100);

  if (!q1Error) {
    const symptomLikeQ1 = q1Patterns.filter(c => {
      const val = c.q1_question?.toLowerCase() || '';
      return val.includes('exhaust') || val.includes('brain fog') ||
             val.includes('anxiety') || val.includes('depress') ||
             val.includes('weight') || val.includes('sleep');
    });

    console.log(`Q1 Analysis (out of ${q1Patterns.length} contacts):`);
    console.log(`  - Contains symptom keywords: ${symptomLikeQ1.length} ❌ (should be months postpartum)`);
    console.log(`  - Looks correct: ${q1Patterns.length - symptomLikeQ1.length} ✅`);
  }

  // Pattern 2: Is objections actually symptoms?
  const { data: objectionPatterns, error: objError } = await supabaseAdmin
    .from('contacts')
    .select('objections')
    .not('objections', 'is', null)
    .limit(100);

  if (!objError) {
    const symptomLikeObjections = objectionPatterns.filter(c => {
      const val = c.objections?.toLowerCase() || '';
      return val.includes('exhaust') || val.includes('brain fog') ||
             val.includes('anxiety') || val.includes('depress') ||
             val.includes('weight') || val.includes('sleep');
    });

    console.log(`\nObjections Analysis (out of ${objectionPatterns.length} contacts):`);
    console.log(`  - Contains symptom keywords: ${symptomLikeObjections.length} ❌ (should be objections)`);
    console.log(`  - Looks correct: ${objectionPatterns.length - symptomLikeObjections.length} ✅`);
  }
}

checkFieldMappingIssues()
  .then(() => {
    console.log('\n✅ Analysis complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
