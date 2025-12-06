# Multi-Tenancy Directive

**Purpose:** Complete guide to MCB's multi-tenant architecture.
**Scope:** All tenant operations, onboarding, configuration, and isolation.
**Last Updated:** December 2025

---

## Overview

MCB supports multiple tenants (clients) on a shared database with complete data isolation. Each tenant has:

- **Separate accounts** for ManyChat, GoHighLevel, Stripe, Meta Ads
- **Isolated data** via `tenant_id` on all tables
- **Per-tenant credentials** stored in `tenant_integrations`
- **URL-based routing** for webhooks: `/api/webhooks/[tenant]/[source]`

---

## Architecture

### Database Schema

```
tenants
├── id (UUID)
├── slug (TEXT, UNIQUE) - 'ppcu', 'centner', 'columnline'
├── name (TEXT) - 'Postpartum Care USA'
├── owner_name (TEXT) - For report greetings
├── report_email (TEXT) - Weekly report destination
├── config (JSONB) - Flexible settings
└── is_active (BOOLEAN)

tenant_integrations
├── id (UUID)
├── tenant_id (FK → tenants)
├── provider (TEXT) - 'manychat', 'ghl', 'stripe', 'meta'
├── credentials (JSONB) - API keys, tokens
├── webhook_secret (TEXT) - Signature verification
└── is_active (BOOLEAN)
```

### Data Isolation

All data tables include `tenant_id`:
- `contacts` - tenant_id NOT NULL
- `payments` - tenant_id NOT NULL
- `webhook_logs` - tenant_id (nullable for legacy)
- `meta_ads` - tenant_id
- `meta_ad_creatives` - tenant_id
- `meta_ad_insights` - tenant_id

**Unique Constraints:**
```sql
-- mc_id is unique WITHIN a tenant
UNIQUE(tenant_id, mc_id)

-- ghl_id is unique WITHIN a tenant
UNIQUE(tenant_id, ghl_id)

-- payment_event_id is unique WITHIN a tenant
UNIQUE(tenant_id, payment_event_id)
```

---

## Webhook Routing

### URL Structure

```
POST /api/webhooks/[tenant]/manychat
POST /api/webhooks/[tenant]/ghl
POST /api/webhooks/[tenant]/stripe
POST /api/webhooks/[tenant]/denefits
POST /api/webhooks/[tenant]/perspective
```

### Examples

- `POST /api/webhooks/ppcu/manychat` → PPCU ManyChat events
- `POST /api/webhooks/centner/stripe` → Centner Stripe payments
- `POST /api/webhooks/columnline/ghl` → Columnline GHL bookings

### Tenant Context

All webhooks use `getTenantContext(slug)` to:
1. Validate tenant exists and is active
2. Fetch tenant configuration
3. Load per-tenant credentials
4. Scope all queries to `tenant_id`

```typescript
const tenant = await getTenantContext('ppcu');
// tenant.id - UUID for queries
// tenant.credentials.stripe.secret_key - Per-tenant Stripe key
// tenant.credentials.manychat.api_key - Per-tenant ManyChat key
```

---

## Adding a New Tenant

### Step 1: Create Tenant Record

```sql
INSERT INTO tenants (slug, name, owner_name, report_email, config)
VALUES (
  'acme',
  'Acme Health',
  'Jane',
  'jane@acmehealth.com',
  '{"timezone": "America/New_York"}'
);
```

### Step 2: Add Integrations

```sql
-- Get the tenant ID
SELECT id FROM tenants WHERE slug = 'acme';

-- Add ManyChat integration
INSERT INTO tenant_integrations (tenant_id, provider, credentials)
VALUES (
  '{{tenant_id}}',
  'manychat',
  '{"api_key": "mc_xxx"}'
);

-- Add Stripe integration
INSERT INTO tenant_integrations (tenant_id, provider, credentials, webhook_secret)
VALUES (
  '{{tenant_id}}',
  'stripe',
  '{"secret_key": "sk_live_xxx"}',
  'whsec_xxx'
);

-- Add GHL integration
INSERT INTO tenant_integrations (tenant_id, provider, credentials)
VALUES (
  '{{tenant_id}}',
  'ghl',
  '{"api_key": "ghl_xxx"}'
);

-- Add Meta integration
INSERT INTO tenant_integrations (tenant_id, provider, credentials)
VALUES (
  '{{tenant_id}}',
  'meta',
  '{"access_token": "EAAxx", "ad_account_id": "act_xxx"}'
);
```

