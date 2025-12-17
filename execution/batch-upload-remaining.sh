#!/bin/bash

# Upload remaining outliers to Google Sheets in batches
# This uploads rows 12-108 (97 more outliers) in batches of 15

SPREADSHEET_ID="1Y8km8-iAAhOEB2BsIfIMT15b1BKpGOHDUz_g0yx5UrE"
CSV_PATH="outputs/content_outliers_instagram_data_centner_combined_latest.csv"

echo "Uploading remaining 105 outliers in batches..."
echo ""

# Use python to upload in batches
python3 << 'PYEOF'
import csv
import json
import subprocess

SPREADSHEET_ID = "1Y8km8-iAAhOEB2BsIfIMT15b1BKpGOHDUz_g0yx5UrE"
USER_EMAIL = "connor@columnline.com"
CSV_PATH = "outputs/content_outliers_instagram_data_centner_combined_latest.csv"

# Parse CSV
with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
    reader = csv.reader(f)
    headers = next(reader)
    all_rows = list(reader)

# Skip first 2 rows (already uploaded)
remaining_rows = all_rows[2:]

# Format rows with formulas
def format_row(row):
    formatted = []
    for i, value in enumerate(row):
        if i == 8 and value:  # post_url
            formatted.append(f'=HYPERLINK("{value}", "View Post")')
        elif i == 9 and value:  # thumbnail_url
            formatted.append(f'=IMAGE("{value}")')
        else:
            formatted.append(value)
    return formatted

# Upload in batches of 15
batch_size = 15
start_row = 4  # Starting from row 4 (already have 1-3)

for i in range(0, len(remaining_rows), batch_size):
    batch = remaining_rows[i:i+batch_size]
    formatted_batch = [format_row(row) for row in batch]

    end_row = start_row + len(batch) - 1
    range_name = f'Outliers!A{start_row}:S{end_row}'

    print(f"Uploading batch {i//batch_size + 1}/{len(remaining_rows)//batch_size + 1}: rows {start_row}-{end_row}...")

    # Call MCP via subprocess
    data = json.dumps(formatted_batch)
    cmd = [
        'claude', 'mcp', 'call',
        'google-workspace', 'modify_sheet_values',
        '--user_google_email', USER_EMAIL,
        '--spreadsheet_id', SPREADSHEET_ID,
        '--range_name', range_name,
        '--value_input_option', 'USER_ENTERED',
        '--values', data
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"ERROR: {result.stderr}")
        break

    print(f"✓ Batch {i//batch_size + 1} complete")

    start_row = end_row + 1

print("\n✅ All outliers uploaded!")
print(f"📊 Google Sheet: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit")
PYEOF
