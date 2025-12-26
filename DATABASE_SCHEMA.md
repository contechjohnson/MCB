# Database Schema Reference

**Last Updated:** December 25, 2025
**Schema Version:** v3.0 (Events-First Architecture)
**Database:** Supabase PostgreSQL

---

## 🚨 ARCHITECTURE CHANGE (Dec 2025)

**Events-First:** `funnel_events` is the single source of truth for all funnel analytics.
**Contacts Simplified:** Identity + current state only. All date columns REMOVED.

---

## 📊 Quick Reference

| Table | Purpose | Primary Use |
|-------|---------|-------------|
| `contacts` | Identity + current state | Contact matching, current stage |
| `funnel_events` | **SOURCE OF TRUTH** | All funnel analytics, conversion tracking |
| `payments` | Payment transactions | Revenue tracking, attribution |
| `webhook_logs` | Webhook audit trail | Debugging, event replay |
| `meta_ads` | Meta ad configurations | Ad performance tracking |
| `meta_ad_creatives` | Ad creative content | Creative analysis |
| `meta_ad_insights` | Daily ad metrics | Performance trends |
| `tenants` | Multi-tenant config | Tenant routing, credentials |

---

## 🔑 Core Tables

### `contacts` (Identity + Current State)

**Purpose:** Identity and current state only. Query `funnel_events` for history.

**Primary Key:** `id` (UUID)

**Schema (20 columns only):**
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK to tenants |
| `created_at` | TIMESTAMPTZ | Record created |
| `updated_at` | TIMESTAMPTZ | Last updated |
| `mc_id` | TEXT | ManyChat subscriber ID (UNIQUE) |
| `ghl_id` | TEXT | GoHighLevel contact ID (UNIQUE) |
| `ig` | TEXT | Instagram handle |
| `ig_id` | BIGINT | Instagram user ID |
| `fb` | TEXT | Facebook profile |
| `stripe_customer_id` | TEXT | Stripe customer reference |
| `email_primary` | TEXT | Primary email (from MC) |
| `email_booking` | TEXT | Email used for booking |
| `email_payment` | TEXT | Email used for payment |
| `phone` | TEXT | Phone number |
| `first_name` | TEXT | First name |
| `last_name` | TEXT | Last name |
| `stage` | TEXT | Current funnel stage |
| `source` | TEXT | Traffic source |
| `ad_id` | TEXT | Meta Ads ID (first-touch) |
| `tags` | JSONB | Flexible metadata |

**Stage Values:**
- `new_lead` - Initial contact
- `dm_qualified` - Qualified via ManyChat
- `landing_link_sent` - Booking link sent
- `landing_link_clicked` - Link clicked
- `form_submitted` - Form completed
- `call_booked` - Appointment scheduled
- `meeting_held` - Appointment completed
- `purchased` - Made a purchase

**Tags (JSONB) Common Keys:**
- `chatbot` - A/B test variant (A, B)
- `funnel` - Raw funnel name from Perspective
- `source` - Additional source info

**⚠️ REMOVED COLUMNS (Dec 2025):**
These columns no longer exist - query `funnel_events` instead:
- ~~subscribe_date~~, ~~dm_qualified_date~~, ~~link_send_date~~, ~~link_click_date~~
- ~~form_submit_date~~, ~~appointment_date~~, ~~appointment_held_date~~
- ~~purchase_date~~, ~~deposit_paid_date~~, ~~package_sent_date~~, ~~checkout_started~~
- ~~chatbot_ab~~, ~~funnel_variant~~, ~~misc_ab~~ (use `tags` JSONB)
- ~~purchase_amount~~ (use `payments` table)
- ~~q1_question~~, ~~q2_question~~, ~~objections~~, ~~lead_summary~~, ~~trigger_word~~ (use `funnel_events.event_data`)
- ~~thread_id~~, ~~subscribed~~, ~~ig_last_interaction~~

---

### `funnel_events` (SOURCE OF TRUTH)

**Purpose:** All funnel history. Every webhook creates an event here.

**Primary Key:** `id` (UUID)