### Step 3: Configure External Services

**ManyChat:**
1. Go to ManyChat → Settings → API
2. Set webhook URL: `https://mcb-dun.vercel.app/api/webhooks/acme/manychat`

**GoHighLevel:**
1. Go to GHL → Settings → Webhooks
2. Add webhook: `https://mcb-dun.vercel.app/api/webhooks/acme/ghl`

**Stripe:**
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://mcb-dun.vercel.app/api/webhooks/acme/stripe`
3. Copy signing secret to `tenant_integrations.webhook_secret`

**Denefits (via Make.com):**
1. Update Make.com scenario to route to tenant-specific URL
2. Endpoint: `https://mcb-dun.vercel.app/api/webhooks/acme/denefits`

### Step 4: Test Webhooks

```bash
# Test each endpoint
curl https://mcb-dun.vercel.app/api/webhooks/acme/manychat
curl https://mcb-dun.vercel.app/api/webhooks/acme/ghl
curl https://mcb-dun.vercel.app/api/webhooks/acme/stripe
curl https://mcb-dun.vercel.app/api/webhooks/acme/denefits
curl https://mcb-dun.vercel.app/api/webhooks/acme/perspective
```

---

## Current Tenants

| Slug | Name | Status | Owner |
|------|------|--------|-------|
| `ppcu` | Postpartum Care USA | Active | Eric |
| `centner` | Centner Wellness | Pending | - |
| `columnline` | Columnline AI | Pending | Connor |

---

## Querying Tenant Data

### Always Filter by Tenant

```sql
-- CORRECT: Filter by tenant_id
SELECT * FROM contacts
WHERE tenant_id = '{{ppcu_id}}'
  AND source != 'instagram_historical';

-- WRONG: Global query (mixes tenant data)
SELECT * FROM contacts;
```

### Cross-Tenant Analytics (Admin Only)

```sql
-- Aggregate metrics across tenants
SELECT
  t.name,
  COUNT(c.id) as contacts,
  SUM(c.purchase_amount) as revenue
FROM tenants t
LEFT JOIN contacts c ON c.tenant_id = t.id
GROUP BY t.id, t.name;
```

---

## Cron Jobs

### Meta Ads Sync

The Meta Ads sync iterates over all tenants with Meta integration:

```typescript
const tenants = await getTenantsWithIntegration('meta');
for (const tenant of tenants) {
  await syncMetaAdsForTenant(tenant.id, tenant.credentials.meta);
}
```

### Weekly Reports

Weekly reports generate per-tenant:

```typescript
const tenants = await getAllTenants();
for (const tenant of tenants.filter(t => t.report_email)) {
  await generateWeeklyReportForTenant(tenant);
}
```

---

## Troubleshooting

### "Unknown tenant" Error

**Cause:** Tenant slug doesn't exist or is inactive.

**Fix:**
```sql
-- Check if tenant exists
SELECT * FROM tenants WHERE slug = 'xxx';

-- Activate if needed
UPDATE tenants SET is_active = true WHERE slug = 'xxx';
```

### Missing Credentials

**Cause:** Integration not configured for tenant.

**Fix:**
```sql
-- Check integrations
SELECT * FROM tenant_integrations WHERE tenant_id = '{{id}}';

-- Add missing integration
INSERT INTO tenant_integrations (tenant_id, provider, credentials)
VALUES ('{{id}}', 'manychat', '{"api_key": "xxx"}');
```

### Webhook Signature Failures (Stripe)

**Cause:** Wrong webhook secret in database.

**Fix:**
```sql
-- Update webhook secret
UPDATE tenant_integrations
SET webhook_secret = 'whsec_xxx'
WHERE tenant_id = '{{id}}' AND provider = 'stripe';
```

---

## Security Considerations

1. **Credentials Encryption** - In production, encrypt `credentials` JSONB using pgcrypto
2. **RLS Policies** - Consider adding RLS if exposing data to tenant users
3. **API Key Rotation** - Regularly rotate API keys in `tenant_integrations`
4. **Audit Logging** - All webhook logs include `tenant_id` for audit trail

---

## Self-Annealing Log

| Date | Issue | Resolution |
|------|-------|------------|
| Dec 2025 | Initial multi-tenant architecture | Created tenants table, webhook routing, per-tenant credentials |

---

## Related Directives

- `webhooks.md` - Webhook handling details
- `meta-ads-sync.md` - Per-tenant Meta Ads sync
- `weekly-reports.md` - Per-tenant report generation
