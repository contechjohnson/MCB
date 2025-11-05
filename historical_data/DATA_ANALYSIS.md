# Historical Data Analysis - What We Found

**Date:** November 5, 2025
**Analyzed by:** Claude Code

---

## 📁 Files Overview

### Summary

| File | Source | Rows | Purpose | Key Fields |
|------|--------|------|---------|------------|
| **google_sheets_main_contacts.csv** | Google Sheets (Clara Analytics) | 15,186 | **PRIMARY SOURCE** - Most complete contact data | User ID, Email, Stage, Trigger Words, Purchase data, Attribution |
| **google_sheets_simplified_contacts.csv** | Google Sheets (Clara Analytics) | 6,457 | Simplified version with Thread ID & Ad ID | Thread ID, Ad_Id, Basic funnel stages |
| **airtable_contacts.csv** | Airtable | 3,554 | Recent ad attribution tracking | MC_ID, AD_ID, Trigger Word, GHL_ID, detailed dates |
| **airtable_purchases.csv** | Airtable | 114 | Purchase records | Type (Stripe/Denefits), Amount, Email, Date |
| **airtable_ads_performance.csv** | Airtable | 3,413 | Ad performance data | Ad ID, Spend, ROAS, Impressions, Clicks |

---

## 📊 Detailed File Analysis

### 1. `google_sheets_main_contacts.csv` ⭐ PRIMARY SOURCE

**What it is:** Your main contact tracking sheet from Google Sheets. This is the most complete dataset with 15,186 contacts.

**Key columns:**
- **Identity**: User ID, First Name, Last Name, Email Address, Phone Number, Instagram Name, Facebook Name
- **Attribution**:
  - `PAID VS ORGANIC` - Traffic source
  - `TRIGGER WORD` - ManyChat keyword that started conversation (RELIEF, THRIVE, ACCESS, etc.)
  - `TAG` - Campaign tags
  - `IG or FB` - Which platform they came from
  - `raw_attribution` - Raw attribution data
- **Dates**:
  - `Subscription Date` - When they opted in
  - `Last IG Interaction` / `Last FB Interaction` - Most recent activity
- **Funnel tracking**:
  - `Stage` - Current funnel position (e.g., "Clicked Link (Stage 5 of 12)")
  - `Sent Link`, `Clicked Link`, `Booked Free DC`, `Booked Paid DC`, `Attended Free DC`, `Attended Paid DC`
  - `Bought Package 1/2/3`, `Bought Store 1/2/3/4`
  - `Total Purchased` - Purchase amount
- **Qualification**:
  - `Symptoms` - Their symptoms (or "NONE")
  - `Months PP` - Months postpartum (or "NA")
  - `Objections` - Recorded objections
- **Purchase matching**:
  - `LIKELY MATCH DC` - Likely matched to a discovery call
  - `LIKELY PURCHASE AMOUNT` - Estimated purchase amount
  - `Likely Package` - Which package they likely bought
  - `Month Attended DC` - When they attended DC

**Data quality notes:**
- Has #REF! errors in some columns (Excel formula errors)
- Some boolean fields are TRUE/FALSE, others are empty/filled
- Dates are in format: "6/17/2025 21:59:19" or "2025-06-17 12:42:14"
- Trigger words are separate columns (RELIEF, THRIVE, ACCESS, etc.) with TRUE/FALSE values
- Some emails are missing

**Best for:**
- Overall funnel analysis
- Trigger word performance
- Paid vs organic comparison
- Stage progression tracking

---

### 2. `google_sheets_simplified_contacts.csv`

**What it is:** A simplified/cleaned version of the main sheet with 6,457 contacts. Focuses on key funnel stages and adds Thread ID & Ad ID.

**Key columns:**
- **Identity**: User ID, First Name, Last Name, Email Address, Phone Number
- **Attribution**:
  - `PAID VS ORGANIC` - Traffic source
  - `Trigger Word TAGs` - Trigger words (seems to be tags, not individual columns)
  - `Thread ID` - OpenAI Assistant thread ID (for AI conversations)
  - `Ad_Id` - Facebook/Meta Ad ID
  - `AB - Test Tags` - A/B test identifiers
