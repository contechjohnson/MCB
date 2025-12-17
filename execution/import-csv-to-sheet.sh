#!/bin/bash
# Import CSV directly to Google Sheets using Google Drive API
#
# This uploads the CSV file and converts it to Google Sheets format

SHEET_ID="1U3W7BiaRZ94WLKnsLASdai1RhYr4FR9ur8loSrSHTvc"
CSV_FILE="outputs/content_outliers_instagram_data_centner_combined_latest.csv"

# Get OAuth token from existing MCP session
# Note: This assumes MCP OAuth is already set up

echo "📤 Uploading CSV to Google Drive..."

# Upload CSV and convert to Sheets format
curl -X POST "https://www.googleapis.com/upload/drive/v3/files/${SHEET_ID}?uploadType=media&convert=true" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: text/csv" \
  --data-binary "@${CSV_FILE}"

echo ""
echo "✅ Import complete!"
echo "🔗 https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit"
