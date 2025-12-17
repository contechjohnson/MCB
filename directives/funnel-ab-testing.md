# Funnel A/B Testing

## Overview

This system tracks and compares different acquisition funnels to determine which performs better. Currently testing:

- **jane_paid** - Original funnel: Instagram DM → ManyChat → Jane paid consult
- **calendly_free** - New funnel: Instagram Ad → Perspective.co → Calendly free discovery call

## Database Schema

### `funnel_variant` Column

Added to the `contacts` table:

```sql
ALTER TABLE contacts ADD COLUMN funnel_variant TEXT;
```

**Values:**
- `jane_paid` - Default for contacts entering via ManyChat/DM flow
- `calendly_free` - For contacts entering via Perspective.co discovery funnel
- `NULL` - Historical data (pre-December 2025) or instagram_historical imports

### Index for Analytics

```sql
CREATE INDEX idx_contacts_funnel_variant
ON contacts(tenant_id, funnel_variant, created_at DESC);
```

## Data Flow

### Jane (Paid) Funnel
```
Instagram DM → ManyChat webhook → contact created (funnel_variant='jane_paid')
    ↓
GHL "Lead Qualified from CLARA" pipeline → contact updated (stage changes)
    ↓
Stripe/Denefits webhook → purchase recorded
```

### Calendly (Free) Funnel
```
Instagram Ad → "PPCU V1 SALES FUNNEL" in Perspective.co → contact created (funnel_variant='calendly_free')
    ↓
GHL "FREE DISCOVERY CALL PIPELINE" webhook:
  - "DC BOOKED" stage → stage='meeting_booked'
  - "Completed DC" stage → stage='meeting_held' (first time only, not overwritten)
  - "NO SHOW" stage → skipped entirely
    ↓
Stripe/Denefits webhook → purchase recorded (matched by email)
```

## Webhook Behavior

### Perspective Webhook (`/api/webhooks/[tenant]/perspective`)

Detects funnel type from `funnelName`:
- **Discovery funnel** (funnelName contains "discovery" or "calendly"): Creates new contact with `funnel_variant='calendly_free'`, `source='instagram_direct'`
- **Checkout funnel** (funnelName contains "checkout"): Updates existing contact's `checkout_started` timestamp

### GHL Webhook (`/api/webhooks/[tenant]/ghl`)

- If contact exists (by GHL ID, MC ID, or email): Links `ghl_id`, **preserves existing `funnel_variant`**
- If contact doesn't exist: Creates with `funnel_variant='jane_paid'` (assumed DM flow)

## Query Patterns

### Filter by Variant

```sql
-- Jane (paid) funnel only
SELECT * FROM contacts
WHERE tenant_id = 'uuid'
  AND source != 'instagram_historical'
  AND funnel_variant = 'jane_paid';

-- Calendly (free) funnel only
SELECT * FROM contacts
WHERE tenant_id = 'uuid'
  AND source != 'instagram_historical'
  AND funnel_variant = 'calendly_free';
```

### Compare Variants

```sql
SELECT
  funnel_variant,
  COUNT(*) as total,
  COUNT(CASE WHEN form_submit_date IS NOT NULL THEN 1 END) as form_submitted,
  COUNT(CASE WHEN appointment_held_date IS NOT NULL THEN 1 END) as meeting_held,
  COUNT(CASE WHEN purchase_date IS NOT NULL THEN 1 END) as purchased,
  SUM(COALESCE(purchase_amount, 0)) as revenue
FROM contacts
WHERE tenant_id = 'uuid'
  AND source != 'instagram_historical'
  AND funnel_variant IN ('jane_paid', 'calendly_free')
  AND created_at >= NOW() - INTERVAL '60 days'
GROUP BY funnel_variant;
```

### Conversion Rate Comparison

```sql
SELECT
  funnel_variant,
  COUNT(*) as leads,
  ROUND(100.0 * COUNT(CASE WHEN purchase_date IS NOT NULL THEN 1 END) / NULLIF(COUNT(*), 0), 1) as conversion_rate,
  ROUND(SUM(COALESCE(purchase_amount, 0)) / NULLIF(COUNT(*), 0), 0) as revenue_per_lead
FROM contacts
WHERE tenant_id = 'uuid'
  AND source != 'instagram_historical'
  AND funnel_variant IN ('jane_paid', 'calendly_free')
  AND created_at >= NOW() - INTERVAL '60 days'
GROUP BY funnel_variant;
```

## Slash Commands

- `/funnel [tenant] [time]` - Standard funnel analysis (all variants combined)
- `/funnel-compare [tenant] [time]` - Side-by-side comparison of variants

## Adding New Variants

To add a new funnel variant:

1. **Define the value** - e.g., `jane_free` for Jane with free consults
2. **Update entry point webhook** - Set `funnel_variant` at contact creation
3. **Document in this file**
4. **Update `/funnel-compare` command** if needed

## User Setup Requirements

### For Perspective.co Discovery Funnel

1. Create new funnel in Perspective (name must contain "discovery" or "calendly")
2. Add hidden field `ad_id` that captures URL parameter from Meta ads
3. Configure webhook to: `https://mcb-dun.vercel.app/api/webhooks/ppcu/perspective`

### For GHL Pipeline

1. Set up webhook triggers for "discovery call booked" and "completed" stages
2. Point to: `https://mcb-dun.vercel.app/api/webhooks/ppcu/ghl`
3. Include `pipeline_stage` in custom data

## Testing Duration

Recommended: **60-90 days** minimum for statistically meaningful comparison.

With current lead volume (~100-150/month), expect to need:
- 60 days for directional insights
- 90 days for confident conclusions
- Consider sample size when interpreting results

## Self-Annealing Log

| Date | Issue | Resolution |
|------|-------|------------|
| 2025-12-18 | Initial implementation | Created funnel_variant column, updated Perspective/GHL webhooks |
