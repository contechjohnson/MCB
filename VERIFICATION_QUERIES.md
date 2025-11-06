# Verification & Monitoring Queries

**Last Updated**: January 6, 2025
**Purpose**: SQL queries for monitoring webhook system health

---

## 📊 Weekly Health Dashboard

**Run this every Monday morning** to get complete system health overview.

```sql
-- ============================================
-- WEEKLY HEALTH CHECK (All-in-One)
-- ============================================

WITH weekly_stats AS (
  SELECT
    -- Total new contacts
    COUNT(*) as total_new_contacts,

    -- By source
    COUNT(*) FILTER (WHERE source = 'instagram') as instagram_contacts,
    COUNT(*) FILTER (WHERE source = 'website') as website_contacts,

    -- ID availability
    COUNT(*) FILTER (WHERE mc_id IS NOT NULL) as has_mc_id,
    COUNT(*) FILTER (WHERE ghl_id IS NOT NULL) as has_ghl_id,
    COUNT(*) FILTER (WHERE ad_id IS NOT NULL) as has_ad_id,

    -- Linkage
    COUNT(*) FILTER (WHERE mc_id IS NOT NULL AND ghl_id IS NOT NULL) as mc_ghl_linked,

    -- Funnel stages reached
    COUNT(*) FILTER (WHERE dm_qualified_date IS NOT NULL) as dm_qualified,
    COUNT(*) FILTER (WHERE form_submit_date IS NOT NULL) as form_submitted,
    COUNT(*) FILTER (WHERE appointment_date IS NOT NULL) as meeting_booked,
    COUNT(*) FILTER (WHERE appointment_held_date IS NOT NULL) as meeting_held,
    COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) as purchased

  FROM contacts
  WHERE created_at >= NOW() - INTERVAL '7 days'
),

payment_stats AS (
  SELECT
    COUNT(*) as total_payments,
    COUNT(*) FILTER (WHERE contact_id IS NULL) as orphan_payments,
    COUNT(*) FILTER (WHERE payment_source = 'stripe') as stripe_payments,
    COUNT(*) FILTER (WHERE payment_source = 'denefits') as denefits_payments,

    SUM(amount) as total_revenue,
    SUM(amount) FILTER (WHERE contact_id IS NULL) as orphan_revenue,
    SUM(amount) FILTER (WHERE payment_source = 'stripe') as stripe_revenue,
    SUM(amount) FILTER (WHERE payment_source = 'denefits') as denefits_revenue

  FROM payments
  WHERE created_at >= NOW() - INTERVAL '7 days'
),

webhook_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE source = 'manychat') as manychat_webhooks,
    COUNT(*) FILTER (WHERE source = 'ghl') as ghl_webhooks,
    COUNT(*) FILTER (WHERE source = 'stripe') as stripe_webhooks,
    COUNT(*) FILTER (WHERE source = 'denefits') as denefits_webhooks,
    COUNT(*) FILTER (WHERE source = 'perspective') as perspective_webhooks,

    COUNT(*) FILTER (WHERE status = 'error') as webhook_errors,
    COUNT(*) FILTER (WHERE status = 'processed_orphan') as orphan_logs

  FROM webhook_logs
  WHERE created_at >= NOW() - INTERVAL '7 days'
)

SELECT
  '=== CONTACTS ===' as section,
  ws.total_new_contacts,
  ws.instagram_contacts,
  ws.website_contacts,

  CONCAT(
    ROUND(100.0 * ws.mc_ghl_linked / NULLIF(ws.has_mc_id, 0), 1),
    '% (',
    CASE
      WHEN ROUND(100.0 * ws.mc_ghl_linked / NULLIF(ws.has_mc_id, 0), 1) >= 90 THEN '✅'
      WHEN ROUND(100.0 * ws.mc_ghl_linked / NULLIF(ws.has_mc_id, 0), 1) >= 85 THEN '🟡'
      ELSE '🔴'
    END,
    ')'
  ) as mc_linkage_rate,

  CONCAT(
    ROUND(100.0 * ws.has_ad_id / NULLIF(ws.instagram_contacts, 0), 1),
    '%'
  ) as ad_id_capture_rate,

  '=== FUNNEL ===' as section2,
  ws.dm_qualified,
  ws.form_submitted,
  ws.meeting_booked,
  ws.meeting_held,
  ws.purchased,

  CONCAT(
    ROUND(100.0 * ws.purchased / NULLIF(ws.meeting_held, 0), 1),
    '%'
  ) as meeting_to_purchase_rate,

  '=== PAYMENTS ===' as section3,
  ps.total_payments,
  ps.stripe_payments,
  ps.denefits_payments,

  CONCAT(
    '$',
    ROUND(ps.total_revenue, 0)
  ) as total_revenue,

  CONCAT(
    ps.orphan_payments,
    ' (',
    ROUND(100.0 * ps.orphan_payments / NULLIF(ps.total_payments, 0), 1),
    '%) ',
    CASE
      WHEN ROUND(100.0 * ps.orphan_payments / NULLIF(ps.total_payments, 0), 1) < 10 THEN '✅'
      WHEN ROUND(100.0 * ps.orphan_payments / NULLIF(ps.total_payments, 0), 1) < 20 THEN '🟡'
      ELSE '🔴'
    END
  ) as orphan_rate,

  '=== WEBHOOKS ===' as section4,
  wh.manychat_webhooks,
  wh.ghl_webhooks,
  wh.stripe_webhooks,
  wh.denefits_webhooks,
  wh.perspective_webhooks,
  wh.webhook_errors

FROM weekly_stats ws, payment_stats ps, webhook_stats wh;
```

