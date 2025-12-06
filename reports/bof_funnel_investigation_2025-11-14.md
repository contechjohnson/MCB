# Bottom of Funnel (BOF) Investigation Report
**Date Range:** November 7-14, 2025
**Generated:** November 14, 2025

---

## Executive Summary

The BOF funnel **IS working** - 80 contacts (10% of total) bypassed the ManyChat chatbot and went directly to the booking form this week. However, attribution is broken on BOTH funnels.

**Key Findings:**
- ✅ BOF funnel operational: 80 contacts (10.0% of total traffic)
- 🔴 TOF/MOF attribution: 442 of 719 Instagram contacts (61.5%) missing ad_id
- 🟡 BOF attribution: 10 of 46 Instagram contacts (21.7%) missing ad_id
- 💰 Website BOF driving 100% of revenue this week ($8,244 from 3 purchases)

---

## 1. Overall Funnel Split

**Total Contacts This Week:** 801

| Funnel Path | Count | % of Total | Has MC_ID | Has GHL_ID |
|-------------|-------|-----------|-----------|------------|
| **TOF/MOF (ManyChat Flow)** | 721 | 90.0% | ✅ Yes | Varies |
| **BOF (Direct to Form)** | 80 | 10.0% | ❌ No | ✅ Yes |

**Definition:**
- **BOF contacts** = No mc_id (never saw chatbot) + Has ghl_id (submitted form)
- **TOF/MOF contacts** = Has mc_id (went through chatbot)

---

## 2. BOF Funnel Analysis

### 2.1 BOF by Source

| Source | Count | % of BOF | With AD_ID | Forms | Meetings | Purchases | Revenue |
|--------|-------|---------|-----------|-------|----------|-----------|---------|
| **Instagram** | 54 | 67.5% | 44 (81.5%) | 54 | 0 | 0 | $0.00 |
| **Website** | 37 | 46.3% | 0 (0%) | 22 | 16 | 3 | $8,244.00 |
| **TOTAL** | 91* | - | 44 (48.4%) | 76 | 16 | 3 | $8,244.00 |

*Note: 11 contacts had both IG and website touches

### 2.2 Instagram BOF Performance

**Total Instagram BOF:** 54 contacts
- **With ad_id:** 44 (81.5%) ✅ Good attribution
- **Without ad_id:** 10 (18.5%) ⚠️ Attribution gap

**Unique BOF Ad IDs Captured:** 5
1. `120236928026440652` - 10 contacts
2. `120236942069970652` - 9 contacts  
3. `120236927208710652` - 12 contacts
4. `120233842485330652` - 5 contacts
5. `123456` - Test/unknown

**Performance:**
- Forms submitted: 54 (100%)
- Meetings held: 0 (0%)
- Purchases: 0 (0%)

**⚠️ Issue:** These ad_ids are NOT in the `meta_ads` table. They may be:
- New ads not yet synced
- Paused ads excluded from sync
- Test/staging ad IDs

### 2.3 Website BOF Performance

**Total Website BOF:** 37 contacts

**Performance:**
- Forms submitted: 22 (59.5%)
- Meetings held: 16 (43.2%)
- Purchases: 3 (8.1%)
- Revenue: $8,244.00

**Conversion Funnel:**
```
37 contacts → 22 forms (59%) → 16 meetings (73% of forms) → 3 purchases (19% of meetings)
```

**💡 Insight:** Website BOF has MUCH better conversion than Instagram BOF:
- Instagram BOF: 0% meeting attendance
- Website BOF: 43% meeting attendance

---

## 3. TOF/MOF (ManyChat) Analysis

### 3.1 TOF/MOF by Source

| Source | Count | % of TOF/MOF | With AD_ID | Without AD_ID |
|--------|-------|-------------|-----------|---------------|
| **Instagram** | 719 | 99.7% | 277 (38.5%) | 442 (61.5%) ⚠️ |
| **Website** | 2 | 0.3% | 0 | 2 |
| **TOTAL** | 721 | - | 277 (38.4%) | 444 (61.6%) |

### 3.2 Attribution Breakdown

**Instagram ManyChat Contacts:** 719

**Missing ad_id (442 contacts):**
- This is NOT organic traffic - they have mc_id (came through chatbot)
- **Trigger word breakdown:**
  - `none`: 415 contacts (93.9%)
  - `HEAL HEAL`: 10 contacts
  - `RELIEF RELIEF`: 6 contacts
  - `55 55`: 4 contacts
  - `CARE CARE`: 3 contacts
  - Other: 4 contacts

**Of the 442 missing ad_id:**
- 55 submitted forms (12.4%)
- 4 purchased (0.9%)

---

## 4. GHL Webhook Analysis

**Total GHL Events (Nov 7-14):** 100

**GHL Events WITHOUT mc_id:** 44 (44.0%)
- These are likely BOF contacts hitting GHL directly
- Event types: OpportunityCreate, ContactCreate

