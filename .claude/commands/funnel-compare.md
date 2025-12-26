---
description: Compare conversion funnels (jane_paid vs calendly_free) side by side
---

Compare funnel performance between variants for $ARGUMENTS.

Use the analytics-agent subagent to:

1. Query funnel metrics for BOTH variants side-by-side using **funnel_events** (events-first):
   - `jane_paid` - ManyChat → Jane paid consult flow
   - `calendly_free` - Perspective → Calendly free discovery flow

2. For each variant, calculate using funnel_events:
   - Total leads (contact_subscribed or form_submitted event)
   - Form submitted (form_submitted event)
   - Meeting held (appointment_held event)
   - Purchased (purchase_completed event)
   - Revenue (from payments table, joined by contact_id)

3. Present as a comparison table:

| Stage | Jane (Paid) | Rate | Calendly (Free) | Rate | Delta |
|-------|-------------|------|-----------------|------|-------|
| Leads | 100 | - | 80 | - | -20% |
| Form Submit | 30 | 30% | 40 | 50% | +20pp |
| Meeting Held | 20 | 20% | 25 | 31% | +11pp |
| Purchased | 5 | 5% | 3 | 4% | -1pp |
| Revenue | $25k | $5k/lead | $12k | $4k/lead | -$1k |

4. Add insights:
   - Which funnel has better conversion at each stage
   - Statistical note if sample size is small (<30)
   - Net recommendation

**SQL Query Pattern (Events-First):**
```sql
-- Get funnel metrics by variant using tags
WITH variant_events AS (
  SELECT
    COALESCE(tags->>'funnel', c.funnel_variant) as variant,
    fe.event_type,
    fe.contact_id
  FROM funnel_events fe
  JOIN contacts c ON fe.contact_id = c.id
  WHERE fe.tenant_id = '[tenant_uuid]'
    AND fe.event_timestamp >= NOW() - INTERVAL '[time_range]'
    AND c.source != 'instagram_historical'
)
SELECT
  variant,
  COUNT(DISTINCT CASE WHEN event_type IN ('contact_subscribed', 'form_submitted') THEN contact_id END) as leads,
  COUNT(DISTINCT CASE WHEN event_type = 'form_submitted' THEN contact_id END) as form_submitted,
  COUNT(DISTINCT CASE WHEN event_type = 'appointment_held' THEN contact_id END) as meeting_held,
  COUNT(DISTINCT CASE WHEN event_type = 'purchase_completed' THEN contact_id END) as purchased
FROM variant_events
WHERE variant ILIKE '%jane%' OR variant ILIKE '%calendly%'
GROUP BY variant;

-- Get revenue by variant
SELECT
  COALESCE(c.tags->>'funnel', c.funnel_variant) as variant,
  SUM(p.amount) as revenue
FROM payments p
JOIN contacts c ON p.contact_id = c.id
WHERE p.tenant_id = '[tenant_uuid]'
  AND p.payment_category IN ('deposit', 'full_purchase', 'downpayment')
  AND p.payment_date >= NOW() - INTERVAL '[time_range]'
GROUP BY COALESCE(c.tags->>'funnel', c.funnel_variant);
```

**IMPORTANT:**
- Always filter `WHERE source != 'instagram_historical'`
- Query **funnel_events** table, NOT contact date columns (deprecated)
- If no time range is specified, default to "last 60 days" (longer for A/B comparison)
- If no tenant specified, default to PPCU
- Note if one variant has very few contacts (less meaningful comparison)
