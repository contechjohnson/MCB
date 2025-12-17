/**
 * Upload Content Outliers to Google Sheets
 *
 * Creates a properly formatted Google Sheet with:
 * - IMAGE formulas for thumbnails (not just URLs)
 * - Clickable hyperlinks for URLs
 * - Conditional formatting for scores
 * - Proper column widths and styling
 *
 * Usage: node execution/upload-outliers-to-sheets.js <csv-path>
 */

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Parse CSV file
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  // Remove BOM if present
  if (lines[0].charCodeAt(0) === 0xFEFF) {
    lines[0] = lines[0].substring(1);
  }

  const headers = lines[0].split(',');
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    rows.push(values);
  }

  return { headers, rows };
}

// Parse CSV line handling quoted fields
function parseCSVLine(line) {
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
}

async function uploadToSheets(csvPath) {
  console.log('\n📊 Uploading Content Outliers to Google Sheets\n');

  // Parse CSV
  const { headers, rows } = parseCSV(csvPath);
  console.log(`✅ Parsed CSV: ${rows.length} rows, ${headers.length} columns`);

  // Initialize Google Sheets API
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Create spreadsheet
  const timestamp = new Date().toISOString().split('T')[0];
  const title = `Content Outliers - Centner Wellness - ${timestamp}`;

  console.log(`\n📝 Creating spreadsheet: "${title}"`);

  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: title,
      },
      sheets: [{
        properties: {
          title: 'Outliers',
          gridProperties: {
            rowCount: rows.length + 1,
            columnCount: headers.length,
          },
        },
      }],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId;
  const spreadsheetUrl = createResponse.data.spreadsheetUrl;

  console.log(`✅ Created: ${spreadsheetUrl}`);

  // Prepare data with formulas
  const sheetData = [headers];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const formattedRow = [];

    for (let j = 0; j < row.length; j++) {
      const header = headers[j];
      const value = row[j];

      // Column I (index 8) - post_url - make it a hyperlink
      if (j === 8 && value) {
        formattedRow.push(`=HYPERLINK("${value}", "View Post")`);
      }
      // Column J (index 9) - thumbnail_url - use IMAGE formula
      else if (j === 9 && value) {
        formattedRow.push(`=IMAGE("${value}")`);
      }
      // All other columns - plain values
      else {
        formattedRow.push(value);
      }
    }

    sheetData.push(formattedRow);
  }

  // Upload data
  console.log('\n📤 Uploading data with formulas...');

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Outliers!A1',
    valueInputOption: 'USER_ENTERED', // This allows formulas to be parsed
    requestBody: {
      values: sheetData,
    },
  });

  console.log('✅ Data uploaded');

  // Apply formatting
  console.log('\n🎨 Applying formatting...');

  const requests = [
    // Freeze header row
    {
      updateSheetProperties: {
        properties: {
          sheetId: 0,
          gridProperties: {
            frozenRowCount: 1,
          },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    // Bold header row
    {
      repeatCell: {
        range: {
          sheetId: 0,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              bold: true,
            },
          },
        },
        fields: 'userEnteredFormat.textFormat.bold',
      },
    },
    // Set column widths
    {
      updateDimensionProperties: {
        range: {
          sheetId: 0,
          dimension: 'COLUMNS',
          startIndex: 0, // cross_niche_score
          endIndex: 1,
        },
        properties: {
          pixelSize: 100,
        },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: 0,
          dimension: 'COLUMNS',
          startIndex: 9, // thumbnail
          endIndex: 10,
        },
        properties: {
          pixelSize: 150,
        },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: 0,
          dimension: 'COLUMNS',
          startIndex: 10, // caption
          endIndex: 11,
        },
        properties: {
          pixelSize: 300,
        },
        fields: 'pixelSize',
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId: 0,
          dimension: 'COLUMNS',
          startIndex: 15, // caption variants
          endIndex: 18,
        },
        properties: {
          pixelSize: 400,
        },
        fields: 'pixelSize',
      },
    },
    // Set row height for data rows (to show thumbnails)
    {
      updateDimensionProperties: {
        range: {
          sheetId: 0,
          dimension: 'ROWS',
          startIndex: 1,
          endIndex: rows.length + 1,
        },
        properties: {
          pixelSize: 100,
        },
        fields: 'pixelSize',
      },
    },
    // Conditional formatting for cross_niche_score (column A)
    // Dark green for >= 5.0
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: rows.length + 1,
            startColumnIndex: 0,
            endColumnIndex: 1,
          }],
          booleanRule: {
            condition: {
              type: 'NUMBER_GREATER_THAN_EQ',
              values: [{ userEnteredValue: '5.0' }],
            },
            format: {
              backgroundColor: { red: 0.0, green: 0.6, blue: 0.0 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
            },
          },
        },
        index: 0,
      },
    },
    // Light green for >= 3.0
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: rows.length + 1,
            startColumnIndex: 0,
            endColumnIndex: 1,
          }],
          booleanRule: {
            condition: {
              type: 'NUMBER_GREATER_THAN_EQ',
              values: [{ userEnteredValue: '3.0' }],
            },
            format: {
              backgroundColor: { red: 0.7, green: 0.9, blue: 0.7 },
            },
          },
        },
        index: 1,
      },
    },
    // Yellow for >= 2.0
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: rows.length + 1,
            startColumnIndex: 0,
            endColumnIndex: 1,
          }],
          booleanRule: {
            condition: {
              type: 'NUMBER_GREATER_THAN_EQ',
              values: [{ userEnteredValue: '2.0' }],
            },
            format: {
              backgroundColor: { red: 1.0, green: 1.0, blue: 0.6 },
            },
          },
        },
        index: 2,
      },
    },
    // Bold + dark blue text for days_ago <= 1 (viral NOW)
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: rows.length + 1,
            startColumnIndex: 3, // days_ago column
            endColumnIndex: 4,
          }],
          booleanRule: {
            condition: {
              type: 'NUMBER_LESS_THAN_EQ',
              values: [{ userEnteredValue: '1' }],
            },
            format: {
              textFormat: {
                foregroundColor: { red: 0, green: 0, blue: 0.8 },
                bold: true,
              },
            },
          },
        },
        index: 3,
      },
    },
    // Bold text for days_ago <= 3 (very recent)
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: rows.length + 1,
            startColumnIndex: 3,
            endColumnIndex: 4,
          }],
          booleanRule: {
            condition: {
              type: 'NUMBER_LESS_THAN_EQ',
              values: [{ userEnteredValue: '3' }],
            },
            format: {
              textFormat: { bold: true },
            },
          },
        },
        index: 4,
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });

  console.log('✅ Formatting applied');

  // Sort by cross_niche_score descending
  console.log('\n🔀 Sorting by cross-niche score...');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        sortRange: {
          range: {
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: rows.length + 1,
            startColumnIndex: 0,
            endColumnIndex: headers.length,
          },
          sortSpecs: [
            {
              dimensionIndex: 0, // cross_niche_score
              sortOrder: 'DESCENDING',
            },
            {
              dimensionIndex: 3, // days_ago (secondary sort)
              sortOrder: 'ASCENDING',
            },
          ],
        },
      }],
    },
  });

  console.log('✅ Sorted');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Success!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊 Google Sheet URL:\n   ${spreadsheetUrl}`);
  console.log(`\n📈 Summary:`);
  console.log(`   - Total outliers: ${rows.length}`);
  console.log(`   - Columns: ${headers.length}`);
  console.log(`   - Thumbnails: IMAGE formulas (will render if URLs exist)`);
  console.log(`   - Post URLs: Clickable hyperlinks`);
  console.log(`   - Sorted by: Cross-niche score (descending)`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return spreadsheetUrl;
}

// Main execution
const csvPath = process.argv[2] || 'outputs/content_outliers_instagram_data_centner_combined_latest.csv';

if (!fs.existsSync(csvPath)) {
  console.error(`❌ Error: CSV file not found: ${csvPath}`);
  process.exit(1);
}

uploadToSheets(csvPath)
  .then(url => {
    console.log('✅ Upload complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
