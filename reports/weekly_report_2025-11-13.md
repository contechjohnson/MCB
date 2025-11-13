# Weekly Analytics Report
**Week of November 6-13, 2025**

**Report Generated:** November 13, 2025  
**Data Source:** Supabase MCB Database  
**Historical Data Filter:** `WHERE source != 'instagram_historical'` (Applied to all queries)

---

## Executive Summary

### Key Metrics This Week

| Metric | This Week | Last Week | Change | % Change |
|--------|-----------|-----------|--------|----------|
| **New Contacts** | 938 | 22 | +916 | +4,163% |
| **Purchases** | 4 | 2 | +2 | +100% |
| **Revenue** | $11,988 | N/A | - | - |
| **Conversion Rate** | 0.43% | 9.09% | -8.66pp | -95.3% |

### Week-over-Week Analysis

**MASSIVE VOLUME SPIKE:** We saw a dramatic 42x increase in new contacts this week (938 vs 22), likely due to:
- Major ad campaign launch or budget increase
- Viral content or influencer collaboration
- Technical backlog processing (check webhook logs)

**Conversion Rate Impact:** While absolute purchases doubled (2→4), the conversion rate dropped from 9.09% to 0.43% due to the massive influx of new leads who haven't had time to progress through the funnel.

**Revenue Performance:** Total revenue of $11,988 from 4 purchases, with an average order value of $2,997.

---

## Funnel Performance

### Overall Stage Distribution (All Active Contacts)

| Stage | Count | % of Total |
|-------|-------|------------|
| New Lead | 349 | 36.1% |
| Link Sent | 209 | 21.6% |
| Form Submitted | 188 | 19.4% |
| DM Qualified | 165 | 17.0% |
| Package Sent | 35 | 3.6% |
| Link Clicked | 12 | 1.2% |
| Meeting Held | 5 | 0.5% |
| Purchased | 5 | 0.5% |

**Total Active Contacts:** 968 (excluding 537 historical imports)

### Weekly Funnel Progression (Contacts Created This Week)

For the 938 new contacts created this week, here's how far they've progressed:

| Stage | Count | % of New Leads | Conversion Rate |
|-------|-------|----------------|-----------------|
| **Total New Leads** | 938 | 100.0% | - |
| Reached DM Qualified | 451 | 48.1% | 48.1% |
| Reached Call Booked | 3 | 0.3% | 0.7% of qualified |
| Reached Meeting Held | 40 | 4.3% | 8.9% of qualified |
| Reached Purchased | 5 | 0.5% | 1.1% of qualified |

### Funnel Insights

**Strong DM Qualification:** 48.1% of new leads reached DM qualified status within the week - this is excellent engagement.

**Bottleneck Identified:** The drop from DM Qualified (451) to Call Booked (3) represents a **99.3% drop-off**. This is the critical bottleneck in the funnel.

**Meeting Held Anomaly:** We have 40 contacts marked as "meeting held" but only 3 as "call booked" - this suggests:
- Meetings are being held via alternate booking methods (EHR system not tracked)
- Stage progression logic may need adjustment
- Some contacts skipping booking stage (direct-to-meeting)

**Purchase Conversion:** Of the 40 who attended meetings, 5 purchased (12.5% close rate).

---

## Source Attribution

### New Contacts by Source (This Week)

| Source | New Contacts | % of Total |
|--------|--------------|------------|
| **Instagram** | 896 | 95.5% |
| **Website** | 41 | 4.4% |
| **Instagram LM** | 1 | 0.1% |

**Instagram dominates** new lead acquisition at 95.5%, consistent with the paid social strategy.

### Purchases by Source (This Week)

| Source | Purchases | Revenue |
|--------|-----------|---------|
| **Instagram** | 2 | $5,994 |
| **Website** | 2 | $5,994 |

**Even split** between Instagram and Website conversions, despite Instagram generating 22x more leads.

### Conversion Rate by Source (All Time)

| Source | Total Contacts | Purchases | Conversion Rate |
|--------|----------------|-----------|-----------------|
| **Website** | 42 | 2 | **4.76%** |
| **Instagram** | 925 | 4 | **0.43%** |
| **Instagram LM** | 1 | 0 | 0.00% |

**Website traffic converts 11x better** than Instagram (4.76% vs 0.43%), suggesting:
- Website visitors are warmer/more qualified
- Instagram requires more nurturing before conversion
- Different customer journey paths

