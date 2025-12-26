---
description: Debug webhook issues by querying webhook_logs table
---

Debug webhook issues for $ARGUMENTS.

Use the analytics-agent subagent to query webhook_logs:

**1. Recent Webhook Activity:**
```sql
SELECT
  source,
  event_type,
  status,
  COUNT(*) as count
FROM webhook_logs
WHERE tenant_id = '[tenant_uuid]'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY source, event_type, status
ORDER BY count DESC;
```

**2. Failed Webhooks:**
```sql
SELECT
  id,
  source,
  event_type,
  error_message,
  mc_id,
  ghl_id,
  created_at
FROM webhook_logs
WHERE tenant_id = '[tenant_uuid]'
  AND status = 'error'
  AND created_at >= NOW() - INTERVAL '[time_range]'
ORDER BY created_at DESC
LIMIT 20;
```

**3. Specific Webhook Payload:**
```sql
SELECT
  id,
  source,
  event_type,
  payload,
  contact_id,
  status,
  error_message,
  created_at
FROM webhook_logs
WHERE tenant_id = '[tenant_uuid]'
  AND (
    mc_id = '[search_term]'
    OR ghl_id = '[search_term]'
    OR id::text = '[search_term]'
  )
ORDER BY created_at DESC
LIMIT 5;
```

**4. Webhook Volume by Hour:**
```sql
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  source,
  COUNT(*) as webhooks
FROM webhook_logs
WHERE tenant_id = '[tenant_uuid]'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), source
ORDER BY hour DESC;
```

**5. Check Contact Linking:**
```sql
SELECT
  source,
  COUNT(*) as total,
  COUNT(contact_id) as linked,
  COUNT(*) - COUNT(contact_id) as unlinked,
  ROUND(100.0 * COUNT(contact_id) / NULLIF(COUNT(*), 0), 1) as link_rate
FROM webhook_logs
WHERE tenant_id = '[tenant_uuid]'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY source;
```

**Present Results:**
1. Summary of webhook activity by source and status
2. List of any errors with error messages
3. Linking rate by source
4. If searching specific webhook, show full payload

**IMPORTANT:**
- Webhook sources: manychat, ghl, stripe, denefits, perspective
- Status values: received, processed, error, skipped
- Default time range: 24 hours if not specified
- Supabase Project ID: `succdcwblbzikenhhlrz`
