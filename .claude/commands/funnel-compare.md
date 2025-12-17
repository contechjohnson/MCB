---
description: Compare conversion funnels (jane_paid vs calendly_free) side by side
---

Compare funnel performance between variants for $ARGUMENTS.

Use the analytics-agent subagent to:

1. Query funnel metrics for BOTH variants side-by-side:
   - `jane_paid` - ManyChat → Jane paid consult flow
   - `calendly_free` - Perspective → Calendly free discovery flow

2. For each variant, calculate:
   - Total leads (subscribe_date or form_submit_date IS NOT NULL)
   - Form submitted (form_submit_date IS NOT NULL)
   - Meeting booked (appointment_date IS NOT NULL)
   - Meeting held (appointment_held_date IS NOT NULL)
   - Purchased (purchase_date IS NOT NULL)
   - Revenue (SUM of purchase_amount)

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

**SQL Query Pattern:**
```sql
SELECT
  funnel_variant,
  COUNT(*) as total_leads,
  COUNT(CASE WHEN form_submit_date IS NOT NULL THEN 1 END) as form_submitted,
  COUNT(CASE WHEN appointment_date IS NOT NULL THEN 1 END) as meeting_booked,
  COUNT(CASE WHEN appointment_held_date IS NOT NULL THEN 1 END) as meeting_held,
  COUNT(CASE WHEN purchase_date IS NOT NULL THEN 1 END) as purchased,
  SUM(COALESCE(purchase_amount, 0)) as revenue
FROM contacts
WHERE tenant_id = '[tenant_uuid]'
  AND source != 'instagram_historical'
  AND funnel_variant IN ('jane_paid', 'calendly_free')
  AND created_at >= NOW() - INTERVAL '[time_range]'
GROUP BY funnel_variant;
```

**IMPORTANT:**
- Always filter `WHERE source != 'instagram_historical'`
- If no time range is specified, default to "last 60 days" (longer for A/B comparison)
- If no tenant specified, default to PPCU
- Note if one variant has very few contacts (less meaningful comparison)
