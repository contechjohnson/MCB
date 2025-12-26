---
description: Analyze chatbot A/B test performance comparing variants A vs B
---

Analyze chatbot A/B test for $ARGUMENTS.

Use the analytics-agent subagent to compare chatbot variants using funnel_events:

**1. Overall Performance by Variant:**
```sql
WITH variant_events AS (
  SELECT
    COALESCE(fe.tags->>'chatbot', c.tags->>'chatbot') as variant,
    fe.event_type,
    fe.contact_id
  FROM funnel_events fe
  JOIN contacts c ON fe.contact_id = c.id
  WHERE fe.tenant_id = '[tenant_uuid]'
    AND fe.event_timestamp >= NOW() - INTERVAL '[time_range]'
    AND c.source != 'instagram_historical'
    AND (fe.tags->>'chatbot' IS NOT NULL OR c.tags->>'chatbot' IS NOT NULL)
)
SELECT
  variant,
  COUNT(DISTINCT CASE WHEN event_type = 'contact_subscribed' THEN contact_id END) as entered,
  COUNT(DISTINCT CASE WHEN event_type = 'dm_qualified' THEN contact_id END) as dm_qualified,
  COUNT(DISTINCT CASE WHEN event_type = 'link_clicked' THEN contact_id END) as link_clicked,
  COUNT(DISTINCT CASE WHEN event_type = 'form_submitted' THEN contact_id END) as form_submitted,
  COUNT(DISTINCT CASE WHEN event_type = 'appointment_held' THEN contact_id END) as meeting_held,
  COUNT(DISTINCT CASE WHEN event_type = 'purchase_completed' THEN contact_id END) as purchased
FROM variant_events
GROUP BY variant;
```

**2. Revenue by Variant:**
```sql
SELECT
  COALESCE(c.tags->>'chatbot', 'unknown') as variant,
  COUNT(DISTINCT p.contact_id) as customers,
  SUM(p.amount) as total_revenue,
  ROUND(SUM(p.amount) / NULLIF(COUNT(DISTINCT p.contact_id), 0), 0) as avg_order
FROM payments p
JOIN contacts c ON p.contact_id = c.id
WHERE p.tenant_id = '[tenant_uuid]'
  AND p.payment_category IN ('deposit', 'full_purchase', 'downpayment')
  AND p.payment_date >= NOW() - INTERVAL '[time_range]'
  AND c.tags->>'chatbot' IS NOT NULL
GROUP BY c.tags->>'chatbot';
```

**3. Conversion Rates Comparison:**
Calculate and present as:

| Stage | Variant A | A Rate | Variant B | B Rate | Winner | Delta |
|-------|-----------|--------|-----------|--------|--------|-------|
| Entered | 100 | - | 95 | - | A | +5% |
| DM Qualified | 70 | 70% | 60 | 63% | A | +7pp |
| Form Submit | 30 | 30% | 35 | 37% | B | -7pp |
| Meeting Held | 20 | 20% | 22 | 23% | B | -3pp |
| Purchased | 5 | 5% | 4 | 4% | A | +1pp |
| Revenue | $25k | $250/lead | $18k | $189/lead | A | +$61 |

**4. Statistical Significance Check:**
- Note sample size for each variant
- Flag if either variant has < 30 contacts (not statistically significant)
- Calculate confidence level if sample size is sufficient

**Present Results:**
1. Side-by-side comparison table
2. Clear winner designation at each stage
3. Overall recommendation (A, B, or "continue testing")
4. Revenue per lead comparison

**IMPORTANT:**
- Query funnel_events with tags->>'chatbot' filter (events-first)
- Default time range: 60 days (longer for A/B test significance)
- Default tenant: PPCU
- Note small sample sizes explicitly
- Supabase Project ID: `succdcwblbzikenhhlrz`
