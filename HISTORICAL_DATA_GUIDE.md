# Historical Data Analysis System - Complete Guide

**Last Updated:** November 5, 2025

This guide walks you through everything you need to know about analyzing your messy historical data from Google Sheets, Airtable, Stripe, and Denefits.

---

## 🎯 What This System Does

This historical data analysis system is **completely separate** from your live webhook system. It:

- Imports messy CSV exports from legacy systems
- Normalizes and deduplicates data
- Stores clean(ish) data in dedicated `hist_*` tables
- Provides pre-built SQL views for common questions
- Lets you ask questions in natural language
- Generates automated weekly reports with AI insights

**What it's NOT:**
- Not connected to your live contacts/payments tables
- Not a replacement for your webhook system
- Not trying to be perfect (it works with what you have)

---

## 📋 Prerequisites

### Required Software

1. **Python 3.7+** (for import scripts)
   ```bash
   python3 --version
   ```

2. **Node.js 18+** (for query tool and reports)
   ```bash
   node --version
   ```

3. **Python packages**
   ```bash
   pip install supabase python-dotenv pandas
   ```

### Required Environment Variables

Add these to your `.env.local` file:

```bash
# Supabase (you already have these)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Claude API (for natural language queries and AI insights)
ANTHROPIC_API_KEY=sk-ant-...
```

**Get Claude API Key:**
1. Go to https://console.anthropic.com/
2. Create an API key
3. Add to `.env.local`

---

## 🚀 Setup (One-Time)

### Step 1: Run Database Migrations

These create the `hist_*` tables and views in Supabase.

**Option A: Via Supabase Dashboard (Easiest)**
1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the left sidebar
3. Open `migrations/20250511_create_historical_tables.sql`
4. Copy entire contents
5. Paste into SQL Editor
6. Click **Run**
7. Repeat for `migrations/20250511_create_historical_views.sql`

**Option B: Via Supabase CLI** (if installed)
```bash
supabase db push
```

**Verify it worked:**
```sql
-- Run this in Supabase SQL Editor
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'hist_%';
```

You should see: `hist_contacts`, `hist_payments`, `hist_timeline`, `hist_import_logs`

---

## 📥 Importing Your Data

### Step 1: Export Your Data

**Google Sheets:**
1. Open your massive Google Sheet
2. File → Download → CSV (.csv)
3. Save as `google_sheets_export.csv`

**Airtable:**
1. Open your Airtable base
2. Click the view dropdown (top left)
3. Click "..." → "Download CSV"
4. Save as `airtable_export.csv`

**Stripe:**
1. Go to https://dashboard.stripe.com/payments
2. Click "Export" (top right)
3. Select date range (all time)
4. Download CSV
5. Save as `stripe_export.csv`

**Denefits:**
1. Export from your Denefits dashboard
2. Save as `denefits_export.csv`

**Put all CSVs in:** `/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/`

---

### Step 2: Import Google Sheets Data

This imports contacts from your Google Sheets export.

```bash
cd /Users/connorjohnson/CLAUDE_CODE/MCB
python scripts/import_google_sheets.py historical_data/google_sheets_export.csv
```

**What it does:**
- Reads CSV
- Normalizes emails (lowercase, trimmed)
- Deduplicates by email
- Extracts dates if available (row creation timestamp)
- Flags suspicious data (future dates, fake emails)
- Inserts into `hist_contacts` table
- Creates timeline events

**Expected output:**
```
============================================================
IMPORTING GOOGLE SHEETS CSV: historical_data/google_sheets_export.csv
============================================================

📖 Reading CSV file...
✓ Found 3,456 rows in CSV

🔄 Processing rows...
✓ Processed 3,456 rows
  - 3,102 contacts ready to import
  - 354 rows skipped (no email or errors)

🔍 Deduplicating by email...
✓ Deduped to 2,847 unique contacts

💾 Inserting into Supabase...
✓ Inserted 2,847 contacts into hist_contacts

============================================================
✅ IMPORT COMPLETE
============================================================
```