**Schema:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK to tenants |
| `contact_id` | UUID | FK to contacts |
| `event_type` | TEXT | Standardized event type |
| `event_timestamp` | TIMESTAMPTZ | When the event occurred |
| `source` | TEXT | Which webhook (manychat, ghl, stripe, etc.) |
| `source_event_id` | TEXT | Unique ID for deduplication |
| `event_data` | JSONB | Additional payload data |
| `tags` | JSONB | Flexible metadata (chatbot, funnel, etc.) |
| `contact_snapshot` | JSONB | State of contact at event time |
| `created_at` | TIMESTAMPTZ | Record created |

**Event Types:**
- `contact_subscribed` - New contact via ManyChat
- `dm_qualified` - Qualification questions answered
- `link_sent` - Booking link sent
- `link_clicked` - Link clicked
- `form_submitted` - Form completed (GHL or Perspective)
- `appointment_booked` - Meeting scheduled
- `appointment_held` - Meeting completed
- `package_sent` - Package shipped
- `purchase_completed` - Payment received
- `checkout_abandoned` - Checkout not completed

**Query Examples:**
```sql
-- Funnel conversion
SELECT event_type, COUNT(DISTINCT contact_id)
FROM funnel_events
WHERE tenant_id = 'ppcu-uuid'
  AND event_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY event_type;

-- Chatbot A/B comparison
SELECT tags->>'chatbot' as variant, COUNT(DISTINCT contact_id)
FROM funnel_events
WHERE tags->>'chatbot' IS NOT NULL
GROUP BY tags->>'chatbot';

-- Journey for specific contact
SELECT event_type, event_timestamp, source
FROM funnel_events
WHERE contact_id = 'contact-uuid'
ORDER BY event_timestamp;
```

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `source_event_id` (deduplication)
- INDEX on `(tenant_id, event_timestamp)`
- INDEX on `(tenant_id, contact_id)`

---

### `payments` (Payment Transactions)

**Purpose:** Track all payments (Stripe and Denefits BNPL).

**Primary Key:** `id` (UUID)

**Unique Constraint:** `payment_event_id` (source + event ID)

**Payment Source:**
| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `payment_source` | TEXT | CHECK ('stripe', 'denefits') | Where payment came from |
| `payment_type` | TEXT | CHECK ('buy_in_full', 'buy_now_pay_later') | Payment plan type |
| `payment_event_id` | TEXT | UNIQUE | Source-specific event ID |

**Customer Info:**
| Column | Type | Description |
|--------|------|-------------|
| `contact_id` | UUID | FK to contacts (NULL if orphaned) |
| `customer_email` | TEXT | Email used for payment |
| `customer_name` | TEXT | Name on payment |
| `customer_phone` | TEXT | Phone number |

**Payment Details:**
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `amount` | NUMERIC | - | Payment amount |
| `currency` | TEXT | `'usd'` | Currency code |
| `status` | TEXT | - | Payment status |
| `payment_date` | TIMESTAMPTZ | - | When payment occurred |

**Stripe-Specific:**
| Column | Type | Description |
|--------|------|-------------|
| `stripe_event_type` | TEXT | Stripe event type |
| `stripe_customer_id` | TEXT | Stripe customer ID |
| `stripe_session_id` | TEXT | Checkout session ID |

**Denefits-Specific:**
| Column | Type | Description |
|--------|------|-------------|
| `denefits_contract_id` | INTEGER | Contract ID |
| `denefits_contract_code` | TEXT | Contract code |
| `denefits_financed_amount` | NUMERIC | Total financed |
| `denefits_downpayment` | NUMERIC | Down payment amount |
| `denefits_recurring_amount` | NUMERIC | Monthly payment |
| `denefits_num_payments` | INTEGER | Total payments |
| `denefits_remaining_payments` | INTEGER | Payments left |

**Audit:**
| Column | Type | Description |
|--------|------|-------------|
| `raw_payload` | JSONB | Full webhook payload |
| `created_at` | TIMESTAMPTZ | Record created |
| `updated_at` | TIMESTAMPTZ | Last updated |

**Indexes:**
- PRIMARY KEY on `id`
- UNIQUE on `payment_event_id`

---

### `webhook_logs` (Webhook Audit Trail)

**Purpose:** Log all incoming webhook events for debugging and replay.

