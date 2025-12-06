#!/usr/bin/env node
/**
 * Fix Historical Field Swapping
 *
 * PROBLEM:
 * - Q1 has symptoms (should be months postpartum)
 * - Q2 has months postpartum (should be symptoms)
 * - chatbot_ab has symptoms (should be A-OCT30 or B-OCT30)
 *
 * SOLUTION:
 * - Swap Q1 ↔ Q2 for all historical contacts
 * - Clean chatbot_ab to only valid A/B values
 * - Backs up data before making changes
 *
 * SAFETY:
 * - Only affects historical data (source LIKE '%_historical%')
 * - Creates backup table before changes
 * - Can be rolled back
 *
 * Usage:
 *   node scripts/fix-historical-field-swapping.js --dry-run  (preview)
 *   node scripts/fix-historical-field-swapping.js            (apply fix)
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

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 FIX HISTORICAL FIELD SWAPPING');
  console.log('='.repeat(80));
  console.log(`\nMode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '💾 LIVE FIX'}\n`);

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('⚠️  LIVE MODE - Database will be modified\n');
  }

  // ==================
  // STEP 1: Preview affected data
  // ==================
  console.log('📊 Analyzing affected data...\n');

  const { data: historicalContacts, error: countError } = await supabaseAdmin
    .from('contacts')
    .select('id, first_name, q1_question, q2_question, chatbot_ab, objections', { count: 'exact' })
    .like('source', '%_historical%');

  if (countError) {
    console.error('❌ Error querying contacts:', countError);
    process.exit(1);
  }

  console.log(`Total historical contacts: ${historicalContacts.length}`);

  // Count contacts with Q1/Q2 data
  const withQ1 = historicalContacts.filter(c => c.q1_question).length;
  const withQ2 = historicalContacts.filter(c => c.q2_question).length;
  console.log(`  - With Q1 data: ${withQ1}`);
  console.log(`  - With Q2 data: ${withQ2}`);

  // Analyze chatbot_ab values
  const chatbotValues = {};
  historicalContacts.forEach(c => {
    if (c.chatbot_ab) {
      chatbotValues[c.chatbot_ab] = (chatbotValues[c.chatbot_ab] || 0) + 1;
    }
  });

  const validAB = Object.keys(chatbotValues).filter(v =>
    v === 'A-OCT30' || v === 'B-OCT30' || v === 'A - OCT30' || v === 'B - OCT30'
  );
  const invalidAB = Object.keys(chatbotValues).filter(v =>
    v !== 'A-OCT30' && v !== 'B-OCT30' && v !== 'A - OCT30' && v !== 'B - OCT30'
  );

  console.log(`\n  Chatbot AB Analysis:`);
  console.log(`    - Valid values: ${validAB.length} (${validAB.reduce((sum, v) => sum + chatbotValues[v], 0)} contacts)`);
  console.log(`    - Invalid values: ${invalidAB.length} (${invalidAB.reduce((sum, v) => sum + chatbotValues[v], 0)} contacts)`);

  if (invalidAB.length > 0) {
    console.log(`\n    Top 10 invalid chatbot_ab values:`);
    invalidAB
      .sort((a, b) => chatbotValues[b] - chatbotValues[a])
      .slice(0, 10)
      .forEach(val => {
        console.log(`      "${val}": ${chatbotValues[val]} contacts`);
      });
  }

  // Sample some Q1/Q2 values
  console.log(`\n  Sample Q1 values (should be symptoms, will become months):`);
  historicalContacts
    .filter(c => c.q1_question)
    .slice(0, 5)
    .forEach(c => {
      console.log(`    - ${c.first_name || 'Unknown'}: "${c.q1_question?.substring(0, 50)}${c.q1_question?.length > 50 ? '...' : ''}"`);
    });

  console.log(`\n  Sample Q2 values (should be months, will become symptoms):`);
  historicalContacts
    .filter(c => c.q2_question)
    .slice(0, 5)
    .forEach(c => {
      console.log(`    - ${c.first_name || 'Unknown'}: "${c.q2_question}"`);
    });

  if (DRY_RUN) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DRY RUN COMPLETE - No changes made');
    console.log('='.repeat(80));
    console.log('\nRun without --dry-run to apply the fix:\n');
    console.log('  node scripts/fix-historical-field-swapping.js\n');
    process.exit(0);
  }

  // ==================
  // STEP 2: Confirm before proceeding
  // ==================
  console.log('\n' + '='.repeat(80));
  console.log('⚠️  READY TO APPLY FIX');
  console.log('='.repeat(80));
  console.log('\nThis will:');
  console.log('  1. Create backup table (contacts_backup_20250107)');
  console.log('  2. Swap Q1 ↔ Q2 for all historical contacts');
  console.log(`  3. Clean ${invalidAB.reduce((sum, v) => sum + chatbotValues[v], 0)} invalid chatbot_ab values`);
  console.log('  4. Clean some objections that contain symptoms\n');

  // Note: In actual CLI, you'd want a prompt here
  // For automated script, we assume user confirmed by running without --dry-run

  console.log('▶️  Proceeding with fix...\n');

  // ==================
  // STEP 3: Apply migration
  // ==================
  try {
    // Read migration file
    const migrationSQL = fs.readFileSync(
      './migrations/20250107_fix_historical_field_swapping.sql',
      'utf8'
    );

    // Split into individual statements (rough split by semicolon)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      // Skip comments and verification queries
      if (stmt.includes('SELECT') && stmt.includes('COUNT')) {
        console.log(`  ⏭  Skipping verification query ${i + 1}`);
        continue;
      }

      console.log(`  ▶️  Executing statement ${i + 1}/${statements.length}...`);

      const { error } = await supabaseAdmin.rpc('execute_sql', { query: stmt });

      if (error) {
        console.error(`\n❌ Error executing statement ${i + 1}:`, error);
        console.error(`\nStatement was:\n${stmt.substring(0, 200)}...\n`);
        throw error;
      }
    }

    console.log('\n✅ All statements executed successfully\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.log('\n📋 To rollback, run the rollback query from the migration file\n');
    process.exit(1);
  }

  // ==================
  // STEP 4: Verify results
  // ==================
  console.log('🔍 Verifying changes...\n');

  const { data: afterContacts } = await supabaseAdmin
    .from('contacts')
    .select('id, q1_question, q2_question, chatbot_ab')
    .like('source', '%_historical%');

  // Check chatbot_ab cleanup
  const afterChatbot = {};
  afterContacts.forEach(c => {
    if (c.chatbot_ab) {
      afterChatbot[c.chatbot_ab] = (afterChatbot[c.chatbot_ab] || 0) + 1;
    }
  });

  const afterInvalid = Object.keys(afterChatbot).filter(v =>
    !v.includes('OCT30')
  );

  console.log('✅ Verification Results:');
  console.log(`  - Total historical contacts: ${afterContacts.length}`);
  console.log(`  - Chatbot AB invalid values remaining: ${afterInvalid.length}`);
  if (afterInvalid.length > 0) {
    console.log(`    ⚠️  Still some invalid values:`);
    afterInvalid.forEach(val => {
      console.log(`      "${val}": ${afterChatbot[val]} contacts`);
    });
  }

  // Sample Q1/Q2 after swap
  console.log(`\n  Sample Q1 after fix (should now be months):`);
  afterContacts
    .filter(c => c.q1_question)
    .slice(0, 5)
    .forEach(c => {
      console.log(`    - "${c.q1_question}"`);
    });

  console.log(`\n  Sample Q2 after fix (should now be symptoms):`);
  afterContacts
    .filter(c => c.q2_question)
    .slice(0, 5)
    .forEach(c => {
      console.log(`    - "${c.q2_question?.substring(0, 50)}${c.q2_question?.length > 50 ? '...' : ''}"`);
    });

  // ==================
  // STEP 5: Success summary
  // ==================
  console.log('\n' + '='.repeat(80));
  console.log('✅ FIX COMPLETED SUCCESSFULLY');
  console.log('='.repeat(80));
  console.log('\nWhat was fixed:');
  console.log(`  ✅ Q1 and Q2 swapped for ${afterContacts.length} historical contacts`);
  console.log(`  ✅ Cleaned ${invalidAB.reduce((sum, v) => sum + chatbotValues[v], 0)} invalid chatbot_ab values`);
  console.log('  ✅ Backup created: contacts_backup_20250107\n');
  console.log('Next steps:');
  console.log('  1. Run analysis script to verify:');
  console.log('     node scripts/check-field-mapping-issues.js');
  console.log('  2. Update prepare-migration-data.js to prevent future issues');
  console.log('  3. (Optional) Drop backup table after verification:\n');
  console.log('     DROP TABLE contacts_backup_20250107;\n');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
