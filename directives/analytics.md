# Directive: Analytics

> Query funnel data, run performance analysis, and generate insights via slash commands.

**Status:** Active
**Script:** `.claude/agents/analytics-agent.md` (agentic) or direct SQL queries
**Related:** `webhooks.md` (data source), `weekly-reports.md` (uses analytics)

---

## Overview

Analytics is primarily agentic work - the analytics-agent translates natural language requests into SQL queries, executes them, and interprets results. Slash commands provide quick access to common analyses.

**Critical Rule:** Always filter out historical data unless explicitly analyzing total database:
```sql
WHERE source != 'instagram_historical'
```

---

## Commands

| Intent | Command | Notes |
|--------|---------|-------|
| Full funnel analysis | `/funnel ppcu last 30 days` | Stage-by-stage conversion |
| **Funnel A/B compare** | `/funnel-compare ppcu 60 days` | Jane vs Calendly side-by-side |
| Data quality check | `/data-quality ppcu` | Find missing fields, orphans |
| Source comparison | `/source-performance ppcu` | Instagram vs website |
| Recent activity | `/recent-activity ppcu 7d` | New contacts/events |
| Database health | `/db-status` | Connection, row counts |
| Weekly summary | `/weekly-report ppcu` | Generate full report |
| Custom query | Ask naturally | "Show me purchases from November" |

---

## Slash Command Details

### `/funnel [tenant] [time-range]`

Analyzes conversion at each stage:
- New Lead → DM Qualified
- DM Qualified → Call Booked
- Call Booked → Meeting Held
- Meeting Held → Purchased

**Output:**
```
Stage          | Count | Conversion
---------------|-------|----------
New Leads      | 145   | -
DM Qualified   | 89    | 61.4%
Call Booked    | 32    | 36.0%
Meeting Held   | 24    | 75.0%
Purchased      | 8     | 33.3%

Overall: 5.5% (New Lead → Purchased)
```

### `/data-quality [tenant]`

Checks for:
- Contacts missing email
- Contacts missing mc_id or ghl_id
- Payments not linked to contacts (orphans)
- Duplicate emails
- Stage inconsistencies

### `/source-performance [tenant]`

Compares metrics by source:
- Instagram (DM flow)
- Website (direct form)
- Historical (imported)

Shows: lead count, conversion rate, revenue per source

### `/recent-activity [tenant] [time]`

Lists recent:
- New contacts
- Stage changes
- Payments
- Webhook events

---

## Funnel Variant Filtering

**New (Dec 2025):** Filter by funnel variant for A/B testing:

```sql
-- Jane (paid consult) funnel only
WHERE funnel_variant = 'jane_paid'

-- Calendly (free discovery) funnel only
WHERE funnel_variant = 'calendly_free'

-- Both (for comparison)
WHERE funnel_variant IN ('jane_paid', 'calendly_free')
```

See `directives/funnel-ab-testing.md` for full documentation.

### `/funnel-compare [tenant] [time-range]`

Side-by-side comparison of funnel variants:
- Total leads per variant
- Conversion rates at each stage
- Revenue per lead
- Delta (difference) between variants

Default time range: 60 days (longer for meaningful comparison)

---

## Common Queries

### Funnel Conversion
```sql
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN dm_qualified_date IS NOT NULL THEN 1 END) as dm_qualified,
  COUNT(CASE WHEN form_submit_date IS NOT NULL THEN 1 END) as booked,
  COUNT(CASE WHEN appointment_held_date IS NOT NULL THEN 1 END) as attended,
  COUNT(CASE WHEN purchase_date IS NOT NULL THEN 1 END) as purchased
FROM contacts
WHERE tenant_id = 'tenant-uuid'
  AND source != 'instagram_historical'
  AND created_at >= NOW() - INTERVAL '30 days';
```

### Revenue by Source
```sql
SELECT
  source,
  COUNT(*) as contacts,
  SUM(purchase_amount) as revenue,
  AVG(purchase_amount) as avg_order
FROM contacts
WHERE tenant_id = 'tenant-uuid'
  AND stage = 'purchased'
GROUP BY source;
```

### Orphan Payments
```sql
SELECT
  p.id,
  p.customer_email,
  p.amount,
  p.payment_date
FROM payments p
WHERE p.tenant_id = 'tenant-uuid'
  AND p.contact_id IS NULL;
```

### MC→GHL Linkage Rate
```sql
SELECT
  COUNT(*) as total_with_mc,
  COUNT(ghl_id) as also_has_ghl,
  ROUND(100.0 * COUNT(ghl_id) / COUNT(*), 1) as linkage_pct
FROM contacts
WHERE tenant_id = 'tenant-uuid'
  AND mc_id IS NOT NULL;
```

### Top Performing Ads
```sql
SELECT
  ma.ad_name,
  ma.spend,
  COUNT(c.id) as leads,
  SUM(c.purchase_amount) as revenue,
  ROUND(SUM(c.purchase_amount) / NULLIF(ma.spend, 0), 2) as roas
FROM meta_ads ma
LEFT JOIN contacts c ON c.ad_id = ma.ad_id AND c.tenant_id = ma.tenant_id
WHERE ma.tenant_id = 'tenant-uuid'
GROUP BY ma.ad_id, ma.ad_name, ma.spend
ORDER BY revenue DESC NULLS LAST
LIMIT 10;
```