**Primary Key:** `id` (BIGSERIAL)

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `source` | TEXT | Webhook source (stripe, ghl, manychat, denefits, perspective) |
| `event_type` | TEXT | Type of event |
| `contact_id` | UUID | Related contact (if matched) |
| `mc_id` | TEXT | ManyChat ID (if applicable) |
| `ghl_id` | TEXT | GHL ID (if applicable) |
| `payload` | JSONB | Full webhook payload |
| `status` | TEXT | Processing status (default: 'received') |
| `error_message` | TEXT | Error if failed |
| `created_at` | TIMESTAMPTZ | When received |

**Common Statuses:**
- `received` - Just logged
- `processed` - Successfully processed
- `error` - Failed processing

---

## 📊 Meta Ads Tables

### `meta_ads` (Ad Configurations)

**Purpose:** Store Meta ad configuration and cumulative metrics.

**Primary Key:** `id` (UUID)
**Unique:** `ad_id` (TEXT)

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `ad_id` | TEXT | Meta Ads ID |
| `ad_name` | TEXT | Ad name |
| `campaign_id` | TEXT | Campaign ID |
| `adset_id` | TEXT | Ad set ID |
| `status` | TEXT | Ad status |
| `effective_status` | TEXT | Actual running status |
| `is_active` | BOOLEAN | Currently active? |
| `created_time` | TIMESTAMPTZ | Ad created time (Meta) |
| `updated_time` | TIMESTAMPTZ | Ad last updated (Meta) |
| `date_start` | DATE | Start date |
| `date_stop` | DATE | End date |
| `last_synced` | TIMESTAMPTZ | Last sync from API |

**Cumulative Metrics:**
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `spend` | NUMERIC | 0 | Total spend |
| `impressions` | INTEGER | 0 | Total impressions |
| `clicks` | INTEGER | 0 | Total clicks |
| `reach` | INTEGER | 0 | Total reach |
| `link_clicks` | INTEGER | 0 | Link clicks |
| `landing_page_views` | INTEGER | 0 | Landing page views |
| `leads` | INTEGER | 0 | Leads generated |
| `pixel_leads` | INTEGER | 0 | Pixel-tracked leads |
| `video_views` | INTEGER | 0 | Video views |
| `post_engagements` | INTEGER | 0 | Post engagements |
| `ctr` | NUMERIC | 0 | Click-through rate |
| `cpc` | NUMERIC | 0 | Cost per click |
| `frequency` | NUMERIC | 0 | Frequency |
| `cost_per_lead` | NUMERIC | NULL | Cost per lead |
| `cost_per_landing_page_view` | NUMERIC | NULL | Cost per landing page view |

---

### `meta_ad_creatives` (Ad Creative Content)

**Purpose:** Store creative elements for analysis.

**Primary Key:** `id` (UUID)
**Unique:** `ad_id` (TEXT)
**Foreign Key:** `ad_id` → `meta_ads.ad_id`

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `ad_id` | TEXT | References meta_ads |
| `primary_text` | TEXT | Ad primary text |
| `headline` | TEXT | Ad headline |
| `alternative_copy` | TEXT | Alternative copy variant |
| `video_id` | TEXT | Video asset ID |
| `thumbnail_url` | TEXT | Thumbnail URL |
| `preview_url` | TEXT | Ad preview URL |
| `post_id` | TEXT | Facebook post ID |
| `transformation_theme` | TEXT | Theme category |
| `symptom_focus` | TEXT[] | Array of symptoms |
| `copy_length` | TEXT | Short/medium/long |
| `media_type` | TEXT | Image/video/carousel |

---

### `meta_ad_insights` (Daily Performance Snapshots)

**Purpose:** Daily performance metrics for trend analysis.

**Primary Key:** `id` (UUID)
**Foreign Key:** `ad_id` → `meta_ads.ad_id`

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `ad_id` | TEXT | References meta_ads |
| `snapshot_date` | DATE | Date of snapshot |
| `spend` | NUMERIC | Daily spend |
| `impressions` | INTEGER | Daily impressions |
| `clicks` | INTEGER | Daily clicks |
| `reach` | INTEGER | Daily reach |
| `leads` | INTEGER | Daily leads |
| `ctr` | NUMERIC | CTR for day |
| `cpc` | NUMERIC | CPC for day |
| `created_at` | TIMESTAMPTZ | When recorded |

