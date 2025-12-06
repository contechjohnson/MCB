# Ad Performance Report: November 6-13, 2025

**Generated:** November 13, 2025  
**Date Range:** November 6, 2025 - November 13, 2025 (7 days)  
**Data Source:** Supabase MCB Database  
**Filter:** Excludes `instagram_historical` contacts

---

## Executive Summary

**Total Activity This Week:**
- **946 New Contacts** entered the funnel
- **$25,802 in Revenue** from 9 purchases
- **61.3% Attribution Gap** - 580 contacts (61.3%) have NO AD_ID
- **Only 1 ad drove revenue** (AG: MC64 - Labs video)

**Key Findings:**
1. **Attribution Crisis:** 61.3% of contacts have no AD_ID, representing $22,506 in revenue (87.2%)
2. **Single Winner:** Only ONE ad (MC64 - Labs/Confusion to Clarity theme) drove attributed revenue ($2,997)
3. **NO Spend Data:** All Meta ads show $0 spend - Meta sync may need update
4. **Overwhelm to Relief Theme Underperforming:** 104 contacts, 0 purchases (0% conversion)

---

## Overall Funnel Performance (Last 7 Days)

### Stage Progression

| Stage | Count | Conversion from Previous | % of New Contacts |
|-------|-------|-------------------------|-------------------|
| **New Contacts** | 946 | - | 100% |
| **DM Qualified** | 457 | 48.3% | 48.3% |
| **Link Sent** | 325 | 71.1% | 34.4% |
| **Form Filled** | 201 | 61.8% | 21.2% |
| **Meeting Held** | 43 | 21.4% | 4.5% |
| **Purchases** | 9 | 20.9% | 1.0% |

**Total Revenue:** $25,802.00

### Bottlenecks Identified

1. **DM → Qualification (48.3%)** - Over half of new leads don't qualify
2. **Link Sent → Form Fill (61.8%)** - 38.2% drop-off after clicking link
3. **Form Fill → Meeting Held (21.4%)** - CRITICAL BOTTLENECK - 78.6% no-show/cancel rate

---

## Performance by AD_ID

### Top 10 Ads by Contact Volume

| Rank | AD_ID | Ad Name | Contacts | DM Qual % | Form Fill | Meeting | Purchases | Revenue | Theme |
|------|-------|---------|----------|-----------|-----------|---------|-----------|---------|-------|
| 1 | NO_AD_ID | Unknown | 580 | 44.1% | 96 | 33 | 9 | $22,506 | - |
| 2 | 120236362673690652 | MC24 - Symptoms Cycle Carousel | 47 | 48.9% | 12 | 0 | 0 | $0 | General |
| 3 | 120236516327450652 | AG: MC64 - Labs (Stacia b-roll) | 25 | 68.0% | 7 | 1 | 1 | $2,997 | Confusion→Clarity |
| 4 | 120236476393440652 | AG: MC63 - PND Carousel | 24 | 79.2% | 6 | 1 | 0 | $0 | General |
| 5 | 120236513806850652 | MC22 - VSLQ2 Video | 23 | 52.2% | 3 | 1 | 0 | $0 | General |
| 6 | 120236476054200652 | AG: MC62 - Symptoms PP (b-roll) | 19 | 78.9% | 1 | 0 | 0 | $0 | Overwhelm→Relief |
| 7 | 120236521786440652 | MC39 - 15mo Postpartum Carousel | 19 | 73.7% | 5 | 0 | 0 | $0 | Overwhelm→Relief |
| 8 | 120236524224110652 | MC52 - VSLQ30 Xmas Video | 17 | 41.2% | 2 | 0 | 0 | $0 | Pain→Comfort |
| 9 | 120236458772810652 | MC22 - VSLQ2 Video (duplicate) | 17 | 58.8% | 3 | 1 | 0 | $0 | General |
| 10 | 120236613351890652 | MC49 - Follow-up Labs Carousel | 16 | 50.0% | 2 | 0 | 0 | $0 | Overwhelm→Relief |