---

### Step 3: Import Airtable Data

This merges Airtable data with existing contacts (or creates new ones).

```bash
python scripts/import_airtable.py historical_data/airtable_export.csv
```

**What it does:**
- Handles duplicate columns (merges them)
- Extracts ad attribution (paid vs organic, trigger words, campaign names)
- Merges with existing contacts from Google Sheets
- Updates existing records or inserts new ones

**Expected output:**
```
============================================================
IMPORTING AIRTABLE CSV: historical_data/airtable_export.csv
============================================================

📖 Reading CSV file...
✓ Found 2,134 rows in CSV

🔍 Checking for duplicate columns...
  Found duplicate columns: ['Email', 'Campaign']

🔄 Processing rows...
✓ Processed 2,134 rows
  - 2,003 contacts ready to import
  - 131 rows skipped

🔗 Checking for existing contacts...
✓ Found 1,654 existing contacts

💾 Upserting into Supabase...
✓ Upserted 2,003 contacts
  - 349 new inserts
  - 1,654 updates to existing records
```

---

### Step 4: Import Payment Data

This imports Stripe and Denefits payments, links them to contacts, and updates purchase status.

**Stripe:**
```bash
python scripts/import_payments.py --stripe historical_data/stripe_export.csv
```

**Denefits:**
```bash
python scripts/import_payments.py --denefits historical_data/denefits_export.csv
```

**Both at once:**
```bash
python scripts/import_payments.py \
  --stripe historical_data/stripe_export.csv \
  --denefits historical_data/denefits_export.csv
```

**What it does:**
- Parses payment amounts (handles cents vs dollars, currency symbols)
- Normalizes dates
- Links payments to contacts by email
- Updates `hist_contacts` with purchase info
- Calculates total purchase amount per customer
- Flags refunds separately

**Expected output:**
```
============================================================
IMPORTING STRIPE PAYMENTS: historical_data/stripe_export.csv
============================================================

📖 Reading CSV file...
✓ Found 487 rows in CSV

🔄 Processing rows...
✓ Processed 487 rows
  - 479 payments ready to import
  - 8 rows skipped

💾 Inserting payments into Supabase...
✓ Inserted 479 payments into hist_payments

🔗 Updating contacts with purchase info...
✓ Updated 412 contacts with purchase info

Revenue Stats:
  Total revenue: $412,537.00
  Refunds: $3,480.00
  Net revenue: $409,057.00
```

---

## 📊 Querying Your Data

### Method 1: Pre-Built Views (Easiest)

Just run these in Supabase SQL Editor:

```sql
-- Overall funnel performance
SELECT * FROM v_funnel_summary;

-- Revenue by paid vs organic
SELECT * FROM v_paid_vs_organic;

-- Top performing trigger words
SELECT * FROM v_top_trigger_words;

-- Conversion rates over time
SELECT * FROM v_conversion_over_time;

-- How long does it take to convert?
SELECT * FROM v_time_to_purchase_summary;

-- Payment method breakdown
SELECT * FROM v_payment_breakdown;

-- Data quality check
SELECT * FROM v_data_quality_report;
```

---

### Method 2: Natural Language Queries (Coolest)

Ask questions in plain English and get SQL + results + AI insights.

```bash
# Ask a question
node scripts/query-historical.js "show me paid vs organic revenue"

# Another example
node scripts/query-historical.js "which trigger words had the best conversion rate?"

# Use a saved query
node scripts/query-historical.js --saved funnel

# Run raw SQL
node scripts/query-historical.js --sql "SELECT * FROM v_funnel_summary"
```

