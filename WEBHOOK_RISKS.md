# Webhook System Risk Assessment

**Last Updated**: January 6, 2025
**System**: MCB Attribution Tracking

---

## 🎯 Risk Priority Framework

Risks are categorized by:
- **Impact**: How much damage if it occurs (Revenue Loss, Attribution Loss, Data Quality)
- **Likelihood**: How often it's likely to happen
- **Detectability**: How easily we can catch it

**Priority Levels**:
- 🔴 **CRITICAL** - High impact + High likelihood = Address immediately
- 🟠 **HIGH** - High impact OR high likelihood = Address soon
- 🟡 **MEDIUM** - Moderate impact + moderate likelihood = Monitor & plan
- 🟢 **LOW** - Low impact + low likelihood = Accept & document

---

## 🔴 CRITICAL RISKS

### **Risk #1: GHL Custom Fields Not Configured**
**Category**: Data Loss
**Impact**: ⚠️⚠️⚠️ Catastrophic - Breaks entire attribution chain
**Likelihood**: 🟡 Medium - Configuration-dependent
**Detectability**: ✅ Easy - Query shows missing MC_ID/AD_ID

**What Happens**:
- Funnel form submits with MC_ID and AD_ID in hidden fields
- GHL receives form but has no custom fields to store MC_ID/AD_ID
- GHL webhook fires WITHOUT mc_id/ad_id in customData
- System can't find existing ManyChat contact
- Creates DUPLICATE contact with only GHL_ID
- ManyChat engagement data orphaned
- AD_ID attribution lost forever

**Business Impact**:
- Can't calculate ROAS by ad
- Can't track full funnel from ad → DM → purchase
- Duplicate contacts clutter database
- Revenue attributed to wrong contact or lost

**Detection Query**:
```sql
-- Check if recent GHL contacts from ManyChat flow have MC_ID
SELECT
  ghl_id,
  mc_id,
  ad_id,
  email_primary,
  source,
  created_at
FROM contacts
WHERE ghl_id IS NOT NULL
  AND created_at >= NOW() - INTERVAL '7 days'
  AND source = 'instagram'  -- Should have MC_ID if from ManyChat
ORDER BY created_at DESC;

-- RED FLAG: If mc_id is NULL for instagram source contacts
```

**Mitigation**:
1. **Immediate**: Verify GHL custom fields exist
   - Field name: `MC_ID` (exact match, case-sensitive)
   - Field name: `AD_ID` (exact match, case-sensitive)
   - Field type: Text
   - Source: Form submission (hidden fields)

2. **Weekly**: Run detection query, investigate any NULL values

3. **Automated Alert**: Set up weekly Slack/email alert if MC_ID capture rate drops below 85%

**Prevention**:
```javascript
// GHL Workflow Configuration Checklist:
// 1. Custom Field "MC_ID" exists in GHL
// 2. Custom Field "AD_ID" exists in GHL
// 3. Funnel form has hidden fields:
//    <input type="hidden" name="MC_ID" value="{{url_param_mc_id}}">
//    <input type="hidden" name="AD_ID" value="{{url_param_ad_id}}">
// 4. GHL workflow maps form fields to custom fields
// 5. GHL webhook includes customData.MC_ID and customData.AD_ID
```

---

### **Risk #2: Email Mismatch at Payment**
**Category**: Revenue Attribution Loss
**Impact**: ⚠️⚠️⚠️ High - Revenue tracked but attribution lost
**Likelihood**: 🟠 High - User behavior dependent
**Detectability**: ✅ Easy - Orphan payments table

**What Happens**:
- User books with email `work@company.com` in GHL
- User pays with email `personal@gmail.com` in Stripe
- Stripe webhook fires with `personal@gmail.com`
- System can't find contact (email doesn't match)
- Payment logged as ORPHAN (contact_id = NULL)
- Revenue tracked but not attributed to any contact
- Can't calculate LTV, ROAS, or funnel metrics

**Business Impact**:
- Lost attribution for 10-20% of revenue (typical orphan rate)
- Can't accurately calculate customer acquisition cost
- Can't identify which ads/campaigns drove purchases
- Difficult to optimize ad spend

**Root Causes**:
1. User has multiple email addresses (work vs personal)
2. Typo in either GHL or Stripe email entry
3. User changes email between booking and payment
4. Shared email (husband books, wife pays)

