#!/usr/bin/env node
/**
 * Historical Data Migration Preparation Script
 *
 * Purpose: Extract last 2 months of cleanest data from Airtable and Supabase exports
 * Output: CSV file ready for Supabase import with correct stage mapping
 *
 * Based on: MIGRATION_QUICK_START.md and HISTORICAL_DATA_MAPPING.md
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Papa = require('papaparse');

console.log('\n' + '='.repeat(80));
console.log('📦 HISTORICAL DATA MIGRATION PREPARATION');
console.log('='.repeat(80) + '\n');

// Helper: Parse CSV (using Papa for proper parsing)
function parseCSV(filePath) {
  const csv = fs.readFileSync(filePath, 'utf8');

  const { data, errors } = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ',',
    transformHeader: (header) => header.trim().replace(/^\uFEFF/, '') // Remove BOM
  });

  if (errors.length > 0) {
    console.warn(`⚠️  CSV parsing warnings for ${filePath}:`, errors.slice(0, 3));
  }

  return data;
}

// Helper: Parse date flexibly
function parseDate(dateStr) {
  if (!dateStr || dateStr === '') return null;

  // Try ISO format first
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  return null;
}

// Helper: Normalize phone to E.164
function normalizePhone(phone) {
  if (!phone) return null;

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it's 11 digits and starts with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If already has +, return as is
  if (phone.startsWith('+')) {
    return phone.replace(/\D/g, (match, offset) => offset === 0 ? match : '');
  }

  return null;
}

// Helper: Map old stage to new stage
function mapStage(oldStage, hasPhone, hasEmail) {
  if (!oldStage || oldStage === '') return null; // Will skip

  const stage = oldStage.toUpperCase().trim();

  // Purchased (highest priority)
  if (stage === 'BOUGHT_PACKAGE' || stage === 'PAID') {
    return 'purchased';
  }

  // Checkout started
  if (stage === 'PACKAGE_REGISTRATION_COMPLETE') {
    return 'checkout_started';
  }

  // Package sent (from GHL only, unlikely in historical)
  if (stage === 'PACKAGE_SENT' || stage === 'SENT_PACKAGE') {
    return 'package_sent';
  }

  // Meeting held
  if (stage === 'ATTENDED') {
    return 'meeting_held';
  }

  // Meeting booked
  if (stage === 'BOOKED' || stage === 'READY_TO_BOOK') {
    return 'meeting_booked';
  }

  // Form submitted (LEAD_CONTACT with phone + email)
  if (stage === 'LEAD_CONTACT' && hasPhone && hasEmail) {
    return 'form_submitted';
  }

  // Form submitted (other indicators)
  if (stage === 'CLICKED_LINK' || stage === 'COMPLETED_DC') {
    return 'form_submitted';
  }

  // Link clicked
  if (stage.includes('CLICK') && stage.includes('LINK')) {
    return 'link_clicked';
  }

  // Link sent
  if (stage === 'SENT_LINK') {
    return 'link_sent';
  }

  // DM qualified
  if (stage === 'DM_QUALIFIED' || stage === 'SHOWED_INTEREST' ||
      stage.includes('CLARA')) {
    return 'dm_qualified';
  }

  // New lead
  if (stage === 'LEAD_CONTACT' || stage === 'LEAD' ||
      stage.includes('NEW_CONTACT')) {
    return 'new_lead';
  }

  // Don't map unknown stages - return null to skip
  return null;
}

// Helper: Determine furthest stage reached
function getFurthestStage(stages) {
  const stageOrder = [
    'purchased',
    'checkout_started',
    'package_sent',
    'meeting_held',
    'meeting_booked',
    'form_submitted',
    'link_clicked',
    'link_sent',
    'dm_qualified',
    'new_lead'
  ];

  for (const stage of stageOrder) {
    if (stages.includes(stage)) return stage;
  }

  return 'new_lead';
}

console.log('📂 Loading data sources...\n');

// Load Airtable data
const airtablePath = path.join(__dirname, '..', 'historical_data', 'airtable_contacts.csv');
const airtableData = parseCSV(airtablePath);
console.log(`✅ Loaded ${airtableData.length} contacts from Airtable`);

// Load Airtable purchases
const purchasesPath = path.join(__dirname, '..', 'historical_data', 'airtable_purchases.csv');
const purchasesData = parseCSV(purchasesPath);
console.log(`✅ Loaded ${purchasesData.length} purchases from Airtable`);

// Load Supabase export
const supabasePath = path.join(__dirname, '..', 'historical_data', 'supabase_export_contacts_full.csv');
const supabaseData = parseCSV(supabasePath);
console.log(`✅ Loaded ${supabaseData.length} contacts from Supabase export\n`);

console.log('🔍 Filtering to last 3 months (since Aug 6, 2025)...\n');

const twoMonthsAgo = new Date('2025-08-06'); // Expanded to 3 months
const contacts = new Map(); // email -> contact data

// Process Airtable data (higher priority)
let airtableRecent = 0;
for (const row of airtableData) {
  const subscribedDate = parseDate(row.SUBSCRIBED_DATE);
  const purchaseDate = parseDate(row.DATE_SET_PURCHASE);

  // Filter: Must be from last 3 months OR have recent purchase
  if ((!subscribedDate || subscribedDate < twoMonthsAgo) &&
      (!purchaseDate || purchaseDate < twoMonthsAgo)) {
    continue;
  }

  const email = row.EMAIL?.toLowerCase().trim();
  const phone = normalizePhone(row.PHONE);

  // Must have at least email or phone
  if (!email && !phone) continue;

  // CRITICAL: Must have MC_ID or GHL_ID (at least one)
  const mcId = row.MC_ID?.trim();
  const ghlId = row.GHL_ID?.trim();
  if (!mcId && !ghlId) {
    continue; // Skip - no webhook identifiers
  }

  const hasPhone = !!phone;
  const hasEmail = !!email;
  const newStage = mapStage(row.STAGE, hasPhone, hasEmail);

  // Skip if we can't map the stage
  if (!newStage) continue;

  airtableRecent++;

  const key = email || phone;

  contacts.set(key, {
    id: crypto.randomUUID(),
    mc_id: row.MC_ID || null,
    ghl_id: row.GHL_ID || null,
    ad_id: row.AD_ID || null,
    first_name: row.FIRST_NAME || null,
    last_name: row.LAST_NAME || null,
    email_primary: email || null,
    email_booking: row['EMAIL ALT']?.toLowerCase().trim() || null,
    email_payment: null,
    phone: phone,
    ig: row.IG_USERNAME || null,
    ig_id: null,
    fb_name: null,
    source: row.PAID_VS_ORGANIC === 'ORGANIC' ? 'instagram' : 'instagram', // Assume Instagram
    chatbot_ab: row.AB_TEST || null,
    misc_ab: row.PAID_VS_ORGANIC || null,
    trigger_word: row.TRIGGER_WORD || null,
    q1_question: row.SEGMENT_SYMPTOMS || null,
    q2_question: row.SEGMENT_MONTHS || null,
    objections: row.SEGMENT_OBJECTIONS || null,
    lead_summary: row.SALES_SUMMARY || null,
    thread_id: row.THREAD_ID || null,
    subscribe_date: subscribedDate ? subscribedDate.toISOString() : null,
    subscribed: subscribedDate ? subscribedDate.toISOString() : null,
    ig_last_interaction: parseDate(row.PRESALE_LAST_INTERACTION_DATE)?.toISOString() || null,
    dm_qualified_date: parseDate(row.DATE_SET_CLARACONVO)?.toISOString() || null,
    link_send_date: parseDate(row.DATE_SET_CLARALINKSENT)?.toISOString() || null,
    link_click_date: parseDate(row.DATE_SET_CLARACLICKLINK)?.toISOString() || null,
    form_submit_date: parseDate(row.DATE_SET_EMAIL)?.toISOString() || null,
    appointment_date: parseDate(row.DATE_SET_BOOKED_DC)?.toISOString() || null,
    appointment_held_date: parseDate(row.DATE_SET_COMPLETED_DC)?.toISOString() || null,
    package_sent_date: null,
    checkout_started: parseDate(row.DATE_SET_CHECKOUT_REGISTRATION)?.toISOString() || null,
    purchase_date: purchaseDate ? purchaseDate.toISOString() : null,
    purchase_amount: null, // Don't import amounts - use purchases table instead
    stage: newStage,
    created_at: subscribedDate ? subscribedDate.toISOString() : new Date().toISOString(),
    updated_at: purchaseDate ? purchaseDate.toISOString() : (subscribedDate ? subscribedDate.toISOString() : new Date().toISOString())
  });
}

console.log(`✅ Airtable: ${airtableRecent} contacts from last 3 months`);

// Process Supabase export (only add if not already in Airtable)
let supabaseRecent = 0;
let supabaseSkipped = 0;

for (const row of supabaseData) {
  const subscribedDate = parseDate(row.subscription_date);
  const purchaseDate = parseDate(row.first_purchase_date || row.package_purchase_date);

  // Filter: Must be from last 3 months OR have recent purchase
  if ((!subscribedDate || subscribedDate < twoMonthsAgo) &&
      (!purchaseDate || purchaseDate < twoMonthsAgo)) {
    continue;
  }

  const email = row.email_address?.toLowerCase().trim();
  const phone = normalizePhone(row.phone_number);

  // Must have at least email or phone
  if (!email && !phone) continue;

  // CRITICAL: Must have MC_ID or GHL_ID (at least one)
  // Supabase export doesn't have these in separate columns, skip for now
  // We'll rely on Airtable data which has proper IDs
  continue; // Skip Supabase export entirely - no reliable MC/GHL IDs

  const key = email || phone;

  // Skip if already have from Airtable
  if (contacts.has(key)) {
    supabaseSkipped++;
    continue;
  }

  const hasPhone = !!phone;
  const hasEmail = !!email;
  const newStage = mapStage(row.stage, hasPhone, hasEmail);

  // Skip if we can't map the stage
  if (!newStage) continue;

  supabaseRecent++;

  contacts.set(key, {
    id: crypto.randomUUID(),
    mc_id: null,
    ghl_id: null,
    ad_id: row.ad_id || null,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    email_primary: email || null,
    email_booking: null,
    email_payment: null,
    phone: phone,
    ig: row.instagram_name || null,
    ig_id: null,
    fb_name: row.facebook_name || null,
    source: row.ig_or_fb === 'IG' ? 'instagram' : (row.ig_or_fb === 'FB' ? 'facebook' : 'instagram'),
    chatbot_ab: null,
    misc_ab: row.paid_vs_organic || null,
    trigger_word: row.trigger_word_tags || null,
    q1_question: row.symptoms || null,
    q2_question: row.months_pp || null,
    objections: row.objections || null,
    lead_summary: row.summary || null,
    thread_id: row.thread_id || null,
    subscribe_date: subscribedDate ? subscribedDate.toISOString() : null,
    subscribed: subscribedDate ? subscribedDate.toISOString() : null,
    ig_last_interaction: parseDate(row.last_ig_interaction)?.toISOString() || null,
    dm_qualified_date: null,
    link_send_date: null,
    link_click_date: null,
    form_submit_date: null,
    appointment_date: parseDate(row.booking_date)?.toISOString() || null,
    appointment_held_date: null,
    package_sent_date: null,
    checkout_started: null,
    purchase_date: purchaseDate ? purchaseDate.toISOString() : null,
    purchase_amount: null, // Don't import amounts - use purchases table instead
    stage: newStage,
    created_at: subscribedDate ? subscribedDate.toISOString() : new Date().toISOString(),
    updated_at: purchaseDate ? purchaseDate.toISOString() : (subscribedDate ? subscribedDate.toISOString() : new Date().toISOString())
  });
}

console.log(`✅ Supabase: ${supabaseRecent} contacts from last 3 months (${supabaseSkipped} duplicates skipped)\n`);

// Convert to array
const migrationData = Array.from(contacts.values());

console.log(`✅ Base contacts ready: ${migrationData.length}\n`);

// Now match purchases to contacts by email
console.log('💰 Matching purchases to contacts...\n');

let purchasesMatched = 0;
let purchasesUnmatched = 0;

for (const purchase of purchasesData) {
  const purchaseEmail = purchase.Email?.toLowerCase().trim();
  if (!purchaseEmail) continue;

  // Find contact by email
  const contact = migrationData.find(c => c.email_primary === purchaseEmail);

  if (contact) {
    // Parse amount (remove $, commas)
    const amountStr = purchase.Amount?.replace(/[$,]/g, '');
    const amount = amountStr ? parseFloat(amountStr) : null;
    const purchaseDate = parseDate(purchase.Date);

    if (amount && amount > 0) {
      // Update contact with purchase data
      if (!contact.purchase_amount || amount > contact.purchase_amount) {
        contact.purchase_amount = amount;
      }

      if (purchaseDate && (!contact.purchase_date || purchaseDate > new Date(contact.purchase_date))) {
        contact.purchase_date = purchaseDate.toISOString();
      }

      // If they have a purchase, set stage to purchased (if not already higher)
      if (contact.stage !== 'purchased') {
        contact.stage = 'purchased';
      }

      purchasesMatched++;
    }
  } else {
    purchasesUnmatched++;
  }
}

console.log(`✅ Purchases matched: ${purchasesMatched}`);
console.log(`⚠️  Purchases unmatched: ${purchasesUnmatched} (contact not in migration list)\n`);

console.log('📊 MIGRATION DATA SUMMARY');
console.log('='.repeat(80));
console.log(`Total contacts ready for migration: ${migrationData.length}`);
console.log(`  Source: Airtable (${airtableRecent} from last 3 months, filtered to have MC_ID or GHL_ID)`);
console.log(`  Supabase export: Skipped (no reliable webhook IDs)`);
console.log();

// Stage breakdown
const stageBreakdown = {};
for (const contact of migrationData) {
  stageBreakdown[contact.stage] = (stageBreakdown[contact.stage] || 0) + 1;
}

console.log('Stage Distribution:');
const stageOrder = ['purchased', 'checkout_started', 'package_sent', 'meeting_held',
                   'meeting_booked', 'form_submitted', 'link_clicked', 'link_sent',
                   'dm_qualified', 'new_lead'];
for (const stage of stageOrder) {
  if (stageBreakdown[stage]) {
    console.log(`  ${stage.padEnd(20)}: ${stageBreakdown[stage]}`);
  }
}
console.log();

// Purchase tracking (dates only, amounts in separate purchases table)
const withPurchaseDate = migrationData.filter(c => c.purchase_date);
if (withPurchaseDate.length > 0) {
  console.log('Purchase Tracking:');
  console.log(`  Contacts with purchase_date: ${withPurchaseDate.length}`);
  console.log(`  (Revenue amounts will come from purchases table)`);
  console.log();
}

// Data quality
const withEmail = migrationData.filter(c => c.email_primary).length;
const withPhone = migrationData.filter(c => c.phone).length;
const withBoth = migrationData.filter(c => c.email_primary && c.phone).length;

console.log('Data Quality:');
console.log(`  With email: ${withEmail} (${(withEmail/migrationData.length*100).toFixed(1)}%)`);
console.log(`  With phone: ${withPhone} (${(withPhone/migrationData.length*100).toFixed(1)}%)`);
console.log(`  With both: ${withBoth} (${(withBoth/migrationData.length*100).toFixed(1)}%)`);
console.log();

// Generate CSV
console.log('💾 Generating migration CSV...\n');

const csvHeaders = [
  'id', 'mc_id', 'ghl_id', 'ad_id',
  'first_name', 'last_name',
  'email_primary', 'email_booking', 'email_payment', 'phone',
  'ig', 'ig_id', 'fb_name',
  'source', 'chatbot_ab', 'misc_ab', 'trigger_word',
  'q1_question', 'q2_question', 'objections', 'lead_summary', 'thread_id',
  'subscribe_date', 'subscribed', 'ig_last_interaction',
  'dm_qualified_date', 'link_send_date', 'link_click_date', 'form_submit_date',
  'appointment_date', 'appointment_held_date', 'package_sent_date',
  'checkout_started', 'purchase_date', 'purchase_amount',
  'stage', 'created_at', 'updated_at'
];

// Use Papa.unparse to properly handle CSV escaping
const csvContent = Papa.unparse(migrationData, {
  columns: csvHeaders,
  quotes: true, // Quote all fields to prevent any parsing issues
  quoteChar: '"',
  escapeChar: '"',
  delimiter: ',',
  newline: '\n'
});

const outputPath = path.join(__dirname, '..', 'historical_data', 'migration_ready_contacts_last_2mo.csv');
fs.writeFileSync(outputPath, csvContent);

console.log(`✅ CSV saved to: ${outputPath}`);
console.log();

// Show sample records
console.log('📋 SAMPLE RECORDS (First 5):');
console.log('='.repeat(80));

for (let i = 0; i < Math.min(5, migrationData.length); i++) {
  const c = migrationData[i];
  console.log(`\n${i + 1}. ${c.first_name || 'Unknown'} ${c.last_name || ''} (${c.source})`);
  console.log(`   Email: ${c.email_primary || 'N/A'}`);
  console.log(`   Phone: ${c.phone || 'N/A'}`);
  console.log(`   Stage: ${c.stage}`);
  if (c.purchase_date) {
    console.log(`   Purchase Date: ${c.purchase_date.substring(0, 10)}`);
  }
  console.log(`   Subscribed: ${c.subscribe_date?.substring(0, 10) || 'Unknown'}`);
  console.log(`   Source: ${c.source}`);
  console.log(`   Trigger Word: ${c.trigger_word || 'N/A'}`);
}

console.log('\n' + '='.repeat(80));
console.log('✅ MIGRATION PREPARATION COMPLETE');
console.log('='.repeat(80));
console.log();
console.log('📌 NEXT STEPS:');
console.log('1. Review the generated CSV file');
console.log('2. Check the stage mapping looks correct');
console.log('3. Verify sample records match expectations');
console.log('4. When ready, we\'ll create the import script for Supabase');
console.log();
console.log('💡 TIP: Run this command to preview the CSV:');
console.log(`   head -20 ${outputPath}`);
console.log();