**Example output:**
```
🤔 Converting to SQL...

📝 Generated SQL:
SELECT * FROM v_paid_vs_organic

⚡ Executing query...

✅ Results (2 rows):

ad_type | contact_count | purchase_count | conversion_rate | total_revenue | avg_order_value | revenue_per_lead
--------|---------------|----------------|-----------------|---------------|-----------------|------------------
organic | 1,847         | 284            | 15.38%          | $256,780.00   | $903.73         | $139.01
paid    | 1,000         | 128            | 12.80%          | $152,277.00   | $1,189.66       | $152.28

💡 Interpreting results...

📊 Insights:
Organic traffic shows a higher conversion rate (15.38% vs 12.80%) despite paid traffic
generating higher average order values ($1,189.66 vs $903.73). However, paid traffic
produces slightly better revenue per lead ($152.28 vs $139.01), suggesting your paid
campaigns attract higher-intent prospects willing to pay more.
```

**Saved queries available:**
- `funnel` - Overall funnel summary
- `attribution` - Revenue by source and trigger word
- `conversion-over-time` - Monthly cohort analysis
- `paid-vs-organic` - Paid vs organic comparison
- `trigger-words` - Top performing keywords
- `time-to-purchase` - Conversion timing stats
- `data-quality` - Data completeness report
- `payments` - Payment method breakdown

---

### Method 3: Automated Weekly Reports (Smartest)

Generate a comprehensive markdown report with all key metrics and AI-powered insights.

```bash
# Generate and display report
node scripts/generate-historical-report.js

# Generate and save only (don't display)
node scripts/generate-historical-report.js --save-only
```

**What it generates:**
- Executive summary (AI-written)
- Funnel performance table + insights
- Paid vs organic comparison + insights
- Top trigger words + insights
- Conversion trends over time + insights
- Time-to-purchase analysis + insights
- Payment method breakdown
- Data quality report
- Recommended actions (AI-generated)

**Report is saved to:**
`/historical_data/reports/report_YYYY-MM-DD.md`

**Set up weekly automation (optional):**

On Mac:
```bash
# Edit crontab
crontab -e

# Add this line (runs every Monday at 9 AM)
0 9 * * 1 cd /Users/connorjohnson/CLAUDE_CODE/MCB && node scripts/generate-historical-report.js --save-only
```

---

## 🔧 Common Tasks

### Re-import Data (if you clean your sources)

The import scripts are **idempotent** (safe to run multiple times).

```bash
# Re-import Google Sheets (updates existing contacts)
python scripts/import_google_sheets.py historical_data/google_sheets_export_v2.csv

# Re-import Airtable (merges with existing)
python scripts/import_airtable.py historical_data/airtable_export_cleaned.csv
```

---

### Check Import History

See what's been imported and when:

```sql
SELECT
  source_type,
  source_file,
  rows_imported,
  rows_skipped,
  import_completed_at
FROM hist_import_logs
ORDER BY import_completed_at DESC;
```

---

### Find Orphan Payments (no matching contact)

```sql
SELECT
  p.email,
  p.amount,
  p.payment_date,
  p.source
FROM hist_payments p
LEFT JOIN hist_contacts c ON p.email = c.email
WHERE c.email IS NULL
ORDER BY p.amount DESC;
```

These are customers who paid but aren't in your contact exports.

---

### Manually Add a Contact

If you need to add a one-off contact:

```sql
INSERT INTO hist_contacts (
  email,
  first_name,
  last_name,
  source,
  has_purchase,
  reached_stage
) VALUES (
  'john@example.com',
  'John',
  'Doe',
  'manual_entry',
  true,
  'purchased'
);
```

---

## 🐛 Troubleshooting

### "Missing Supabase credentials"

Make sure `.env.local` contains:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

Load it:
```bash
source .env.local
```

---

### "Module not found: supabase"

Install Python packages:
```bash
pip install supabase python-dotenv pandas
```

---

### "Table hist_contacts does not exist"

You haven't run the migrations yet. See **Setup → Step 1**.

---

### Import skipped lots of rows