**Interpretation**:
- ✅ = Healthy
- 🟡 = Warning (investigate)
- 🔴 = Critical (fix immediately)

**Target Metrics**:
- MC linkage rate: >90%
- Orphan rate: <10%
- AD_ID capture (instagram): >80%

---

## 🔍 Diagnostic Queries

### **1. Check MC_ID → GHL_ID Linkage**

Find ManyChat contacts that should have GHL_ID but don't (indicates broken handoff).

```sql
-- ManyChat contacts who clicked link but never got GHL_ID
SELECT
  mc_id,
  email_primary,
  subscribe_date,
  link_send_date,
  link_click_date,
  form_submit_date,
  ghl_id,
  created_at
FROM contacts
WHERE mc_id IS NOT NULL
  AND link_click_date IS NOT NULL  -- They clicked the link
  AND ghl_id IS NULL                -- But never got GHL_ID
  AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY link_click_date DESC;

-- Expected: 0 rows (everyone who clicks should submit form and get GHL_ID)
-- If rows exist: Funnel form → GHL handoff is broken
```

---

### **2. Check Recent GHL Contacts Have MC_ID (if from ManyChat)**

Verify that GHL contacts created from ManyChat flow have MC_ID.

```sql
-- Recent GHL contacts from instagram source should have MC_ID
SELECT
  ghl_id,
  mc_id,
  ad_id,
  email_primary,
  source,
  form_submit_date,
  created_at
FROM contacts
WHERE ghl_id IS NOT NULL
  AND source = 'instagram'          -- Should be from ManyChat flow
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Check: mc_id should NOT be NULL for instagram source contacts
-- If NULL: GHL custom fields not configured or not passing customData
```

---

### **3. Find Orphan Payments (For Manual Reconciliation)**

List payments that couldn't be linked to contacts.

```sql
-- Orphan payments in last 30 days
SELECT
  payment_event_id,
  payment_source,
  customer_email,
  customer_name,
  customer_phone,
  amount,
  payment_date,
  created_at
FROM payments
WHERE contact_id IS NULL
  AND created_at >= NOW() - INTERVAL '30 days'
ORDER BY payment_date DESC;

-- Action: For each payment, try to find matching contact manually:
-- 1. Search by email (check if typo or different email)
-- 2. Search by name + phone
-- 3. Check GHL for recent bookings
-- 4. Link manually if found: UPDATE payments SET contact_id = 'uuid' WHERE id = 'payment_id'
```

---

### **4. Check AD_ID Capture Rate by Source**

Verify AD_ID is being captured for paid traffic.