**Note:** All ads show $0 spend. Meta Ads sync may need to run to pull latest spend data.

---

## Ad Creative Analysis

### Performance by Transformation Theme

| Theme | Contacts | Purchases | Conv. Rate | Revenue | Avg. Revenue per Contact |
|-------|----------|-----------|------------|---------|--------------------------|
| **Confusion → Clarity** | 41 | 1 | 2.4% | $2,997 | $73.10 |
| **General** | 144 | 0 | 0.0% | $0 | $0.00 |
| **Overwhelm → Relief** | 104 | 0 | 0.0% | $0 | $0.00 |
| **Pain → Comfort** | 26 | 0 | 0.0% | $0 | $0.00 |
| **Unknown** | 51 | 0 | 0.0% | $0 | $0.00 |
| **NO_AD_ID** | 580 | 9 | 1.6% | $22,506 | $38.80 |

### Key Insights

**🏆 Winner: Confusion → Clarity**
- Only theme that drove attributed revenue this week
- Best conversion rate (2.4%)
- Single ad: MC64 (Stacia b-roll - Labs video)
- 68% DM qualification rate (highest)

**❌ Underperformers:**
- **General theme:** 144 contacts, 0 purchases
- **Overwhelm → Relief:** 104 contacts, 0 purchases (largest volume, no revenue)
- **Pain → Comfort:** 26 contacts, 0 purchases

### Media Type Performance

*Note: Data from `meta_ad_creatives` table*

**Video Ads:**
- Examples: MC64 (Labs), MC22 (VSLQ2), MC52 (Xmas)
- Best performer: MC64 (1 purchase)

**Image Ads (Carousels):**
- Examples: MC24 (Symptoms Cycle), MC39 (15mo Postpartum), MC63 (PND)
- No purchases this week

---

## Contacts Without AD_ID (Attribution Gap)

### Overview

| Metric | Value |
|--------|-------|
| **Total Contacts (No AD_ID)** | 580 (61.3% of all new contacts) |
| **Purchases** | 9 |
| **Conversion Rate** | 1.6% (27.3% of those who reached meeting stage) |
| **Revenue** | $22,506 (87.2% of total weekly revenue) |

### Sources of Non-Attributed Contacts

| Source | Count | % of No-AD_ID |
|--------|-------|---------------|
| Instagram | 541 | 93.3% |
| Website | 39 | 6.7% |

**Critical Issue:** 541 Instagram contacts have NO AD_ID. Possible causes:
1. Organic traffic (no trigger word = no paid attribution)
2. Meta permission issues (breaking attribution flow)
3. Owner sending discount links with no tracking
4. Direct profile visits (not from ads)

### Performance Comparison: With AD_ID vs. Without

| Metric | With AD_ID (366) | Without AD_ID (580) |
|--------|------------------|---------------------|
| DM Qualification Rate | 54.9% (201/366) | 44.1% (256/580) |
| Form Fill Count | 105 | 96 |
| Meeting Held Count | 10 | 33 |
| Purchases | 1 | 9 |
| Revenue | $2,997 | $22,506 |

**Surprising Finding:** Contacts WITHOUT AD_ID are converting to purchases at a HIGHER rate (9 purchases from 580 contacts = 1.6%) vs. attributed contacts (1 purchase from 366 contacts = 0.3%).

**Hypothesis:** Non-attributed traffic may be:
- Warmer audience (returning visitors, referrals)
- Organic followers (higher intent)
- Website traffic (further down funnel)

---

## Top Performing Ads

### 🥇 Best Ad by Total Contacts

**MC24 - Symptoms Cycle Carousel (120236362673690652)**
- **Theme:** General
- **Media:** Image (Carousel)
- **Trigger Word:** Heal
- **Performance:**
  - 47 new contacts
  - 48.9% DM qualification rate
  - 12 form fills (25.5% of contacts)
  - 0 meetings held
  - 0 purchases
- **Issue:** High drop-off at meeting booking stage

### 🥇 Best Ad by Conversion Rate

