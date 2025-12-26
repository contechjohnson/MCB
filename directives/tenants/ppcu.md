# PPCU Tenant Configuration

**Tenant:** Postpartum Care USA (PPCU)
**Tenant ID:** `2cb58664-a84a-4d74-844a-4ccd49fcef5a`
**Tenant Slug:** `ppcu`

---

## Funnel Overview

PPCU has TWO entry funnels:

| Funnel | Entry Point | Booking Source | Form Source |
|--------|-------------|----------------|-------------|
| **Jane/CLARA** | Instagram DM → ManyChat → Jane booking | `jane` | Perspective |
| **Calendly Free** | Instagram DM → Perspective form → Calendly | `calendly` | Perspective |

**Note:** Checkout funnel is DEPRECATED. Purchases are tracked via Stripe/Denefits webhooks only.

---

## Flexible Tagging System

**New (Dec 2025):** Contacts and events use a flexible JSONB `tags` field for categorization.

### Key Tags

| Tag | Values | Description |
|-----|--------|-------------|
| `booking_source` | `jane`, `calendly`, `website` | How the meeting was booked |
| `funnel_type` | `bottom_of_funnel`, `top_of_funnel`, `discovery` | Funnel stage |
| `pipeline` | `ppcu_pipeline`, `free_discovery_call` | GHL pipeline |

### How Tags Are Set

1. **Perspective webhook** auto-derives:
   - `booking_source` from funnelName (contains "calendly" → `calendly`, contains "jane" → `jane`)
   - `funnel_type` from funnelName (bof/tof/mof indicators)
   - `perspective_funnel_id` from Perspective

2. **GHL webhook** auto-derives:
   - `booking_source` from pipeline stage
   - `pipeline` from GHL stage names
   - **Or** accepts explicit tags via `customData.tags`

### Querying by Tags

```sql
-- Find all Jane bookings
SELECT * FROM contacts
WHERE tenant_id = 'tenant-uuid'
  AND tags->>'booking_source' = 'jane';

-- Find all Calendly bookings last 30 days
SELECT * FROM funnel_events
WHERE tenant_id = 'tenant-uuid'
  AND tags->>'booking_source' = 'calendly'
  AND event_timestamp >= NOW() - INTERVAL '30 days';

-- Count by booking source
SELECT
  tags->>'booking_source' as booking_source,
  COUNT(*) as count
FROM contacts
WHERE tenant_id = 'tenant-uuid'
  AND source != 'instagram_historical'
GROUP BY tags->>'booking_source';
```

---

## Perspective Funnels

| Funnel Name | Status | `funnel_variant` | Tags |
|-------------|--------|------------------|------|
| `LVNG_BOF_Calendly` | LIVE | `LVNG_BOF_Calendly` | `booking_source: calendly` |
| `LVNG_BOF_JANE` | LIVE | `LVNG_BOF_JANE` | `booking_source: jane` |
| `LVNG_TOFMOF_MANYCHAT_JANE` | LIVE | `LVNG_TOFMOF_MANYCHAT_JANE` | `booking_source: jane` |
| `LVNG_TOF_LM` | DEPRECATED | - | - |
| `LVNG_CHECKOUT` | DEPRECATED | - | - |
| `LVNG_TOF_SUPPLEMENTS` | DEPRECATED | - | - |

**Note:** `funnel_variant` now stores the RAW funnel name from Perspective. Use `tags.booking_source` for filtering by Jane vs Calendly.

**Funnel Detection Logic:**
```
if funnelName contains "checkout" OR "supplements" OR "LM" → SKIP
funnel_variant = raw funnelName (stored as-is)
tags.booking_source = derived from funnelName
```

---

## Pipeline Stages Tracked

| Stage | Source | Webhook | Date Field |
|-------|--------|---------|------------|
| DM Started | ManyChat | `/api/webhooks/ppcu/manychat` | `subscribe_date` |
| DM Qualified | ManyChat | `/api/webhooks/ppcu/manychat` | `dm_qualified_date` |
| Link Sent | ManyChat | `/api/webhooks/ppcu/manychat` | `booking_link_sent_date` |
| Link Clicked | ManyChat | `/api/webhooks/ppcu/manychat` | `booking_link_clicked_date` |
| Form Submitted | Perspective | `/api/webhooks/ppcu/perspective` | `form_submit_date` |
| Meeting Booked | GHL | `/api/webhooks/ppcu/ghl` | `appointment_date` |
| Meeting Held | GHL | `/api/webhooks/ppcu/ghl` | `appointment_held_date` |
| Purchase | Stripe/Denefits | `/api/webhooks/ppcu/stripe` or `/denefits` | `payment_date` |