**Note:** This allows week-over-week and trend analysis without recalculating cumulative metrics.

---

## 📈 Reporting Tables

*(These may exist from migrations but are not heavily documented yet)*

- `weekly_snapshots` - Weekly summary metrics
- `ab_tests` - A/B test tracking
- `ad_performance_weekly` - Weekly ad rollups
- `theme_performance_weekly` - Weekly theme performance

---

## 🔄 Migration History

### Applied Migrations (In Order):

1. **Base Schema** (Implicit) - Initial contacts, payments, webhook_logs tables
2. `add_ig_columns.sql` - Added Instagram-specific fields
3. `create_contact_insert_function.sql` - Upsert function for contacts
4. `fix_duplicate_mc_id_upsert.sql` - Fixed duplicate mc_id handling
5. `20250107_create_meta_ads_tables.sql` - Meta ads tracking
6. `20250107_create_analytics_views.sql` - Analytics helper views
7. `20250107_create_analytics_functions.sql` - Analytics functions
8. `20250107_create_reporting_memory_tables.sql` - Weekly snapshots, A/B tests
9. `20250107_fix_historical_field_swapping.sql` - Fixed Q1/Q2 field mapping
10. `20250511_create_historical_tables.sql` - Historical data tables
11. `20250511_create_historical_views.sql` - Historical data views

### Schema Version History:

- **v1.0** - Initial schema (archived)
- **v2.0** - UUID primary keys, cleaned up structure
- **v2.1** - Meta ads integration
- **v2.2** - Payments table, Instagram fields, historical data

---

## 🔗 Relationships

### Primary Relationships:

```
contacts (1) ←→ (0..n) payments
  └─ contact_id FK in payments

meta_ads (1) ←→ (1) meta_ad_creatives
  └─ ad_id FK

meta_ads (1) ←→ (0..n) meta_ad_insights
  └─ ad_id FK

contacts (0..n) ←→ (1) meta_ads
  └─ ad_id field (not enforced FK)
```

### Linking Strategy:

**MC → GHL Linkage:**
- Match via `email_primary` (case-insensitive with `.ilike()`)
- Update `ghl_id` when GHL webhook arrives
- **Current Issue:** Only 7.9% have both mc_id and ghl_id

**Payment → Contact Linkage:**
- Match via `customer_email` to contact emails
- Tries `email_primary`, `email_booking`, `email_payment`
- Updates `contact_id` when match found
- **Current Issue:** 100% orphan rate (2 payments unlinked)

**Ad Attribution:**
- `ad_id` captured from ManyChat webhook parameters
- Stored in `contacts.ad_id`
- **Current Rate:** 35% capture rate

---

## 🔍 Common Queries (Events-First)

### Funnel Conversion (Events):
```sql
SELECT
  event_type,
  COUNT(DISTINCT contact_id) as contacts
FROM funnel_events
WHERE tenant_id = 'ppcu-uuid'
  AND event_timestamp >= NOW() - INTERVAL '30 days'
  AND event_type IN (
    'contact_subscribed', 'dm_qualified', 'link_clicked',
    'form_submitted', 'appointment_held', 'purchase_completed'
  )
GROUP BY event_type;
```

### Chatbot A/B Comparison:
```sql
SELECT
  tags->>'chatbot' as variant,
  COUNT(DISTINCT contact_id) as leads,
  COUNT(DISTINCT CASE WHEN event_type = 'form_submitted' THEN contact_id END) as forms,
  COUNT(DISTINCT CASE WHEN event_type = 'purchase_completed' THEN contact_id END) as purchases
FROM funnel_events
WHERE tenant_id = 'ppcu-uuid'
  AND tags->>'chatbot' IS NOT NULL
  AND event_timestamp >= NOW() - INTERVAL '60 days'
GROUP BY tags->>'chatbot';
```

### Revenue by Source:
```sql
SELECT
  c.source,
  COUNT(DISTINCT p.contact_id) as customers,
  SUM(p.amount) as revenue
FROM payments p
JOIN contacts c ON p.contact_id = c.id
WHERE p.tenant_id = 'ppcu-uuid'
  AND p.payment_category IN ('deposit', 'full_purchase', 'downpayment')
GROUP BY c.source;
```

