---
description: Display recent database activity and new contacts
---

Show recent activity for $ARGUMENTS.

Use the analytics-agent subagent to query recent funnel events (events-first architecture):

**Recent Events Query:**
```sql
SELECT
  fe.event_type,
  fe.event_timestamp,
  fe.source,
  c.first_name,
  c.email_primary,
  c.stage,
  fe.tags
FROM funnel_events fe
JOIN contacts c ON fe.contact_id = c.id
WHERE fe.tenant_id = '[tenant_uuid]'
  AND fe.event_timestamp >= NOW() - INTERVAL '[time_range]'
ORDER BY fe.event_timestamp DESC
LIMIT 25;
```

**New Contacts Query:**
```sql
SELECT
  first_name,
  email_primary,
  stage,
  source,
  tags->>'chatbot' as chatbot_variant,
  tags->>'funnel' as funnel_name,
  created_at
FROM contacts
WHERE tenant_id = '[tenant_uuid]'
  AND created_at >= NOW() - INTERVAL '[time_range]'
  AND source != 'instagram_historical'
ORDER BY created_at DESC
LIMIT 20;
```

**Recent Payments Query:**
```sql
SELECT
  c.first_name,
  c.email_primary,
  p.amount,
  p.payment_category,
  p.payment_source,
  p.payment_date
FROM payments p
LEFT JOIN contacts c ON p.contact_id = c.id
WHERE p.tenant_id = '[tenant_uuid]'
  AND p.payment_date >= NOW() - INTERVAL '[time_range]'
ORDER BY p.payment_date DESC
LIMIT 10;
```

**Present Results:**
1. Summary of activity counts by event type
2. List of new contacts with key details
3. List of recent payments
4. Any orphan payments (contact_id IS NULL)

**IMPORTANT:**
- Query funnel_events table (events-first architecture)
- Always filter `WHERE source != 'instagram_historical'` to exclude imported data
- Default time range: 7 days if not specified
- Default tenant: PPCU if not specified
- Supabase Project ID: `succdcwblbzikenhhlrz`
