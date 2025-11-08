# Historical Data Migration Plan

**Date:** November 6, 2025
**Status:** ✅ Data prepared, ready for review

---

## 🎯 Goal

Import the cleanest, most recent historical data (last 2 months) into Supabase to:
1. **Enable Stripe webhook matching** - When someone pays, find them in the database
2. **Preserve attribution** - Know where customers came from (trigger words, ads, source)
3. **Track funnel progression** - Understand the customer journey

---

## 📊 What's Ready to Import

### Contacts Table: 3,014 contacts
- **530 from Airtable** (cleanest source)
- **2,492 from Supabase export** (deduplicated)
- **99.7% have email** (critical for Stripe matching)
- **Date range:** September 6 - November 6, 2025

### Stage Distribution
```
purchased          : 25      ← Confirmed customers
checkout_started   : 23      ← Hot leads (started checkout)
meeting_held       : 129     ← Attended discovery call
meeting_booked     : 62      ← Scheduled
form_submitted     : 857     ← Gave email/phone (PIPELINE)
link_clicked       : 46      ← Engaged
link_sent          : 576     ← In conversation
dm_qualified       : 237     ← Answered Q1/Q2
new_lead           : 1,059   ← Just subscribed
```

---

## 🗺️ Stage Mapping (Old → New)

Based on `MIGRATION_QUICK_START.md` and your corrections:

```
BOUGHT_PACKAGE                 → purchased
PACKAGE_REGISTRATION_COMPLETE  → checkout_started
ATTENDED                       → meeting_held
BOOKED, READY_TO_BOOK         → meeting_booked
LEAD_CONTACT (with phone+email) → form_submitted
CLICKED_LINK, COMPLETED_DC    → form_submitted
SENT_LINK                     → link_sent
DM_QUALIFIED, SHOWED_INTEREST → dm_qualified
CLARA_* stages                → dm_qualified
LEAD_CONTACT, LEAD            → new_lead
[Unknown/empty]               → SKIPPED (not imported)
```

---

## 💰 Revenue Strategy

**Important:** Revenue amounts are NOT in the contacts migration file.

### Why?
- Purchase amounts will come from the **purchases table** (separate import)
- Contacts table only tracks `purchase_date` to mark stage
- Stripe/Denefits webhooks will populate the `payments` table going forward

### Purchases Table (Separate Import)
- Source: `historical_data/airtable_purchases.csv`
- 114 purchase records
- Links to contacts via email
- Will be imported separately AFTER contacts

---

## 📁 Files Created

```
historical_data/
├── migration_ready_contacts_last_2mo.csv  ← Ready to import (3,014 contacts)
└── airtable_purchases.csv                  ← Will import separately

scripts/
└── prepare-migration-data.js               ← The script that generated the CSV
```

---

## ✅ Data Quality

### Email Coverage (Critical for Stripe Matching)
- **3,006 contacts with email (99.7%)** ✅
- **272 contacts with phone (9.0%)**
- **264 contacts with both (8.8%)**

### Purchase Tracking
- **1,421 contacts have purchase_date** (not all in "purchased" stage - may be from old tracking)
- **25 contacts in "purchased" stage** (confirmed via stage mapping)

### Attribution Data Preserved
- ✅ `trigger_word` - Which keyword triggered the bot
- ✅ `source` - Instagram, website, Facebook
- ✅ `ad_id` - Meta ad campaign ID (where available)
- ✅ `mc_id` - ManyChat subscriber ID (where available)
- ✅ `ghl_id` - GoHighLevel contact ID (where available)
- ✅ `chatbot_ab` - A/B test variant
- ✅ `paid_vs_organic` - Attribution type (stored in misc_ab)

---

## 🔧 Field Mapping Details

### Identification Fields
```
email              → email_primary
phone              → phone (normalized to +1XXXXXXXXXX)
MC_ID              → mc_id
GHL_ID             → ghl_id
THREAD_ID          → thread_id
```

### Contact Info
```
FIRST_NAME         → first_name
LAST_NAME          → last_name
IG_USERNAME        → ig
PHONE              → phone
```

### Attribution
```
TRIGGER_WORD       → trigger_word
PAID_VS_ORGANIC    → misc_ab
AB_TEST            → chatbot_ab
AD_ID              → ad_id
source             → 'instagram' (default)
```

