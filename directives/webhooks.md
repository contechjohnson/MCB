# Directive: Webhooks

> Receive and process events from ManyChat, GoHighLevel, Stripe, Denefits, and Perspective.

**Status:** Active
**Script:** `app/api/webhooks/[tenant]/[source]/route.ts` (multi-tenant) or legacy `app/api/[source]/route.ts`
**Related:** `multi-tenancy.md`, `analytics.md`

---

## Overview

Webhooks are the primary data ingestion mechanism. Five external systems send events to our endpoints, which normalize the data and create `funnel_events` records. All webhooks follow a consistent pattern: receive → log → match/create contact → create event → update stage → return 200.

**Architecture (Dec 2025):** Events-first. Every webhook creates a `funnel_events` record. Contact table holds only identity + current stage + tags.

**Critical Rule:** Always return HTTP 200, even on errors. This prevents retry storms from external systems.

---

## Commands

| Intent | Command | Notes |
|--------|---------|-------|
| Test endpoint health | `curl https://mcb-dun.vercel.app/api/webhooks/ppcu/manychat` | Should return `{"status":"ok"}` |
| Check recent webhooks | `/recent-activity ppcu 24h` | Shows webhook activity |
| Debug specific webhook | Query `webhook_logs` table | Filter by source, mc_id, or ghl_id |
| View webhook payload | `SELECT payload FROM webhook_logs WHERE id = 'xxx'` | Full JSON stored |

---

## The Five Webhooks

### 1. ManyChat (`/api/webhooks/[tenant]/manychat`)

**Triggers:** DM conversation events
**Creates:** New contacts with `mc_id`, funnel_events records
**Updates:** Contact `stage`, `tags` (JSONB)

**Event Types (→ funnel_events.event_type):**
- `contact_created` → `contact_subscribed`
- `dm_qualified` → `dm_qualified`
- `link_sent` → `link_sent`
- `link_clicked` → `link_clicked`

**Key Fields Captured:**
- `mc_id` - ManyChat subscriber ID (unique per tenant)
- `ad_id` - Meta Ads ID from URL parameters (stored on contact)
- `tags.chatbot` - A/B test variant (via custom field chatbot_AB)
- `tags.source` - Traffic source if available

**Data Storage:**
- Contact: Identity + current stage + tags
- funnel_events: Full event with timestamp, event_data, contact_snapshot

### 2. GoHighLevel (`/api/webhooks/[tenant]/ghl`)

**Triggers:** Form submissions, pipeline stage changes
**Creates:** Contacts without `mc_id` (website traffic), funnel_events records
**Updates:** Contact `ghl_id`, `stage`, `tags`

**Event Types (→ funnel_events.event_type):**
- `OpportunityCreate` → `form_submitted`
- `MeetingCompleted` → `appointment_held`
- `PackageSent` → `package_sent`
- `PipelineStageChange` → stage-specific events

**Linking Logic:**
1. Check for existing contact by `ghl_id`
2. If not found, try email matching (case-insensitive)
3. If not found, create new contact

**Data Storage:**
- Contact: ghl_id + current stage + tags
- funnel_events: Full event with ghl_id, pipeline info, timestamps

### 3. Stripe (`/api/webhooks/[tenant]/stripe`)

**Triggers:** Checkout and payment events
**Creates:** Payment records in `payments` table, funnel_events records
**Updates:** Contact `stage = 'purchased'`, `stripe_customer_id`

**Event Types (→ funnel_events.event_type):**
- `checkout.session.completed` → `purchase_completed`
- `checkout.session.expired` → `checkout_abandoned`
- `charge.refunded` → `refund_processed`

**Payment Linking:**
1. Extract email from checkout session
2. Find contact by email (tries all 3 email fields)
3. Create payment record with `contact_id` and `payment_category`
4. Create funnel_event for purchase_completed
5. If no match, payment created as "orphan" (NULL contact_id)

**Payment Categories:** `deposit`, `full_purchase`, `downpayment`, `recurring`

### 4. Denefits (`/api/webhooks/[tenant]/denefits`)

**Triggers:** BNPL financing events (via Make.com)
**Creates:** Payment records with `payment_source = 'denefits'`, funnel_events
**Updates:** Contact `stage = 'purchased'`

**Event Types (→ funnel_events.event_type):**
- Application approved → `purchase_completed` (with payment_category = 'payment_plan')

**Fields (in payments table):**
- `denefits_contract_id` - Contract identifier
- `denefits_financed_amount` - Total financed
- `denefits_downpayment` - Initial payment (creates separate payment record)
- `denefits_recurring_amount` - Monthly payment

**Payment Categories:** `payment_plan` (total financed), `downpayment` (initial payment)

### 5. Perspective (`/api/webhooks/[tenant]/perspective`)

**Triggers:** Form submissions from Perspective funnels
**Creates:** New contacts, funnel_events records
**Updates:** Contact `stage`, `funnel_variant`, `tags`

**Event Types (→ funnel_events.event_type):**
- Form completion → `form_submitted`

