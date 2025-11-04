# Historical Data

This folder contains CSV exports and Airtable data that you want to analyze, but **don't** want to import into the Supabase database.

## What Goes Here

- CSV exports from your old spreadsheets
- Airtable exports
- Any historical data that you want to keep for reference
- Data that doesn't fit the new clean schema

## What to Do With This Data

When you need insights from this data:
1. Drop the CSV/export file in this folder
2. Tell Claude what you want to analyze
3. We'll write a quick script to read it and generate insights
4. The script outputs results, but doesn't modify your Supabase database

## Example Files

```
historical_data/
  old_contacts_2024.csv
  airtable_export.csv
  legacy_bookings.csv
  README.md (this file)
```

## Important

This data stays **separate** from your live Supabase database. We don't try to match it up or merge it. It's just for occasional analysis and reference.
