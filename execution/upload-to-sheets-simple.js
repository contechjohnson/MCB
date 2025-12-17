#!/usr/bin/env node
/**
 * Upload CSV to existing Google Sheet
 * Uses googleapis with simple OAuth flow
 */

const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const SPREADSHEET_ID = '1Y8km8-iAAhOEB2BsIfIMT15b1BKpGOHDUz_g0yx5UrE';
const CSV_PATH = path.join(__dirname, '../outputs/content_outliers_instagram_data_centner_combined_latest.csv');

// Simple OAuth config (uses installed app flow)
const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',  // We'll use a simpler approach
  'YOUR_CLIENT_SECRET',
  'urn:ietf:wg:oauth:2.0:oob'
);

async function uploadCSVToSheet() {
  console.log('\n📊 Uploading CSV to Google Sheets\n');

  // Read CSV
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = csvContent.split('\n').filter(l => l.trim());

  console.log(`✅ Read CSV: ${lines.length} rows`);

  // Parse CSV (simple parser)
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
    values.push(current);
    return values;
  });

  console.log(`✅ Parsed ${rows.length} rows\n`);

  // Format rows with formulas
  const formattedRows = rows.map((row, idx) => {
    if (idx === 0) return row; // Header

    return row.map((val, colIdx) => {
      if (colIdx === 8 && val) {  // post_url
        return `=HYPERLINK("${val}", "View Post")`;
      } else if (colIdx === 9 && val) {  // thumbnail_url
        return `=IMAGE("${val}")`;
      }
      return val;
    });
  });

  // Use the Sheets API directly with batch update
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  try {
    const result = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Outliers!A1:S' + formattedRows.length,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: formattedRows
      }
    });

    console.log(`✅ Uploaded ${result.data.updatedRows} rows`);
    console.log(`\n🔗 https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit\n`);

  } catch (error) {
    console.error('❌ Upload failed:', error.message);
  }
}

uploadCSVToSheet();
