---
description: Analyze conversion funnel with stage-by-stage breakdown and conversion rates
---

Analyze the conversion funnel for $ARGUMENTS.

Use the analytics-agent subagent to query **funnel_events** (events-first architecture):

1. Query stage-by-stage breakdown using funnel_events:
```sql
SELECT
  event_type,
  COUNT(DISTINCT contact_id) as contacts
FROM funnel_events fe
JOIN contacts c ON fe.contact_id = c.id
WHERE fe.tenant_id = '[tenant_uuid]'
  AND fe.event_timestamp >= NOW() - INTERVAL '[time_range]'
  AND c.source != 'instagram_historical'
  AND event_type IN (
    'contact_subscribed', 'dm_qualified', 'link_clicked',
    'form_submitted', 'appointment_held', 'purchase_completed'
  )
GROUP BY event_type
ORDER BY
  CASE event_type
    WHEN 'contact_subscribed' THEN 1
    WHEN 'dm_qualified' THEN 2
    WHEN 'link_clicked' THEN 3
    WHEN 'form_submitted' THEN 4
    WHEN 'appointment_held' THEN 5
    WHEN 'purchase_completed' THEN 6
  END;
```

2. Calculate conversion rates between each stage
3. Identify drop-off points (where we lose the most people)
4. Present results as a markdown table with insights and recommendations

**IMPORTANT:**
- Query **funnel_events** table, NOT contact date columns (deprecated Dec 2025)
- Always filter `WHERE source != 'instagram_historical'` to exclude imported historical data
- If no time range is specified, default to "last 30 days"
- If no tenant specified, default to PPCU