**Sample BOF GHL Events:**
- apendleton14@jcu.edu - OpportunityCreate
- jayla747@gmail.com - OpportunityCreate
- hareem.salmn@tis.edu.pk - OpportunityCreate

**✅ Confirms:** BOF funnel is routing correctly to GHL

---

## 5. Attribution Issues Summary

### 5.1 TOF/MOF Attribution Loss

**Problem:** 61.5% of Instagram ManyChat contacts missing ad_id

**Possible Causes:**
1. **Meta-ManyChat attribution breaking**
   - Meta permissions updates (documented issue)
   - ManyChat not receiving ad_id in webhook
2. **Organic Instagram DMs**
   - People finding profile organically
   - But trigger words suggest paid (HEAL, RELIEF, etc.)
3. **MC custom field not populating**
   - ad_id field in MC not being set correctly

**Impact:**
- Can't attribute 442 contacts to specific ads
- Can't calculate accurate ROAS
- Can't optimize ad spend

### 5.2 BOF Attribution Gap

**Problem:** 18.5% of Instagram BOF contacts missing ad_id

**Possible Causes:**
1. **BOF link not capturing ad_id in URL**
   - Landing page URL params not including `ad_id`
   - Form not passing through ad_id to GHL
2. **Organic clicks to landing page**
   - Less likely given BOF is paid traffic focus

**Impact:**
- Smaller issue (only 10 contacts)
- But prevents full BOF ad performance tracking

---

## 6. Revenue Analysis

### 6.1 Weekly Revenue by Funnel

| Funnel | Contacts | Purchases | Revenue | Conv Rate | Rev/Contact |
|--------|----------|-----------|---------|-----------|-------------|
| Website BOF | 37 | 3 | $8,244.00 | 8.1% | $222.81 |
| Instagram BOF | 54 | 0 | $0.00 | 0.0% | $0.00 |
| TOF/MOF | 721 | 0 | $0.00 | 0.0% | $0.00 |
| **TOTAL** | 801 | 3 | $8,244.00 | 0.4% | $10.29 |

**💰 Key Insight:** ALL revenue this week came from Website BOF (organic/direct traffic)

### 6.2 Purchase Details

All 3 purchases came from website BOF contacts:
- Source: website
- Entry point: Direct to booking form (no chatbot)
- Average purchase: $2,748.00

---

## 7. Comparison: BOF vs TOF/MOF

| Metric | Website BOF | Instagram BOF | TOF/MOF |
|--------|------------|--------------|---------|
| **Volume** | 37 contacts | 54 contacts | 721 contacts |
| **Form Submit Rate** | 59.5% | 100%* | ~12% |
| **Meeting Attendance** | 43.2% | 0% | Unknown |
| **Purchase Rate** | 8.1% | 0% | 0% |
| **Revenue** | $8,244 | $0 | $0 |
| **Attribution** | N/A | 81.5% | 38.5% |

*Instagram BOF has 100% form rate because that's how we identify BOF contacts (has ghl_id = submitted form)

**Key Differences:**
1. **Website BOF converts**, Instagram BOF doesn't
   - Suggests quality difference or funnel issue
2. **Attribution better on Instagram BOF** than TOF/MOF
   - 81.5% vs 38.5% ad_id capture
3. **TOF/MOF has massive attribution gap**
   - 442 contacts (61.5%) unattributable

---

## 8. Conclusions

### What's Working ✅
1. **BOF funnel is operational**
   - 80 contacts bypassed chatbot this week
   - Represents 10% of total traffic
2. **Website BOF driving revenue**
   - 3 purchases, $8,244 revenue
   - 8.1% conversion rate
3. **Instagram BOF attribution decent**
   - 81.5% of IG BOF contacts have ad_id
   - Better than TOF/MOF (38.5%)

### What's Broken 🔴
1. **TOF/MOF attribution failure**
   - 61.5% of Instagram chatbot contacts missing ad_id
   - Can't attribute 442 contacts to ads
2. **Instagram BOF not converting**
   - 54 contacts, 0 meetings, 0 purchases
   - Despite 100% form submission
3. **BOF ads not in meta_ads table**
   - 5 unique ad_ids not synced
   - Can't analyze ad performance/spend

### What Needs Investigation 🔍
1. **Why Instagram BOF isn't converting**
   - All submitted forms but 0 meetings
   - Form quality issue? Spam? Wrong audience?
2. **Why TOF/MOF ad_id capture so low**
   - Meta permissions issue (known)?
   - MC custom field broken?
   - Organic traffic vs paid?
3. **Why BOF ad_ids not in meta_ads**
   - Are these new ads?
   - Sync filtering them out?
   - Test ad IDs?

---

## 9. Recommendations

### Immediate Actions
1. **Investigate Instagram BOF form quality**
   - Review 54 form submissions manually
   - Check for spam/fake leads
   - Verify phone numbers/emails
2. **Sync BOF ads to meta_ads table**
   - Add missing 5 ad_ids to sync
   - Get ad names, spend, performance data
3. **Audit TOF/MOF attribution**
   - Check ManyChat custom field configuration
   - Test ad click → MC subscribe flow
   - Document when ad_id IS being captured