### Funnel Variant Comparison
```sql
SELECT
  funnel_variant,
  COUNT(*) as total_leads,
  COUNT(CASE WHEN form_submit_date IS NOT NULL THEN 1 END) as form_submitted,
  COUNT(CASE WHEN appointment_held_date IS NOT NULL THEN 1 END) as meeting_held,
  COUNT(CASE WHEN purchase_date IS NOT NULL THEN 1 END) as purchased,
  ROUND(100.0 * COUNT(CASE WHEN purchase_date IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 1) as conversion_pct,
  SUM(COALESCE(purchase_amount, 0)) as revenue
FROM contacts
WHERE tenant_id = 'tenant-uuid'
  AND source != 'instagram_historical'
  AND funnel_variant IN ('jane_paid', 'calendly_free')
  AND created_at >= NOW() - INTERVAL '60 days'
GROUP BY funnel_variant;
```

---

## Historical Data Filter

**Why:** 537 contacts imported from Airtable have `source = 'instagram_historical'`. This data is lower quality and pollutes go-forward analytics.

**Rule:** Always add this filter:
```sql
WHERE source != 'instagram_historical'
```

**Exceptions:**
- Total revenue tracking (include all purchases)
- Total database size
- When explicitly asked to include historical

**Auto-upgrade:** When historical contacts engage (click link, book call), webhooks overwrite their source to `'instagram'` or `'website'`.

---

## Multi-Tenant Queries

All queries must include `tenant_id`:

```sql
-- WRONG: Returns all tenants
SELECT * FROM contacts WHERE stage = 'purchased';

-- CORRECT: Scoped to tenant
SELECT * FROM contacts
WHERE tenant_id = 'tenant-uuid'
  AND stage = 'purchased';
```

For cross-tenant admin views:
```sql
SELECT
  t.name as tenant,
  COUNT(*) as contacts
FROM contacts c
JOIN tenants t ON c.tenant_id = t.id
GROUP BY t.id, t.name;
```

---

## Analytics Agent

The `analytics-agent` handles natural language queries:

```
User: "Show me conversion rates for last week"

Agent:
1. Determines time range (last 7 days)
2. Identifies metrics needed (funnel stages)
3. Generates SQL query
4. Executes via Supabase MCP
5. Formats results as markdown table
6. Adds interpretation
```

**Agent File:** `.claude/agents/analytics-agent.md`

---

## Performance Benchmarks

Typical healthy metrics for social media funnels:

| Metric | Target | Warning |
|--------|--------|---------|
| Lead → DM Qualified | >60% | <40% |
| DM Qualified → Booked | >30% | <20% |
| Booked → Attended | >70% | <50% |
| Attended → Purchased | >30% | <15% |
| Overall Lead → Purchase | >5% | <2% |
| MC→GHL Linkage | >90% | <50% |
| Orphan Payment Rate | <5% | >20% |

---

## Edge Cases

| Scenario | Symptom | Handling |
|----------|---------|----------|
| No data in time range | Empty results | Return "No data for selected period" |
| Tenant not found | Query fails | Check tenant slug is correct |
| Duplicate emails | Inflated counts | Use DISTINCT or GROUP BY |
| NULL stage | Uncategorized contacts | Default to 'new_lead' |

---

## Troubleshooting

### Query Returns Wrong Numbers
**Symptom:** Dashboard numbers don't match
**Causes:**
1. Missing historical filter
2. Wrong date range
3. Different tenant

**Fix:** Verify filters:
```sql
WHERE tenant_id = 'correct-uuid'
  AND source != 'instagram_historical'
  AND created_at >= 'correct-start-date'
```

### Slow Queries
**Symptom:** Queries take >5 seconds
**Cause:** Missing indexes or large table scans
**Fix:** Add indexes on frequently filtered columns:
```sql
CREATE INDEX idx_contacts_tenant_created ON contacts(tenant_id, created_at);
CREATE INDEX idx_contacts_tenant_stage ON contacts(tenant_id, stage);
```

---

## Self-Annealing Log

| Date | Issue | Resolution |
|------|-------|------------|
| 2025-11-08 | Funnel showing inflated numbers | Added `source != 'instagram_historical'` filter |
| 2025-11-13 | MC→GHL linkage showing 100% | Bug: was counting NULLs wrong. Fixed query logic |

### Detailed Learnings

**Date Handling:**
When users say "last 30 days", they usually mean "last 30 days from today", not a calendar month. Use:
```sql
created_at >= NOW() - INTERVAL '30 days'
```

Not:
```sql
created_at >= DATE_TRUNC('month', NOW())
```

---

## Related Directives

- `webhooks.md` - Source of analytics data
- `weekly-reports.md` - Uses these queries
- `meta-ads-sync.md` - Ad performance queries
- `historical-data.md` - Filter rules
