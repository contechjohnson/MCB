# AD_ID Attribution Gap Investigation Report
**Date Range:** November 7-14, 2025  
**Generated:** November 14, 2025  
**Status:** CRITICAL - 60.4% of contacts missing ad_id attribution

---

## Executive Summary

### Key Findings
1. **60.4% of contacts have NO ad_id** (515 out of 853 contacts)
2. **Major attribution source: Instagram organic/chatbot traffic** (478 Instagram contacts with no ad_id)
3. **Duplicate ad names exist** (3 ads with duplicate names causing potential confusion)
4. **Our CPL varies dramatically from Meta's CPL** (ranging from $0.55 to $43.18 vs Meta's $9-$60)
5. **Website traffic is well-isolated** (37 website contacts, all missing ad_id as expected)

### Recommendations
1. **Fix ManyChat ad_id parameter capture** - 398 contacts have MC_ID but no ad_id
2. **Investigate "B - OCT30" variant** - 200 contacts with this chatbot_ab value but no ad_id
3. **Standardize ad naming** - Remove duplicate ad names to prevent confusion
4. **Track organic vs paid separately** - Consider separate source values for paid vs organic Instagram traffic

---

## Query 1: Contacts WITHOUT AD_ID by Source

**Total contacts without ad_id:** 515 (60.4%)

| Source | Count | DM Qualified | Form Submitted | Meeting Held | Purchased | Revenue |
|--------|-------|--------------|----------------|--------------|-----------|---------|
| **instagram** | 478 | 227 | 66 | 14 | 4 | $8,790 |
| **website** | 37 | 0 | 22 | 16 | 3 | $8,244 |

**Analysis:**
- **Instagram (478 contacts, $8,790 revenue):** These are likely organic Instagram traffic or ad clicks where ManyChat failed to capture ad_id parameter
  - 227 (47%) were DM qualified → strong engagement despite missing attribution
  - 66 (14%) submitted forms → decent conversion
  - 4 purchases → $8,790 in unattributed revenue
  
- **Website (37 contacts, $8,244 revenue):** Expected to have no ad_id (direct traffic or SEO)
  - 0 DM qualified → bypassed ManyChat entirely (as expected)
  - 22 (59%) submitted forms → high intent traffic
  - 3 purchases → $8,244 in website-sourced revenue

**Critical Issue:** 478 Instagram contacts with no ad_id represents massive attribution loss. If these are paid ad clicks, we're losing visibility into which ads drive revenue.

---

## Query 2: Overall AD_ID Capture Rate

**Total contacts (Nov 7-14):** 853  
**With ad_id:** 338 (39.6%)  
**Without ad_id:** 515 (60.4%)

**Trend:** Down from historical 35% capture rate to 39.6%. Slight improvement but still critical issue.

**Breakdown by source:**
- **Instagram (WITH ad_id):** 335 contacts, 1 purchase, $2,997
- **Instagram (NO ad_id):** 478 contacts, 4 purchases, $8,790
- **Website (NO ad_id):** 37 contacts, 3 purchases, $8,244
- **Other (NO ad_id):** 3 contacts, 0 purchases, $0

**Key Insight:** Instagram traffic WITHOUT ad_id is converting better (4 purchases vs 1 purchase) and generating 3x more revenue ($8,790 vs $2,997). This suggests:
1. Organic Instagram traffic is higher quality than paid
2. OR our best-performing ads are failing to capture ad_id
3. OR these are paid clicks but ManyChat isn't capturing attribution

---

## Query 3: Source Breakdown with AD_ID

| Source | Has AD_ID | Contacts | Purchases | Revenue |
|--------|-----------|----------|-----------|---------|
| instagram | NO | 478 | 4 | $8,790 |
| instagram | YES | 335 | 1 | $2,997 |
| website | NO | 37 | 3 | $8,244 |
| Other | NO | 3 | 0 | $0 |

**Summary:** 5 purchases occurred with NO ad_id attribution (4 Instagram + 1 website) totaling $11,034. Only 1 purchase had ad_id attribution worth $2,997.

---

## Query 4: BOF Funnel Pattern Analysis

**Top 15 patterns (by contact count):**

| Pattern | Count | Analysis |
|---------|-------|----------|
| MC \| NoAD \| null \| B - OCT30 \| instagram | 200 | **CRITICAL:** Has MC_ID but no ad_id. Chatbot variant B launched Oct 30. |
| MC \| NoAD \| null \| A - OCT30 \| instagram | 198 | **CRITICAL:** Has MC_ID but no ad_id. Chatbot variant A launched Oct 30. |
| MC \| AD \| null \| A - OCT30 \| instagram | 141 | ✅ Variant A with attribution working |
| MC \| AD \| null \| B - OCT30 \| instagram | 138 | ✅ Variant B with attribution working |
| NoMC \| AD \| null \| null \| instagram | 44 | Direct-to-funnel (BOF) with ad click |
| MC \| NoAD \| null \| null \| instagram | 42 | Older contacts (pre-Oct 30 variants) |
| NoMC \| NoAD \| null \| null \| website | 37 | ✅ Website traffic (expected to have no attribution) |
| NoMC \| NoAD \| null \| null \| instagram | 10 | Organic Instagram (no chatbot, no ad click) |