### Linkage Rates:
```sql
SELECT
  COUNT(*) as total,
  COUNT(mc_id) as has_mc,
  COUNT(ghl_id) as has_ghl,
  COUNT(CASE WHEN mc_id IS NOT NULL AND ghl_id IS NOT NULL THEN 1 END) as linked,
  ROUND(100.0 * COUNT(CASE WHEN mc_id IS NOT NULL AND ghl_id IS NOT NULL THEN 1 END) / COUNT(*), 1) as linkage_pct
FROM contacts
WHERE tenant_id = 'ppcu-uuid';
```

### Orphan Payments:
```sql
SELECT
  COUNT(*) as total_payments,
  COUNT(contact_id) as linked,
  COUNT(*) - COUNT(contact_id) as orphaned
FROM payments
WHERE tenant_id = 'ppcu-uuid';
```

### Contact Journey:
```sql
SELECT
  event_type,
  event_timestamp,
  source,
  tags
FROM funnel_events
WHERE contact_id = 'contact-uuid'
ORDER BY event_timestamp;
```

### Recent Activity:
```sql
SELECT
  c.first_name,
  c.email_primary,
  fe.event_type,
  fe.event_timestamp,
  fe.source
FROM funnel_events fe
JOIN contacts c ON fe.contact_id = c.id
WHERE fe.tenant_id = 'ppcu-uuid'
  AND fe.event_timestamp >= NOW() - INTERVAL '7 days'
ORDER BY fe.event_timestamp DESC
LIMIT 20;
```

---

## 🔐 Row Level Security (RLS)

**Current Status:** RLS is **disabled** on all tables.

**Why:** All access is via service role key (admin) from API routes. No public access.

**Future:** If adding user-facing features, implement RLS policies.

---

## 🛠️ Maintenance

### Indexes

**Existing:**
- Primary keys (automatic indexes)
- Unique constraints (automatic indexes)
- No custom indexes yet

**Recommended for scale:**
```sql
-- If contacts > 10K
CREATE INDEX idx_contacts_mc_id ON contacts(mc_id);
CREATE INDEX idx_contacts_ghl_id ON contacts(ghl_id);
CREATE INDEX idx_contacts_email ON contacts(email_primary);
CREATE INDEX idx_contacts_stage ON contacts(stage);
CREATE INDEX idx_contacts_created_at ON contacts(created_at);

-- If webhook_logs > 100K
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX idx_webhook_logs_source ON webhook_logs(source);
```

### Backup Strategy

- **Supabase Automatic:** Daily backups (7-day retention on Pro plan)
- **Manual Export:** Use pg_dump if needed
- **Weekly Snapshots:** Use `weekly_snapshots` table for historical comparison

---

## 📚 Related Documentation

- **System Architecture:** `SYSTEM_ARCHITECTURE.md` - Data flow and external dependencies
- **Current Status:** `CURRENT_STATUS.md` - Current metrics and known issues
- **Project Guide:** `CLAUDE.md` - Developer reference
- **Scripts Index:** `scripts/README.md` - Database utilities

---

## 🚨 Known Schema Issues

### Critical

1. **No enforced FK: contacts.ad_id → meta_ads.ad_id**
   - Can have orphan ad_ids
   - Not a huge issue since Meta ads are synced separately

2. **Email fields not normalized**
   - `email_primary`, `email_booking`, `email_payment` can diverge
   - Makes matching harder
   - Consider consolidating or creating `contact_emails` junction table

### Medium

3. **Stage progression not enforced**
   - Can skip stages
   - Can regress stages
   - Consider trigger to validate stage transitions

4. **Timestamp field duplication**
   - Both `subscribed` and `subscribe_date` exist
   - Likely historical artifact
   - Should consolidate

### Low

5. **No cascade deletes**
   - Deleting contact doesn't delete related payments
   - Currently not an issue (never delete contacts)
   - Add `ON DELETE CASCADE` if needed

---

**For schema changes:** Always create a migration file in `/migrations/` and apply via `node scripts/apply_migrations.js`