Check the warnings:
```bash
python scripts/import_google_sheets.py historical_data/export.csv 2>&1 | grep "Warning"
```

Common reasons:
- No email in row (required)
- Email format invalid
- All fields empty

**Fix:** Clean your CSV before re-importing.

---

### Query tool says "query requires stored procedure"

The query is too complex for direct execution. Copy the SQL and run it in Supabase SQL Editor instead.

Or use one of the pre-built views:
```bash
node scripts/query-historical.js --saved funnel
```

---

### AI insights not generating

Make sure you have `ANTHROPIC_API_KEY` in `.env.local`:
```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Get a key at: https://console.anthropic.com/

---

## 📈 Next Steps

### After importing all data:

1. **Run the data quality report:**
   ```bash
   node scripts/query-historical.js --saved data-quality
   ```

2. **Generate your first report:**
   ```bash
   node scripts/generate-historical-report.js
   ```

3. **Explore the data:**
   ```bash
   node scripts/query-historical.js "show me the funnel summary"
   node scripts/query-historical.js "which campaigns generated the most revenue?"
   node scripts/query-historical.js "how did conversion change month over month?"
   ```

4. **Set up weekly reports** (optional - see automation section above)

---

## 📚 Available SQL Views

Quick reference for all pre-built views:

| View Name | What It Shows |
|-----------|---------------|
| `v_funnel_summary` | Overall conversion rates at each funnel stage |
| `v_revenue_attribution` | Revenue breakdown by ad type and trigger word |
| `v_conversion_over_time` | Monthly cohort analysis (contacts created vs purchased) |
| `v_time_to_purchase` | Individual records with days to convert |
| `v_time_to_purchase_summary` | Statistical summary (min, max, avg, median conversion time) |
| `v_payment_breakdown` | Revenue by payment method (Stripe vs Denefits, full vs BNPL) |
| `v_data_quality_report` | Data completeness for each field |
| `v_top_trigger_words` | Best performing ManyChat keywords |
| `v_paid_vs_organic` | Simple paid vs organic comparison |

---

## 🎓 Advanced: Custom Queries

### Find contacts who booked but never purchased:

```sql
SELECT
  email,
  first_name,
  last_name,
  first_seen,
  reached_stage
FROM hist_contacts
WHERE reached_stage IN ('booked', 'attended')
  AND has_purchase = FALSE
  AND is_suspicious = FALSE
ORDER BY first_seen DESC;
```

### Calculate revenue by month:

```sql
SELECT
  DATE_TRUNC('month', payment_date) as month,
  COUNT(*) as payment_count,
  SUM(amount) as total_revenue,
  AVG(amount) as avg_payment
FROM hist_payments
WHERE payment_type != 'refund'
  AND is_suspicious = FALSE
GROUP BY DATE_TRUNC('month', payment_date)
ORDER BY month;
```

### Find your best customers (multiple purchases):

```sql
SELECT
  email,
  COUNT(*) as payment_count,
  SUM(amount) as lifetime_value
FROM hist_payments
WHERE payment_type != 'refund'
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY lifetime_value DESC
LIMIT 20;
```

---

## 📞 Getting Help

If something's not working:

1. Check the import logs in Supabase:
   ```sql
   SELECT * FROM hist_import_logs ORDER BY import_started_at DESC LIMIT 1;
   ```

2. Check for errors in the terminal output

3. Verify your environment variables are loaded:
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   ```

4. Ask Claude Code to help debug (describe what you expected vs what happened)

---

## 🎉 You're All Set!

You now have a complete historical data analysis system that:
- ✅ Imports messy CSV data
- ✅ Deduplicates and normalizes
- ✅ Stores in clean database tables
- ✅ Provides pre-built analysis views
- ✅ Lets you ask questions in natural language
- ✅ Generates automated reports with AI insights

**Start exploring your data!**

```bash
node scripts/query-historical.js "show me everything about my funnel"
```