```sql
-- AD_ID availability by source
SELECT
  source,
  COUNT(*) as total_contacts,
  COUNT(*) FILTER (WHERE ad_id IS NOT NULL) as has_ad_id,
  ROUND(100.0 * COUNT(*) FILTER (WHERE ad_id IS NOT NULL) / COUNT(*), 1) as ad_id_rate
FROM contacts
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY source
ORDER BY total_contacts DESC;

-- Expected:
-- instagram: >80% (most should have AD_ID from Meta ads)
-- website: Low (organic traffic, expected)

-- If instagram <80%: Check ManyChat AD_ID custom field and URL parameters
```

---

### **5. Find Duplicate Contacts**

Identify potential duplicate contacts by email.

```sql
-- Duplicate emails (same person, multiple records)
SELECT
  email_primary,
  COUNT(*) as contact_count,
  ARRAY_AGG(id ORDER BY created_at) as contact_ids,
  ARRAY_AGG(source ORDER BY created_at) as sources,
  ARRAY_AGG(mc_id ORDER BY created_at) as mc_ids,
  ARRAY_AGG(ghl_id ORDER BY created_at) as ghl_ids,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM contacts
WHERE email_primary IS NOT NULL
GROUP BY email_primary
HAVING COUNT(*) > 1
ORDER BY contact_count DESC, email_primary;

-- Review each duplicate:
-- - Are they actually the same person?
-- - Can they be merged? (Combine MC_ID from one, GHL_ID from other)
-- - Or keep separate? (Legitimately different people with shared email)
```

---

### **6. Check Payment Source Distribution**

Verify both Stripe and Denefits are working.

```sql
-- Payment distribution by source (weekly)
SELECT
  payment_source,
  COUNT(*) as payment_count,
  SUM(amount) as total_revenue,
  ROUND(AVG(amount), 2) as avg_payment,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as pct_of_count,
  ROUND(100.0 * SUM(amount) / SUM(SUM(amount)) OVER(), 1) as pct_of_revenue
FROM payments
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY payment_source
ORDER BY total_revenue DESC;

-- Expected: Roughly 50/50 split between stripe and denefits
-- If denefits = 0%: Denefits webhook is broken (check Make.com)
-- If stripe = 0%: Stripe webhook is broken (check Stripe dashboard)
```

---

### **7. Check Webhook Activity (Detect Failures)**

Ensure all webhook sources are firing.

```sql
-- Webhook activity by source (daily breakdown)
SELECT
  source,
  DATE(created_at) as date,
  COUNT(*) as webhook_count,
  COUNT(*) FILTER (WHERE status = 'processed') as successful,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  COUNT(*) FILTER (WHERE status = 'processed_orphan') as orphans,
  COUNT(*) FILTER (WHERE status = 'no_contact_found') as not_found
FROM webhook_logs
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY source, DATE(created_at)
ORDER BY date DESC, source;

-- Red flags:
-- - ManyChat = 0 for multiple days (bot stopped sending webhooks?)
-- - GHL = 0 for multiple days (workflow paused?)
-- - Stripe/Denefits = 0 but payments showing in dashboard (webhook broken)
-- - High error count (check error_message in webhook_logs)
```

---

### **8. Funnel Conversion Analysis**

Track conversion rates through the funnel.

