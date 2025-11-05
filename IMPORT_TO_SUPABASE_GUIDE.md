# Import Unified Contacts to Supabase - Quick Guide

**Status:** Ready to import!
**Date:** November 5, 2025

---

## ✅ What's Ready

1. **Unified contacts file created**: `historical_data/unified_contacts.csv`
   - 4,162 unique contacts
   - 192 customers
   - $504,538 total revenue tracked

2. **Database migrations created**:
   - `migrations/20250511_create_historical_tables.sql` - Creates tables
   - `migrations/20250511_create_historical_views.sql` - Creates analysis views

3. **Import script ready**: `scripts/import_unified_to_supabase.py`

---

## 🚀 Steps to Import (5 minutes)

### Step 1: Apply Database Migrations

Since Supabase JS doesn't support raw SQL execution, you need to run migrations manually:

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Click **"SQL Editor"** in the left sidebar
3. Click **"New query"**
4. Open `migrations/20250511_create_historical_tables.sql`
5. Copy entire file contents
6. Paste into SQL Editor
7. Click **"Run"** (bottom right)
8. Wait for success message

9. Click **"New query"** again
10. Open `migrations/20250511_create_historical_views.sql`
11. Copy entire file contents
12. Paste into SQL Editor
13. Click **"Run"**
14. Wait for success message

**✅ Migrations complete!** You now have:
- Tables: `hist_contacts`, `hist_payments`, `hist_timeline`, `hist_import_logs`
- Views: `v_funnel_summary`, `v_paid_vs_organic`, `v_top_trigger_words`, and 6 more

---

### Step 2: Run the Import Script

Back in your terminal:

```bash
python scripts/import_unified_to_supabase.py
```

This will:
- ✅ Insert all 4,162 contacts into `hist_contacts`
- ✅ Create payment records for Stripe and Denefits customers
- ✅ Create timeline events (subscription, purchases)
- ✅ Log the import in `hist_import_logs`

**Expected runtime:** 1-2 minutes

---

### Step 3: Verify Import

In Supabase SQL Editor, run:

```sql
-- Check contacts imported
SELECT COUNT(*) FROM hist_contacts;

-- Check customers
SELECT COUNT(*) FROM hist_contacts WHERE has_purchase = TRUE;

-- Check funnel summary
SELECT * FROM v_funnel_summary;

-- Check paid vs organic
SELECT * FROM v_paid_vs_organic;
```

---

## 📊 What You'll Be Able to Query

Once imported, you can run:

### Pre-built Views:

```sql
-- Overall conversion rates
SELECT * FROM v_funnel_summary;

-- Revenue by paid vs organic
SELECT * FROM v_paid_vs_organic;

-- Top trigger words
SELECT * FROM v_top_trigger_words;

-- Monthly trends
SELECT * FROM v_conversion_over_time;

-- Time to purchase stats
SELECT * FROM v_time_to_purchase_summary;

-- Payment method breakdown
SELECT * FROM v_payment_breakdown;

-- Data quality report
SELECT * FROM v_data_quality_report;
```

### Custom Queries:

```sql
-- Find your top 10 customers by revenue
SELECT
  email,
  first_name,
  last_name,
  trigger_word,
  ad_type,
  purchase_date
FROM hist_contacts
WHERE has_purchase = TRUE
ORDER BY purchase_amount DESC
LIMIT 10;

-- Conversion rate by trigger word
SELECT
  trigger_word,
  COUNT(*) as total_contacts,
  COUNT(*) FILTER (WHERE has_purchase = TRUE) as customers,
  ROUND(100.0 * COUNT(*) FILTER (WHERE has_purchase = TRUE) / COUNT(*), 2) as conversion_rate
FROM hist_contacts
WHERE trigger_word IS NOT NULL
GROUP BY trigger_word
ORDER BY conversion_rate DESC;

-- Revenue by month
SELECT
  DATE_TRUNC('month', purchase_date) as month,
  COUNT(*) as purchases,
  SUM(purchase_amount) as revenue
FROM hist_contacts
WHERE has_purchase = TRUE
GROUP BY month
ORDER BY month;
```

---

## 🎯 What Gets Imported

### `hist_contacts` table:
- Email (primary key)
- Name, phone, Instagram/Facebook
- Attribution (paid/organic, trigger word)
- Funnel stage
- Purchase data (has_purchase, purchase_date, purchase_amount)
- Source (google_sheets/airtable/merged)

### `hist_payments` table:
- Email (links to contacts)
- Amount, date
- Source (stripe/denefits)
- Payment type (buy_in_full/buy_now_pay_later)

### `hist_timeline` table:
- Email (links to contacts)
- Event type (contact_created, purchased)
- Event date
- Source

---

## 🔧 Troubleshooting

### "Table already exists" error
Tables already created! Skip Step 1, go straight to Step 2.

### "Missing Supabase credentials" error
Make sure your `.env.local` has:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### "Module not found: supabase" error
Install Python packages:
```bash
pip install supabase python-dotenv pandas
```

### Import seems stuck
The script processes in batches of 500. With 4,162 contacts, it will show progress for each batch. Wait for all batches to complete.

---

## 🎉 After Import

You'll have access to:
- ✅ All contact data in one place
- ✅ Revenue attribution by source/trigger word
- ✅ Funnel conversion metrics
- ✅ Time-to-purchase analysis
- ✅ Paid vs organic performance
- ✅ Monthly trends

Use the natural language query tool:
```bash
node scripts/query-historical.js "show me paid vs organic revenue"
```

Or generate automated reports:
```bash
node scripts/generate-historical-report.js
```

---

## 📝 Notes

- **Data is deduplicated by email** - One record per unique email
- **Source tracking** - Contacts marked as google_sheets, airtable, or merged
- **Purchase matching** - Customers linked to Stripe or Denefits (or both!)
- **Safe to re-run** - Import uses UPSERT, so you can run multiple times

---

Ready to import? Run Step 1 in Supabase dashboard, then Step 2 in terminal!