**Tags Storage:**
- `tags.funnel` - Raw funnel name (e.g., LVNG_BOF_JANE)
- `tags.perspective_funnel_id` - Funnel ID if available
- Additional tags pass-through from payload

---

## Data Flow Diagram

```
Instagram DM                    Website Form                Direct Ad Click
     │                              │                            │
     ▼                              ▼                            ▼
  ManyChat ──────────────────► GoHighLevel ◄──────────────── Perspective
     │                              │                            │
     │ mc_id                        │ ghl_id                     │ email
     ▼                              ▼                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         contacts table                               │
│  Identity: mc_id, ghl_id, email, phone, name                        │
│  Current State: stage, source, ad_id                                 │
│  Flexible Metadata: tags (JSONB)                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  funnel_events  │ │    payments     │ │  webhook_logs   │
│ (SOURCE OF      │ │ (Stripe/Denefits│ │ (Audit Trail)   │
│  TRUTH)         │ │  transactions)  │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Events-First Architecture (Dec 2025)

Every webhook creates a `funnel_events` record:
- `contact_id`, `tenant_id` - Links to contact
- `event_type` - Standardized event (form_submitted, appointment_held, etc.)
- `event_timestamp` - THE timestamp for this action
- `source` - Which webhook (manychat, ghl, stripe, etc.)
- `tags` - JSONB for flexible metadata (chatbot variant, funnel name)
- `event_data` - Additional payload data
- `contact_snapshot` - State of contact at event time

---

## Contact Matching Rules

**Priority Order:**
1. `mc_id` exact match (ManyChat webhook)
2. `ghl_id` exact match (GHL webhook)
3. Email match - case insensitive against `email_primary`, `email_booking`, `email_payment`
4. Phone match (fallback)

**Multi-Tenant Constraint:**
All matches must include `tenant_id`. Two tenants can have contacts with the same email.

```sql
-- Multi-tenant email lookup
SELECT id FROM contacts
WHERE tenant_id = 'tenant-uuid'
  AND (
    email_primary ILIKE 'test@example.com'
    OR email_booking ILIKE 'test@example.com'
    OR email_payment ILIKE 'test@example.com'
  )
LIMIT 1;
```

---

## Webhook URL Configuration

### Multi-Tenant URLs (New)
```
https://mcb-dun.vercel.app/api/webhooks/ppcu/manychat
https://mcb-dun.vercel.app/api/webhooks/ppcu/ghl
https://mcb-dun.vercel.app/api/webhooks/ppcu/stripe
https://mcb-dun.vercel.app/api/webhooks/ppcu/denefits
https://mcb-dun.vercel.app/api/webhooks/ppcu/perspective
```

### Legacy URLs (Backward Compatible)
```
https://mcb-dun.vercel.app/api/manychat
https://mcb-dun.vercel.app/api/ghl-webhook
https://mcb-dun.vercel.app/api/stripe-webhook
https://mcb-dun.vercel.app/api/denefits-webhook
https://mcb-dun.vercel.app/api/perspective-webhook
```

---

## Edge Cases

| Scenario | Symptom | Handling |
|----------|---------|----------|
| Payment before contact | Payment arrives, contact doesn't exist yet | Create payment with NULL contact_id, retry linking later |
| Duplicate mc_id | Webhook with existing mc_id | Upsert - update existing contact |
| Email mismatch | GHL email differs from ManyChat | Both stored: `email_primary` (MC) vs `email_booking` (GHL) |
| Historical contact engages | Contact with `source='instagram_historical'` clicks link | Source overwritten to `'instagram'` |

---

## Troubleshooting

### Orphan Payments (Payment Not Linked to Contact)
**Symptom:** Payment in `payments` table with `contact_id = NULL`
**Cause:** Email used at checkout doesn't match any contact email
**Fix:**
```sql
-- Find the orphan
SELECT * FROM payments WHERE contact_id IS NULL;

-- Find potential matches
SELECT id, email_primary, email_booking FROM contacts
WHERE email_primary ILIKE '%part-of-email%';

-- Link manually
UPDATE payments SET contact_id = 'contact-uuid' WHERE id = 'payment-uuid';
UPDATE contacts SET stage = 'purchased', purchase_date = NOW() WHERE id = 'contact-uuid';
```

### Low MC→GHL Linkage Rate
**Symptom:** Most contacts have `mc_id` but no `ghl_id`
**Cause:** Email used in ManyChat differs from email used in GHL booking form
**Diagnosis:**
```sql
SELECT mc_id, email_primary, ghl_id FROM contacts
WHERE mc_id IS NOT NULL AND ghl_id IS NULL
ORDER BY created_at DESC LIMIT 20;
```

### Webhook Not Firing
**Symptom:** No new entries in `webhook_logs`
**Cause:** External system not sending, or URL misconfigured
**Fix:**
1. Check external system's webhook settings
2. Test endpoint: `curl https://mcb-dun.vercel.app/api/webhooks/ppcu/manychat`
3. Check Vercel function logs

---

## Self-Annealing Log