**AG: MC64 - Stacia b-roll - Labs (120236516327450652)**
- **Theme:** Confusion → Clarity
- **Media:** Video
- **Performance:**
  - 25 new contacts
  - 68.0% DM qualification rate (HIGHEST)
  - 7 form fills (28% of contacts)
  - 1 meeting held (14.3% of forms)
  - 1 purchase (100% of meetings!)
  - **Revenue:** $2,997
- **Why it won:** Educational angle (labs/testing) resonates with "confusion to clarity" positioning

### 🥇 Best Ad by Revenue

**AG: MC64 - Stacia b-roll - Labs (120236516327450652)**
- Same as above ($2,997)

### 🥇 Best Ad by ROAS

**Unable to Calculate**
- All ads show $0 spend in `meta_ads` table
- Need to run Meta Ads sync: `node scripts/sync-meta-ads.js`

---

## Detailed Contact List by Top Ads

### MC64 - Labs Video (120236516327450652) - $2,997 Revenue

| Name | Email | Stage | Purchase | Days in Funnel |
|------|-------|-------|----------|----------------|
| Lauren Giolitto | birtha56@aim.com | purchased | $2,997 | 6 |
| *24 others* | *various* | new_lead to form_submitted | No | 0-6 |

**Winner Contact Journey:**
- Created: Nov 7, 2025
- DM Qualified: Yes
- Link Sent: Yes
- Form Filled: Yes
- Meeting Held: Yes
- Purchased: Yes ($2,997)
- **Total time: 6 days**

### MC24 - Symptoms Cycle Carousel (120236362673690652) - 47 Contacts, $0 Revenue

*High volume, no conversions to purchase*

| Stage | Count |
|-------|-------|
| New Lead | Various |
| DM Qualified | 23 (48.9%) |
| Form Filled | 12 |
| Meeting Held | 0 ❌ |
| Purchases | 0 ❌ |

**Issue:** Despite 12 form fills, ZERO meetings held. Possible causes:
- No-show rate issue
- Booking link broken?
- Form fills not converting to actual bookings

### MC63 - PND Carousel (120236476393440652) - 24 Contacts, $0 Revenue

| Stage | Count |
|-------|-------|
| New Lead | 24 |
| DM Qualified | 19 (79.2% - HIGH!) |
| Form Filled | 6 |
| Meeting Held | 1 |
| Purchases | 0 |

**Note:** Excellent DM qualification rate (79.2%), but poor form→meeting conversion.

---

## SQL Queries Used

### Overall Funnel Query

```sql
SELECT
  COUNT(*) FILTER (WHERE created_at >= '2025-11-06' AND created_at < '2025-11-14') as new_contacts,
  COUNT(*) FILTER (WHERE dm_qualified_date >= '2025-11-06' AND dm_qualified_date < '2025-11-14') as dm_qualified,
  COUNT(*) FILTER (WHERE link_send_date >= '2025-11-06' AND link_send_date < '2025-11-14') as link_sent,
  COUNT(*) FILTER (WHERE form_submit_date >= '2025-11-06' AND form_submit_date < '2025-11-14') as form_filled,
  COUNT(*) FILTER (WHERE appointment_held_date >= '2025-11-06' AND appointment_held_date < '2025-11-14') as meeting_held,
  COUNT(*) FILTER (WHERE purchase_date >= '2025-11-06' AND purchase_date < '2025-11-14') as purchases,
  SUM(purchase_amount) FILTER (WHERE purchase_date >= '2025-11-06' AND purchase_date < '2025-11-14') as total_revenue
FROM contacts
WHERE source != 'instagram_historical';
```

### Ad Performance Query

