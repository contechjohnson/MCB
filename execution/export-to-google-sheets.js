/**
 * Export Content Outliers to Google Sheets
 *
 * Usage: node execution/export-to-google-sheets.js <csv_path> <user_email>
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());

  // Parse CSV with proper quote handling
  const rows = lines.map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current); // Last value

    return values;
  });

  return rows;
}

function formatForSheets(rows) {
  // Format header row
  const headers = [
    'Cross-Niche Score',
    'Final Score',
    'Raw Outlier Score',
    'Days Ago',
    'Category',
    'Creator',
    'Followers',
    'Avg ER',
    'Post URL',
    'Thumbnail',
    'Caption',
    'Likes',
    'Comments',
    'Date',
    'Post ER',
    'Caption Variant 1',
    'Caption Variant 2',
    'Caption Variant 3',
    'Type'
  ];

  // Format data rows
  const dataRows = rows.slice(1).map(row => {
    return [
      parseFloat(row[0]).toFixed(2),  // cross_niche_score
      parseFloat(row[1]).toFixed(2),  // final_score
      parseFloat(row[2]).toFixed(2),  // raw_outlier_score
      parseInt(row[3]),               // days_ago
      row[4],                          // category
      `@${row[5]}`,                    // creator_handle
      parseInt(row[6]).toLocaleString(), // creator_followers
      `${parseFloat(row[7]).toFixed(2)}%`, // creator_avg_er
      row[8],                          // post_url (will be hyperlinked)
      `=IMAGE("${row[9]}")`,           // thumbnail_url (formula)
      row[10].substring(0, 200),       // caption (truncated)
      parseInt(row[11]).toLocaleString(), // likes
      parseInt(row[12]).toLocaleString(), // comments
      row[13].split('T')[0],           // post_date (just date)
      `${parseFloat(row[14]).toFixed(2)}%`, // post_er
      row[15],                         // caption_variant_1
      row[16],                         // caption_variant_2
      row[17],                         // caption_variant_3
      row[18]                          // post_type
    ];
  });

  return [headers, ...dataRows];
}

async function main() {
  const csvPath = process.argv[2] || path.join(__dirname, '../outputs/content_outliers_centner_latest.csv');
  const userEmail = process.argv[3];

  if (!userEmail) {
    console.error('❌ Error: Please provide your Google email');
    console.log('Usage: node execution/export-to-google-sheets.js <csv_path> <user_email>');
    process.exit(1);
  }

  console.log(`📊 Reading CSV: ${csvPath}\n`);

  const rows = await parseCSV(csvPath);
  console.log(`✅ Parsed ${rows.length - 1} outliers\n`);

  const sheetData = formatForSheets(rows);

  console.log('📤 Ready to export to Google Sheets');
  console.log('   Use Google Workspace MCP to create spreadsheet with this data\n');

  // Write formatted data to temp file for MCP consumption
  const tempFile = path.join(__dirname, '../outputs/temp_sheet_data.json');
  fs.writeFileSync(tempFile, JSON.stringify(sheetData, null, 2));

  console.log(`💾 Formatted data saved to: ${tempFile}`);
  console.log(`\nNext: Use mcp__google-workspace__create_spreadsheet and mcp__google-workspace__modify_sheet_values`);

  return sheetData;
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { parseCSV, formatForSheets };
