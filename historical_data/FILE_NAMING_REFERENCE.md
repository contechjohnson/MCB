# Historical Data File Naming Reference

**Last Updated:** November 5, 2025

---

## File Naming Convention

All historical data files follow this pattern:
```
{source}_{content_type}_{descriptor}.csv
```

**Sources:**
- `google_sheets_` - Data exported from Clara Analytics Google Sheets
- `airtable_` - Data exported from Airtable
- `stripe_` - Data exported from Stripe dashboard
- `denefits_` - Data exported from Denefits system
- `supabase_export_` - Data exported from previous Supabase integration
- `unified_` - Merged/processed data from multiple sources

---

## Current Files

### Google Sheets Exports (Clara Analytics)

**`google_sheets_main_contacts.csv`**
- **Rows:** 15,186
- **Purpose:** Main contact tracking sheet with detailed attribution and purchase data
- **Key Fields:** email, first_name, last_name, phone, paid_vs_organic, trigger_word, total_purchased, subscription_date
- **Date Range:** Multiple years of historical data
- **Quality:** 🟢 Best source for contact attribution and funnel stages

**`google_sheets_simplified_contacts.csv`**
- **Rows:** 6,457
- **Purpose:** Simplified contact list with Thread IDs for ManyChat linking
- **Key Fields:** email, thread_id, user_id, subscription_date
- **Date Range:** Subset of main contacts
- **Quality:** 🟡 Good for ManyChat integration but less detailed

---

### Airtable Exports

**`airtable_contacts.csv`**
- **Rows:** 3,554
- **Purpose:** Detailed contact records with 30+ timestamp fields tracking every funnel stage
- **Key Fields:** email, first_name, last_name, trigger_word, ad_type, 30+ timestamp columns
- **Date Range:** Unknown, overlaps with Google Sheets data
- **Quality:** 🟢 Excellent for funnel stage timing analysis

**`airtable_purchases.csv`**
- **Rows:** 114
- **Purpose:** Purchase tracking with product/package details
- **Key Fields:** email, purchase_date, amount, product_name
- **Date Range:** Historical purchases
- **Quality:** 🟡 Small dataset, useful for validation

**`airtable_ads_performance.csv`**
- **Rows:** 3,413
- **Purpose:** Ad campaign performance metrics
- **Key Fields:** ad_id, campaign_name, impressions, clicks, cost, conversions
- **Date Range:** Historical ad performance
- **Quality:** 🟢 Good for ROI analysis

---

### Stripe Exports

**`stripe_unified_payments.csv`**
- **Rows:** 2,013
- **Purpose:** Complete Stripe transaction history export
- **Key Fields:** email, amount, status (paid/abandoned), created_date, customer_description (has package metadata)
- **Date Range:** December 2023 - November 2025
- **Revenue:** $5.2M total, $290k paid (600 successful payments)
- **Quality:** 🟢 96.4% email coverage, excellent for revenue tracking
- **Notable:** 48% abandonment rate (972 abandoned checkouts)

---

### Denefits Exports

**`denefits_contracts.csv`**
- **Rows:** 103
- **Purpose:** Buy Now Pay Later financing contracts
- **Key Fields:** email, contract_amount, signup_date, status, payment_schedule
- **Date Range:** August 2025 - November 2025
- **Revenue:** $271k financed
- **Quality:** 🟢 100% email coverage, 96% active contracts

---

### Supabase Exports (Previous Integration)

**`supabase_export_contacts_full.csv`**
- **Rows:** 30,227
- **Purpose:** Contact records from previous Supabase/ManyChat integration
- **Key Fields:** email, first_name, last_name, phone, paid_vs_organic, trigger_word, stage, total_purchased
- **Date Range:** December 2023 - November 2025
- **Quality:** 🔴 **68% missing emails** (only 9,666 usable), corrupted attribution field
- **Notable:** 19.27% purchase rate (5,824 contacts with purchases)
- **Status:** Needs significant cleaning before import

**`supabase_export_stripe_webhooks.csv`**
- **Rows:** 1,145
- **Purpose:** Stripe webhook event logs from previous integration
- **Key Fields:** event_type, customer_email, status, matched_contact_id, match_method
- **Date Range:** During previous Supabase integration period
- **Quality:** 🟢 96.4% email coverage, good event tracking
- **Notable:** 82.6% matched to contacts, 58.6% abandonment rate

---

### Unified/Processed Files

**`unified_contacts.csv`**
- **Rows:** 4,162
- **Purpose:** Master unified contact list matched to all payment sources
- **Sources:** Google Sheets + Airtable + Stripe + Denefits
- **Key Fields:** email, first_name, last_name, phone, trigger_word, paid_vs_organic, source, has_purchase, purchase_date, stripe_revenue, denefits_revenue, total_revenue
- **Customers:** 192 (4.6% conversion rate)
- **Revenue:** $504,538 tracked
- **Quality:** 🟢 100% email-based, deduplicated, comprehensive
- **Created:** November 5, 2025 via `create_unified_contacts.py`