```sql
SELECT
  c.ad_id,
  ma.ad_name,
  mac.transformation_theme,
  mac.media_type,
  COUNT(*) as total_contacts,
  COUNT(*) FILTER (WHERE c.dm_qualified_date IS NOT NULL) as dm_qualified,
  COUNT(*) FILTER (WHERE c.form_submit_date IS NOT NULL) as form_filled,
  COUNT(*) FILTER (WHERE c.appointment_held_date IS NOT NULL) as meeting_held,
  COUNT(*) FILTER (WHERE c.purchase_date IS NOT NULL) as purchases,
  SUM(c.purchase_amount) as revenue,
  ma.spend
FROM contacts c
LEFT JOIN meta_ads ma ON c.ad_id = ma.ad_id
LEFT JOIN meta_ad_creatives mac ON c.ad_id = mac.ad_id
WHERE c.created_at >= '2025-11-06'
  AND c.created_at < '2025-11-14'
  AND c.source != 'instagram_historical'
GROUP BY c.ad_id, ma.ad_name, mac.transformation_theme, mac.media_type, ma.spend
ORDER BY total_contacts DESC;
```

### Attribution Gap Query

```sql
SELECT
  source,
  COUNT(*) as contacts,
  COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) as purchases,
  SUM(purchase_amount) as revenue
FROM contacts
WHERE created_at >= '2025-11-06'
  AND created_at < '2025-11-14'
  AND source != 'instagram_historical'
  AND ad_id IS NULL
GROUP BY source;
```

---

## Recommendations

### 1. Fix Attribution Gap (CRITICAL)

**Problem:** 61.3% of contacts (580) have no AD_ID, representing 87.2% of revenue ($22,506).

**Actions:**
1. Run Meta Ads sync to check if attribution is tracking: `node scripts/sync-meta-ads.js`
2. Check ManyChat webhook for `ad_id` parameter capture
3. Verify Meta permissions haven't changed (common issue)
4. Add UTM parameters to all discount links owner sends
5. Consider implementing Meta CAPI (Conversions API) for better attribution

### 2. Scale MC64 (Labs Video) - Confusion to Clarity Theme

**Why:** Only ad that drove revenue this week ($2,997 from 25 contacts).

**Actions:**
1. Increase budget on MC64
2. Create similar ads with:
   - Educational angle (labs, testing, diagnostics)
   - Confusion → Clarity positioning
   - Stacia b-roll video format
3. Test variations: different symptoms, different lab types

### 3. Investigate Meeting Held Bottleneck

**Problem:** Only 21.4% of form fills result in meetings held (43 of 201).

**Potential Causes:**
- High no-show rate
- Booking calendar issues
- Email/SMS reminders not working
- Time zone confusion

**Actions:**
1. Check GHL webhook logs for "meeting held" events
2. Review booking confirmation emails
3. Add SMS reminders before appointments
4. Check if EHR system is creating proper calendar holds

### 4. Pause Underperforming Themes

**Candidates for Pause/Restructure:**
- **Overwhelm → Relief:** 104 contacts, 0 purchases
- **General theme:** 144 contacts, 0 purchases
- **Pain → Comfort:** 26 contacts, 0 purchases

**Actions:**
1. Pause lowest performers (Pain → Comfort first)
2. Reallocate budget to Confusion → Clarity variants
3. Test new creative angles for Overwhelm → Relief (high volume, no conversions)

### 5. Update Meta Ads Spend Data

**Problem:** All ads showing $0 spend - can't calculate ROAS.

**Actions:**
1. Run sync: `node scripts/sync-meta-ads.js`
2. Verify Meta API credentials
3. Check rate limits
4. Schedule daily auto-sync (cron job)

### 6. Deep Dive on Non-Attributed Conversions

**Why:** 9 purchases from NO_AD_ID contacts suggests strong organic/referral channel.

**Actions:**
1. Survey recent customers: "How did you hear about us?"
2. Check for common patterns in email domains (referral networks?)
3. Review Instagram profile visits (organic traffic)
4. Consider adding "referral source" field to booking form

---

## Raw Data Export

See `/reports/ad_performance_raw_data_2025-11-13.json` for full contact-level data.

**Contact Script:** `/Users/connorjohnson/CLAUDE_CODE/MCB/scripts/ad_funnel_report.js`

---

**Generated by:** Claude Code Analytics Agent  
**Report Date:** November 13, 2025  
**Next Review:** November 20, 2025