**Key Findings:**
1. **398 contacts (200 + 198) have MC_ID but NO ad_id despite being in OCT30 variants**
   - These should have ad_id captured if they came from paid ads
   - Suggests either:
     - ManyChat ad parameter capture is broken for ~60% of subscribers
     - These are organic chatbot subscribers (not from ads)
     - Ad links missing tracking parameters

2. **279 contacts (141 + 138) have both MC_ID AND ad_id in OCT30 variants**
   - Attribution is working for ~40% of paid traffic
   - Proves the system CAN capture ad_id when parameters are present

3. **Trigger words are mostly null ({{cuf | 12800559}} patterns)**
   - These are ManyChat custom field placeholders, not actual trigger words
   - Suggests trigger word capture is also broken or these are non-triggered chatbot interactions

---

## Query 5: Duplicate Ad Names

**3 ads with duplicate names:**

| Ad Name | Count | Ad IDs |
|---------|-------|--------|
| MC22 w/Attr tracking - VSLQ2 Video Ad - 30 Oct 2025 - Copy | 2 | [IDs] |
| MC39 w/Attr - Carousel Still not feeling like yourself at 15 months Postpartum - 5 Nov 2025 | 2 | [IDs] |
| MC31 w/Attr - 'Still exhausted' Carousel - Pain angle - 4 Nov 2025 | 2 | [IDs] |

**Impact:**
- Can't definitively attribute contacts to specific ad creative
- Reporting shows combined results for both ads
- Recommendation: Append "(v2)" or similar suffix to duplicate ad names

---

## Query 6: CPL Calculation - Our Contacts vs Meta Reported Leads

**Top 15 ads by our contact count (Nov 7-14):**

| Ad Name | Our Contacts | Meta Leads | Spend | Our CPL | Meta CPL |
|---------|--------------|------------|-------|---------|----------|
| MC24 - Symptoms Cycle Carousel (Aug 4) | 49 | 4 | $98.79 | $2.02 | $24.70 |
| MC22 - VSLQ2 Video Ad (Oct 30) - Copy | 22 | 9 | $413.10 | $18.78 | $45.90 |
| AG: MC64 - Stacia b-roll Labs (Nov 5) | 22 | 13 | $334.85 | $15.22 | $25.76 |
| AG: MC63 - Educational Carousel PND (Nov 4) | 21 | 27 | $440.35 | $20.97 | $16.31 |
| MC39 - Carousel 15mo Postpartum (Nov 5) | 20 | 0 | $10.92 | $0.55 | N/A |
| MC49 - Carousel Follow-up labs (Nov 6) | 16 | 3 | $177.75 | $11.11 | $59.25 |
| MC52 - VSLQ30 Xmas video (Oct 15) - Copy | 16 | 1 | $17.85 | $1.12 | $17.85 |
| MC31 - Still exhausted Carousel (Nov 4) | 16 | 1 | $23.14 | $1.45 | $23.14 |
| MC22 - VSLQ2 Video Ad (Oct 30) - Dupe | 16 | 2 | $18.14 | $1.13 | $9.07 |
| AG: MC62 - Stacia Symptoms (Nov 4) | 10 | 41 | $431.78 | $43.18 | $10.53 |
| MC31 - Still exhausted (Nov 4) - Dupe 1 | 10 | 8 | $171.57 | $17.16 | $21.45 |
| MC31 - Still exhausted (Nov 5) - Dupe 2 | 9 | 4 | $150.02 | $16.67 | $37.51 |
| MC65 - VSLQ5 video (Nov 6) | 7 | 9 | $205.06 | $29.29 | $22.78 |
| MC50 - VSLQ24 video (Oct 30) | 6 | 7 | $221.39 | $36.90 | $31.63 |
| MC39 - Carousel 15mo (Nov 4) - Dupe | 4 | 7 | $168.17 | $42.04 | $24.02 |

**Analysis:**