```sql
-- Funnel stages with conversion rates (last 30 days)
WITH funnel_stages AS (
  SELECT
    COUNT(*) as total_contacts,
    COUNT(*) FILTER (WHERE subscribe_date IS NOT NULL) as subscribed,
    COUNT(*) FILTER (WHERE dm_qualified_date IS NOT NULL) as dm_qualified,
    COUNT(*) FILTER (WHERE link_send_date IS NOT NULL) as link_sent,
    COUNT(*) FILTER (WHERE link_click_date IS NOT NULL) as link_clicked,
    COUNT(*) FILTER (WHERE form_submit_date IS NOT NULL) as form_submitted,
    COUNT(*) FILTER (WHERE appointment_date IS NOT NULL) as meeting_booked,
    COUNT(*) FILTER (WHERE appointment_held_date IS NOT NULL) as meeting_held,
    COUNT(*) FILTER (WHERE package_sent_date IS NOT NULL) as package_sent,
    COUNT(*) FILTER (WHERE checkout_started IS NOT NULL) as checkout_started,
    COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) as purchased
  FROM contacts
  WHERE created_at >= NOW() - INTERVAL '30 days'
)
SELECT
  'Subscribed' as stage, subscribed as count, 100.0 as conversion_rate FROM funnel_stages
UNION ALL
SELECT 'DM Qualified', dm_qualified, ROUND(100.0 * dm_qualified / NULLIF(subscribed, 0), 1) FROM funnel_stages
UNION ALL
SELECT 'Link Sent', link_sent, ROUND(100.0 * link_sent / NULLIF(dm_qualified, 0), 1) FROM funnel_stages
UNION ALL
SELECT 'Link Clicked', link_clicked, ROUND(100.0 * link_clicked / NULLIF(link_sent, 0), 1) FROM funnel_stages
UNION ALL
SELECT 'Form Submitted', form_submitted, ROUND(100.0 * form_submitted / NULLIF(link_clicked, 0), 1) FROM funnel_stages
UNION ALL
SELECT 'Meeting Booked', meeting_booked, ROUND(100.0 * meeting_booked / NULLIF(form_submitted, 0), 1) FROM funnel_stages
UNION ALL
SELECT 'Meeting Held', meeting_held, ROUND(100.0 * meeting_held / NULLIF(meeting_booked, 0), 1) FROM funnel_stages
UNION ALL
SELECT 'Package Sent', package_sent, ROUND(100.0 * package_sent / NULLIF(meeting_held, 0), 1) FROM funnel_stages
UNION ALL
SELECT 'Checkout Started', checkout_started, ROUND(100.0 * checkout_started / NULLIF(package_sent, 0), 1) FROM funnel_stages
UNION ALL
SELECT 'Purchased', purchased, ROUND(100.0 * purchased / NULLIF(meeting_held, 0), 1) FROM funnel_stages
ORDER BY count DESC;

-- Identify drop-off points:
-- - Link sent → Link clicked <50%: Link not compelling or broken
-- - Link clicked → Form submitted <70%: Funnel form has issues
-- - Meeting booked → Meeting held <80%: High no-show rate
-- - Meeting held → Purchased <30%: Sales process needs improvement
```

---

### **9. Revenue Attribution by Source**

Calculate revenue and ROAS by traffic source.

```sql
-- Revenue by source (last 30 days)
SELECT
  c.source,
  COUNT(DISTINCT c.id) as contacts,
  COUNT(DISTINCT p.id) as payments,
  ROUND(SUM(p.amount), 2) as total_revenue,
  ROUND(AVG(p.amount), 2) as avg_order_value,
  ROUND(SUM(p.amount) / NULLIF(COUNT(DISTINCT c.id), 0), 2) as revenue_per_contact
FROM contacts c
LEFT JOIN payments p ON p.contact_id = c.id
WHERE c.created_at >= NOW() - INTERVAL '30 days'
GROUP BY c.source
ORDER BY total_revenue DESC NULLS LAST;

-- Use this to calculate ROAS:
-- ROAS = (revenue_per_contact * contacts) / ad_spend
```

---

### **10. Recently Created Contacts (Sanity Check)**

View recent contacts to verify all fields populating correctly.

```sql
-- Last 10 contacts created (all fields)
SELECT
  id,
  mc_id,
  ghl_id,
  ad_id,
  source,
  email_primary,
  phone,
  stage,
  subscribe_date,
  dm_qualified_date,
  form_submit_date,
  appointment_date,
  purchase_date,
  created_at
FROM contacts
ORDER BY created_at DESC
LIMIT 10;

-- Manual review:
-- - Do instagram source contacts have mc_id and ad_id?
-- - Do website source contacts have ghl_id but no mc_id? (expected)
-- - Are stages progressing logically?
-- - Are timestamps in correct order?
```

---

## 🚨 Alert Queries (Run Automatically)

Set these up to run daily and send alerts if thresholds crossed.

### **Alert #1: MC Linkage Rate Drops Below 85%**

