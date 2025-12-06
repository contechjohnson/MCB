# Directive: Meta Ads Sync

> Fetch ad performance and creative data from Meta Ads API and store for ROAS analysis.

**Status:** Active
**Script:** `execution/sync-meta-ads.js` or `app/api/cron/sync-meta-ads/route.ts`
**Related:** `webhooks.md` (ad_id attribution), `analytics.md` (ROAS queries)

---

## Overview

Meta Ads sync pulls performance metrics and creative content from the Meta Graph API. We maintain TWO different data sets:
1. **Lifetime metrics** (cumulative all-time) → `meta_ads` table
2. **Weekly metrics** (last 7 days) → `meta_ad_insights` table

This separation enables both overall ROAS calculation and week-over-week trend analysis.

---

## Commands

| Intent | Command | Notes |
|--------|---------|-------|
| Manual sync | `node execution/sync-meta-ads.js` | Syncs all tenants |
| Dry run (preview) | `node execution/sync-meta-ads.js --dry-run` | Shows what would sync |
| Check last sync | `SELECT MAX(last_synced) FROM meta_ads` | Per-tenant |
| View ad performance | `/funnel ppcu` includes ad data | Or query directly |

---

## Process

### Step 1: Fetch Active Ads
- Query Meta API for ads with `effective_status = 'ACTIVE'`
- Only syncs currently running ads
- Script: `execution/sync-meta-ads.js`

### Step 2: Fetch Lifetime Performance
- API call with `date_preset=maximum` (all-time cumulative)
- Metrics: spend, impressions, clicks, reach, leads, CTR, CPC
- Stored in `meta_ads` table

### Step 3: Fetch Weekly Performance
- API call with `date_preset=last_7d`
- Same metrics but for last 7 days only
- Stored in `meta_ad_insights` with `snapshot_date`

### Step 4: Fetch Creative Content
- Pulls primary_text, headline from ad creative
- Auto-detects transformation theme (confusion→clarity, etc.)
- Auto-detects symptom focus (diastasis, pelvic_floor, etc.)
- Stored in `meta_ad_creatives` table

---

## Database Tables

### `meta_ads` (Lifetime Performance)
```sql
ad_id TEXT UNIQUE,          -- Meta's ad ID
ad_name TEXT,               -- Human-readable name
spend NUMERIC,              -- LIFETIME total spend
impressions INTEGER,        -- LIFETIME impressions
clicks INTEGER,             -- LIFETIME clicks
leads INTEGER,              -- LIFETIME leads
ctr NUMERIC,                -- Click-through rate
cpc NUMERIC,                -- Cost per click
last_synced TIMESTAMPTZ,    -- When this row was updated
tenant_id UUID              -- Multi-tenant FK
```

### `meta_ad_insights` (Weekly Snapshots)
```sql
ad_id TEXT,                 -- FK to meta_ads
snapshot_date DATE,         -- Date of this snapshot
spend NUMERIC,              -- LAST 7 DAYS spend
impressions INTEGER,        -- LAST 7 DAYS impressions
clicks INTEGER,             -- LAST 7 DAYS clicks
leads INTEGER,              -- LAST 7 DAYS leads
tenant_id UUID              -- Multi-tenant FK
UNIQUE(tenant_id, ad_id, snapshot_date)
```

### `meta_ad_creatives` (Creative Analysis)
```sql
ad_id TEXT UNIQUE,          -- FK to meta_ads
primary_text TEXT,          -- Ad copy
headline TEXT,              -- Ad headline
transformation_theme TEXT,  -- Auto-detected: 'confusion_to_clarity', etc.
symptom_focus TEXT[],       -- Auto-detected: ['diastasis', 'pelvic_floor']
media_type TEXT,            -- 'video' or 'image'
tenant_id UUID              -- Multi-tenant FK
```

---

## ROAS Calculations

### Lifetime ROAS (All-Time)
```sql
SELECT
  SUM(c.purchase_amount) as revenue,
  SUM(ma.spend) as spend,
  SUM(c.purchase_amount) / NULLIF(SUM(ma.spend), 0) as roas
FROM contacts c
JOIN meta_ads ma ON c.ad_id = ma.ad_id
WHERE c.tenant_id = 'tenant-uuid'
  AND c.stage = 'purchased';
```

### Weekly ROAS (Last 7 Days)
```sql
SELECT
  SUM(c.purchase_amount) as weekly_revenue,
  SUM(mi.spend) as weekly_spend,
  SUM(c.purchase_amount) / NULLIF(SUM(mi.spend), 0) as weekly_roas
FROM contacts c
JOIN meta_ad_insights mi ON c.ad_id = mi.ad_id
WHERE c.tenant_id = 'tenant-uuid'
  AND c.purchase_date >= CURRENT_DATE - INTERVAL '7 days'
  AND mi.snapshot_date = CURRENT_DATE;
```