**Detection Query**:
```sql
-- Orphan payment rate (weekly)
SELECT
  COUNT(*) FILTER (WHERE contact_id IS NULL) as orphan_payments,
  COUNT(*) as total_payments,
  SUM(amount) FILTER (WHERE contact_id IS NULL) as orphan_revenue,
  SUM(amount) as total_revenue,
  ROUND(100.0 * COUNT(*) FILTER (WHERE contact_id IS NULL) / COUNT(*), 2) as orphan_rate,
  ROUND(100.0 * SUM(amount) FILTER (WHERE contact_id IS NULL) / SUM(amount), 2) as orphan_revenue_pct
FROM payments
WHERE created_at >= NOW() - INTERVAL '7 days';

-- TARGET: orphan_rate < 10%, orphan_revenue_pct < 15%
-- RED FLAG: If either metric > 20%
```

**Mitigation**:
1. **Manual Reconciliation** (weekly):
   ```sql
   -- Find orphan payments
   SELECT
     payment_event_id,
     customer_email,
     customer_name,
     amount,
     payment_date
   FROM payments
   WHERE contact_id IS NULL
   ORDER BY payment_date DESC;

   -- Try to link by partial email match or name similarity
   -- Manual research: Check GHL for similar names, phone numbers
   ```

2. **Automated Linking** (daily cron job):
   ```sql
   -- Link orphans when contact is created later
   -- (User might pay first, then create account)
   SELECT link_orphan_payments('user@example.com');
   ```

3. **Preventive Measures**:
   - Add email confirmation in Stripe checkout
   - Send pre-checkout email: "Please use THIS email when checking out"
   - Display email in checkout link preview

**Prevention**:
```sql
-- Create automated daily orphan linking job
CREATE OR REPLACE FUNCTION auto_link_orphan_payments()
RETURNS void AS $$
DECLARE
  orphan_email TEXT;
BEGIN
  -- For each orphan payment with email
  FOR orphan_email IN
    SELECT DISTINCT customer_email
    FROM payments
    WHERE contact_id IS NULL
      AND customer_email IS NOT NULL
  LOOP
    -- Try to link
    PERFORM link_orphan_payments(orphan_email);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule via cron or Supabase Edge Function (daily at 2am)
```

---

### **Risk #3: ManyChat Link Missing UTM Parameters**
**Category**: Attribution Loss
**Impact**: ⚠️⚠️ High - Can't track MC_ID or AD_ID
**Likelihood**: 🟢 Low - Configuration once, stable
**Detectability**: ⚠️ Moderate - Requires testing actual links

**What Happens**:
- ManyChat bot sends booking link WITHOUT `?mc_id=XXX&ad_id=YYY` parameters
- User clicks link → Funnel form loads
- Hidden fields try to populate from URL params → Find nothing
- Form submits to GHL with MC_ID = null, AD_ID = null
- GHL creates contact, fires webhook with no MC_ID/AD_ID
- System creates NEW contact instead of linking existing
- Attribution lost, duplicate contact created

**Business Impact**:
- Same as Risk #1 (duplicate contacts, lost attribution)
- Harder to detect (no error messages, just silently fails)

**Detection**:
```javascript
// Manual Test (do monthly):
// 1. Go through ManyChat bot flow as test user
// 2. When bot sends booking link, click it
// 3. Check URL in browser address bar
// 4. Should see: ?mc_id=1234567890&ad_id=ad_xyz_123
// 5. If missing → ManyChat flow is broken

// Automated Test:
// Check ManyChat webhook logs for link_sent events
```

```sql
-- Check if recent ManyChat contacts are getting GHL_ID
-- (If not, might be link issue)
SELECT
  mc_id,
  ghl_id,
  subscribe_date,
  link_send_date,
  link_click_date,
  form_submit_date
FROM contacts
WHERE mc_id IS NOT NULL
  AND subscribe_date >= NOW() - INTERVAL '7 days'
ORDER BY subscribe_date DESC;

-- RED FLAG: If link_click_date exists but ghl_id is NULL
-- Means they clicked link but form submission didn't link
```

**Mitigation**:
1. **Monthly Manual Test**: Click through bot, verify URL parameters
2. **ManyChat Flow Audit**: Ensure link includes {{subscriber_id}} and {{AD_ID}} variables
3. **Fallback**: If MC_ID missing, use email match (less reliable)