### Conversation Data
```
SEGMENT_SYMPTOMS   → q1_question
SEGMENT_MONTHS     → q2_question
SEGMENT_OBJECTIONS → objections
SALES_SUMMARY      → lead_summary
```

### Timeline Dates
```
SUBSCRIBED_DATE              → subscribe_date, subscribed
DATE_SET_CLARACONVO          → dm_qualified_date
DATE_SET_CLARALINKSENT       → link_send_date
DATE_SET_CLARACLICKLINK      → link_click_date
DATE_SET_EMAIL               → form_submit_date
DATE_SET_BOOKED_DC           → appointment_date
DATE_SET_COMPLETED_DC        → appointment_held_date
DATE_SET_CHECKOUT_REGISTRATION → checkout_started
DATE_SET_PURCHASE            → purchase_date
PRESALE_LAST_INTERACTION_DATE → ig_last_interaction
```

### Metadata
```
id                 → UUID (auto-generated)
created_at         → subscribe_date OR now()
updated_at         → latest date OR now()
stage              → Mapped via stage rules
```

---

## ⚠️ Known Issues (Non-Blocking)

### 1. Corrupted Trigger Words
- Some records show: `{{cuf_12800559}} HEAL HEAL`
- These are ManyChat custom field placeholders
- **Action:** Left as-is, can clean up post-import

### 2. Missing Phone Numbers
- Only 9% have phone numbers
- **Impact:** Low - email is the primary matching key

### 3. Inconsistent Dates
- Some contacts missing `subscribe_date`
- **Action:** Using `created_at` as fallback

---

## 🚀 Next Steps

### Step 1: User Review (YOU ARE HERE)
- ✅ Review the mapping logic above
- ✅ Check sample records make sense
- ✅ Confirm stage mappings are correct

### Step 2: Import Contacts
Once approved:
1. Create Supabase import script
2. Handle duplicates (check by email, mc_id, ghl_id, phone)
3. Insert or update contacts
4. Validate import (check counts, stages)

### Step 3: Import Purchases
After contacts are in:
1. Parse `airtable_purchases.csv`
2. Match purchases to contacts by email
3. Insert into `payments` table
4. Update contact `purchase_amount` if needed

### Step 4: Validate
Run queries to verify:
- Stripe webhooks can match contacts by email
- Stage distribution looks correct
- No orphan purchases (all linked to contacts)

---

## 💡 Why This Solves the Stripe Problem

**Before:**
- Stripe webhook fires with email `customer@example.com`
- Looks up contact in Supabase
- **Finds nothing** (database empty)
- Can't link payment to attribution

**After:**
- Stripe webhook fires with email `customer@example.com`
- Looks up contact in Supabase
- **Finds contact** (from this import)
- Links payment to:
  - Instagram ad campaign
  - Trigger word that started conversation
  - Full funnel journey (DM → form → meeting → purchase)

---

## 📝 Sample Records Preview

### Contact 1: Pipeline Lead (Form Submitted)
```
Email:  example@gmail.com
Phone:  +15551234567
Stage:  form_submitted
Source: instagram
Trigger: HEAL
Subscribed: 2025-10-15
```
**Why important:** If they purchase tomorrow, Stripe finds them ✅

### Contact 2: Recent Customer (Purchased)
```
Email:  customer@example.com
Stage:  purchased
Purchase Date: 2025-10-20
Source: instagram
Trigger: PAIN
```
**Why important:** Already purchased, has full attribution ✅

---

## 🎯 Success Criteria

After import is complete:

1. ✅ 3,000+ contacts in Supabase
2. ✅ 99%+ have email addresses
3. ✅ All stages mapped correctly
4. ✅ Attribution data preserved
5. ✅ Stripe webhooks can match by email
6. ✅ No duplicate contacts

---

## 📞 Questions Before Import?

- Are the stage mappings correct?
- Should we filter out corrupted trigger words?
- Any specific contacts we should prioritize/exclude?
- Ready to proceed with import script?

---

**Ready to review the actual CSV?**
```bash
head -20 historical_data/migration_ready_contacts_last_2mo.csv
```