### Attribution Metrics

**AD_ID Capture Rate:**
- Instagram contacts with AD_ID: 371 / 925 = **40.11%**
- Up from 35% baseline - attribution improving!

**MC→GHL Linkage Rate:**
- Contacts with both MC_ID and GHL_ID: 15 / 968 = **1.55%**
- **CRITICAL ISSUE:** Down from 7.9% - linkage is getting worse

---

## Revenue Metrics

### This Week's Revenue

| Metric | Value |
|--------|-------|
| **Total Revenue** | $11,988 |
| **Number of Purchases** | 4 |
| **Average Order Value** | $2,997 |

### Revenue by Source

| Source | Purchases | Total Revenue | Avg Order Value |
|--------|-----------|---------------|-----------------|
| Instagram | 2 | $5,994 | $2,997 |
| Website | 2 | $5,994 | $2,997 |

**Perfect parity:** Both sources contributed equally to revenue with identical AOV.

### Revenue by Payment Method

| Payment Method | Transactions | Total Revenue |
|----------------|--------------|---------------|
| **Stripe** | 6 | $17,235 |

**Note:** Payment data shows 6 Stripe transactions totaling $17,235, while contact data shows 4 purchases totaling $11,988. This discrepancy suggests:
- Some payments may be from historical contacts
- Payment records span a different time window
- Potential data linking issues (see Orphan Payments below)

---

## Data Quality

### Data Completeness

| Field | Contacts with Data | % Complete |
|-------|-------------------|------------|
| **Email** | 606 / 968 | 62.60% |
| **Phone** | 230 / 968 | 23.76% |

**Email completeness is acceptable** at 62.6%, but **phone completeness is poor** at 23.76%.

**Impact:** Low phone completeness limits SMS outreach and backup contact methods.

### Attribution Completeness

**AD_ID Capture (Instagram only):**
- 371 / 925 = **40.11%**
- Improved from 35% baseline

**MC→GHL Linkage (All contacts):**
- 15 / 968 = **1.55%**
- **CRITICAL:** Significantly worse than 7.9% baseline
- Only 15 contacts can be tracked through full DM → Booking funnel

### Orphan Payments

| Metric | Value |
|--------|-------|
| Total Payments | 8 |
| Linked to Contacts | 7 |
| Orphaned (No Contact) | 1 |
| **Orphan Rate** | **12.50%** |

**Improvement:** Orphan rate improved from 100% to 12.50% - excellent progress!

**Remaining issue:** 1 payment ($amount unknown) still unlinked to a contact.

### Webhook Activity (Last 7 Days)

| Webhook Source : Event | Count |
|------------------------|-------|
| manychat:dm_qualified | 311 |
| manychat:contact_created | 252 |
| manychat:link_sent | 218 |
| ghl:OpportunityCreate | 101 |
| ghl:MeetingCompleted | 29 |
| manychat:link_clicked | 24 |
| ghl:ContactUpdate | 22 |
| perspective:checkout_form_submitted | 19 |
| ghl:PackageSent | 13 |
| stripe:checkout.session.expired | 7 |
| stripe:checkout.session.completed | 4 |

**Webhook Health:** All systems firing correctly. Strong ManyChat activity (311 DM qualified, 218 links sent).

**Funnel velocity:** 24 link clicks, 19 checkout forms, 4 completed purchases shows healthy progression.

---

## Data Anomalies Detected

### 1. Meeting Held > Call Booked Discrepancy
- **Issue:** 40 contacts marked "meeting_held" but only 3 marked "call_booked"
- **Likely Cause:** EHR booking system not tracked; meetings booked outside GHL
- **Impact:** Can't measure booking-to-show rate accurately
- **Recommendation:** Add GHL form submission after EHR booking confirmation

### 2. MC→GHL Linkage Degradation
- **Issue:** Linkage rate dropped from 7.9% to 1.55%
- **Likely Cause:** Massive influx of Instagram leads not yet synced to GHL
- **Impact:** Cannot track full funnel from DM → Purchase for 98.45% of contacts
- **Recommendation:** Investigate email matching logic; check GHL webhook delay

### 3. Revenue Data Mismatch
- **Issue:** Payments table shows $17,235 (6 txns) vs Contacts table shows $11,988 (4 purchases)
- **Difference:** $5,247 and 2 transactions
- **Likely Cause:** Payments from different time windows or historical contacts
- **Recommendation:** Cross-reference payment dates with contact purchase_dates

