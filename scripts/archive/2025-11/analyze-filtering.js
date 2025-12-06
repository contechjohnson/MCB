const fs = require('fs');
const path = require('path');

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

const data = parseCSV('historical_data/airtable_contacts.csv');
const twoMonthsAgo = new Date('2025-09-06');

console.log('\nAIRTABLE FILTERING ANALYSIS');
console.log('='.repeat(80));
console.log(`Total Airtable contacts: ${data.length}\n`);

// Check ID requirements
let hasMcId = 0;
let hasGhlId = 0;
let hasEither = 0;

for (const row of data) {
  const mc = row.MC_ID?.trim();
  const ghl = row.GHL_ID?.trim();

  if (mc) hasMcId++;
  if (ghl) hasGhlId++;
  if (mc || ghl) hasEither++;
}

console.log('ID REQUIREMENTS:');
console.log(`  Have MC_ID: ${hasMcId}`);
console.log(`  Have GHL_ID: ${hasGhlId}`);
console.log(`  Have either MC_ID OR GHL_ID: ${hasEither}`);
console.log(`  Missing both IDs: ${data.length - hasEither}\n`);

// Check date filtering
let passesDateFilter = 0;
let hasSubDate = 0;
let hasPurDate = 0;

for (const row of data) {
  const subDate = parseDate(row.SUBSCRIBED_DATE);
  const purDate = parseDate(row.DATE_SET_PURCHASE);

  if (subDate) hasSubDate++;
  if (purDate) hasPurDate++;

  if ((subDate && subDate >= twoMonthsAgo) || (purDate && purDate >= twoMonthsAgo)) {
    passesDateFilter++;
  }
}

console.log('DATE FILTER (>= Sept 6, 2025):');
console.log(`  Have subscribe_date: ${hasSubDate}`);
console.log(`  Have purchase_date: ${hasPurDate}`);
console.log(`  Pass date filter: ${passesDateFilter}`);
console.log(`  Fail date filter: ${data.length - passesDateFilter}\n`);

// Combined filters
let passesAll = 0;
let failsDate = 0;
let failsId = 0;
let failsBoth = 0;

for (const row of data) {
  const subDate = parseDate(row.SUBSCRIBED_DATE);
  const purDate = parseDate(row.DATE_SET_PURCHASE);
  const datePass = (subDate && subDate >= twoMonthsAgo) || (purDate && purDate >= twoMonthsAgo);

  const mc = row.MC_ID?.trim();
  const ghl = row.GHL_ID?.trim();
  const idPass = mc || ghl;

  if (datePass && idPass) {
    passesAll++;
  } else if (!datePass && !idPass) {
    failsBoth++;
  } else if (!datePass) {
    failsDate++;
  } else if (!idPass) {
    failsId++;
  }
}

console.log('COMBINED FILTERS:');
console.log(`  Pass both (Date AND ID): ${passesAll}`);
console.log(`  Fail date only: ${failsDate}`);
console.log(`  Fail ID only: ${failsId}`);
console.log(`  Fail both: ${failsBoth}\n`);

console.log('CONCLUSION:');
console.log(`  Expected in migration: ${passesAll}`);
console.log(`  Actual in migration: 520-528`);
console.log(`  ${passesAll === 528 ? '✅ MATCH!' : '⚠️  Slight difference'}\n`);