**Prevention**:
```
ManyChat Flow Configuration:
- External Request block or Button with URL:
  https://funnel.com/quiz?mc_id={{subscriber_id}}&ad_id={{AD_ID}}

- Ensure custom field "AD_ID" exists in ManyChat
- Ensure subscriber_id variable is available (default variable)
```

---

## 🟠 HIGH RISKS

### **Risk #4: Funnel Form Not Capturing Hidden Fields**
**Category**: Data Loss
**Impact**: ⚠️⚠️ High - Lost MC_ID/AD_ID
**Likelihood**: 🟢 Low - Frontend change risk
**Detectability**: ✅ Easy - Same as Risk #1

**What Happens**:
- ManyChat sends link with correct parameters: `?mc_id=XXX&ad_id=YYY`
- Funnel form loads but hidden fields not configured or JavaScript broken
- Form submits to GHL with empty MC_ID/AD_ID
- Same symptoms as Risk #1

**Root Causes**:
- Frontend developer changed form code
- JavaScript error prevents hidden field population
- Form hosted on different domain (CORS issues)
- Form builder changed, fields not migrated

**Detection**: Same query as Risk #1

**Mitigation**:
1. **Monthly Test**: Submit test form, verify GHL receives MC_ID/AD_ID
2. **Code Review**: Any changes to funnel form must be tested end-to-end
3. **Version Control**: Keep form code in git, review changes

**Prevention**:
```html
<!-- Funnel Form Hidden Fields (DO NOT REMOVE) -->
<input type="hidden" id="mc_id_field" name="MC_ID" value="">
<input type="hidden" id="ad_id_field" name="AD_ID" value="">

<script>
// Populate hidden fields from URL parameters
const urlParams = new URLSearchParams(window.location.search);
document.getElementById('mc_id_field').value = urlParams.get('mc_id') || '';
document.getElementById('ad_id_field').value = urlParams.get('ad_id') || '';

// Debug: Log to console
console.log('MC_ID:', urlParams.get('mc_id'));
console.log('AD_ID:', urlParams.get('ad_id'));
</script>
```

---

### **Risk #5: Denefits Webhook Broken (Make.com)**
**Category**: Revenue Loss
**Impact**: ⚠️⚠️⚠️ Critical - 50% of revenue lost if broken
**Likelihood**: 🟡 Medium - Third-party dependency
**Detectability**: ⚠️ Moderate - Need to check payments table

**What Happens**:
- Denefits payment occurs
- Make.com scenario supposed to forward webhook to your API
- Scenario broken/paused/error → Webhook never arrives
- Payment NOT logged in database
- Revenue completely lost (not even orphan)

**Business Impact**:
- Missing 50% of revenue (Denefits is half of payments)
- Can't reconcile revenue vs Denefits reports
- Can't calculate accurate LTV or ROAS

**Detection Query**:
```sql
-- Check payment source distribution (weekly)
SELECT
  payment_source,
  COUNT(*) as payment_count,
  SUM(amount) as total_revenue,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as pct_of_payments,
  ROUND(100.0 * SUM(amount) / SUM(SUM(amount)) OVER(), 2) as pct_of_revenue
FROM payments
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY payment_source;

-- EXPECTED: stripe ~50%, denefits ~50%
-- RED FLAG: If denefits = 0% or <20%
```

**Mitigation**:
1. **Weekly Monitoring**: Run detection query every Monday
2. **Make.com Alerts**: Set up Make.com email notifications for scenario errors
3. **Manual Check**: Log into Denefits weekly, compare payment count vs database

**Prevention**:
1. Make.com scenario should have error handling
2. Store webhook_logs even if processing fails
3. Consider direct Denefits webhook (bypass Make.com)

---

### **Risk #6: Perspective Webhook Not Firing**
**Category**: Insight Loss
**Impact**: ⚠️ Medium - Lose checkout_started tracking
**Likelihood**: 🟡 Medium - Third-party dependency
**Detectability**: ⚠️ Moderate - Need to check webhook_logs

**What Happens**:
- User fills out Perspective checkout form
- Perspective supposed to fire webhook
- Webhook doesn't fire or fails
- `checkout_started` timestamp not recorded
- Can't track checkout abandonment

**Business Impact**:
- Can't measure conversion rate from package sent → checkout started
- Can't identify high-intent prospects who didn't complete purchase
- Lose retargeting opportunity

