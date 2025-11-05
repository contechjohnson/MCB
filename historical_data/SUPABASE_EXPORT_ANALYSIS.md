# Supabase Export Analysis

**Date:** November 5, 2025
**Source:** Previous Supabase integration export
**Files Analyzed:** contacts_rows.csv, stripe_webhook_logs_rows.csv

---

## Executive Summary

The previous Supabase integration contained **30,227 contact records** and **1,145 Stripe webhook events**. However, the data quality is significantly compromised:

- ❌ **68% missing emails** (only 9,666 out of 30,227 have email addresses)
- ⚠️ **Severely corrupted attribution data** (paid_vs_organic field contains timestamps, trigger words, random text)
- ✅ **19.27% purchase rate** (5,824 contacts with purchases) - useful if we can match to emails
- ✅ **Good webhook log quality** (96.4% have emails, detailed event tracking)

**Recommendation:** Extract the 9,666 contacts with emails and cross-reference with unified_contacts.csv to identify any new customers or revenue data. Discard the 20,561 records without emails as they're not matchable to our payment systems.

---

## File 1: contacts_rows.csv

### Overview
- **Total Records:** 30,227
- **Date Range:** Earliest subscription: 12/1/2023, Latest: 11/4/2025
- **Primary Purpose:** Contact tracking from ManyChat/Instagram interactions
- **Platform Split:** Instagram (majority), Facebook

### Data Quality Assessment

#### Email Coverage
```
With email:     9,666  (32.0%)
Missing email:  20,561 (68.0%)
```
**Critical Issue:** The majority of records are unusable for payment matching without emails.

#### Purchase Tracking
```
Contacts with purchases: 5,824
Purchase rate: 19.27%
```
Note: This is based on non-zero values in `total_purchased`, `first_purchase_amount`, or `package_purchase_amount` fields.

#### Attribution Data (CORRUPTED)
The `paid_vs_organic` field is severely corrupted and contains:
- **Valid Values:**
  - PAID: 8,413 contacts
  - ORGANIC: 5,004 contacts
  - Unknown: 10,867 contacts

- **Corrupted Values (examples):**
  - Timestamps: "2025-09-29 02:38:42.381+00" (245 occurrences)
  - Trigger words: "HEAL" (182), "RELIEF" (162), "SHOULDER" (144)
  - Random text and dates mixed in

**Root Cause:** Likely a data migration issue or column misalignment during CSV export.

#### ID Coverage
```
With user_id:    30,227 (100%)
With thread_id:  30,227 (100%)
With ad_id:      16,943 (56.1%)
```

### Top Funnel Stages
```
1. DM Qualified:                    8,837 contacts
2. Sent Link:                       5,982 contacts
3. Showed Interest:                 3,844 contacts
4. Clicked Link - Not Qualified:    2,461 contacts
5. Follow Up - 2:                   1,493 contacts
6. Abandoned Cart:                  1,269 contacts
7. Paid - In Full:                  1,162 contacts
8. Follow Up - 1:                     985 contacts
9. Follow Up - 4:                     763 contacts
10. Booked Appointment - GHL:         717 contacts
```

**Insight:** Clear funnel progression from DM → Link → Interest → Payment. The "Paid - In Full" stage has 1,162 contacts which should align with Stripe data.

### Platform Breakdown
```
Instagram: Majority
Facebook:  Minority
Unknown:   Some
```

---

## File 2: stripe_webhook_logs_rows.csv

### Overview
- **Total Events:** 1,145
- **Email Coverage:** 96.4% (1,104 events have emails)
- **Matched to Contacts:** 82.6% (946 events matched to contact records)
- **Time Period:** Captured Stripe webhook events during the previous integration

### Event Type Breakdown
```
checkout.session.completed:     521 events (45.5%)
checkout.session.expired:       451 events (39.4%)
checkout.session.async_payment: 173 events (15.1%)
```

**Insight:** High checkout abandonment rate (39.4% expired sessions).

### Status Breakdown
```
success:  721 events (63.0%)
complete: 424 events (37.0%)
```

### Contact Matching Performance
```
Matched to contact:  946 events (82.6%)
Not matched:         199 events (17.4%)
```

**Match Methods Used:**
```
email:       746 matches (65.2%)
not_matched: 399 events (34.8%)
```

**Issue:** 34.8% of webhook events couldn't be matched to contacts, likely due to the 68% missing email problem in contacts_rows.csv.

### Checkout Tracking
```
Abandoned checkouts:  397
Converted checkouts:  280
Abandonment rate:     58.6%
```

**Critical Finding:** Nearly 60% abandonment rate! This is even higher than the unified_payments.csv abandonment rate (48%).

---

## Comparison with Unified Contacts

### Current Unified Contacts Stats
- **Total Contacts:** 4,162
- **Customers:** 192 (4.6% conversion rate)
- **Total Revenue:** $504,538
- **Email-based:** 100% have emails (by definition)

### Supabase Export Potential
- **Usable Records:** 9,666 (with emails)
- **Purchase Records:** 5,824 (19.27% purchase rate)
- **Potential New Customers:** Need to cross-reference to determine overlap

### Overlap Analysis Needed

**Questions to Answer:**
1. How many of the 9,666 Supabase emails are NEW (not in unified_contacts.csv)?
2. How many of the 5,824 "purchased" contacts are NEW customers we missed?
3. Does the Supabase data have revenue amounts we can use?

**Revenue Fields in Supabase Export:**
- `total_purchased` - Total amount purchased
- `first_purchase_amount` - Amount of first purchase
- `package_purchase_amount` - Package purchase amount
- `stripe_payment_amount` - Specific Stripe payment amount

---