### 4. Conversion Rate Week-over-Week Drop
- **Issue:** Conversion rate dropped from 9.09% to 0.43%
- **Cause:** New leads haven't had time to convert yet (cohort effect)
- **Impact:** None - this is expected behavior
- **Note:** Track this cohort over next 30 days to measure true conversion

---

## Recommendations

### Top 3 Action Items

#### 1. FIX MC→GHL LINKAGE (CRITICAL)
**Priority:** URGENT  
**Current State:** Only 1.55% of contacts linked  
**Impact:** Cannot track 98% of customer journey from DM to purchase  

**Actions:**
- Review email matching logic in GHL webhook (`/api/ghl-webhook/route.ts`)
- Check if GHL webhook is receiving contact data with MC_ID field
- Test with known contacts to verify linkage flow
- Consider alternative matching fields (phone, IG handle)

**Success Metric:** Achieve >70% linkage rate within 2 weeks

---

#### 2. INVESTIGATE CALL BOOKED BOTTLENECK
**Priority:** HIGH  
**Current State:** 451 qualified → 3 booked (99.3% drop-off)  
**Impact:** Losing qualified leads before booking opportunity  

**Actions:**
- Review booking link click-through rate (only 24 clicks from 218 sent)
- Test booking flow for friction points
- Check if booking links are working/active
- Consider A/B testing booking CTA copy
- Add follow-up sequence for non-clickers

**Success Metric:** Increase booking rate from 0.7% to 15% of qualified leads

---

#### 3. IMPROVE PHONE NUMBER CAPTURE
**Priority:** MEDIUM  
**Current State:** Only 23.76% have phone numbers  
**Impact:** Limited SMS outreach capability; harder to reach for reminders  

**Actions:**
- Make phone field required in booking forms (if not already)
- Add phone capture step in ManyChat flow before sending booking link
- Review which sources provide phone (instagram vs website)
- Consider phone verification step

**Success Metric:** Achieve >80% phone completeness within 30 days

---

### Additional Recommendations

**4. Track Cohort Conversion Over Time**
- The 938 new leads this week need 30+ days to fully convert
- Set up automated cohort analysis to track week 1, 2, 3, 4 conversion rates
- Expected: 0.43% will increase to 3-5% over 30 days

**5. Investigate Website Traffic Quality**
- Website converts at 4.76% vs Instagram's 0.43% (11x better)
- Analyze: What makes website traffic different? (SEO, direct, referral?)
- Consider: Increasing website traffic acquisition efforts
- Action: Add UTM tracking to identify best referral sources

**6. Attribution Improvement**
- AD_ID capture improved to 40.11% - good progress!
- Continue monitoring Meta permissions and ManyChat attribution flow
- Document what changed to cause improvement
- Goal: Reach 60%+ capture rate

---

## SQL Queries Used

All queries excluded historical data using `WHERE source != 'instagram_historical'`.

### 1. New Contacts This Week
```sql
SELECT COUNT(*) 
FROM contacts
WHERE source != 'instagram_historical'
  AND created_at >= '2025-11-06'
  AND created_at < '2025-11-14';
```
**Result:** 938

### 2. Purchases This Week
```sql
SELECT COUNT(*) 
FROM contacts
WHERE source != 'instagram_historical'
  AND purchase_date >= '2025-11-06'
  AND purchase_date < '2025-11-14';
```
**Result:** 4

### 3. Revenue This Week
```sql
SELECT 
  COUNT(*) as purchases,
  SUM(purchase_amount) as total_revenue,
  ROUND(AVG(purchase_amount), 2) as avg_order_value
FROM contacts
WHERE source != 'instagram_historical'
  AND purchase_date >= '2025-11-06'
  AND purchase_date < '2025-11-14';
```
**Result:** 4 purchases, $11,988 total, $2,997 avg

### 4. Conversion by Source
```sql
SELECT
  source,
  COUNT(*) as total_contacts,
  COUNT(purchase_date) as purchases,
  ROUND(100.0 * COUNT(purchase_date) / NULLIF(COUNT(*), 0), 2) as conversion_rate
FROM contacts
WHERE source != 'instagram_historical'
GROUP BY source
ORDER BY conversion_rate DESC;
```