**Detection Query**:
```sql
-- Check Perspective webhook activity (weekly)
SELECT
  DATE(created_at) as date,
  COUNT(*) as webhook_count,
  COUNT(*) FILTER (WHERE status = 'processed') as successful,
  COUNT(*) FILTER (WHERE status = 'no_contact_found') as not_found
FROM webhook_logs
WHERE source = 'perspective'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- RED FLAG: If webhook_count = 0 for multiple days
-- (Should have SOME checkout activity)
```

**Mitigation**:
1. **Weekly Monitoring**: Check Perspective webhook logs
2. **Perspective Dashboard**: Verify webhook is enabled and pointing to correct URL
3. **Fallback**: Use Stripe `checkout.session.created` as proxy for checkout_started

**Prevention**:
- Document Perspective webhook configuration
- Test webhook monthly
- Have backup tracking via Stripe

---

## 🟡 MEDIUM RISKS

### **Risk #7: Website Form No UTM Tracking**
**Category**: Attribution Loss (Expected)
**Impact**: ⚠️ Medium - Can't attribute organic traffic to ads
**Likelihood**: ✅ Always (by design)
**Detectability**: N/A (expected behavior)

**What Happens**:
- User finds website via organic search (Google, direct link)
- Submits website contact form
- Form has no UTM parameters (no ad campaign)
- Contact created with no AD_ID
- Can't attribute to specific marketing channel

**Business Impact**:
- Can't differentiate organic vs paid traffic at form level
- Can only identify as "website" source
- Acceptable - this is EXPECTED for organic traffic

**Detection**:
```sql
-- Check source distribution
SELECT
  source,
  COUNT(*) as contact_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM contacts
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY source
ORDER BY contact_count DESC;

-- EXPECTED: instagram ~70%, website ~30%
-- This is NORMAL - not a problem
```

**Mitigation**: NONE NEEDED (expected behavior)

**Note**: If you want to track organic traffic sources, add Google Analytics UTM parameters to all marketing links (email signatures, social media bios, etc.)

---

### **Risk #8: Duplicate Contacts (Edge Cases)**
**Category**: Data Quality
**Impact**: ⚠️ Medium - Clutters database, split data
**Likelihood**: 🟢 Low - Smart matching prevents most
**Detectability**: ✅ Easy - Query shows duplicates

**What Happens**:
- Same person creates contact through multiple paths
- Example: ManyChat → Books via GHL → Also submits website form
- If email/phone changed between touchpoints, creates duplicate

**Business Impact**:
- Engagement data split across multiple records
- Revenue attributed to wrong contact
- Confusing reports (same person counted twice)

**Detection Query**:
```sql
-- Find potential duplicates by email
SELECT
  email_primary,
  COUNT(*) as contact_count,
  ARRAY_AGG(id) as contact_ids,
  ARRAY_AGG(source) as sources
FROM contacts
WHERE email_primary IS NOT NULL
GROUP BY email_primary
HAVING COUNT(*) > 1
ORDER BY contact_count DESC;
```

**Mitigation**:
1. **Manual Merge**: Review duplicates monthly, merge manually
2. **Automated Merge** (risky - requires careful logic):
   ```sql
   -- Example: Merge older contact into newer
   -- ONLY if you're confident they're the same person
   ```

**Prevention**:
- Smart matching already prevents most duplicates
- Collect email EARLY in all flows
- Use consistent email across touchpoints

---

## 🟢 LOW RISKS

### **Risk #9: Lost Q1/Q2 Answers for Direct-to-Funnel**
**Category**: Insight Loss
**Impact**: 🟢 Low - Only affects market research
**Likelihood**: ✅ Always (by design)
**Detectability**: N/A (expected)

**What Happens**:
- User comes directly to funnel (Path B) - skips ManyChat bot
- Never answers qualification questions
- No Q1/Q2 data for this contact

**Business Impact**:
- Can't analyze symptoms or postpartum stage for direct-to-funnel traffic
- Only affects market research, not revenue tracking
- Acceptable trade-off for faster funnel

**Mitigation**: NONE NEEDED (expected behavior)

**Option**: Add Q1/Q2 questions to funnel form (would increase friction)

---

### **Risk #10: Lost Instagram Engagement Data for Website Forms**
**Category**: Insight Loss
**Impact**: 🟢 Low - Only affects engagement metrics
**Likelihood**: ✅ Always (by design)
**Detectability**: N/A (expected)