**Stages NOT tracked (handled elsewhere):**
- `$100 Deposit Paid` → Stripe webhook
- `Pay In Full` → Stripe webhook
- `NO SHOW` → Skipped (already handled by NO SHOW logic)
- Checkout Started → DEPRECATED

---

## Payment Events

Payments are categorized for accurate revenue tracking:

### Stripe Payments

| Amount | Category | Event Type | Contact Update |
|--------|----------|------------|----------------|
| $100 exactly | `deposit` | `deposit_paid` | stage='deposit_paid', deposit_paid_date set |
| >$100 | `full_purchase` | `purchase_completed` | stage='purchased', purchase_date set |
| <$100 | `miscellaneous` | None | Log only, no contact update |

### Denefits Payments (BNPL)

| Webhook Event | Category | What It Represents |
|---------------|----------|-------------------|
| `contract.created` | `payment_plan` | Projected revenue (total financed amount) |
| `contract.created` | `downpayment` | Cash collected (initial payment, if > $0) |
| `contract.payments.recurring_payment` | `recurring` | Cash collected (monthly installment) |

**Event Types:**
- `payment_plan_created` - Denefits contract created
- `recurring_payment_received` - Denefits monthly payment processed

### Revenue Metrics

| Metric | Formula | Use Case |
|--------|---------|----------|
| **Deposits Paid** | COUNT WHERE payment_category = 'deposit' | High-intent leads |
| **Projected Revenue** | SUM WHERE payment_category = 'payment_plan' | Expected BNPL revenue |
| **Cash Collected** | SUM WHERE payment_category IN ('deposit', 'full_purchase', 'downpayment', 'recurring') | Actual revenue received |

---

## GHL Pipelines

### PPCU PIPELINE (Jane/CLARA Flow)
```
Form Filled → Meeting Attended → Package Sent → ...
```
- No "Meeting Booked" stage (Jane handles booking internally)
- Webhook fires on: `meeting_attended` only

### FREE DISCOVERY CALL PIPELINE (Calendly Flow)
```
DC BOOKED → NO SHOW (skip)
    ↓
COMPLETED DC → $100 Deposit Paid (skip) → Pay In Full (skip)
```
- Webhook fires on: `DC BOOKED` (meeting_booked), `COMPLETED DC` (meeting_attended)
- Payment stages handled by Stripe

---

## Webhook Configuration

### 1. ManyChat Webhooks

**URL:** `https://mcb-dun.vercel.app/api/webhooks/ppcu/manychat`

**Payload:**
```json
{
  "subscriber": {{subscriber_data|to_json:true}},
  "event_type": "contact_created"
}
```

**Event Types:**
| Event | When to Fire |
|-------|--------------|
| `contact_created` | New subscriber joins |
| `dm_qualified` | Subscriber answers qualifying questions |
| `link_sent` | Booking link sent to subscriber |
| `link_clicked` | Subscriber clicks booking link |

---

### 2. Perspective Webhooks

**URL:** `https://mcb-dun.vercel.app/api/webhooks/ppcu/perspective`

**Fires automatically from Perspective on form submission.**

Funnel detection:
- `funnelName` contains "checkout" → IGNORED (deprecated)
- `funnelName` anything else → Creates/updates contact as `form_submitted`

**What gets stored:**
- `funnel_variant` = Raw funnelName (e.g., "LVNG_BOF_Calendly")
- `tags.booking_source` = `calendly` or `jane` (auto-derived)
- `tags.funnel_type` = `bottom_of_funnel` / `top_of_funnel` / etc. (auto-derived)

---

### 3. GHL Webhooks

**URL:** `https://mcb-dun.vercel.app/api/webhooks/ppcu/ghl`

**Tags Support:** GHL webhooks auto-derive tags from pipeline stage, OR you can pass explicit tags via `customData.tags`.

#### Meeting Booked (Calendly only)
**Trigger:** Opportunity Created in FREE DISCOVERY CALL PIPELINE
**OR** Pipeline Stage Changed to "DC BOOKED"