> Update this section every time you fix a webhook issue.

| Date | Issue | Resolution |
|------|-------|------------|
| 2025-11-03 | Stripe webhook signature verification failing | Fixed: Was using wrong webhook secret. Always verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard |
| 2025-11-05 | ManyChat webhook returning 500 | Fixed: Array payload handling - MC sometimes sends `[{...}]` instead of `{...}` |
| 2025-11-07 | GHL contacts not linking to MC contacts | Root cause: Email case mismatch. Fix: Use `.ilike()` instead of `.eq()` for email matching |
| 2025-11-08 | Denefits payments not creating | Fixed: Make.com webhook URL was pointing to wrong environment |
| 2025-12-09 | Multi-tenant migration broke legacy webhooks | **Critical:** After adding tenant_id constraint to `webhook_logs` and `payments` tables, all 4 legacy webhook endpoints stopped working (GHL, Stripe, Denefits, Perspective). Fixed: Added `PPCU_TENANT_ID` constant and `.eq('tenant_id', PPCU_TENANT_ID)` to all database inserts |
| 2025-12-09 | Email reports including cross-tenant data | Weekly/monthly cron jobs were missing tenant_id filters on all queries. Fixed: Added tenant_id filters to all 20+ database queries in both cron jobs |
| 2025-12-09 | Multi-tenant webhook endpoints deployed | **Migration Complete:** All 5 webhook sources now have multi-tenant endpoints at `/api/webhooks/[tenant]/[source]`. Legacy endpoints still work. Created `WEBHOOK_MIGRATION_GUIDE.md` with step-by-step instructions for updating external systems. |
| 2025-12-09 | Email reports refactored for multi-tenant | Weekly reports now support `?test=true` (send to connor@columnline.com only), `?tenant=slug` (specific tenant), and `?all=true` (all tenants). Tenant recipients stored in `tenants.config.report_recipients` JSONB array with fallback to `report_email`. Migration SQL ready but not yet applied. |

### Detailed Learnings

**ManyChat Payload Variability:**
ManyChat sends two different payload formats depending on context:
1. Full subscriber object: `{ subscriber: { id, custom_fields, ... } }`
2. Simple ID: `{ subscriber_id: "123", event_type: "..." }`

Always handle both. Check `body.subscriber` first, fall back to `body.subscriber_id`.

**Email Matching is Fragile:**
Users enter different emails in different contexts:
- ManyChat: Personal email
- Booking form: Sometimes work email
- Stripe checkout: PayPal email or alternate

This is why we track three email fields. Matching should try all three.

**Multi-Tenant Migration Gotchas (Dec 2025):**
When migrating from single-tenant to multi-tenant architecture, ALL database operations need tenant_id:

**Schema Changes:**
- `webhook_logs` and `payments` tables now require `tenant_id` (NOT NULL)
- Legacy webhooks that omit tenant_id will fail with constraint violation

**What Breaks:**
1. **Legacy webhook endpoints** (`/api/manychat`, `/api/ghl-webhook`, etc.)
   - Missing tenant_id on ALL `.insert()` calls
   - Fix: Add hardcoded `PPCU_TENANT_ID` constant
2. **Cron jobs** (weekly/monthly reports)
   - Missing tenant_id filters on ALL `.select()` queries
   - Result: Reports include data from ALL tenants
   - Fix: Add `.eq('tenant_id', PPCU_TENANT_ID)` to every query
3. **RPC functions** (like `find_contact_by_email`)
   - Some RPC functions don't accept tenant_id parameter
   - Fix: Rewrite to use direct table queries with tenant_id filter

**Pattern for Legacy Endpoint Fixes:**
```typescript
// Add at top of file
const PPCU_TENANT_ID = '2cb58664-a84a-4d74-844a-4ccd49fcef5a';

// All inserts need tenant_id
await supabase.from('webhook_logs').insert({
  tenant_id: PPCU_TENANT_ID,  // ← ADD THIS
  source: 'manychat',
  // ...rest of fields
});

// All selects need tenant_id filter
const { data } = await supabase
  .from('contacts')
  .select('*')
  .eq('tenant_id', PPCU_TENANT_ID)  // ← ADD THIS
  .eq('mc_id', mcId);
```

**Migration Checklist:**
- [ ] Legacy webhook endpoints: Add tenant_id to all inserts
- [ ] Legacy webhook endpoints: Add tenant_id filter to all selects
- [ ] Cron jobs: Add tenant_id filter to ALL queries
- [ ] RPC functions: Replace with direct queries if needed
- [ ] Test: Verify webhooks process correctly
- [ ] Test: Verify reports only show single tenant data

**Why This Matters:**
- Without tenant_id filters, cron jobs generate cross-tenant reports (security issue)
- Without tenant_id on inserts, webhooks fail silently (data loss)
- Migration is complete when both legacy AND multi-tenant endpoints work

---

## Related Directives

- `multi-tenancy.md` - Tenant routing for webhooks
- `analytics.md` - Querying webhook data
- `weekly-reports.md` - Webhooks feed into reports