- **Simplified funnel**:
  - `Sent Link`, `Clicked Link`, `Booked`, `Attended`
  - `Sent Package Link`, `Bought Package`
  - `Total Purchased`
- **Qualification**:
  - `Symptoms`, `Months PP`, `Objections` (same as main sheet)

**Data quality notes:**
- Cleaner than main sheet (no #REF! errors)
- Fewer rows suggests it's a filtered version or more recent snapshot
- Has Thread ID which is important for connecting to AI conversations

**Best for:**
- Connecting contacts to AI conversation threads
- Ad-level attribution (has Ad_Id)
- Simplified funnel analysis without all the complexity

---

### 3. `airtable_contacts.csv` ⭐ MOST DETAILED ATTRIBUTION

**What it is:** Airtable's ad attribution database. Only 3,554 contacts but has the MOST detailed attribution and date tracking.

**Key columns:**
- **Platform IDs**:
  - `MC_ID` - ManyChat subscriber ID
  - `GHL_ID` - GoHighLevel contact ID
  - `THREAD_ID` - OpenAI thread ID
- **Ad attribution** (⭐ Most detailed):
  - `AD_ID` - Facebook Ad ID
  - `AD_SET_ID` - Ad Set ID
  - `CAMPAIGN_ID` - Campaign ID
  - `TRIGGER_WORD` - ManyChat keyword
  - `PAID_VS_ORGANIC` - Traffic source
  - `AB_TEST` - A/B test identifier
- **Contact info**:
  - `EMAIL`, `EMAIL ALT` - Primary and alternate emails
  - `PHONE`, `FIRST_NAME`, `LAST_NAME`, `IG_USERNAME`
- **Stage tracking**:
  - `STAGE` - Current stage
  - `FUNNEL`, `SECONDARY FUNNEL` - Which funnel they're in
  - `MAIN_FUNNEL_QUAL`, `MAIN_FUNNEL_ANSWERS` - Qualification status
  - `LM_FUNNEL_QUAL`, `LM_FUNNEL_ANSWERS` - Alternative funnel qualification
  - `BOOKING_TYPE` - How they booked
- **Detailed timestamps** (⭐ GOLD MINE):
  - `SUBSCRIBED_DATE`
  - `DATE_SET_CLARACONVO` - When Clara (AI) conversation happened
  - `DATE_SET_CLARALINKSENT` - When booking link was sent
  - `DATE_SET_CLARACLICKLINK` - When they clicked link
  - `DATE_SET_EMAIL`, `DATE_SET_PHONE` - When email/phone was captured
  - `DATE_SET_SENT_EMAIL`, `DATE_SET_OPENED_EMAIL`, `DATE_SET_CLICKED_CTA_EMAIL` - Email engagement
  - `DATE_SET_BOOKED_DC`, `DATE_SET_COMPLETED_DC` - Discovery call dates
  - `DATE_SET_CHECKOUT_REGISTRATION`, `DATE_SET_PURCHASE` - Purchase dates
  - `DATE_SET_NEW_PATIENT` - Became patient
  - `DATE_SET_FEEDBACK_REQUEST_SENT`, `DATE_SET_FEEDBACK_RECEIVED` - Feedback tracking
  - `DATE_SET_TESTIMONIAL_RECIEVED`, `DATE_SET_GIFT_SENT`, `DATE_SET_REFFERAL_RECIEVED` - Post-purchase tracking
- **Purchase data**:
  - `PURCHASE` - Boolean or purchase description
  - `Purchases` - Linked purchase records
  - `Amount (from Purchases)` - Total amount from linked purchases
  - `ROAS` - Return on ad spend
- **Raw data**:
  - `FULL_CHATBOT_TRANSCRIPT` - Complete ManyChat conversation
  - `FULL_SALES_TRANSCRIPT` - Complete sales conversation
  - `MANYCHAT_LINK`, `GHL_LINK`, `IG_LINK` - Links to platform records

**Data quality notes:**
- Most structured and clean of all exports
- Lots of empty date fields (expected - not everyone reaches every stage)
- Has normalized email field: `Email (Norm)`
- Many contacts are missing AD_ID (organic traffic or not tracked)

**Best for:**
- Precise time-to-conversion calculations (dates for every stage!)
- Ad-level attribution and ROAS analysis
- Linking contacts across platforms (MC_ID, GHL_ID, THREAD_ID)
- Post-purchase tracking (feedback, testimonials, referrals)

---

### 4. `airtable_purchases.csv`

**What it is:** Standalone purchase records. Only 114 purchases recorded.

**Key columns:**
- `Purchase ID` - Unique identifier
- `Type` - "Denefits (BNPL)" or likely "Stripe" for others
- `Amount` - Purchase amount (formatted as "$1000.00")
- `Date` - Purchase date
- `Email` - Customer email
- `Name` - Customer name
- `Phone` - Customer phone
- `Description` - Purchase description
- `Related MC_ID` - Links to ManyChat contact
- `Purchases_Email_Norm` - Normalized email for matching
- `ROAS` - Return on ad spend

**Data quality notes:**
- Very small dataset (only 114 purchases)
- Likely incomplete - you have more than 114 customers
- Might be recent purchases only, or specific package types
- Has both Stripe and Denefits flagged

**Best for:**
- Purchase matching to contacts
- BNPL vs full payment analysis
- Verifying purchase amounts in contact records

---

### 5. `airtable_ads_performance.csv`

**What it is:** Ad performance data from Facebook/Meta. 3,413 ads tracked.

**Key columns:**
- **Ad identifiers**:
  - `ad_id`, `ad_name`
  - `adset_id`, `campaign_id`
- **Creative**:
  - `primary_text`, `headline`, `alternative_copy`
  - `video_id`, `thumbnail_url`, `preview_url`, `post_id`
- **Performance metrics**:
  - `spend` - Amount spent
  - `impressions`, `clicks`, `reach`
  - `ctr` - Click-through rate
  - `cpc` - Cost per click
  - `frequency` - How often same person saw ad
  - `link_clicks`, `landing_page_views`, `leads`, `pixel_leads`
  - `video_views`, `post_engagements`
  - `cost_per_lead`, `cost_per_landing_page_view`
- **Revenue**:
  - `PURCHASE Rollup (from Contacts)` - Total purchases attributed to this ad
  - `ROAS` - Return on ad spend
- **Status**:
  - `status`, `effective_status`, `is_active`
  - `created_time`, `updated_time`
- **Linked data**:
  - `Contacts` - Number of contacts from this ad

**Data quality notes:**
- Clean and structured (coming from Facebook API)
- Has UTF-8 BOM character at start (﻿ad_id) - needs to be handled in import
- Performance data is solid, but linking to contacts requires matching on ad_id

**Best for:**
- Ad creative analysis (which headlines/copy performed best)
- Cost per acquisition (CPA) calculations
- ROAS by ad, ad set, or campaign
- Identifying winning vs losing ads

---

## 🎯 Recommended Import Strategy

### Import Order:

1. **First: `google_sheets_main_contacts.csv`**
   - Why: Most complete dataset, 15k contacts, establishes baseline
   - Maps to: `hist_contacts`

2. **Second: `airtable_contacts.csv`**
   - Why: Adds detailed attribution, precise timestamps, platform IDs
   - Maps to: `hist_contacts` (merge/update) + `hist_timeline` (all those dates!)

3. **Third: `google_sheets_simplified_contacts.csv`**
   - Why: Adds Thread IDs and Ad IDs where missing
   - Maps to: `hist_contacts` (update Thread ID and Ad_Id fields)

4. **Fourth: `airtable_purchases.csv`**
   - Why: Clean purchase records with clear type (Stripe vs Denefits)
   - Maps to: `hist_payments` + update `hist_contacts.has_purchase`

5. **Fifth (Optional): `airtable_ads_performance.csv`**
   - Why: Ad performance data for deeper analysis
   - Maps to: NEW TABLE `hist_ads` (if you want ad-level analysis)

### Data Overlap Analysis:

**Contacts:**
- Google Sheets main: 15,186 contacts
- Airtable: 3,554 contacts
- Google Sheets simplified: 6,457 contacts

**Likely overlap:** Airtable contains the most recent/active contacts with best tracking. Google Sheets has historical contacts that may not be in Airtable.

**Strategy:** Import Google Sheets first (baseline), then merge Airtable data on top (by email matching) to enrich with attribution and detailed timestamps.

---

## 🔑 Key Insights

### What you have:

1. **~15k-20k total unique contacts** (after deduplication)
2. **Detailed funnel tracking** with stage progression
3. **Ad attribution data** (Ad ID, Campaign ID, trigger words)
4. **Precise timestamps** for every funnel stage (in Airtable)
5. **Purchase data** (~114 purchases explicitly recorded, likely more in contact records)
6. **Paid vs Organic** tracking across all sources
7. **Trigger word performance** data (RELIEF, THRIVE, ACCESS, etc.)
8. **OpenAI Thread IDs** for connecting to AI conversation data

### What's challenging:

1. **Multiple date formats** across files
2. **Boolean fields stored differently** (TRUE/FALSE vs empty/filled vs 1/0)
3. **Some #REF! errors** in Google Sheets main file
4. **Purchase records incomplete** (only 114 in Airtable, but contacts show more)
5. **Missing data** (emails, dates, attribution for older contacts)
6. **Duplicate columns** need merging (multiple trigger word columns)

### What you can answer:

✅ **Funnel conversion rates at each stage**
✅ **Paid vs organic performance**
✅ **Trigger word ROI** (which keywords lead to purchases)
✅ **Time-to-conversion** (from subscription to purchase)
✅ **Ad performance** (creative, copy, ROAS)
✅ **Stage drop-off points** (where people abandon funnel)
✅ **Monthly cohort analysis** (how performance changed over time)
✅ **Customer lifetime value** (purchase amounts)
✅ **Post-purchase engagement** (feedback, testimonials, referrals)

---

## 🛠️ Next Steps

1. **Update import scripts** to handle these specific column names
2. **Run imports** in recommended order
3. **Validate data quality** with `v_data_quality_report`
4. **Generate first report** with `generate-historical-report.js`
5. **Start querying** to get insights!

---

## 📝 Notes for Import Scripts

### Google Sheets Main - Column Mapping:

```
User ID → user_id (keep for reference)
Email Address → email
First Name → first_name
Last Name → last_name
Phone Number → phone
Subscription Date → first_seen (also subscribed_date in timeline)
PAID VS ORGANIC → ad_type
TRIGGER WORD → trigger_word (or parse from individual columns)
Stage → reached_stage (extract stage number/name)
Total Purchased → purchase_amount
IG or FB → platform (instagram or facebook)
```

### Airtable Contacts - Column Mapping:

```
MC_ID → mc_id
GHL_ID → ghl_id
AD_ID → ad_id
TRIGGER_WORD → trigger_word
PAID_VS_ORGANIC → ad_type
EMAIL → email
PHONE → phone
FIRST_NAME → first_name
LAST_NAME → last_name
SUBSCRIBED_DATE → first_seen
DATE_SET_PURCHASE → purchase_date
All DATE_SET_* fields → hist_timeline events!
```

### Airtable Purchases - Column Mapping:

```
Type → payment_type (map "Denefits (BNPL)" to "buy_now_pay_later")
Amount → amount (strip $ and commas)
Date → payment_date
Email → email
Purchase ID → external_id
```

---

This analysis shows you have a GOLD MINE of data! The Airtable export especially has incredible detail with all those timestamp fields. You'll be able to calculate precise conversion times at every funnel stage.
