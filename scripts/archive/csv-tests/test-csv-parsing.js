const fs = require('fs');

// Simple CSV parser that handles quoted fields
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length > 0) {
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      rows.push(row);
    }
  }

  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);

  return result;
}

const data = parseCSV('/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/migration_ready_contacts_last_2mo.csv');

console.log('\nCSV PARSING TEST');
console.log('='.repeat(80));
console.log(`Total rows parsed: ${data.length}`);
console.log(`Expected: 537`);
console.log(`Status: ${data.length === 537 ? '✅ PERFECT MATCH!' : '⚠️ Mismatch'}`);
console.log();

// Check a few sample rows
console.log('Sample parsed rows:');
console.log(`Row 1: ${data[0].first_name} ${data[0].last_name} - ${data[0].email_primary}`);
console.log(`Row 5: ${data[4].first_name} ${data[4].last_name} - ${data[4].q1_question?.substring(0, 50)}`);
console.log(`Row 100: ${data[99].first_name} ${data[99].last_name} - ${data[99].email_primary}`);
console.log(`Row 537: ${data[536].first_name} ${data[536].last_name} - ${data[536].email_primary}`);
console.log();

// Check for any rows with mismatched field counts
const headerCount = 38; // Number of headers
let badRows = 0;
data.forEach((row, idx) => {
  const fieldCount = Object.keys(row).length;
  if (fieldCount !== headerCount) {
    console.log(`⚠️ Row ${idx + 1}: has ${fieldCount} fields (expected ${headerCount})`);
    badRows++;
  }
});

if (badRows === 0) {
  console.log('✅ All rows have correct field count!');
} else {
  console.log(`⚠️ Found ${badRows} rows with field count issues`);
}
