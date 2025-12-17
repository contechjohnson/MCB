/**
 * Update Google Sheet with Real Instagram Outliers
 *
 * Reads sanitized data and updates the existing Google Sheet.
 */

const fs = require('fs');
const path = require('path');

async function main() {
  const sheetId = '1V2SIdWFn7Z75fKcPS79-PeGtdhnynZva_3qVA-HhxTw';
  const userEmail = 'connor@columnline.com';

  // Read sanitized data
  const dataPath = path.join(__dirname, '../outputs/temp_sheet_data_sanitized.json');
  const sheetData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  console.log(`📊 Loaded ${sheetData.length - 1} outliers from sanitized data`);
  console.log(`📤 Sheet ID: ${sheetId}`);
  console.log(`👤 User: ${userEmail}`);
  console.log('\n✅ Data ready - use Google Workspace MCP to update:');
  console.log(`   mcp__google-workspace__modify_sheet_values`);
  console.log(`   spreadsheet_id: ${sheetId}`);
  console.log(`   range_name: A1:S${sheetData.length}`);
  console.log(`   values: <sanitized 2D array>`);
  console.log(`\nAlternatively, copy data manually from:`);
  console.log(`   ${dataPath}`);
}

main().catch(console.error);
