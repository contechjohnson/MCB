#!/usr/bin/env python3
"""
Upload CSV to Google Sheets using gspread (standard method)
Requires: pip install gspread oauth2client
"""

import csv
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# If you have a service account JSON, put path here
# Otherwise we'll use oauth
SHEET_ID = '1U3W7BiaRZ94WLKnsLASdai1RhYr4FR9ur8loSrSHTvc'
CSV_PATH = 'outputs/content_outliers_instagram_data_centner_combined_latest.csv'

# Read CSV
with open(CSV_PATH, 'r', encoding='utf-8-sig') as f:
    reader = csv.reader(f)
    data = list(reader)

print(f"📊 Loaded {len(data)} rows from CSV")

# Authorize with gspread (uses default credentials)
gc = gspread.oauth()

# Open sheet
sh = gc.open_by_key(SHEET_ID)
worksheet = sh.get_worksheet(0)

# Clear existing content
worksheet.clear()

# Upload all data at once
worksheet.update('A1', data, value_input_option='USER_ENTERED')

print(f"✅ Uploaded {len(data)} rows to Google Sheets")
print(f"\n🔗 https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit\n")