### Best Performers (Our CPL)
1. **MC39 (Nov 5):** $0.55 CPL, 20 contacts, $10.92 spend → Incredibly efficient
2. **MC22 (Oct 30) Dupe:** $1.13 CPL, 16 contacts, $18.14 spend → Very efficient
3. **MC52 (Oct 15):** $1.12 CPL, 16 contacts, $17.85 spend → Very efficient
4. **MC31 (Nov 4):** $1.45 CPL, 16 contacts, $23.14 spend → Very efficient
5. **MC24 (Aug 4):** $2.02 CPL, 49 contacts, $98.79 spend → Highest volume at low CPL

### Worst Performers (Our CPL)
1. **AG: MC62:** $43.18 CPL, 10 contacts, $431.78 spend → Meta shows 41 leads but we only captured 10
2. **MC39 (Nov 4) Dupe:** $42.04 CPL, 4 contacts, $168.17 spend → Low volume, high cost
3. **MC50:** $36.90 CPL, 6 contacts, $221.39 spend → Low volume, high cost

### Meta vs Our CPL Discrepancies

**Our CPL HIGHER than Meta CPL (we're capturing fewer leads):**
- **AG: MC62:** Our $43.18 vs Meta $10.53 (4.1x higher!) → **CRITICAL:** Meta reports 41 leads, we only see 10 contacts
- **MC39 Dupe:** Our $42.04 vs Meta $24.02 (1.75x higher)
- **MC50:** Our $36.90 vs Meta $31.63 (1.17x higher)

**Our CPL LOWER than Meta CPL (we're capturing more leads):**
- **MC24:** Our $2.02 vs Meta $24.70 (12x lower!) → **QUESTION:** Are we counting non-leads?
- **MC49:** Our $11.11 vs Meta $59.25 (5.3x lower)
- **MC22:** Our $18.78 vs Meta $45.90 (2.4x lower)

**Possible Explanations:**
1. **Meta's "Leads" definition ≠ Our "Contacts"**
   - Meta may only count form submissions
   - We count ManyChat subscribers (earlier in funnel)
2. **Attribution window differences**
   - Meta uses 7-day click / 1-day view window
   - We use timestamped contact creation
3. **Multiple ads with same name skewing results**
   - Duplicate ad names combine stats incorrectly
4. **Meta Pixel vs ManyChat tracking mismatch**
   - Some users block pixels but still interact with chatbot

---

## Root Cause Analysis

### Why 60% of contacts have NO ad_id?

**Hypothesis 1: Organic Instagram Traffic (LIKELY)**
- 398 contacts have MC_ID but no ad_id despite being in tracked chatbot variants
- These users likely found chatbot organically (profile link, story mention, DMs)
- Solution: Add `trigger_word` or custom field to separate paid vs organic

**Hypothesis 2: ManyChat Parameter Capture Failure (POSSIBLE)**
- Ad links may be missing `ad_id={{ad.id}}` parameter
- ManyChat webhook may not be capturing custom fields correctly
- Solution: Audit ad links and ManyChat webhook payload

**Hypothesis 3: Website Traffic (CONFIRMED)**
- 37 website contacts are expected to have no ad_id (direct/SEO traffic)
- This is working as intended

**Hypothesis 4: Direct-to-Funnel (BOF) Traffic (PARTIAL)**
- 44 contacts have ad_id but no MC_ID (BOF funnel working)
- These bypassed chatbot and clicked ads directly to booking form
- Attribution is working for BOF funnel (ad_id captured)

---

## Recommendations

### Immediate Actions (Critical)

1. **Audit ManyChat Ad Links**
   - Check if ad links include `ad_id={{ad.id}}` parameter
   - Verify parameter is being captured in ManyChat custom fields
   - Test end-to-end: Ad click → ManyChat subscribe → Webhook → Database

2. **Add Organic vs Paid Tracking**
   - Use `trigger_word` field to separate paid (heal, thrive, care) vs organic (null)
   - Consider adding `traffic_type` custom field (paid_ad, organic, profile_link, etc.)

3. **Fix Duplicate Ad Names**
   - Rename duplicate ads to include unique identifiers
   - Update Meta ads to append (v2), (v3), etc.

4. **Investigate AG: MC62 Attribution Loss**
   - Meta reports 41 leads, we only captured 10 contacts (75% loss!)
   - Check if this ad is using different tracking or landing page

### Medium-Term Actions

5. **Improve CPL Accuracy**
   - Align our "contact" definition with Meta's "lead" definition
   - Consider tracking "qualified_lead" vs "contact" separately
   - Add funnel stage to CPL calculation (e.g., CPL for form_submitted vs new_lead)

6. **Automate Attribution Audits**
   - Weekly report on ad_id capture rate by ad
   - Alert if capture rate drops below 40%
   - Track "Our CPL vs Meta CPL" variance

### Long-Term Actions

7. **Separate Organic Instagram Source**
   - Change source to `instagram_organic` for contacts with MC_ID but no ad_id
   - Keep `instagram` for ad-attributed traffic only
   - Add `instagram_profile` for profile link clicks

8. **Build Attribution Health Dashboard**
   - Real-time capture rate monitoring
   - CPL variance tracking
   - Duplicate ad name detection

---

## SQL Queries Used

### Query 1: Contacts WITHOUT AD_ID
```sql
SELECT 
  source,
  COUNT(*) as contact_count,
  COUNT(CASE WHEN dm_qualified_date IS NOT NULL THEN 1 END) as dm_qualified,
  COUNT(CASE WHEN form_submit_date IS NOT NULL THEN 1 END) as form_submitted,
  COUNT(CASE WHEN appointment_held_date IS NOT NULL THEN 1 END) as meeting_held,
  COUNT(CASE WHEN purchase_date IS NOT NULL THEN 1 END) as purchased,
  SUM(COALESCE(purchase_amount, 0)) as revenue
FROM contacts
WHERE created_at >= '2025-11-07'::timestamptz
  AND source != 'instagram_historical'
  AND ad_id IS NULL
GROUP BY source
ORDER BY contact_count DESC;
```

### Query 2: BOF Funnel Pattern Analysis
```sql
SELECT 
  mc_id IS NOT NULL as has_mc_id,
  ad_id IS NOT NULL as has_ad_id,
  trigger_word,
  chatbot_ab,
  source,
  COUNT(*) as count
FROM contacts
WHERE created_at >= '2025-11-07'::timestamptz
  AND source != 'instagram_historical'
GROUP BY has_mc_id, has_ad_id, trigger_word, chatbot_ab, source
ORDER BY count DESC
LIMIT 20;
```

### Query 3: Duplicate Ad Names
```sql
SELECT 
  ma.ad_name,
  COUNT(DISTINCT ma.ad_id) as num_ad_ids,
  STRING_AGG(DISTINCT ma.ad_id, ', ') as ad_ids
FROM meta_ads ma
WHERE ma.is_active = true
GROUP BY ma.ad_name
HAVING COUNT(DISTINCT ma.ad_id) > 1
ORDER BY num_ad_ids DESC;
```

### Query 4: CPL Calculation
```sql
SELECT 
  ma.ad_id,
  ma.ad_name,
  COUNT(DISTINCT c.id) as our_contacts,
  SUM(mai.leads) as meta_reported_leads,
  SUM(mai.spend) as total_spend,
  CASE 
    WHEN COUNT(DISTINCT c.id) > 0 
    THEN ROUND(SUM(mai.spend) / COUNT(DISTINCT c.id), 2)
    ELSE 0
  END as our_cpl,
  CASE 
    WHEN SUM(mai.leads) > 0 
    THEN ROUND(SUM(mai.spend) / SUM(mai.leads), 2)
    ELSE NULL
  END as meta_cpl
FROM meta_ads ma
LEFT JOIN meta_ad_insights mai ON ma.ad_id = mai.ad_id 
  AND mai.snapshot_date >= '2025-11-07'
LEFT JOIN contacts c ON c.ad_id = ma.ad_id 
  AND c.created_at >= '2025-11-07'::timestamptz
  AND c.source != 'instagram_historical'
WHERE ma.is_active = true
GROUP BY ma.ad_id, ma.ad_name
HAVING SUM(mai.spend) > 0
ORDER BY our_contacts DESC
LIMIT 20;
```

### Query 5: Website vs Instagram Breakdown
```sql
SELECT 
  source,
  ad_id IS NOT NULL as has_ad_id,
  COUNT(*) as contacts,
  ROUND(AVG(CASE WHEN purchase_date IS NOT NULL THEN 1 ELSE 0 END) * 100, 2) as conversion_pct,
  SUM(COALESCE(purchase_amount, 0)) as revenue
FROM contacts
WHERE created_at >= '2025-11-07'::timestamptz
  AND source != 'instagram_historical'
GROUP BY source, has_ad_id
ORDER BY contacts DESC;
```

---

## Conclusion

The AD_ID attribution gap is **CRITICAL** but potentially **explainable**:

1. **60% of contacts lack ad_id** → Likely organic Instagram traffic, not attribution failure
2. **Website traffic is isolated correctly** → 37 contacts with no ad_id (expected)
3. **Paid traffic attribution is working at 40%** → 279 contacts have both MC_ID and ad_id
4. **CPL discrepancies are significant** → Need to align definitions with Meta

**Next Steps:**
1. Audit ManyChat ad links for missing parameters
2. Add tracking to separate organic vs paid Instagram traffic
3. Fix duplicate ad names
4. Investigate AG: MC62 attribution loss (75% discrepancy)

**Priority:** MEDIUM-HIGH. System is working but needs better organic vs paid separation for accurate ROAS calculations.
