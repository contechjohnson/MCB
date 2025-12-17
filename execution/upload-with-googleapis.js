const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEET_ID = '1U3W7BiaRZ94WLKnsLASdai1RhYr4FR9ur8loSrSHTvc';
const CSV_PATH = path.join(__dirname, '../outputs/content_outliers_instagram_data_centner_combined_latest.csv');

async function uploadCSVToSheets() {
  try {
    // Parse CSV
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    const rows = lines.map(line => {
      // Simple CSV parsing (handles quoted fields)
      const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
      return matches ? matches.map(field => field.replace(/^"|"$/g, '').trim()) : [];
    });

    console.log(`📊 Parsed ${rows.length} rows from CSV`);

    // Use default application credentials (from MCP OAuth)
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Clear sheet first
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: 'A1:Z1000',
    });

    console.log('🧹 Cleared existing data');

    // Upload all rows at once
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows,
      },
    });

    console.log(`✅ Uploaded ${rows.length} rows to Google Sheets\n`);
    console.log(`🔗 https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

uploadCSVToSheets();
