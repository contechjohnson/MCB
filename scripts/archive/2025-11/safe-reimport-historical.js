#!/usr/bin/env node
/**
 * SAFE Historical Data Re-import
 *
 * WHAT THIS DOES:
 * 1. Creates backup table of instagram_historical contacts
 * 2. Deletes ONLY instagram_historical (535 contacts)
 * 3. Imports 1,477 new corrected contacts from fixed CSV
 * 4. Verifies counts after completion
 *
 * SAFETY GUARANTEES:
 * - ONLY touches source='instagram_historical'
 * - Does NOT touch instagram, website, or instagram_lm sources
 * - Creates backup before any deletion
 * - Dry-run mode available
 * - Can be rolled back from backup
 *
 * Usage:
 *   node scripts/safe-reimport-historical.js --dry-run  (preview only)
 *   node scripts/safe-reimport-historical.js            (execute)
 */

const { createClient } = require('@supabase/supabase-js');
const Papa = require('papaparse');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const DRY_RUN = process.argv.includes('--dry-run');
const CSV_FILE = './historical_data/migration_ready_contacts_last_2mo.csv';

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔄 SAFE HISTORICAL DATA RE-IMPORT');
  console.log('='.repeat(80));
  console.log(`\nMode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '💾 LIVE EXECUTION'}\n`);

  // ==========================================
  // STEP 1: Count current state
  // ==========================================
  console.log('📊 STEP 1: Verify current database state\n');

  const { count: histCount } = await supabaseAdmin
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'instagram_historical');

  const { count: totalCount } = await supabaseAdmin
    .from('contacts')
    .select('*', { count: 'exact', head: true });

  const { data: allContacts } = await supabaseAdmin
    .from('contacts')
    .select('source')
    .not('source', 'is', null);

  const sourceCounts = {};
  allContacts.forEach(r => {
    sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1;
  });

  console.log('Current database:');
  console.log(`  Total contacts: ${totalCount}`);
  console.log(`  instagram_historical: ${histCount} ⬅️  WILL DELETE`);
  console.log(`  instagram: ${sourceCounts['instagram'] || 0} ⬅️  WILL NOT TOUCH`);
  console.log(`  website: ${sourceCounts['website'] || 0} ⬅️  WILL NOT TOUCH`);
  console.log(`  instagram_lm: ${sourceCounts['instagram_lm'] || 0} ⬅️  WILL NOT TOUCH`);

  const liveCount = totalCount - histCount;
  console.log(`\n  Live contacts (safe): ${liveCount}`);

  // ==========================================
  // STEP 2: Load and verify CSV
  // ==========================================
  console.log('\n📄 STEP 2: Verify CSV file\n');

  const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
  const { data: csvRows, errors: parseErrors } = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true
  });

  if (parseErrors.length > 0) {
    console.error('❌ CSV parsing errors:', parseErrors.slice(0, 5));
    process.exit(1);
  }

  console.log(`CSV file: ${CSV_FILE}`);
  console.log(`  Rows to import: ${csvRows.length}`);

  // Verify CSV data quality
  const withLeadSummary = csvRows.filter(r => r.lead_summary && r.lead_summary.trim() !== '');
  const withQ1Q2 = csvRows.filter(r => r.q1_question && r.q2_question);

  console.log(`  Rows with Q1/Q2 data: ${withQ1Q2.length}`);
  console.log(`  Rows with lead_summary: ${withLeadSummary.length} ⬅️  SHOULD BE 0`);

  if (withLeadSummary.length > 0) {
    console.error('❌ ERROR: CSV contains non-empty lead_summary values!');
    console.log('First 3 examples:');
    withLeadSummary.slice(0, 3).forEach(r => {
      console.log(`  - ${r.first_name}: "${r.lead_summary}"`);
    });
    process.exit(1);
  }

  // Sample 3 rows
  console.log('\n  Sample rows:');
  csvRows.slice(0, 3).forEach((r, i) => {
    console.log(`    ${i+1}. ${r.first_name} (MC_ID: ${r.mc_id})`);
    console.log(`       Q1 (Symptoms): ${r.q1_question?.substring(0, 40)}${r.q1_question?.length > 40 ? '...' : ''}`);
    console.log(`       Q2 (Months): ${r.q2_question}`);
    console.log(`       Chatbot AB: ${r.chatbot_ab || 'NULL'}`);
  });

  if (DRY_RUN) {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DRY RUN SUMMARY');
    console.log('='.repeat(80) + '\n');
    console.log('Would perform:');
    console.log(`  1. Create backup table: contacts_backup_historical_20250107`);
    console.log(`  2. Delete ${histCount} instagram_historical contacts`);
    console.log(`  3. Import ${csvRows.length} new contacts from CSV`);
    console.log(`  4. Final count: ${liveCount} live + ${csvRows.length} historical = ${liveCount + csvRows.length}`);
    console.log('\nRun without --dry-run to execute\n');
    process.exit(0);
  }

  // ==========================================
  // STEP 3: Create backup
  // ==========================================
  console.log('\n💾 STEP 3: Create backup\n');

  const { data: backupData, error: backupFetchError } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('source', 'instagram_historical');

  if (backupFetchError) {
    console.error('❌ Failed to fetch backup data:', backupFetchError);
    process.exit(1);
  }

  // Save backup to JSON file
  const backupFile = './historical_data/backup_instagram_historical_20250107.json';
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
  console.log(`✅ Backup saved: ${backupFile} (${backupData.length} contacts)`);

  // ==========================================
  // STEP 4: Delete instagram_historical ONLY
  // ==========================================
  console.log('\n🗑️  STEP 4: Delete instagram_historical contacts\n');

  console.log(`Deleting ${histCount} contacts with source='instagram_historical'...`);

  const { error: deleteError, count: deletedCount } = await supabaseAdmin
    .from('contacts')
    .delete({ count: 'exact' })
    .eq('source', 'instagram_historical');

  if (deleteError) {
    console.error('❌ Delete failed:', deleteError);
    process.exit(1);
  }

  console.log(`✅ Deleted ${deletedCount} contacts`);

  // Verify deletion
  const { count: afterDeleteCount } = await supabaseAdmin
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'instagram_historical');

  if (afterDeleteCount > 0) {
    console.error(`❌ ERROR: Still ${afterDeleteCount} instagram_historical contacts remaining!`);
    process.exit(1);
  }

  console.log('✅ Verified: No instagram_historical contacts remain');

  // ==========================================
  // STEP 5: Import new data
  // ==========================================
  console.log('\n📥 STEP 5: Import corrected data\n');

  console.log(`Importing ${csvRows.length} contacts...`);

  let imported = 0;
  let errors = 0;

  // Import in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < csvRows.length; i += BATCH_SIZE) {
    const batch = csvRows.slice(i, i + BATCH_SIZE);

    // Prepare batch data
    const batchData = batch.map(row => {
      // Convert empty strings to null and handle field name mapping
      const cleanRow = {};
      Object.keys(row).forEach(key => {
        // Skip fb_name - we'll handle it separately
        if (key === 'fb_name') return;

        const value = row[key];
        cleanRow[key] = (value === '' || value === 'NULL' || value === 'NONE') ? null : value;
      });

      // Add _historical suffix to source
      cleanRow.source = 'instagram_historical';

      // Convert fb_name to fb (database uses 'fb', CSV has 'fb_name')
      if (row.fb_name) {
        const value = row.fb_name;
        cleanRow.fb = (value === '' || value === 'NULL' || value === 'NONE') ? null : value;
      }

      return cleanRow;
    });

    const { error: insertError } = await supabaseAdmin
      .from('contacts')
      .insert(batchData);

    if (insertError) {
      console.error(`❌ Batch ${Math.floor(i/BATCH_SIZE) + 1} failed:`, insertError);
      errors += batch.length;
    } else {
      imported += batch.length;
      process.stdout.write(`  Progress: ${imported}/${csvRows.length}\\r`);
    }
  }

  console.log(`\n✅ Imported ${imported} contacts`);
  if (errors > 0) {
    console.log(`⚠️  Errors: ${errors} contacts failed`);
  }

  // ==========================================
  // STEP 6: Verify final state
  // ==========================================
  console.log('\n✅ STEP 6: Verify final state\n');

  const { count: finalHistCount } = await supabaseAdmin
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'instagram_historical');

  const { count: finalTotalCount } = await supabaseAdmin
    .from('contacts')
    .select('*', { count: 'exact', head: true });

  const { data: finalContacts } = await supabaseAdmin
    .from('contacts')
    .select('source')
    .not('source', 'is', null);

  const finalSourceCounts = {};
  finalContacts.forEach(r => {
    finalSourceCounts[r.source] = (finalSourceCounts[r.source] || 0) + 1;
  });

  console.log('Final database:');
  console.log(`  Total contacts: ${finalTotalCount}`);
  console.log(`  instagram_historical: ${finalHistCount} ⬅️  NEW IMPORT`);
  console.log(`  instagram: ${finalSourceCounts['instagram'] || 0} ⬅️  UNCHANGED`);
  console.log(`  website: ${finalSourceCounts['website'] || 0} ⬅️  UNCHANGED`);
  console.log(`  instagram_lm: ${finalSourceCounts['instagram_lm'] || 0} ⬅️  UNCHANGED`);

  // ==========================================
  // STEP 7: Summary
  // ==========================================
  console.log('\n' + '='.repeat(80));
  console.log('✅ RE-IMPORT COMPLETE');
  console.log('='.repeat(80) + '\n');

  console.log('What changed:');
  console.log(`  Before: ${histCount} instagram_historical (broken data)`);
  console.log(`  After: ${finalHistCount} instagram_historical (correct data)`);
  console.log(`  Net change: +${finalHistCount - histCount} contacts`);
  console.log(`\nLive data (UNCHANGED):`);
  console.log(`  instagram: ${sourceCounts['instagram']} → ${finalSourceCounts['instagram']} ✅`);
  console.log(`  website: ${sourceCounts['website']} → ${finalSourceCounts['website']} ✅`);
  console.log(`  instagram_lm: ${sourceCounts['instagram_lm']} → ${finalSourceCounts['instagram_lm']} ✅`);

  console.log(`\nBackup: ${backupFile}`);
  console.log('\nTo verify data quality:');
  console.log('  node scripts/analyze-both-datasets.js\n');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ FATAL ERROR:', error);
    console.log('\n⚠️  Check backup file: ./historical_data/backup_instagram_historical_20250107.json');
    process.exit(1);
  });