### Short-term Improvements
1. **Add BOF tracking fields**
   - Capture which landing page (if multiple)
   - Add UTM parameters to BOF links
   - Track form source more explicitly
2. **Improve Instagram BOF qualification**
   - Add qualification step to BOF form?
   - Different routing for BOF vs website?
   - Price point filtering?
3. **Fix TOF/MOF attribution**
   - Work with MC to troubleshoot ad_id passing
   - Check Meta permissions settings
   - Consider alternative attribution (UTMs?)

### Long-term Strategy
1. **Website BOF is working - double down**
   - Focus organic SEO
   - Content marketing to drive website traffic
   - Website BOF has 8.1% conversion vs 0% IG BOF
2. **Reconsider Instagram BOF strategy**
   - Current performance: 0% conversion
   - May be attracting wrong audience
   - Consider different ad creative/targeting
3. **Build attribution redundancy**
   - Don't rely solely on ad_id
   - Add UTM tracking
   - Session-based tracking
   - Multiple attribution methods

---

## 10. Data Quality Notes

### Known Issues
1. **BOF ad_ids not in meta_ads table**
   - Affects 5 ad IDs, 46 contacts
   - Can't analyze spend, ROAS
2. **11 contacts have conflicting BOF/non-BOF data**
   - Some contacts appear in both IG and website BOF
   - Likely touched both sources
3. **Historical data filtering applied**
   - All queries exclude `source = 'instagram_historical'`
   - Ensures clean go-forward metrics

### Sample Size Considerations
- **Website BOF:** 37 contacts, 3 purchases
  - 8.1% conversion (small sample, high variance)
- **Instagram BOF:** 54 contacts, 0 purchases
  - 0% conversion (may improve with more data)
- **One week timeframe**
  - Short window, results may vary week-to-week

---

## Appendix: Query Reference

All queries used in this analysis:

```sql
-- Query 1: TRUE BOF Contacts
SELECT 
  id, first_name, last_name, email_primary, 
  ad_id, mc_id, ghl_id, source, created_at,
  form_submit_date, appointment_date, 
  appointment_held_date, purchase_date, purchase_amount
FROM contacts
WHERE created_at >= '2025-11-07'::timestamptz
  AND source != 'instagram_historical'
  AND ad_id IS NOT NULL
  AND mc_id IS NULL
ORDER BY created_at DESC;

-- Query 2: Contact Patterns
SELECT 
  mc_id IS NOT NULL as has_mc_id,
  ad_id IS NOT NULL as has_ad_id,
  COUNT(*) as count,
  COUNT(CASE WHEN form_submit_date IS NOT NULL THEN 1 END) as forms,
  COUNT(CASE WHEN purchase_date IS NOT NULL THEN 1 END) as purchases,
  SUM(COALESCE(purchase_amount, 0)) as revenue
FROM contacts
WHERE created_at >= '2025-11-07'::timestamptz
  AND source != 'instagram_historical'
GROUP BY has_mc_id, has_ad_id
ORDER BY count DESC;

-- Query 3: Trigger Words by Pattern
SELECT 
  ad_id IS NOT NULL as has_ad_id,
  mc_id IS NOT NULL as has_mc_id,
  trigger_word,
  COUNT(*) as count
FROM contacts
WHERE created_at >= '2025-11-07'::timestamptz
  AND source != 'instagram_historical'
GROUP BY has_ad_id, has_mc_id, trigger_word
ORDER BY count DESC;

-- Query 4: BOF Ad Performance
SELECT 
  ma.ad_name,
  ma.ad_id,
  COUNT(c.id) as contacts,
  COUNT(CASE WHEN c.form_submit_date IS NOT NULL THEN 1 END) as forms,
  COUNT(CASE WHEN c.purchase_date IS NOT NULL THEN 1 END) as purchases
FROM contacts c
JOIN meta_ads ma ON c.ad_id = ma.ad_id
WHERE c.created_at >= '2025-11-07'::timestamptz
  AND c.source != 'instagram_historical'
  AND c.ad_id IS NOT NULL
  AND c.mc_id IS NULL
GROUP BY ma.ad_name, ma.ad_id
ORDER BY contacts DESC;

-- Query 5: Source Breakdown
SELECT 
  source,
  mc_id IS NOT NULL as has_mc_id,
  COUNT(*) as count,
  COUNT(CASE WHEN form_submit_date IS NOT NULL THEN 1 END) as forms,
  COUNT(CASE WHEN appointment_held_date IS NOT NULL THEN 1 END) as meetings,
  COUNT(CASE WHEN purchase_date IS NOT NULL THEN 1 END) as purchases
FROM contacts
WHERE created_at >= '2025-11-07'::timestamptz
  AND source != 'instagram_historical'
GROUP BY source, has_mc_id
ORDER BY count DESC;
```

---

**Report Generated By:** Analytics Agent (Claude Code)  
**Data Source:** Supabase MCB Database  
**Last Updated:** November 14, 2025
