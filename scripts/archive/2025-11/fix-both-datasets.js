#!/usr/bin/env node
/**
 * Fix Both Historical and Live Data Issues
 *
 * GROUP 1 (instagram_historical):
 * - Swap Q1 ↔ Q2 (Q1 has symptoms, Q2 has months - backwards)
 * - Clean chatbot_AB (remove symptom values)
 *
 * GROUP 2 (live data):
 * - Fix Q1 text values (convert "Almost 3 years" → "36", etc.)
 * - Fix Q2 "NONE" values → NULL
 * - Normalize chatbot_AB spacing ("A - OCT30" → "A-OCT30")
 *
 * SAFETY:
 * - Creates backup before changes
 * - Can be rolled back
 * - Dry-run mode available
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Convert text month descriptions to numbers
 */
function normalizeMonths(text) {
  if (!text || typeof text !== 'string') return null;

  const lower = text.toLowerCase().trim();

  // Already a number
  if (/^\d+(\.\d+)?$/.test(lower)) return text;

  // "Less than 1" → "0.5"
  if (lower.includes('less than 1')) return '0.5';

  // Extract years
  const yearMatch = lower.match(/(\d+)\s*years?/);
  if (yearMatch) {
    const years = parseInt(yearMatch[1]);
    return (years * 12).toString();
  }

  // Extract months
  const monthMatch = lower.match(/(\d+)\s*months?/);
  if (monthMatch) {
    return monthMatch[1];
  }

  // Extract weeks (convert to months)
  const weekMatch = lower.match(/(\d+)\s*weeks?/);
  if (weekMatch) {
    const weeks = parseInt(weekMatch[1]);
    const months = Math.round(weeks / 4);
    return months.toString();
  }

  // "Almost X years" → X*12
  const almostYearMatch = lower.match(/almost\s+(\d+)\s*years?/);
  if (almostYearMatch) {
    const years = parseInt(almostYearMatch[1]);
    return (years * 12).toString();
  }

  // Can't parse - return null
  return null;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 FIX BOTH HISTORICAL AND LIVE DATA');
  console.log('='.repeat(80));
  console.log(`\nMode: ${DRY_RUN ? '🔍 DRY RUN' : '💾 LIVE FIX'}\n`);

  // ==========================================
  // STEP 1: Create backup
  // ==========================================
  if (!DRY_RUN) {
    console.log('📦 Creating backup table...\n');

    const { error: backupError } = await supabaseAdmin.rpc('execute_sql', {
      query: `
        DROP TABLE IF EXISTS contacts_backup_20250107_both;
        CREATE TABLE contacts_backup_20250107_both AS SELECT * FROM contacts;
      `
    });

    if (backupError) {
      console.error('❌ Backup failed:', backupError);
      process.exit(1);
    }

    console.log('✅ Backup created: contacts_backup_20250107_both\n');
  }

  // ==========================================
  // GROUP 1: Fix instagram_historical
  // ==========================================
  console.log('=' .repeat(80));
  console.log('🗂️  GROUP 1: Fixing instagram_historical\n');

  const { data: historical } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('source', 'instagram_historical');

  console.log(`Total contacts: ${historical.length}`);

  const hist_needs_swap = historical.filter(c => c.q1_question || c.q2_question);
  const hist_bad_ab = historical.filter(c =>
    c.chatbot_ab && !c.chatbot_ab.match(/^[AB][\s-]*OCT30$/i)
  );

  console.log(`  - Need Q1/Q2 swap: ${hist_needs_swap.length}`);
  console.log(`  - Need chatbot_AB cleanup: ${hist_bad_ab.length}\n`);

  if (!DRY_RUN) {
    // Swap Q1 ↔ Q2
    console.log('  ▶️  Swapping Q1 ↔ Q2...');
    for (const contact of hist_needs_swap) {
      await supabaseAdmin
        .from('contacts')
        .update({
          q1_question: contact.q2_question,
          q2_question: contact.q1_question,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);
    }
    console.log('  ✅ Swapped\n');

    // Clean chatbot_AB
    console.log('  ▶️  Cleaning chatbot_AB...');
    for (const contact of hist_bad_ab) {
      await supabaseAdmin
        .from('contacts')
        .update({
          chatbot_ab: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);
    }
    console.log('  ✅ Cleaned\n');
  } else {
    console.log('  🔍 Would swap Q1 ↔ Q2 for ' + hist_needs_swap.length + ' contacts');
    console.log('  🔍 Would clean chatbot_AB for ' + hist_bad_ab.length + ' contacts\n');
  }

  // ==========================================
  // GROUP 2: Fix live data
  // ==========================================
  console.log('=' .repeat(80));
  console.log('🗂️  GROUP 2: Fixing live data\n');

  const { data: live } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .not('source', 'eq', 'instagram_historical')
    .not('source', 'is', null);

  console.log(`Total contacts: ${live.length}\n`);

  // Fix Q1 text values
  const live_bad_q1 = live.filter(c => {
    if (!c.q1_question) return false;
    const val = c.q1_question.toLowerCase();
    return val.length > 10 || val.includes('year') || val.includes('week') ||
           val.includes('month') || val.includes('less') || val.includes('almost') ||
           val.includes('pregnant');
  });

  console.log('Q1 Issues:');
  console.log(`  - Text instead of numbers: ${live_bad_q1.length}`);

  if (live_bad_q1.length > 0) {
    console.log('\n  Examples:');
    live_bad_q1.slice(0, 5).forEach(c => {
      const normalized = normalizeMonths(c.q1_question);
      console.log(`    "${c.q1_question}" → "${normalized || 'NULL'}"`);
    });
  }

  // Fix Q2 "NONE" values
  const live_bad_q2 = live.filter(c => c.q2_question === 'NONE');

  console.log(`\nQ2 Issues:`);
  console.log(`  - "NONE" values: ${live_bad_q2.length}`);

  // Fix chatbot_AB spacing
  const live_spacing = live.filter(c =>
    c.chatbot_ab && c.chatbot_ab.includes(' - ')
  );

  console.log(`\nChatbot AB Issues:`);
  console.log(`  - Spacing inconsistencies: ${live_spacing.length}\n`);

  if (!DRY_RUN) {
    // Fix Q1
    console.log('  ▶️  Fixing Q1 text values...');
    for (const contact of live_bad_q1) {
      const normalized = normalizeMonths(contact.q1_question);
      await supabaseAdmin
        .from('contacts')
        .update({
          q1_question: normalized,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);
    }
    console.log('  ✅ Fixed\n');

    // Fix Q2
    console.log('  ▶️  Fixing Q2 "NONE" values...');
    for (const contact of live_bad_q2) {
      await supabaseAdmin
        .from('contacts')
        .update({
          q2_question: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);
    }
    console.log('  ✅ Fixed\n');

    // Fix spacing
    console.log('  ▶️  Normalizing chatbot_AB spacing...');
    for (const contact of live_spacing) {
      await supabaseAdmin
        .from('contacts')
        .update({
          chatbot_ab: contact.chatbot_ab.replace(' - ', '-'),
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);
    }
    console.log('  ✅ Normalized\n');
  } else {
    console.log('  🔍 Would fix Q1 for ' + live_bad_q1.length + ' contacts');
    console.log('  🔍 Would fix Q2 for ' + live_bad_q2.length + ' contacts');
    console.log('  🔍 Would normalize spacing for ' + live_spacing.length + ' contacts\n');
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('=' .repeat(80));
  console.log('📋 SUMMARY');
  console.log('=' .repeat(80) + '\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN - No changes made\n');
    console.log('Would fix:');
    console.log(`  GROUP 1 (instagram_historical):`);
    console.log(`    - Swap Q1↔Q2: ${hist_needs_swap.length}`);
    console.log(`    - Clean chatbot_AB: ${hist_bad_ab.length}`);
    console.log(`  GROUP 2 (live data):`);
    console.log(`    - Fix Q1 text: ${live_bad_q1.length}`);
    console.log(`    - Fix Q2 "NONE": ${live_bad_q2.length}`);
    console.log(`    - Normalize spacing: ${live_spacing.length}`);
    console.log('\nRun without --dry-run to apply fixes\n');
  } else {
    console.log('✅ ALL FIXES APPLIED\n');
    console.log('Fixed:');
    console.log(`  GROUP 1 (instagram_historical):`);
    console.log(`    ✅ Swapped Q1↔Q2: ${hist_needs_swap.length}`);
    console.log(`    ✅ Cleaned chatbot_AB: ${hist_bad_ab.length}`);
    console.log(`  GROUP 2 (live data):`);
    console.log(`    ✅ Fixed Q1 text: ${live_bad_q1.length}`);
    console.log(`    ✅ Fixed Q2 "NONE": ${live_bad_q2.length}`);
    console.log(`    ✅ Normalized spacing: ${live_spacing.length}`);
    console.log('\nBackup: contacts_backup_20250107_both');
    console.log('\nVerify: node scripts/analyze-both-datasets.js\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
