/**
 * Compare specific contact rows between broken and fixed CSV
 */

const fs = require('fs');
const Papa = require('papaparse');

const brokenCSV = fs.readFileSync('./historical_data/migration_ready_contacts_last_2mo.csv.BROKEN_BACKUP', 'utf8');
const fixedCSV = fs.readFileSync('./historical_data/migration_ready_contacts_last_2mo.csv', 'utf8');

const brokenData = Papa.parse(brokenCSV, { header: true, skipEmptyLines: true }).data;
const fixedData = Papa.parse(fixedCSV, { header: true, skipEmptyLines: true }).data;

// Find Eneida in both
const brokenEneida = brokenData.find(r => r.mc_id === '1446368541');
const fixedEneida = fixedData.find(r => r.mc_id === '1446368541');

console.log('\n' + '='.repeat(80));
console.log('ENEIDA COMPARISON (MC_ID: 1446368541)');
console.log('='.repeat(80) + '\n');

console.log('BROKEN CSV:');
console.log('  chatbot_ab:', brokenEneida?.chatbot_ab);
console.log('  q1_question:', brokenEneida?.q1_question);
console.log('  q2_question:', brokenEneida?.q2_question);
console.log('  objections:', brokenEneida?.objections);
console.log('  lead_summary:', brokenEneida?.lead_summary);

console.log('\nFIXED CSV:');
console.log('  chatbot_ab:', fixedEneida?.chatbot_ab);
console.log('  q1_question:', fixedEneida?.q1_question);
console.log('  q2_question:', fixedEneida?.q2_question);
console.log('  objections:', fixedEneida?.objections);
console.log('  lead_summary:', fixedEneida?.lead_summary);

// Check a few more contacts
console.log('\n' + '='.repeat(80));
console.log('BRITTANY (MC_ID: 964091757)');
console.log('='.repeat(80) + '\n');

const brokenBrittany = brokenData.find(r => r.mc_id === '964091757');
const fixedBrittany = fixedData.find(r => r.mc_id === '964091757');

console.log('BROKEN CSV:');
console.log('  chatbot_ab:', brokenBrittany?.chatbot_ab);
console.log('  q1_question:', brokenBrittany?.q1_question);
console.log('  q2_question:', brokenBrittany?.q2_question);
console.log('  objections:', brokenBrittany?.objections);

console.log('\nFIXED CSV:');
console.log('  chatbot_ab:', fixedBrittany?.chatbot_ab);
console.log('  q1_question:', fixedBrittany?.q1_question);
console.log('  q2_question:', fixedBrittany?.q2_question);
console.log('  objections:', fixedBrittany?.objections);

console.log('\n' + '='.repeat(80));
console.log('STATS');
console.log('='.repeat(80) + '\n');

console.log('Broken CSV rows:', brokenData.length);
console.log('Fixed CSV rows:', fixedData.length);

console.log('\n');