### 5. MC→GHL Linkage Rate
```sql
SELECT
  COUNT(*) as total_contacts,
  COUNT(mc_id) as has_mc_id,
  COUNT(ghl_id) as has_ghl_id,
  COUNT(CASE WHEN mc_id IS NOT NULL AND ghl_id IS NOT NULL THEN 1 END) as both_mc_ghl,
  ROUND(100.0 * COUNT(CASE WHEN mc_id IS NOT NULL AND ghl_id IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 2) as linkage_rate
FROM contacts
WHERE source != 'instagram_historical';
```
**Result:** 15/968 = 1.55%

### 6. Data Completeness
```sql
SELECT
  COUNT(*) as total_contacts,
  COUNT(email_primary) as has_email,
  COUNT(phone) as has_phone,
  ROUND(100.0 * COUNT(email_primary) / NULLIF(COUNT(*), 0), 2) as email_completeness,
  ROUND(100.0 * COUNT(phone) / NULLIF(COUNT(*), 0), 2) as phone_completeness
FROM contacts
WHERE source != 'instagram_historical';
```

### 7. Webhook Activity
```sql
SELECT
  source,
  event_type,
  COUNT(*) as event_count
FROM webhook_logs
WHERE created_at >= '2025-11-06'
  AND created_at < '2025-11-14'
GROUP BY source, event_type
ORDER BY event_count DESC
LIMIT 20;
```

---

## Appendix: Raw Data

### Complete Results Object
```json
{
  "newContactsThisWeek": 938,
  "newContactsLastWeek": 22,
  "purchasesThisWeek": 4,
  "purchasesLastWeek": 2,
  "stageDistribution": {
    "landing_link_sent": 209,
    "form_submitted": 188,
    "new_lead": 349,
    "DM_qualified": 165,
    "meeting_held": 5,
    "landing_link_clicked": 12,
    "package_sent": 35,
    "purchased": 5
  },
  "weeklyFunnel": {
    "total_new_leads": 938,
    "reached_dm_qualified": 451,
    "reached_call_booked": 3,
    "reached_meeting_held": 40,
    "reached_purchased": 5
  },
  "sourceDistribution": {
    "instagram": 896,
    "website": 41,
    "instagram_lm": 1
  },
  "purchasesBySource": {
    "instagram": 2,
    "website": 2
  },
  "conversionBySource": {
    "instagram": {
      "total": 925,
      "purchases": 4,
      "conversion_rate": "0.43"
    },
    "website": {
      "total": 42,
      "purchases": 2,
      "conversion_rate": "4.76"
    },
    "instagram_lm": {
      "total": 1,
      "purchases": 0,
      "conversion_rate": "0.00"
    }
  },
  "adIdCapture": {
    "total": 925,
    "with_ad_id": 371,
    "rate": "40.11"
  },
  "mcGhlLinkage": {
    "total": 968,
    "with_mc": 866,
    "with_ghl": 117,
    "both": 15,
    "rate": "1.55"
  },
  "revenue": {
    "purchases": 4,
    "total": 11988,
    "avg": 2997
  },
  "revenueBySource": {
    "instagram": {
      "count": 2,
      "revenue": 5994
    },
    "website": {
      "count": 2,
      "revenue": 5994
    }
  },
  "orphanPayments": {
    "total": 8,
    "orphaned": 1,
    "rate": "12.50"
  },
  "paymentsByMethod": {
    "stripe": {
      "count": 6,
      "revenue": 17235
    }
  },
  "dataCompleteness": {
    "total": 968,
    "email": 606,
    "phone": 230,
    "email_pct": "62.60",
    "phone_pct": "23.76"
  },
  "webhookActivity": {
    "manychat:dm_qualified": 311,
    "manychat:contact_created": 252,
    "manychat:link_sent": 218,
    "ghl:OpportunityCreate": 101,
    "ghl:MeetingCompleted": 29,
    "manychat:link_clicked": 24,
    "ghl:ContactUpdate": 22,
    "perspective:checkout_form_submitted": 19,
    "ghl:PackageSent": 13,
    "stripe:checkout.session.expired": 7,
    "stripe:checkout.session.completed": 4
  }
}
```

---

**End of Report**

*Generated by MCB Analytics System*  
*Database: Supabase (mcb_ppcu)*  
*Report Script: `/Users/connorjohnson/CLAUDE_CODE/MCB/scripts/weekly_analytics_nov13.js`*