```sql
-- Alert if MC → GHL linkage rate < 85% (last 3 days)
WITH recent_mc_contacts AS (
  SELECT
    COUNT(*) FILTER (WHERE mc_id IS NOT NULL AND ghl_id IS NOT NULL) as linked,
    COUNT(*) FILTER (WHERE mc_id IS NOT NULL) as total_mc
  FROM contacts
  WHERE created_at >= NOW() - INTERVAL '3 days'
    AND source = 'instagram'
)
SELECT
  CASE
    WHEN ROUND(100.0 * linked / NULLIF(total_mc, 0), 1) < 85 THEN
      CONCAT('🚨 ALERT: MC linkage rate = ',
             ROUND(100.0 * linked / NULLIF(total_mc, 0), 1),
             '% (expected >85%)')
    ELSE 'OK'
  END as alert_status
FROM recent_mc_contacts;
```

---

### **Alert #2: Orphan Payment Rate Above 15%**

```sql
-- Alert if orphan rate > 15% (last 7 days)
WITH recent_payments AS (
  SELECT
    COUNT(*) FILTER (WHERE contact_id IS NULL) as orphans,
    COUNT(*) as total
  FROM payments
  WHERE created_at >= NOW() - INTERVAL '7 days'
)
SELECT
  CASE
    WHEN ROUND(100.0 * orphans / NULLIF(total, 0), 1) > 15 THEN
      CONCAT('🚨 ALERT: Orphan payment rate = ',
             ROUND(100.0 * orphans / NULLIF(total, 0), 1),
             '% (expected <10%)')
    ELSE 'OK'
  END as alert_status
FROM recent_payments;
```

---

### **Alert #3: No Denefits Payments for 3+ Days**

```sql
-- Alert if no Denefits payments in last 3 days
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '🚨 ALERT: No Denefits payments in last 3 days (check Make.com)'
    ELSE 'OK'
  END as alert_status
FROM payments
WHERE payment_source = 'denefits'
  AND created_at >= NOW() - INTERVAL '3 days';
```

---

### **Alert #4: High Webhook Error Rate**

```sql
-- Alert if >10% of webhooks are errors (last 24 hours)
WITH webhook_health AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'error') as errors,
    COUNT(*) as total
  FROM webhook_logs
  WHERE created_at >= NOW() - INTERVAL '24 hours'
)
SELECT
  CASE
    WHEN ROUND(100.0 * errors / NULLIF(total, 0), 1) > 10 THEN
      CONCAT('🚨 ALERT: Webhook error rate = ',
             ROUND(100.0 * errors / NULLIF(total, 0), 1),
             '% (expected <5%)')
    ELSE 'OK'
  END as alert_status
FROM webhook_health;
```

---

## 📈 Business Intelligence Queries

### **Calculate ROAS by Ad Campaign**

```sql
-- Revenue by AD_ID (for calculating ROAS)
SELECT
  c.ad_id,
  COUNT(DISTINCT c.id) as contacts,
  COUNT(DISTINCT p.id) as purchases,
  ROUND(SUM(p.amount), 2) as total_revenue,
  ROUND(AVG(p.amount), 2) as avg_order_value,
  ROUND(100.0 * COUNT(DISTINCT p.id) / NULLIF(COUNT(DISTINCT c.id), 0), 1) as conversion_rate
FROM contacts c
LEFT JOIN payments p ON p.contact_id = c.id
WHERE c.ad_id IS NOT NULL
  AND c.created_at >= NOW() - INTERVAL '30 days'
GROUP BY c.ad_id
ORDER BY total_revenue DESC NULLS LAST;

-- Calculate ROAS:
-- ROAS = total_revenue / ad_spend_for_this_ad_id
-- Get ad_spend from Meta Ads Manager, match by AD_ID
```

---

### **Cohort Analysis: Purchase Rate by Subscribe Week**

```sql
-- Weekly cohorts: How many eventually purchase?
SELECT
  DATE_TRUNC('week', subscribe_date) as cohort_week,
  COUNT(*) as total_subscribed,
  COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) as purchased,
  ROUND(100.0 * COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) / COUNT(*), 1) as purchase_rate,
  ROUND(SUM(purchase_amount), 2) as total_revenue,
  ROUND(AVG(purchase_amount) FILTER (WHERE purchase_amount > 0), 2) as avg_purchase
FROM contacts
WHERE subscribe_date >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', subscribe_date)
ORDER BY cohort_week DESC;
```

---

These queries cover all monitoring and verification needs for the webhook system. Run the weekly health dashboard every Monday, and set up automated alerts for critical metrics.