---

## Import Status

### Ready to Import
- ✅ `unified_contacts.csv` - Ready for Supabase import via `import_unified_to_supabase.py`

### Needs Cleaning Before Import
- ⚠️ `supabase_export_contacts_full.csv` - Filter to 9,666 with emails, fix corrupted fields
- ⚠️ `supabase_export_stripe_webhooks.csv` - Can import as-is, but need to handle unmatched records

### Reference Only (Not for Direct Import)
- 📚 `google_sheets_main_contacts.csv` - Already merged into unified_contacts.csv
- 📚 `google_sheets_simplified_contacts.csv` - Already merged into unified_contacts.csv
- 📚 `airtable_contacts.csv` - Already merged into unified_contacts.csv
- 📚 `airtable_purchases.csv` - Already merged into unified_contacts.csv
- 📚 `stripe_unified_payments.csv` - Already merged into unified_contacts.csv
- 📚 `denefits_contracts.csv` - Already merged into unified_contacts.csv

---

## File Relationships

```
Google Sheets (15,186 contacts)
    ↓
    ├─→ unified_contacts.csv (4,162 unique)
    │
Airtable (3,554 contacts)
    ↓
    ├─→ unified_contacts.csv
    │       ↓
    │       └─→ Supabase hist_contacts table
    │
Stripe (2,013 transactions)
    ↓
    ├─→ unified_contacts.csv (115 matched)
    │
Denefits (103 contracts)
    ↓
    └─→ unified_contacts.csv (80 matched)

Supabase Export (30,227 contacts)
    ↓
    └─→ Need comparison with unified_contacts.csv
        └─→ Extract 9,666 with emails
            └─→ Find new contacts not in unified
```

---

## Data Quality Summary

| File | Rows | Email Coverage | Quality | Import Ready |
|------|------|----------------|---------|--------------|
| google_sheets_main_contacts.csv | 15,186 | Unknown | 🟢 Good | ✅ Merged |
| google_sheets_simplified_contacts.csv | 6,457 | Unknown | 🟡 Fair | ✅ Merged |
| airtable_contacts.csv | 3,554 | Unknown | 🟢 Good | ✅ Merged |
| airtable_purchases.csv | 114 | Unknown | 🟡 Fair | ✅ Merged |
| airtable_ads_performance.csv | 3,413 | N/A | 🟢 Good | 📚 Reference |
| stripe_unified_payments.csv | 2,013 | 96.4% | 🟢 Excellent | ✅ Merged |
| denefits_contracts.csv | 103 | 100% | 🟢 Excellent | ✅ Merged |
| supabase_export_contacts_full.csv | 30,227 | 32.0% | 🔴 Poor | ⚠️ Needs cleaning |
| supabase_export_stripe_webhooks.csv | 1,145 | 96.4% | 🟢 Good | ⚠️ Review needed |
| **unified_contacts.csv** | **4,162** | **100%** | **🟢 Excellent** | **✅ READY** |

---

## Next Steps

1. **Compare Supabase Export with Unified Contacts**
   - Find overlap between 9,666 Supabase emails and 4,162 unified emails
   - Identify new contacts to add to unified dataset
   - Validate revenue data consistency

2. **Import Unified Contacts to Supabase**
   - Run migrations in Supabase dashboard
   - Execute `import_unified_to_supabase.py`
   - Verify import with SQL queries

3. **Handle Supabase Export Data**
   - Extract 9,666 contacts with emails
   - Cross-reference with unified_contacts.csv
   - Merge new contacts if significant overlap found
   - Create unified_contacts_v2.csv if needed

---

## Script References

### Analysis Scripts
- `scripts/analyze-supabase-data.js` - Analyzes Supabase export files
- `scripts/analyze-stripe.js` - Analyzes Stripe payments
- `scripts/analyze-denefits.js` - Analyzes Denefits contracts

### Processing Scripts
- `scripts/create_unified_contacts.py` - Creates unified_contacts.csv from all sources
- `scripts/import_unified_to_supabase.py` - Imports unified contacts to Supabase

### Utility Scripts
- `scripts/apply_migrations.js` - Guide for applying Supabase migrations (manual steps)

---

## Documentation

- `DATA_ANALYSIS.md` - Detailed column-by-column analysis of all CSV files
- `DENEFITS_ANALYSIS.md` - Comprehensive Denefits contracts analysis
- `STRIPE_ANALYSIS.md` - Comprehensive Stripe payments analysis
- `SUPABASE_EXPORT_ANALYSIS.md` - Comprehensive Supabase export analysis
- `HISTORICAL_DATA_GUIDE.md` - User guide for the historical data system
- `IMPORT_TO_SUPABASE_GUIDE.md` - Step-by-step import guide

---

## Notes

- All files are stored in `/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/`
- Email is the primary key for contact deduplication across all sources
- Dates are parsed flexibly to handle multiple formats
- Phone numbers are normalized to digits-only for matching
- All revenue amounts are in USD
- Purchase data is linked by email matching (case-insensitive)