```
Custom Data:
  contact_id: {{contact.id}}
  email: {{contact.email}}
  phone: {{contact.phone}}
  first_name: {{contact.first_name}}
  last_name: {{contact.last_name}}
  pipeline_stage: meeting_booked
  AD_ID: {{contact.ad_id}}
  MC_ID: {{contact.mc_id}}
  source: instagram_direct
  tags: {"booking_source": "calendly", "pipeline": "free_discovery_call"}
```

#### Meeting Held (Calendly)
**Trigger:** Pipeline Stage Changed to "COMPLETED DC"
**Filter:** Current Stage = "Completed DC" (prevents multiple fires)

```
Custom Data:
  contact_id: {{contact.id}}
  email: {{contact.email}}
  phone: {{contact.phone}}
  first_name: {{contact.first_name}}
  last_name: {{contact.last_name}}
  pipeline_stage: meeting_attended
  AD_ID: {{contact.ad_id}}
  MC_ID: {{contact.mc_id}}
  source: instagram_direct
  tags: {"booking_source": "calendly", "pipeline": "free_discovery_call"}
```

#### Meeting Held (Jane)
**Trigger:** Pipeline Stage Changed to "Meeting Attended" in PPCU PIPELINE

```
Custom Data:
  contact_id: {{contact.id}}
  email: {{contact.email}}
  phone: {{contact.phone}}
  first_name: {{contact.first_name}}
  last_name: {{contact.last_name}}
  pipeline_stage: meeting_attended
  tags: {"booking_source": "jane", "pipeline": "ppcu_pipeline"}
  AD_ID: {{contact.ad_id}}
  MC_ID: {{contact.mc_id}}
  source: instagram
```

---

### 4. Stripe Webhook

**URL:** `https://mcb-dun.vercel.app/api/webhooks/ppcu/stripe`

**Events to enable:**
- `checkout.session.completed`
- `checkout.session.created`
- `checkout.session.expired`
- `charge.refunded`

**Payment Categorization:**
| Amount | Category | Event Created | Stage Update |
|--------|----------|---------------|--------------|
| $100 | `deposit` | `deposit_paid` | `deposit_paid` |
| >$100 | `full_purchase` | `purchase_completed` | `purchased` |
| <$100 | `miscellaneous` | None | None |

---

### 5. Denefits Webhook

**URL:** `https://mcb-dun.vercel.app/api/webhooks/ppcu/denefits`

**Events (via Make.com):**

| Event | Payment Records Created | Funnel Event |
|-------|------------------------|--------------|
| `contract.created` | `payment_plan` (projected) + `downpayment` (if >$0) | `payment_plan_created` |
| `contract.payments.recurring_payment` | `recurring` (cash collected) | `recurring_payment_received` |
| `contract.status` | None (logged only) | None |

---

## What NOT to Configure

1. **No GHL webhook for Perspective form_filled** - Perspective handles funnel forms
2. **No checkout funnel tracking** - Deprecated
3. **No payment stage webhooks from GHL** - Stripe/Denefits handle payments

**EXCEPTION:** Website form submissions (not from Perspective funnels) still go through GHL:
```
Trigger: Form submitted on website
URL: https://mcb-dun.vercel.app/api/webhooks/ppcu/ghl
Custom Data:
  contact_id: {{contact.id}}
  email: {{contact.email}}
  phone: {{contact.phone}}
  first_name: {{contact.first_name}}
  last_name: {{contact.last_name}}
  pipeline_stage: form_filled
  source: website
```

---

## Legacy URLs to Remove

These old URLs should be replaced:
- `/api/ghl-webhook` → `/api/webhooks/ppcu/ghl`
- `/api/manychat` → `/api/webhooks/ppcu/manychat`
- `/api/stripe-webhook` → `/api/webhooks/ppcu/stripe`

---

## Contact Matching Logic

| Source | Matches By |
|--------|-----------|
| ManyChat | MC_ID → Email |
| GHL | GHL_ID → MC_ID → Email |
| Perspective | Email only |
| Stripe | Email (from payment) |
| Denefits | Email (from contract) |

---

## Troubleshooting

**Duplicate contacts?**
- Check if same person has different email in ManyChat vs booking form

**Missing funnel_variant?**
- GHL-created contacts default to `jane_paid`
- Perspective discovery contacts get `calendly_free`

**Payment not linked?**
- Check `webhook_logs` table for Stripe/Denefits errors
- Verify email matches between GHL contact and payment
