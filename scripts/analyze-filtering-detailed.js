const fs = require('fs');

function parseCSV(filePath) {
  const csv = fs.readFileSync(filePath, 'utf8');
  const lines = csv.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i]?.trim() || '';
    });
    return row;
  });
}

function parseDate(dateStr) {
  if (!dateStr || dateStr === '') return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d;
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone.replace(/\D/g, (match, offset) => offset === 0 ? match : '');
  return null;
}

function mapStage(oldStage, hasPhone, hasEmail) {
  if (!oldStage || oldStage === '') return null;
  const stage = oldStage.toUpperCase().trim();

  if (stage === 'BOUGHT_PACKAGE' || stage === 'PAID') return 'purchased';
  if (stage === 'PACKAGE_REGISTRATION_COMPLETE') return 'checkout_started';
  if (stage === 'PACKAGE_SENT' || stage === 'SENT_PACKAGE') return 'package_sent';
  if (stage === 'ATTENDED') return 'meeting_held';
  if (stage === 'BOOKED' || stage === 'READY_TO_BOOK') return 'meeting_booked';
  if (stage === 'LEAD_CONTACT' && hasPhone && hasEmail) return 'form_submitted';
  if (stage === 'CLICKED_LINK' || stage === 'COMPLETED_DC') return 'form_submitted';
  if (stage.includes('CLICK') && stage.includes('LINK')) return 'link_clicked';
  if (stage === 'SENT_LINK') return 'link_sent';
  if (stage === 'DM_QUALIFIED' || stage === 'SHOWED_INTEREST' || stage.includes('CLARA')) return 'dm_qualified';
  if (stage === 'LEAD_CONTACT' || stage === 'LEAD' || stage.includes('NEW_CONTACT')) return 'new_lead';

  return null;
}

const data = parseCSV('historical_data/airtable_contacts.csv');
const twoMonthsAgo = new Date('2025-09-06');

console.log('\nDETAILED FILTERING ANALYSIS');
console.log('='.repeat(80));
console.log(`Total Airtable contacts: ${data.length}\n`);

let passDate = 0;
let passId = 0;
let passEmail = 0;
let passStage = 0;
let passAll = 0;

let failDate = 0;
let failId = 0;
let failEmail = 0;
let failStage = 0;

const unmappableStages = new Set();

for (const row of data) {
  // Date filter
  const subDate = parseDate(row.SUBSCRIBED_DATE);
  const purDate = parseDate(row.DATE_SET_PURCHASE);
  const dateOk = (subDate && subDate >= twoMonthsAgo) || (purDate && purDate >= twoMonthsAgo);

  // ID filter
  const mcId = row.MC_ID?.trim();
  const ghlId = row.GHL_ID?.trim();
  const idOk = mcId || ghlId;

  // Email/phone filter
  const email = row.EMAIL?.toLowerCase().trim();
  const phone = normalizePhone(row.PHONE);
  const contactOk = email || phone;

  // Stage filter
  const hasPhone = !!phone;
  const hasEmail = !!email;
  const newStage = mapStage(row.STAGE, hasPhone, hasEmail);
  const stageOk = !!newStage;

  if (!stageOk && row.STAGE) {
    unmappableStages.add(row.STAGE);
  }

  // Count individual passes
  if (dateOk) passDate++;
  if (idOk) passId++;
  if (contactOk) passEmail++;
  if (stageOk) passStage++;

  // All filters
  if (dateOk && idOk && contactOk && stageOk) {
    passAll++;
  } else {
    if (!dateOk) failDate++;
    if (!idOk) failId++;
    if (!contactOk) failEmail++;
    if (!stageOk) failStage++;
  }
}

console.log('INDIVIDUAL FILTER RESULTS:');
console.log(`  Pass date filter (>= Sept 6): ${passDate}`);
console.log(`  Pass ID filter (MC or GHL): ${passId}`);
console.log(`  Pass contact filter (email or phone): ${passEmail}`);
console.log(`  Pass stage filter (mappable): ${passStage}\n`);

console.log('FAILURE BREAKDOWN (among contacts that fail):');
console.log(`  Fail date: ${failDate}`);
console.log(`  Fail ID: ${failId}`);
console.log(`  Fail email/phone: ${failEmail}`);
console.log(`  Fail stage: ${failStage}\n`);

console.log('UNMAPPABLE STAGES:');
console.log([...unmappableStages].sort().join(', ') || 'None');
console.log();

console.log('FINAL RESULT:');
console.log(`  Pass ALL filters: ${passAll}`);
console.log(`  Expected: ~520`);
console.log(`  ${Math.abs(passAll - 520) < 20 ? '✅ MATCH!' : '⚠️ Check logic'}\n`);