## Data Quality Issues Summary

### Critical Issues
1. **68% Missing Emails** - Cannot match to payments or analyze
2. **Corrupted Attribution Field** - paid_vs_organic contains timestamps/trigger words instead of "PAID"/"ORGANIC"
3. **High Match Failure Rate** - 34.8% of webhook events couldn't match to contacts

### Moderate Issues
1. **Stage Field Inconsistency** - Multiple formats for same stages
2. **Duplicate Tracking** - Some fields seem to overlap (e.g., total_purchased vs stripe_payment_amount)

### Good Aspects
1. **100% User/Thread ID Coverage** - Can track ManyChat conversations
2. **Good Webhook Email Coverage** - 96.4% of webhook events have emails
3. **Detailed Event Tracking** - Webhook logs capture checkout flow well
4. **Date Range Coverage** - 2 years of data (Dec 2023 - Nov 2025)

---

## Recommendations

### Immediate Actions

**1. Extract Valid Contacts (9,666 with emails)**
```python
# Filter to only contacts with emails
valid_contacts = supabase_contacts[supabase_contacts['email'].notna()]
```

**2. Compare with Unified Contacts**
```python
# Find new emails not in unified_contacts.csv
unified_emails = set(unified_df['email'].str.lower())
supabase_emails = set(valid_contacts['email'].str.lower())
new_emails = supabase_emails - unified_emails
```

**3. Extract Purchase Data**
For contacts with purchases, extract:
- Email
- Purchase amount (from total_purchased field)
- Purchase date
- Stage (to understand funnel position)

**4. Cross-Reference Webhook Logs**
Use stripe_webhook_logs_rows.csv to:
- Identify abandoned checkouts we missed
- Validate purchase amounts
- Find customers who purchased but weren't tracked in contacts_rows.csv

### Import Strategy

**Option A: Merge into Unified Contacts**
- Add the new contacts (with emails) to unified_contacts.csv
- Update purchase data for existing contacts if Supabase has more recent info
- Create a new unified_contacts_v2.csv

**Option B: Separate Historical Analysis**
- Keep Supabase data separate
- Use for funnel stage analysis (since it has detailed stage tracking)
- Cross-reference for data validation only

**Recommended:** Option A (Merge), but:
- Flag records with `source: 'supabase_export'`
- Mark records with corrupted attribution as `data_quality_notes: 'corrupted_attribution'`
- Only import contacts with valid emails

### Data Cleaning Steps

**Before Import:**
1. Filter to only rows with valid emails
2. Normalize emails (lowercase, trim)
3. Map purchase amounts to standardized fields
4. Flag records with corrupted paid_vs_organic values
5. Extract valid trigger words (if any can be salvaged)
6. Deduplicate against unified_contacts.csv

### Revenue Validation

**Cross-Check:**
- Stripe webhook logs (1,145 events) vs. Stripe unified_payments.csv (2,013 transactions)
- Why the discrepancy?
  - Different time periods?
  - Different tracking methods?
  - Missing events?

**Action:** Run a comparison to understand if we're missing revenue data.

---

## File Naming Recommendations

Rename these files for clarity:

**Current → Recommended:**
- `contacts_rows.csv` → `supabase_export_contacts_full.csv`
- `stripe_webhook_logs_rows.csv` → `supabase_export_stripe_webhooks.csv`

Add to all other historical files:
- `google_sheets_main_contacts.csv` ✓ (already renamed)
- `google_sheets_simplified_contacts.csv` ✓ (already renamed)
- `airtable_contacts.csv` ✓ (already renamed)
- `airtable_purchases.csv` ✓ (already renamed)
- `airtable_ads_performance.csv` ✓ (already renamed)
- `stripe_unified_payments.csv` (rename from unified_payments.csv)
- `denefits_contracts.csv` ✓ (already renamed)

---

## Next Steps

1. ✅ Complete this analysis document
2. 🔨 Run comparison script to find overlap with unified_contacts.csv
3. 🔨 Create merge script if significant new data found
4. 🔨 Rename all files with proper naming convention
5. 🔨 Update import strategy based on findings
6. 🔨 Update IMPORT_TO_SUPABASE_GUIDE.md with new recommendations

---

## SQL Queries for Analysis (Once Imported)

```sql
-- Find contacts with corrupted attribution
SELECT email, paid_vs_organic, trigger_word
FROM hist_contacts
WHERE source = 'supabase_export'
  AND paid_vs_organic NOT IN ('PAID', 'ORGANIC', NULL);

-- Compare purchase rates by source
SELECT
  source,
  COUNT(*) as total_contacts,
  COUNT(*) FILTER (WHERE has_purchase = TRUE) as customers,
  ROUND(100.0 * COUNT(*) FILTER (WHERE has_purchase = TRUE) / COUNT(*), 2) as conversion_rate
FROM hist_contacts
GROUP BY source;

-- Find duplicate contacts across sources
SELECT email, COUNT(*) as source_count, ARRAY_AGG(source) as sources
FROM hist_contacts
GROUP BY email
HAVING COUNT(*) > 1;
```

---

## Conclusion

The Supabase export contains valuable data but requires significant cleaning:

**Pros:**
- 9,666 contacts with emails (potential to expand unified_contacts)
- 5,824 purchase records (19.27% conversion rate)
- Detailed funnel stage tracking
- 1,145 webhook events with good email coverage

**Cons:**
- 68% of contacts unusable (no email)
- Severely corrupted attribution data
- High abandonment rate (58.6%)
- 34.8% of webhooks couldn't match to contacts

**Bottom Line:** Worth extracting the 9,666 valid contacts and comparing with unified_contacts.csv to identify new customers and validate revenue data.
