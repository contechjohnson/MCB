# Historical Data Filter Rule

**Last Updated:** November 8, 2025

---

## The Problem

We imported 537 contacts from Airtable with `source = 'instagram_historical'`. This data is:
- Lower quality than live webhook data
- Pollutes go-forward analytics
- BUT still valuable for tracking FUTURE events (purchases, bookings)

---

## The Solution

### 1. Filter Out Historical Data by Default

**In ALL queries, reports, and analytics:**
```sql
WHERE source != 'instagram_historical'
```

**Examples:**

```sql
-- Funnel analysis (exclude historical)
SELECT stage, COUNT(*)
FROM contacts
WHERE source != 'instagram_historical'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY stage;

-- Conversion rate (exclude historical)
SELECT
  COUNT(*) FILTER (WHERE stage = 'purchased') as purchases,
  COUNT(*) as total
FROM contacts
WHERE source != 'instagram_historical';

-- Recent activity (exclude historical)
SELECT * FROM contacts
WHERE source != 'instagram_historical'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### 2. Webhooks Overwrite Historical Source

**When a webhook fires for a historical contact, it overwrites the source:**

- **ManyChat webhook:** Sets `source = 'instagram'` (or from custom field)
- **GHL webhook:** Sets `source = 'instagram'` or `'website'` based on attribution
- **Stripe/Denefits:** Don't change source (payment webhooks)

**Result:**
- Historical contact gets link click → source changes to `'instagram'`
- Historical contact books call → source changes to `'instagram'` or `'website'`
- Historical contact purchases → source stays historical (purchase captured, but still excluded from future analytics)

**Why this works:**
- New events = fresh data = should be included in analytics
- Contact "graduates" from historical to live when they engage
- Purchase data still captured for revenue tracking

---

## Implementation

### Webhook Changes (Done)

✅ **ManyChat** (`/api/manychat/route.ts:260`)
```typescript
// Source: Use custom field if provided, otherwise default to instagram
// IMPORTANT: If contact had 'instagram_historical', overwrite it with new live source
source: customFields.source || customFields.Source || 'instagram'
```

✅ **GHL** (`/api/ghl-webhook/route.ts:251`)
```typescript
// Source logic: Use explicit source if provided, otherwise infer from MC_ID/AD_ID
// IMPORTANT: This overwrites 'instagram_historical' with live source when new events occur
source: customData.source || ((customData.MC_ID || customFields.MC_ID || customData.AD_ID || customFields.AD_ID) ? 'instagram' : 'website')
```

✅ **Stripe/Denefits** - No changes needed (don't set source)

### Query Patterns

**Default filter:**
```sql
WHERE source != 'instagram_historical'
```

**Include historical only when needed:**
```sql
-- Revenue tracking (include all purchases)
SELECT SUM(purchase_amount)
FROM contacts
WHERE stage = 'purchased'
-- No source filter - include historical purchases

-- Total database size
SELECT COUNT(*) FROM contacts
-- No source filter - include everyone
```

---

## Slash Commands Updated

All slash commands now filter out historical by default:

- `/funnel` - Excludes historical
- `/source-performance` - Excludes historical
- `/recent-activity` - Excludes historical
- `/data-quality` - Excludes historical
- `/weekly-report` - Excludes historical

---

## Analytics Agent Instructions

The `analytics-agent` is configured to filter out historical by default in all queries. See `.claude/agents/analytics-agent.md` for examples.

---

## Summary

**Rule:** Exclude `instagram_historical` from all analytics by default.

**Exception:** Revenue tracking where you want total $ (include all purchases).

**Auto-cleanup:** Webhooks automatically upgrade historical contacts to live sources when they engage.
