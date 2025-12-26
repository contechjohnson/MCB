---
description: Generate revenue report with cash collected, projected revenue, and attribution
---

Generate a revenue report for $ARGUMENTS.

Use the analytics-agent subagent to query payment data:

**1. Cash Collected (Actual Money Received):**
```sql
SELECT
  payment_category,
  COUNT(*) as transactions,
  SUM(amount) as total
FROM payments
WHERE tenant_id = '[tenant_uuid]'
  AND payment_category IN ('deposit', 'full_purchase', 'downpayment', 'recurring')
  AND payment_date >= NOW() - INTERVAL '[time_range]'
GROUP BY payment_category
ORDER BY total DESC;
```

**2. Projected Revenue (Denefits BNPL Total Financed):**
```sql
SELECT
  COUNT(*) as contracts,
  SUM(amount) as projected_total
FROM payments
WHERE tenant_id = '[tenant_uuid]'
  AND payment_category = 'payment_plan'
  AND payment_date >= NOW() - INTERVAL '[time_range]';
```

**3. Revenue by Source:**
```sql
SELECT
  c.source,
  COUNT(DISTINCT p.contact_id) as customers,
  SUM(p.amount) as revenue,
  ROUND(SUM(p.amount) / NULLIF(COUNT(DISTINCT p.contact_id), 0), 0) as avg_order
FROM payments p
JOIN contacts c ON p.contact_id = c.id
WHERE p.tenant_id = '[tenant_uuid]'
  AND p.payment_category IN ('deposit', 'full_purchase', 'downpayment')
  AND p.payment_date >= NOW() - INTERVAL '[time_range]'
GROUP BY c.source;
```

**4. Revenue by Funnel Variant:**
```sql
SELECT
  COALESCE(c.tags->>'funnel', 'unknown') as funnel,
  COUNT(DISTINCT p.contact_id) as customers,
  SUM(p.amount) as revenue
FROM payments p
JOIN contacts c ON p.contact_id = c.id
WHERE p.tenant_id = '[tenant_uuid]'
  AND p.payment_category IN ('deposit', 'full_purchase', 'downpayment')
  AND p.payment_date >= NOW() - INTERVAL '[time_range]'
GROUP BY c.tags->>'funnel';
```

**5. Orphan Payments (Not Linked to Contact):**
```sql
SELECT
  customer_email,
  amount,
  payment_category,
  payment_source,
  payment_date
FROM payments
WHERE tenant_id = '[tenant_uuid]'
  AND contact_id IS NULL
  AND payment_date >= NOW() - INTERVAL '[time_range]';
```

**Present Results:**
| Metric | Value |
|--------|-------|
| Cash Collected | $X,XXX |
| Projected Revenue (BNPL) | $X,XXX |
| Total Customers | XX |
| Avg Order Value | $X,XXX |
| Orphan Payments | X ($XXX) |

Plus breakdown by source and funnel variant.

**IMPORTANT:**
- Cash Collected = deposit + full_purchase + downpayment + recurring
- Projected Revenue = payment_plan (Denefits total financed amount)
- Default time range: 30 days if not specified
- Default tenant: PPCU
- Supabase Project ID: `succdcwblbzikenhhlrz`
