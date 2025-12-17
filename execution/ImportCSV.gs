/**
 * Google Apps Script to import CSV data into this sheet
 *
 * HOW TO USE:
 * 1. Open the Google Sheet: https://docs.google.com/spreadsheets/d/1U3W7BiaRZ94WLKnsLASdai1RhYr4FR9ur8loSrSHTvc/edit
 * 2. Click Extensions → Apps Script
 * 3. Paste this code and save
 * 4. Run importCSVData() function
 * 5. Authorize when prompted
 */

function importCSVData() {
  const csvData = `PUT_CSV_DATA_HERE`;

  // Parse CSV
  const lines = csvData.trim().split('\n');
  const rows = lines.map(line => {
    // Handle quoted fields
    const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
    return matches ? matches.map(field => field.replace(/^"|"$/g, '')) : [];
  });

  // Get active sheet
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // Clear existing data
  sheet.clear();

  // Write all rows
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  Logger.log(`Imported ${rows.length} rows`);
  SpreadsheetApp.getUi().alert(`Successfully imported ${rows.length} rows!`);
}