### Best Performing Ad (This Week)
```sql
SELECT
  ma.ad_name,
  mi.spend as weekly_spend,
  mi.clicks,
  ROUND((mi.clicks::numeric / NULLIF(mi.impressions, 0)) * 100, 2) as ctr
FROM meta_ad_insights mi
JOIN meta_ads ma ON mi.ad_id = ma.ad_id
WHERE mi.tenant_id = 'tenant-uuid'
  AND mi.snapshot_date = CURRENT_DATE
ORDER BY mi.spend DESC
LIMIT 1;
```

---

## Configuration

### Environment Variables
```bash
# Required
META_ACCESS_TOKEN=your_long_lived_token
META_AD_ACCOUNT_ID=act_199993829749361

# Optional
META_API_VERSION=v20.0  # Default
```

### Multi-Tenant Configuration
For multi-tenant, credentials are stored in `tenant_integrations` table:
```sql
SELECT credentials->>'access_token', credentials->>'ad_account_id'
FROM tenant_integrations
WHERE tenant_id = 'tenant-uuid' AND provider = 'meta';
```

---

## Cron Schedule

**Daily at 6:00 AM UTC** via Vercel cron

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/sync-meta-ads",
    "schedule": "0 6 * * *"
  }]
}
```

---

## Transformation Themes (Auto-Detected)

The sync script analyzes ad copy to detect emotional transformation themes:

| Theme | Keywords |
|-------|----------|
| `confusion_to_clarity` | confusion, clarity, understand, makes sense |
| `overwhelm_to_relief` | overwhelm, relief, stress, calm, easier |
| `pain_to_comfort` | pain, hurt, relief, healed, pain-free |
| `isolation_to_community` | alone, isolated, community, support |
| `shame_to_confidence` | shame, embarrassed, confident, empowered |
| `fear_to_hope` | fear, scared, hope, possible |

---

## Symptom Focus (Auto-Detected)

| Symptom | Keywords |
|---------|----------|
| `diastasis` | diastasis, diastasis recti, ab separation |
| `pelvic_floor` | pelvic, pelvic floor, kegel |
| `low_milk` | milk supply, breastfeeding, lactation |
| `back_pain` | back pain, lower back |
| `incontinence` | leak, incontinence, bladder |

---

## Edge Cases

| Scenario | Symptom | Handling |
|----------|---------|----------|
| Token expired | API returns 401 | Script fails with error. Regenerate token in Meta Business Manager |
| No active ads | Empty response | Script completes with 0 ads synced |
| Rate limited | API returns 429 | Script should implement backoff (currently fails) |
| New ad created mid-day | Won't sync until next run | Manual sync: `node execution/sync-meta-ads.js` |

---

## Troubleshooting

### Token Expired
**Symptom:** `OAuthException: Error validating access token`
**Cause:** Meta access tokens expire after ~60 days
**Fix:**
1. Go to Meta Business Manager → Business Settings → System Users
2. Generate new long-lived token
3. Update `META_ACCESS_TOKEN` in `.env.local` (or `tenant_integrations` for multi-tenant)

### Missing Ad Data
**Symptom:** Ad exists in Meta but not in database
**Cause:** Ad status isn't 'ACTIVE', or sync failed
**Fix:**
```bash
# Check if ad is active in Meta Ads Manager
# Then run manual sync
node execution/sync-meta-ads.js
```

### Spend Discrepancy
**Symptom:** `meta_ads.spend` doesn't match Meta dashboard
**Cause:** Likely comparing lifetime vs. date-range
**Fix:** Remember:
- `meta_ads.spend` = ALL-TIME cumulative
- `meta_ad_insights.spend` = last 7 days only

---

## Self-Annealing Log

| Date | Issue | Resolution |
|------|-------|------------|
| 2025-11-06 | Weekly spend showing lifetime values | Fixed: Was using `date_preset=maximum` for insights. Changed to `date_preset=last_7d` |
| 2025-11-07 | Creative themes all showing 'general' | Fixed: Case sensitivity in keyword matching. Added `.toLowerCase()` |

### Detailed Learnings

**Two-Table Architecture:**
The separation between `meta_ads` (lifetime) and `meta_ad_insights` (weekly) is intentional:
- Lifetime: For overall campaign ROI and total spend tracking
- Weekly: For trend analysis, week-over-week comparisons, and current performance

Never mix these in ROAS calculations. If comparing revenue from "last 7 days", use `meta_ad_insights`, not `meta_ads`.

---

## Related Directives

- `webhooks.md` - `ad_id` captured by ManyChat webhook
- `analytics.md` - ROAS queries and performance analysis
- `weekly-reports.md` - Ad performance included in reports
