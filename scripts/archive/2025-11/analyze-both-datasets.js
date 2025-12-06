/**
 * Analyze Both Historical and Live Data Separately
 *
 * Breaks down issues into two groups:
 * 1. instagram_historical (one big import batch)
 * 2. Everything else (live webhook data)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function analyzeBothDatasets() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 DUAL DATASET ANALYSIS');
  console.log('='.repeat(80) + '\n');

  // ==========================================
  // GROUP 1: instagram_historical
  // ==========================================
  console.log('🗂️  GROUP 1: instagram_historical (Big Import Batch)\n');

  const { data: historicalIG, error: err1 } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('source', 'instagram_historical');

  if (err1) {
    console.error('Error:', err1);
    return;
  }

  console.log(`Total contacts: ${historicalIG.length}\n`);

  // Analyze Q1
  const hist_q1_with_data = historicalIG.filter(c => c.q1_question);
  const hist_q1_looks_like_symptoms = hist_q1_with_data.filter(c => {
    const val = c.q1_question?.toLowerCase() || '';
    return val.length > 10 || val.includes('exhaust') || val.includes('brain') ||
           val.includes('anxiety') || val.includes('depress') || val.includes('weight') ||
           val.includes('rage') || val.includes('tired') || val.includes('mood');
  });

  console.log('Q1 Analysis:');
  console.log(`  Total with Q1: ${hist_q1_with_data.length}`);
  console.log(`  Looks like symptoms (WRONG): ${hist_q1_looks_like_symptoms.length} ❌`);
  console.log(`  Looks like months (correct): ${hist_q1_with_data.length - hist_q1_looks_like_symptoms.length} ✅`);

  // Analyze Q2
  const hist_q2_with_data = historicalIG.filter(c => c.q2_question);
  const hist_q2_looks_like_months = hist_q2_with_data.filter(c => {
    const val = c.q2_question?.trim() || '';
    return /^\d+(\.\d+)?$/.test(val) || val === 'NA' || val === 'NONE';
  });

  console.log('\nQ2 Analysis:');
  console.log(`  Total with Q2: ${hist_q2_with_data.length}`);
  console.log(`  Looks like months (WRONG): ${hist_q2_looks_like_months.length} ❌`);
  console.log(`  Looks like symptoms (correct): ${hist_q2_with_data.length - hist_q2_looks_like_months.length} ✅`);

  // Analyze chatbot_AB
  const hist_chatbot_ab = {};
  historicalIG.forEach(c => {
    if (c.chatbot_ab) {
      hist_chatbot_ab[c.chatbot_ab] = (hist_chatbot_ab[c.chatbot_ab] || 0) + 1;
    }
  });

  const hist_valid_ab = Object.keys(hist_chatbot_ab).filter(v =>
    v.match(/^[AB][\s-]*OCT30$/i)
  );
  const hist_invalid_ab = Object.keys(hist_chatbot_ab).filter(v =>
    !v.match(/^[AB][\s-]*OCT30$/i)
  );

  console.log('\nChatbot AB Analysis:');
  console.log(`  Valid (A/B-OCT30): ${hist_valid_ab.reduce((sum, v) => sum + hist_chatbot_ab[v], 0)} ✅`);
  console.log(`  Invalid (garbage): ${hist_invalid_ab.reduce((sum, v) => sum + hist_chatbot_ab[v], 0)} ❌`);

  if (hist_invalid_ab.length > 0) {
    console.log(`\n  Top 10 invalid values:`);
    hist_invalid_ab
      .sort((a, b) => hist_chatbot_ab[b] - hist_chatbot_ab[a])
      .slice(0, 10)
      .forEach(val => {
        console.log(`    "${val}": ${hist_chatbot_ab[val]}`);
      });
  }

  // Sample data
  console.log('\n  Sample contacts from instagram_historical:');
  historicalIG.slice(0, 3).forEach(c => {
    console.log(`    ${c.first_name || 'Unknown'}:`);
    console.log(`      Q1: "${c.q1_question || 'NULL'}"`);
    console.log(`      Q2: "${c.q2_question || 'NULL'}"`);
    console.log(`      AB: "${c.chatbot_ab || 'NULL'}"`);
  });

  // ==========================================
  // GROUP 2: Everything else (live data)
  // ==========================================
  console.log('\n\n' + '='.repeat(80));
  console.log('🗂️  GROUP 2: Everything Else (Live Webhook Data)\n');

  const { data: liveData, error: err2 } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .not('source', 'eq', 'instagram_historical')
    .not('source', 'is', null);

  if (err2) {
    console.error('Error:', err2);
    return;
  }

  console.log(`Total contacts: ${liveData.length}`);
  console.log(`Sources: ${[...new Set(liveData.map(c => c.source))].join(', ')}\n`);

  // Analyze Q1
  const live_q1_with_data = liveData.filter(c => c.q1_question);
  const live_q1_looks_like_symptoms = live_q1_with_data.filter(c => {
    const val = c.q1_question?.toLowerCase() || '';
    return val.length > 10 || val.includes('exhaust') || val.includes('brain') ||
           val.includes('anxiety') || val.includes('depress') || val.includes('weight') ||
           val.includes('rage') || val.includes('tired') || val.includes('mood');
  });

  console.log('Q1 Analysis:');
  console.log(`  Total with Q1: ${live_q1_with_data.length}`);
  console.log(`  Looks like symptoms (WRONG): ${live_q1_looks_like_symptoms.length} ${live_q1_looks_like_symptoms.length > 0 ? '❌' : '✅'}`);
  console.log(`  Looks like months (correct): ${live_q1_with_data.length - live_q1_looks_like_symptoms.length} ✅`);

  if (live_q1_looks_like_symptoms.length > 0) {
    console.log('\n  ⚠️  Q1 values that look wrong:');
    live_q1_looks_like_symptoms.slice(0, 5).forEach(c => {
      console.log(`    ${c.first_name} (${c.source}): "${c.q1_question}"`);
    });
  }

  // Analyze Q2
  const live_q2_with_data = liveData.filter(c => c.q2_question);
  const live_q2_looks_like_months = live_q2_with_data.filter(c => {
    const val = c.q2_question?.trim() || '';
    return /^\d+(\.\d+)?$/.test(val) || val === 'NA' || val === 'NONE';
  });

  console.log('\nQ2 Analysis:');
  console.log(`  Total with Q2: ${live_q2_with_data.length}`);
  console.log(`  Looks like months (WRONG): ${live_q2_looks_like_months.length} ${live_q2_looks_like_months.length > 0 ? '❌' : '✅'}`);
  console.log(`  Looks like symptoms (correct): ${live_q2_with_data.length - live_q2_looks_like_months.length} ✅`);

  if (live_q2_looks_like_months.length > 0) {
    console.log('\n  ⚠️  Q2 values that look wrong:');
    live_q2_looks_like_months.slice(0, 5).forEach(c => {
      console.log(`    ${c.first_name} (${c.source}): "${c.q2_question}"`);
    });
  }

  // Analyze chatbot_AB
  const live_chatbot_ab = {};
  liveData.forEach(c => {
    if (c.chatbot_ab) {
      live_chatbot_ab[c.chatbot_ab] = (live_chatbot_ab[c.chatbot_ab] || 0) + 1;
    }
  });

  const live_valid_ab = Object.keys(live_chatbot_ab).filter(v =>
    v.match(/^[AB][\s-]*OCT30$/i)
  );
  const live_invalid_ab = Object.keys(live_chatbot_ab).filter(v =>
    !v.match(/^[AB][\s-]*OCT30$/i)
  );

  console.log('\nChatbot AB Analysis:');
  console.log(`  Valid (A/B-OCT30): ${live_valid_ab.reduce((sum, v) => sum + live_chatbot_ab[v], 0)} ✅`);
  console.log(`  Invalid (garbage): ${live_invalid_ab.reduce((sum, v) => sum + live_chatbot_ab[v], 0)} ${live_invalid_ab.length > 0 ? '❌' : '✅'}`);

  if (live_invalid_ab.length > 0) {
    console.log(`\n  ⚠️  Invalid chatbot_AB values:`);
    live_invalid_ab
      .sort((a, b) => live_chatbot_ab[b] - live_chatbot_ab[a])
      .forEach(val => {
        console.log(`    "${val}": ${live_chatbot_ab[val]}`);
      });
  }

  // Check for spacing issues
  const live_spacing_issues = Object.keys(live_chatbot_ab).filter(v =>
    (v === 'A - OCT30' || v === 'B - OCT30') // Has spaces
  );

  if (live_spacing_issues.length > 0) {
    console.log(`\n  ℹ️  Spacing variations found (not invalid, just inconsistent):`);
    live_spacing_issues.forEach(val => {
      console.log(`    "${val}": ${live_chatbot_ab[val]} (should be "${val.replace(' - ', '-')}")`);
    });
  }

  // Sample data
  console.log('\n  Sample contacts from live data:');
  liveData.filter(c => c.q1_question).slice(0, 3).forEach(c => {
    console.log(`    ${c.first_name || 'Unknown'} (${c.source}):`);
    console.log(`      Q1: "${c.q1_question || 'NULL'}"`);
    console.log(`      Q2: "${c.q2_question || 'NULL'}"`);
    console.log(`      AB: "${c.chatbot_ab || 'NULL'}"`);
  });

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 SUMMARY');
  console.log('='.repeat(80) + '\n');

  console.log('GROUP 1 (instagram_historical):');
  console.log(`  Issues found: ${hist_q1_looks_like_symptoms.length > 0 || hist_q2_looks_like_months.length > 0 || hist_invalid_ab.length > 0 ? 'YES ❌' : 'NONE ✅'}`);
  if (hist_q1_looks_like_symptoms.length > 0) {
    console.log(`    - Q1 has symptoms: ${hist_q1_looks_like_symptoms.length} contacts`);
  }
  if (hist_q2_looks_like_months.length > 0) {
    console.log(`    - Q2 has months: ${hist_q2_looks_like_months.length} contacts`);
  }
  if (hist_invalid_ab.length > 0) {
    console.log(`    - Invalid chatbot_AB: ${hist_invalid_ab.reduce((sum, v) => sum + hist_chatbot_ab[v], 0)} contacts`);
  }

  console.log('\nGROUP 2 (live data):');
  console.log(`  Issues found: ${live_q1_looks_like_symptoms.length > 0 || live_q2_looks_like_months.length > 0 || live_invalid_ab.length > 0 ? 'YES ❌' : 'NONE ✅'}`);
  if (live_q1_looks_like_symptoms.length > 0) {
    console.log(`    - Q1 has symptoms: ${live_q1_looks_like_symptoms.length} contacts`);
  }
  if (live_q2_looks_like_months.length > 0) {
    console.log(`    - Q2 has months: ${live_q2_looks_like_months.length} contacts`);
  }
  if (live_invalid_ab.length > 0) {
    console.log(`    - Invalid chatbot_AB: ${live_invalid_ab.reduce((sum, v) => sum + live_chatbot_ab[v], 0)} contacts`);
  }
  if (live_spacing_issues.length > 0) {
    console.log(`    - Spacing inconsistencies: ${live_spacing_issues.reduce((sum, v) => sum + live_chatbot_ab[v], 0)} contacts (minor)`);
  }

  console.log('\n');
}

analyzeBothDatasets()
  .then(() => {
    console.log('✅ Analysis complete\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
