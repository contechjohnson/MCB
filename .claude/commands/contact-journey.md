---
description: View the complete funnel journey for a specific contact
---

Show the complete journey for contact: $ARGUMENTS

Use the analytics-agent subagent to query the contact's full history from funnel_events:

**1. Find Contact:**
```sql
-- Search by email, name, mc_id, or ghl_id
SELECT id, first_name, last_name, email_primary, mc_id, ghl_id, stage, source, tags, created_at
FROM contacts
WHERE tenant_id = '[tenant_uuid]'
  AND (
    email_primary ILIKE '%[search_term]%'
    OR first_name ILIKE '%[search_term]%'
    OR mc_id = '[search_term]'
    OR ghl_id = '[search_term]'
  )
LIMIT 5;
```

**2. Get Full Event Timeline:**
```sql
SELECT
  event_type,
  event_timestamp,
  source,
  tags,
  event_data
FROM funnel_events
WHERE contact_id = '[contact_uuid]'
ORDER BY event_timestamp ASC;
```

**3. Get Payment History:**
```sql
SELECT
  amount,
  payment_category,
  payment_source,
  payment_date,
  status
FROM payments
WHERE contact_id = '[contact_uuid]'
ORDER BY payment_date DESC;
```

**Present Results:**
1. Contact summary (name, emails, IDs, current stage)
2. Timeline view of all events with timestamps
3. Time between stages (velocity analysis)
4. Payment history if any
5. Current tags and metadata

**IMPORTANT:**
- Use contact_id from the first query for subsequent queries
- Show all events in chronological order
- Calculate time deltas between stages
- Supabase Project ID: `succdcwblbzikenhhlrz`
