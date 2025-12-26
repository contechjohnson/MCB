---
description: Run comprehensive data quality checks on contacts database
---

Run a comprehensive data quality check for $ARGUMENTS.

Use the analytics-agent subagent to run these checks:

**1. Missing Critical Fields:**
```sql
SELECT
  'Missing email' as issue,
  COUNT(*) as count
FROM contacts
WHERE tenant_id = '[tenant_uuid]'
  AND source != 'instagram_historical'
  AND email_primary IS NULL
UNION ALL
SELECT
  'Missing mc_id AND ghl_id' as issue,
  COUNT(*) as count
FROM contacts
WHERE tenant_id = '[tenant_uuid]'
  AND source != 'instagram_historical'
  AND mc_id IS NULL AND ghl_id IS NULL;
```

**2. Linkage Rates:**
```sql
SELECT
  COUNT(*) as total_contacts,
  COUNT(mc_id) as has_mc_id,
  COUNT(ghl_id) as has_ghl_id,
  COUNT(CASE WHEN mc_id IS NOT NULL AND ghl_id IS NOT NULL THEN 1 END) as fully_linked,
  ROUND(100.0 * COUNT(CASE WHEN mc_id IS NOT NULL AND ghl_id IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 1) as linkage_pct
FROM contacts
WHERE tenant_id = '[tenant_uuid]'
  AND source != 'instagram_historical';
```

**3. Orphan Payments:**
```sql
SELECT
  COUNT(*) as total_payments,
  COUNT(contact_id) as linked,
  COUNT(*) - COUNT(contact_id) as orphaned,
  SUM(CASE WHEN contact_id IS NULL THEN amount ELSE 0 END) as orphan_revenue
FROM payments
WHERE tenant_id = '[tenant_uuid]';
```

**4. Duplicate Emails:**
```sql
SELECT
  email_primary,
  COUNT(*) as duplicates
FROM contacts
WHERE tenant_id = '[tenant_uuid]'
  AND source != 'instagram_historical'
  AND email_primary IS NOT NULL
GROUP BY email_primary
HAVING COUNT(*) > 1
LIMIT 10;
```

**5. Stage Distribution:**
```sql
SELECT
  stage,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as pct
FROM contacts
WHERE tenant_id = '[tenant_uuid]'
  AND source != 'instagram_historical'
GROUP BY stage
ORDER BY count DESC;
```

**6. Events Without Contacts:**
```sql
SELECT
  COUNT(*) as orphan_events
FROM funnel_events fe
LEFT JOIN contacts c ON fe.contact_id = c.id
WHERE fe.tenant_id = '[tenant_uuid]'
  AND c.id IS NULL;
```

**7. Webhook Error Rate:**
```sql
SELECT
  source,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'error' THEN 1 END) as errors,
  ROUND(100.0 * COUNT(CASE WHEN status = 'error' THEN 1 END) / NULLIF(COUNT(*), 0), 1) as error_rate
FROM webhook_logs
WHERE tenant_id = '[tenant_uuid]'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY source;
```

**Present Results:**

| Category | Issue | Count | Severity |
|----------|-------|-------|----------|
| Identity | Missing email | X | Warning |
| Linkage | MC→GHL linkage | X% | Info |
| Revenue | Orphan payments | X ($XXX) | Critical |
| Data | Duplicate emails | X | Warning |
| Webhooks | Error rate | X% | Info |

Plus sample records for each issue and recommended fixes.

**IMPORTANT:**
- Always filter `WHERE source != 'instagram_historical'`
- Default tenant: PPCU if not specified
- Supabase Project ID: `succdcwblbzikenhhlrz`
