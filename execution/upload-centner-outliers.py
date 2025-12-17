#!/usr/bin/env python3
"""
Upload Content Outliers to Google Sheets using MCP

Prepares data with IMAGE formulas for thumbnails and uploads in batches
to avoid MCP JSON parsing limits.
"""

import csv
import json
import subprocess
import sys

SPREADSHEET_ID = "1Y8km8-iAAhOEB2BsIfIMT15b1BKpGOHDUz_g0yx5UrE"
USER_EMAIL = "connor@columnline.com"

def parse_csv(file_path):
    """Parse CSV and return headers + rows"""
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        headers = next(reader)
        rows = list(reader)
    return headers, rows

def format_row(row, headers):
    """Format a row with proper formulas for hyperlinks and images"""
    formatted = []

    for i, value in enumerate(row):
        header = headers[i]

        # Column I (index 8) - post_url - make clickable hyperlink
        if i == 8 and value:
            formatted.append(f'=HYPERLINK("{value}", "View Post")')
        # Column J (index 9) - thumbnail_url - use IMAGE formula
        elif i == 9 and value:
            formatted.append(f'=IMAGE("{value}")')
        # All other columns - plain value
        else:
            formatted.append(value)

    return formatted

def upload_batch(range_name, values):
    """Upload a batch of rows using MCP tool"""
    # Prepare data as JSON string
    data = json.dumps(values)

    # Call MCP tool via subprocess
    cmd = [
        'claude', 'mcp', 'call',
        'google-workspace', 'modify_sheet_values',
        '--user_google_email', USER_EMAIL,
        '--spreadsheet_id', SPREADSHEET_ID,
        '--range_name', range_name,
        '--value_input_option', 'USER_ENTERED',  # This parses formulas
        '--values', data
    ]

    print(f"📤 Uploading {range_name}...")
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"❌ Error: {result.stderr}")
        return False

    print(f"✅ {range_name} uploaded")
    return True

def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else 'outputs/content_outliers_instagram_data_centner_combined_latest.csv'

    print(f"\n📊 Preparing to upload: {csv_path}\n")

    # Parse CSV
    headers, rows = parse_csv(csv_path)
    print(f"✅ Parsed {len(rows)} outliers with {len(headers)} columns")

    # Prepare header row
    header_row = [headers]

    # Upload header
    if not upload_batch('Outliers!A1', header_row):
        sys.exit(1)

    # Format and upload data in batches of 10 rows
    batch_size = 10
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        formatted_batch = [format_row(row, headers) for row in batch]

        start_row = i + 2  # +1 for header, +1 for 1-indexed
        end_row = start_row + len(batch) - 1
        range_name = f'Outliers!A{start_row}:S{end_row}'

        if not upload_batch(range_name, formatted_batch):
            print(f"❌ Failed at batch {i//batch_size + 1}")
            sys.exit(1)

    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("✨ Upload Complete!")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"\n📊 Google Sheet URL:")
    print(f"   https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit")
    print(f"\n📈 Summary:")
    print(f"   - Total outliers: {len(rows)}")
    print(f"   - Columns: {len(headers)}")
    print(f"   - Thumbnails: IMAGE formulas added (may not render if Instagram blocks)")
    print(f"   - Post URLs: Clickable 'View Post' hyperlinks")
    print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

if __name__ == '__main__':
    main()
