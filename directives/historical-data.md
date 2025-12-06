# Directive: Historical Data

> Rules for handling imported historical data to prevent analytics pollution.

**Status:** Active
**Script:** N/A (filtering rules applied in queries)
**Related:** `analytics.md`, `webhooks.md`

---

## Overview

We imported 537 contacts from Airtable with `source = 'instagram_historical'`. This data is lower quality than live webhook data and must be filtered out of go-forward analytics. However, webhooks automatically "graduate" historical contacts when they engage.

---

## The Rule

### Default: Exclude Historical Data

**In ALL analytics queries:**
```sql
WHERE source != 'instagram_historical'
```

### Exceptions

Include historical when:
1. **Total revenue tracking** - Count all purchases
2. **Total database size** - Count all contacts
3. **Explicitly requested** - User asks for "including historical"

---

## Why This Matters

| Issue | Impact |
|-------|--------|
| Lower data quality | Missing fields, incomplete attribution |
| Inflates metrics | Artificially high lead counts |
| Distorts conversion rates | Historical contacts may not follow funnel |
| Pollutes source analysis | All show as "instagram" even if originally different |

---

## Auto-Graduation

When historical contacts engage, webhooks overwrite their source:

| Event | New Source |
|-------|------------|
| ManyChat webhook (any event) | `'instagram'` |
| GHL form submission | `'instagram'` or `'website'` |
| Stripe payment | Source unchanged (payment recorded) |

**Result:** Engaged historical contacts become "live" contacts and ARE included in analytics.

---

## Webhook Implementation

### ManyChat Webhook
```typescript
// If contact had 'instagram_historical', overwrite with live source
source: customFields.source || 'instagram'
```

### GHL Webhook
```typescript
// Infer source from attribution data
source: customData.source ||
  ((customData.MC_ID || customData.AD_ID) ? 'instagram' : 'website')
```

---

## Identifying Historical Data

### Count Historical Contacts
```sql
SELECT COUNT(*) FROM contacts
WHERE source = 'instagram_historical';
-- Result: 537
```

### Compare Historical vs Live
```sql
SELECT
  CASE WHEN source = 'instagram_historical' THEN 'Historical' ELSE 'Live' END as type,
  COUNT(*) as count
FROM contacts
GROUP BY 1;
```

### Historical That Engaged (Graduated)
```sql
-- These started as historical but now have live data
SELECT * FROM contacts
WHERE source != 'instagram_historical'
  AND subscribed < '2025-11-01'  -- Subscribed before go-live
ORDER BY link_click_date DESC;
```

---

## Query Patterns

### Standard Analytics Query
```sql
SELECT
  stage,
  COUNT(*)
FROM contacts
WHERE tenant_id = 'tenant-uuid'
  AND source != 'instagram_historical'  -- ALWAYS include
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY stage;
```

### Total Revenue (Include Historical)
```sql
-- Exception: Total revenue includes everyone
SELECT SUM(purchase_amount)
FROM contacts
WHERE tenant_id = 'tenant-uuid'
  AND stage = 'purchased';
-- Note: NO historical filter - we want all revenue
```

### Database Growth (Include Historical)
```sql
-- Exception: Total size includes everyone
SELECT
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as new_contacts
FROM contacts
WHERE tenant_id = 'tenant-uuid'
GROUP BY 1
ORDER BY 1;
```

---

## Analytics Agent Instructions

The `analytics-agent` is configured to automatically add the filter:

```markdown
**Critical:** Unless the user explicitly asks for "historical" or "all contacts",
always add: WHERE source != 'instagram_historical'
```

---

## PPCU-Specific Data

Historical data belongs to PPCU tenant only:

| Field | PPCU Historical | Other Tenants |
|-------|-----------------|---------------|
| source | `'instagram_historical'` | N/A |
| Count | 537 | 0 |
| Quality | Lower | N/A |

New tenants start fresh with no historical burden.

---

## Self-Annealing Log

| Date | Issue | Resolution |
|------|-------|------------|
| 2025-11-08 | Funnel showing inflated leads | Added filter to all slash commands |
| 2025-11-13 | Weekly report included historical | Updated report queries |

---

## Related Directives

- `analytics.md` - Query patterns with filtering
- `webhooks.md` - Auto-graduation logic
- `multi-tenancy.md` - Historical is PPCU-only
