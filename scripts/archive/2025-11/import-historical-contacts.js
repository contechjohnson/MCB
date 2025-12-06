/**
 * Safe Historical Data Import Script
 *
 * SAFETY FEATURES:
 * - Appends "_historical" to source field to distinguish old data
 * - Checks for existing contacts by mc_id/ghl_id before inserting
 * - Updates existing contacts instead of creating duplicates
 * - Dry-run mode to preview changes before committing
 * - Batch processing to avoid timeouts
 *
 * Usage:
 *   node scripts/import-historical-contacts.js --dry-run  (preview only)
 *   node scripts/import-historical-contacts.js            (actual import)
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const Papa = require('papaparse');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Configuration
const CSV_FILE = './historical_data/migration_ready_contacts_last_2mo.csv';
const BATCH_SIZE = 50;
const DRY_RUN = process.argv.includes('--dry-run');

// Statistics
let stats = {
  total: 0,
  inserted: 0,
  updated: 0,
  skipped: 0,
  errors: 0
};

/**
 * Mark contact as historical by appending to source field
 */
function markAsHistorical(source) {
  if (!source || source.trim() === '') {
    return 'unknown_historical';
  }
  // If already marked, don't add again
  if (source.includes('_historical')) {
    return source;
  }
  return `${source}_historical`;
}

/**
 * Check if contact already exists
 */
async function findExistingContact(row) {
  const { mc_id, ghl_id, email_primary, phone } = row;

  const { data, error } = await supabaseAdmin
    .rpc('find_contact_smart', {
      search_ghl_id: ghl_id || null,
      search_mc_id: mc_id || null,
      search_email: email_primary || null,
      search_phone: phone || null
    });

  if (error) {
    console.error('Error finding contact:', error);
    return null;
  }

  return data; // Returns UUID or null
}

/**
 * Prepare contact data for insert
 */
function prepareContactData(row) {
  // Parse dates safely
  const parseDate = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') return null;
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
      return null;
    }
  };

  // Parse numeric safely
  const parseNumber = (numStr) => {
    if (!numStr || numStr.trim() === '') return null;
    const num = parseFloat(numStr);
    return isNaN(num) ? null : num;
  };

  return {
    mc_id: row.mc_id || null,
    ghl_id: row.ghl_id || null,
    stripe_customer_id: row.stripe_customer_id || null,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    email_primary: row.email_primary?.toLowerCase().trim() || null,
    email_booking: row.email_booking?.toLowerCase().trim() || null,
    email_payment: row.email_payment?.toLowerCase().trim() || null,
    phone: row.phone || null,
    ig: row.ig || null,
    ig_id: row.ig_id ? parseInt(row.ig_id) : null,
    fb: row.fb_name || null,
    source: markAsHistorical(row.source), // ← MARK AS HISTORICAL
    chatbot_ab: row.chatbot_ab || null,
    misc_ab: row.misc_ab || null,
    trigger_word: row.trigger_word || null,
    q1_question: row.q1_question || null,
    q2_question: row.q2_question || null,
    objections: row.objections || null,
    lead_summary: row.lead_summary || null,
    thread_id: row.thread_id || null,
    ad_id: row.ad_id || null,
    subscribe_date: parseDate(row.subscribe_date),
    subscribed: parseDate(row.subscribed),
    ig_last_interaction: parseDate(row.ig_last_interaction),
    dm_qualified_date: parseDate(row.dm_qualified_date),
    link_send_date: parseDate(row.link_send_date),
    link_click_date: parseDate(row.link_click_date),
    form_submit_date: parseDate(row.form_submit_date),
    appointment_date: parseDate(row.appointment_date),
    appointment_held_date: parseDate(row.appointment_held_date),
    package_sent_date: parseDate(row.package_sent_date),
    checkout_started: parseDate(row.checkout_started),
    purchase_date: parseDate(row.purchase_date),
    purchase_amount: parseNumber(row.purchase_amount),
    stage: row.stage || 'new_lead',
    created_at: parseDate(row.created_at) || new Date().toISOString(),
    updated_at: parseDate(row.updated_at) || new Date().toISOString()
  };
}

/**
 * Insert or update contact
 */
async function upsertContact(contactData) {
  // Check if exists
  const existingId = await findExistingContact(contactData);

  if (existingId) {
    // Update existing contact
    console.log(`  ↻ Updating existing contact: ${contactData.email_primary || contactData.mc_id}`);

    if (DRY_RUN) {
      stats.updated++;
      return;
    }

    const { error } = await supabaseAdmin
      .rpc('update_contact_dynamic', {
        contact_id: existingId,
        update_data: contactData
      });

    if (error) {
      console.error('  ✗ Update failed:', error.message);
      stats.errors++;
    } else {
      stats.updated++;
    }
  } else {
    // Insert new contact
    console.log(`  ✓ Inserting new contact: ${contactData.email_primary || contactData.mc_id}`);

    if (DRY_RUN) {
      stats.inserted++;
      return;
    }

    const { error } = await supabaseAdmin
      .from('contacts')
      .insert(contactData);

    if (error) {
      console.error('  ✗ Insert failed:', error.message);
      stats.errors++;
    } else {
      stats.inserted++;
    }
  }
}

/**
 * Process CSV in batches
 */
async function processBatch(rows, batchNum) {
  console.log(`\n📦 Processing batch ${batchNum} (${rows.length} contacts)...`);

  for (const row of rows) {
    stats.total++;

    // Validate required fields
    if (!row.mc_id && !row.ghl_id) {
      console.log(`  ⚠ Skipping contact without mc_id or ghl_id: ${row.email_primary}`);
      stats.skipped++;
      continue;
    }

    const contactData = prepareContactData(row);
    await upsertContact(contactData);
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Historical Contact Import\n');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '💾 LIVE IMPORT'}`);
  console.log(`File: ${CSV_FILE}`);
  console.log(`Batch size: ${BATCH_SIZE}\n`);

  // Read CSV with proper newline handling
  const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
  const { data: rows, errors } = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    newline: '\n',
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ',',
    transformHeader: (header) => header.trim()
  });

  if (errors.length > 0) {
    console.warn('⚠️  CSV parsing warnings:', errors.slice(0, 5));
  }

  console.log(`📊 Found ${rows.length} contacts in CSV\n`);

  // Process in batches
  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    await processBatch(batches[i], i + 1);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Import Summary\n');
  console.log(`Total processed:  ${stats.total}`);
  console.log(`✓ Inserted:       ${stats.inserted}`);
  console.log(`↻ Updated:        ${stats.updated}`);
  console.log(`⚠ Skipped:        ${stats.skipped}`);
  console.log(`✗ Errors:         ${stats.errors}`);
  console.log('='.repeat(60) + '\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN COMPLETE - No changes were made to the database');
    console.log('   Run without --dry-run to perform actual import\n');
  } else {
    console.log('✅ IMPORT COMPLETE\n');
    console.log('To query only NEW data (exclude historical):');
    console.log('  SELECT * FROM contacts WHERE source NOT LIKE \'%_historical\'\n');
    console.log('To query only HISTORICAL data:');
    console.log('  SELECT * FROM contacts WHERE source LIKE \'%_historical\'\n');
  }
}

main().catch(console.error);