**What Happens**:
- User comes via website form (Path C) - never used ManyChat
- No Instagram username, no IG engagement data

**Business Impact**:
- Can't track Instagram follower growth from organic website traffic
- Only matters for social media analytics, not revenue

**Mitigation**: NONE NEEDED (expected behavior)

---

## 📊 Risk Monitoring Dashboard

**Weekly Health Check** (run every Monday):

```sql
WITH health_metrics AS (
  SELECT
    -- MC_ID → GHL_ID linkage rate
    ROUND(100.0 * COUNT(*) FILTER (WHERE mc_id IS NOT NULL AND ghl_id IS NOT NULL) /
      NULLIF(COUNT(*) FILTER (WHERE mc_id IS NOT NULL), 0), 2) as mc_linkage_rate,

    -- Orphan payment rate
    (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE contact_id IS NULL) / COUNT(*), 2)
     FROM payments
     WHERE created_at >= NOW() - INTERVAL '7 days') as orphan_rate,

    -- AD_ID capture rate (ManyChat contacts only)
    ROUND(100.0 * COUNT(*) FILTER (WHERE mc_id IS NOT NULL AND ad_id IS NOT NULL) /
      NULLIF(COUNT(*) FILTER (WHERE mc_id IS NOT NULL), 0), 2) as ad_capture_rate,

    -- Duplicate contact rate
    (SELECT ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM contacts WHERE email_primary IS NOT NULL), 2)
     FROM (SELECT email_primary FROM contacts WHERE email_primary IS NOT NULL GROUP BY email_primary HAVING COUNT(*) > 1) dupes
    ) as duplicate_rate

  FROM contacts
  WHERE created_at >= NOW() - INTERVAL '7 days'
)
SELECT
  mc_linkage_rate,
  orphan_rate,
  ad_capture_rate,
  duplicate_rate,

  -- Health Status
  CASE
    WHEN mc_linkage_rate < 85 THEN '🔴 CRITICAL: MC linkage broken'
    WHEN mc_linkage_rate < 90 THEN '🟠 WARNING: MC linkage low'
    ELSE '✅ OK'
  END as mc_health,

  CASE
    WHEN orphan_rate > 20 THEN '🔴 CRITICAL: High orphan rate'
    WHEN orphan_rate > 10 THEN '🟠 WARNING: Elevated orphan rate'
    ELSE '✅ OK'
  END as payment_health,

  CASE
    WHEN ad_capture_rate < 70 THEN '🟠 WARNING: AD_ID capture low'
    WHEN ad_capture_rate < 80 THEN '🟡 MONITOR: AD_ID capture moderate'
    ELSE '✅ OK'
  END as attribution_health

FROM health_metrics;
```

**Target Metrics**:
- MC linkage rate: >90%
- Orphan rate: <10%
- AD_ID capture rate: >80%
- Duplicate rate: <5%

---

## 🚨 Incident Response Playbook

### **Incident: MC Linkage Rate Drops Below 85%**

**Symptoms**: Recent ManyChat contacts not getting GHL_ID

**Diagnosis Steps**:
1. Check GHL custom fields exist (MC_ID, AD_ID)
2. Submit test form, verify fields captured
3. Check webhook_logs for GHL webhooks with missing customData
4. Test ManyChat link includes URL parameters

**Fix**:
- If GHL fields missing → Create custom fields
- If funnel form broken → Fix hidden field JavaScript
- If ManyChat link missing params → Fix bot flow

---

### **Incident: Orphan Rate Spikes Above 20%**

**Symptoms**: Lots of payments with contact_id = NULL

**Diagnosis Steps**:
1. Check if email typos (manual review of orphan emails)
2. Check if new email pattern (e.g., all Gmail vs all work emails)
3. Check if Stripe/Denefits email field changed

**Fix**:
- Manual reconciliation of orphan payments
- Update matching logic if needed
- Add email confirmation in checkout

---

### **Incident: No Denefits Payments for >3 Days**

**Symptoms**: payment_source = 'denefits' count = 0

**Diagnosis Steps**:
1. Check Make.com scenario status (paused? error?)
2. Check Denefits dashboard for actual payments
3. Check webhook_logs for denefits source

**Fix**:
- Restart Make.com scenario
- Check webhook URL still correct
- Manual backfill of missing payments

---

This risk assessment provides comprehensive coverage of all failure modes in the webhook system. Use the monitoring dashboard weekly to catch issues early.
