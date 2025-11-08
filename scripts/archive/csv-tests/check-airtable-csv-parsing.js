/**
 * Check how Airtable CSV is actually being parsed
 */

const fs = require('fs');
const Papa = require('papaparse');

const csvContent = fs.readFileSync('./historical_data/airtable_contacts.csv', 'utf8');

const { data: rows, errors } = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
  quoteChar: '"',
  escapeChar: '"',
  delimiter: ',',
  transformHeader: (header) => header.trim().replace(/^\uFEFF/, '') // Remove BOM
});

console.log('CSV Parsing Test\n');
console.log('Errors:', errors.length);
if (errors.length > 0) {
  console.log(errors.slice(0, 5));
}

// Find the specific contacts we're looking at
const testContacts = ['Eneida', 'Brittany', 'Katrina'];

console.log('\nTest Contacts:\n');

testContacts.forEach(name => {
  const matches = rows.filter(r => r.FIRST_NAME === name);

  if (matches.length > 0) {
    console.log(`\n${name} (${matches.length} found):`);
    matches.slice(0, 2).forEach(row => {
      console.log(`  MC_ID: ${row.MC_ID}`);
      console.log(`  SEGMENT_SYMPTOMS: "${row.SEGMENT_SYMPTOMS}"`);
      console.log(`  SEGMENT_MONTHS: "${row.SEGMENT_MONTHS}"`);
      console.log(`  SEGMENT_OBJECTIONS: "${row.SEGMENT_OBJECTIONS}"`);
      console.log(`  SALES_SUMMARY: "${row.SALES_SUMMARY}"`);
      console.log(`  AB_TEST: "${row.AB_TEST}"`);
      console.log('');
    });
  }
});
