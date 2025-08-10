# **Project Charter – ManyChat AI Automation Framework (Simplified)**

## **Purpose**

Build a **simple, repeatable automation system** that integrates **ManyChat**, **Vercel**, **Supabase**, and an **AI model** to handle conversational flows, lead capture, and decision-based automation. System must be cheap to run, easy to clone, and flexible enough to toggle features (DM vs. funnel capture) and A/B test entire script versions without re-architecting.

---

## **Non-Goals (to prevent overbuild)**

* No full BI suite now. **MVP is funnel metrics only.**
* No complex CRM. Contacts live in Supabase with minimal fields.

---

## **Core Objectives**

* Replace Make.com high-op message handling with **one serverless endpoint**.
* **AI decision-making** returns a strict JSON object; ManyChat handles presentation/tracking.
* **Single table approach** - store everything in one contacts table for simplicity.
* **Feature toggles** per client/campaign: capture location, offer routing, integrations.
* **A/B test** full chat scripts and prompts via versioned config.
* **Packable** for agency onboarding; cloning new clients is mostly config.

---

## **System Overview**

**Trigger:** ManyChat External Request sends message + contact to `/ai-router`.

**Serverless Endpoint (`/ai-router` on Vercel):**

1. Upsert contact (Supabase)
2. Update conversation history in contact record
3. Call AI with conversation context + config
4. Receive **structured JSON** (reply + decision flags)
5. Update contact with latest state and metrics
6. Return **flat JSON** for ManyChat field mapping

**ManyChat Logic:**

* Map fields → custom fields; route based on flags.
* Use native MC UI for buttons/images and **built-in CTR/A/B**.
* Track conversions natively; server handles hard data writes.

---

## **Flow & Config Toggles**

**Capture location (switchable):**

* `capture_mode = "dm"` → collect email/phone inside DM; skip funnel.
* `capture_mode = "funnel"` → send link with `?mcid={{subscriber.id}}`; funnel posts back via webhook.

**Decision JSON (high-level contract):**

* Required: `reply_text` (string)
* Optional: `booking_flag` (bool), `booking_url` (string), `resource_type` (string), `objections_json` (stringified array), `lead_stage` (string), `set_fields_json` (stringified object)
* Model is forced to **JSON-only** output (`response_format = json_object`).

**A/B & Versioning:**

* `bot_version` and `prompt_version` set via config; logged on each event.
* Randomization at **user level** (stable by `mcid`) to prevent cross-talk.
* ManyChat runs visual A/B for UI variants; backend tracks version IDs.

---

## **Packability & Multi‑Tenant**

* **Single codebase**, per-client `.env` for API keys, Supabase URL, feature flags.
* Option A (simple): one Supabase project per client.
* Option B (scaled): multi-tenant tables with `tenant_id` on every row + RLS.
* **ManyChat template** duplicated per client; required CFs consistent naming.

---

## **Funnel Metrics – MVP Dashboard (focus for now)**

**Purpose:** Give clients a clean view of funnel performance without overbuild.

**Unified funnel (works for DM-only or funnel path):**

1. **DM Start** → first inbound message from user
2. **Lead Captured** → email/phone captured (either DM or funnel submit)
3. **Booking Link Shown** → bot presented link
4. **Booking Clicked** → user clicked booking CTA (from ManyChat CTR)
5. **Booked** → calendar confirmation (if/when integrated)
6. **Purchased** → Stripe event (optional, later)

**Core metrics (daily + by variant):**

* **DM→Lead Rate** = Leads / DM Starts
* **Lead→Booking Click Rate** = Booking Clicks / Leads
* **Lead→Booked Rate** (when enabled)
* **DM→Booked Rate**
* **Variant Lift** (A vs. B) by step

**Dimensions:** `client`, `campaign`, `bot_version`, `variant_id`, `channel (ig/fb)`

**Implementation (MVP):**

* **Events in Supabase** only (no Sheets dependency).
* Create SQL **views**:

  * `vw_funnel_events` (normalized events)
  * `vw_funnel_steps_daily` (counts per step/day)
  * `vw_variant_performance` (rates by variant)
* **Dashboard**: lightweight Next.js page `/dashboard` reading those views via Supabase JS (basic auth); charts later.

**Event mapping (source → step):**

* **ManyChat**: DM start, booking link shown, booking click (CTR export or tag event)
* **Perspective**: lead captured via webhook (email/phone + `mcid`)
* **Calendar/Stripe**: booked/purchase webhooks (optional, phase 2)

---

## **Minimum Effective Dataset (MED) - Single Table**

### Contacts Table (All-in-One)

Keep lean, client-agnostic; add specifics as needed. Store conversation history and metrics directly in the contact record.

* `mcid` (PK, text) – ManyChat subscriber\_id
* `channel` (text) – `ig` | `fb`
* `name`, `username` (text)
* `email`, `phone` (text)
* `stage` (text enum) – `new`, `lead`, `qualified`, `booked`, `attended`, `purchased`, `disqualified`, `archived`
* `tags` (jsonb array of strings) – raw ManyChat tags
* `ab_variant` (text) – derived from tags (e.g., `A`/`B`)
* `acquisition_source` (text) – `organic` | `paid` (derive from tags or UTM)
* `trigger_tag` (text) – primary trigger/campaign tag
* **Conversation Data:**
  * `conversation_history` (jsonb) – array of message objects with role, content, timestamp
  * `last_ai_response` (text) – most recent AI reply
  * `total_messages` (int) – message count
* **Metrics/Events (embedded):**
  * `dm_started_at` (timestamptz)
  * `lead_captured_at` (timestamptz)
  * `booking_shown_at` (timestamptz)
  * `booking_clicked_at` (timestamptz)
  * `booked_at` (timestamptz)
  * `attended_at` (timestamptz)
  * `purchased_at` (timestamptz)
* **Client‑specific (current project):** `symptoms` (text), `months_postpartum` (int), `objections_json` (jsonb)
* `last_igfb_interaction_at`, `last_mc_interaction_at` (timestamptz)
* `purchase_amount_cents` (int), `currency` (text, default `USD`)
* `custom_json` (jsonb) – for future client-specific fields
* `created_at`, `updated_at`, `archived_at` (timestamptz)

### Stage transitions (simple + opinionated)

* When `lead_captured_at` is set → `stage = lead`
* When `booking_clicked_at` is set → `stage = qualified`
* When `booked_at` is set → `stage = booked`
* When `attended_at` is set → `stage = attended`
* When `purchased_at` is set → `stage = purchased`
* Manual `disqualified` allowed at any time

### Retention & archiving

* **Rule:** if `last_igfb_interaction_at` > **90 days** and `stage` ∉ {`booked`,`attended`,`purchased`} → set `archived_at` and `stage = archived`.
* Weekly job; dashboard excludes `archived` by default.

### A/B & Tagging (keep it simple)

* ManyChat applies two tags:

  * `ab:A` or `ab:B`
  * `source:organic` or `source:paid`
* Server extracts and writes: `ab_variant`, `acquisition_source`, `trigger_tag` (first tag that matches `trigger:*`).

### Attribution placeholders (don't overbuild yet)

* In **Contacts**: `acquisition_source`
* In **Contacts**: `attribution_json` (store any of: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `gclid`, `fbclid`, `referrer`)

### Simplified Tracking

* Track key moments using timestamp fields (e.g., `booking_shown_at`, `booked_at`)
* No need for separate event records - everything in the contact record

### Minimum ManyChat Custom Fields (CFs)

* `reply_text`
* `booking_flag`, `booking_url`
* `email`, `phone`
* `symptoms`, `months_postpartum`, `objections_json`
* (Tags handled natively in MC; server reads them when payload includes tags.)

### Endpoint responsibilities (simplified)

* Parse MC payload → normalize **tags** into `ab_variant`, `acquisition_source`, `trigger_tag`.
* Upsert **Contacts** with conversation history and timestamp fields.
* Update **Stage** based on timestamp fields being set.
* Enforce retention rule (archive pass) on a daily/weekly cron.
* Return flat JSON to MC; do **not** auto‑write summaries yet.

---

## **Dashboard – Funnel Metrics (MVP)**

Focus on funnel only; contacts view later.

**KPIs (by day + by `ab_variant` + by `acquisition_source`):**

* DM Starts (count where `dm_started_at` is not null)
* Leads (count where `lead_captured_at` is not null)
* Booking Links Shown (count where `booking_shown_at` is not null)
* Booking Clicks (count where `booking_clicked_at` is not null)
* Booked (count where `booked_at` is not null)
* Attended (count where `attended_at` is not null)
* Purchased (count where `purchased_at` is not null)
* Rates: `Leads/DM`, `Clicks/Leads`, `Booked/Leads`, `Attended/Booked`, `Purchased/Leads`

**Implementation:**

* Query directly from `contacts` table using timestamp fields
* Group by date ranges using date functions on timestamp fields
* Filter by `ab_variant` and `acquisition_source` directly

**Dashboard page (`/dashboard`):** simple table of steps + conversion rates with filters: date range, variant, source.

---

## **Mandatory Components**

**ManyChat**

* External Request nodes
* Custom Fields: `thread_id`, `reply_text`, decision flags, contact data
* Rich UI flows (offers, bookings, resources) + A/B

\*\*Vercel \*\***`/ai-router`**

* Accept MC payload → Supabase writes → AI call → flat JSON return
* Optional outbound (CAPI/Stripe) only when flags require it

**Supabase**

* Single table: contacts (with embedded conversation history and metrics)
* Service role key on server only; **RLS enabled**
* Simple queries for metrics directly from contacts table

**Dev Stack**

* **Claude Code + VS Code** for editing/refactoring
* Git for versioning scripts/prompts/config
* Config files for feature toggles & AB versions

---

## **Security & Privacy (quick rules)**

* Only store necessary PII (email/phone); hash for external attribution if needed.
* Keep Supabase **service key server-side**; RLS on all tables.
* Verify Stripe signatures; use shared secret on webhooks from MC/Perspective.
* Validate any URLs before returning to chat (no model-invented links).

---

## **SLOs & Ops (MVP)**

* **Latency target:** < 2.5s p95 per AI reply.
* **Error budget:** < 1% failed requests.
* **Logging:** store `status`, `latency_ms`, `version`, `variant_id` on each event.
* **Alert:** simple Slack webhook when p95 > 3.5s for 5 min or error rate > 2%.

---

## **Deployment & Onboarding**

1. Duplicate ManyChat master template
2. Configure `.env` for client (API keys, Supabase URL, toggles)
3. Deploy `/ai-router` to Vercel
4. Connect MC External Requests; map response fields
5. Verify Supabase writes + metrics views
6. Run test conversations; validate booking/resources logic

---

---

## **Future Considerations**

* Multi-channel (WhatsApp/SMS)
* Client dashboards with charts (Metabase/Retool later)
* Automated Sheet export (if requested)
* Model specialization per vertical

---

## **Lightweight Architecture Diagram (Mermaid)**

```mermaid
flowchart LR
  subgraph IG/FB DM
    U[User]
    MC[ManyChat Flows\n- CFs (thread_id, reply, flags)\n- A/B variants\n- Pixel/Tracking]
    U -->|DM message| MC
  end

  MC -->|External Request\n(subscriber_id, thread_id?, message, profile)| API[/Vercel: /ai-router/]

  subgraph Backend (Vercel)
    API --> SUP[(Supabase)]
    API --> AI[AI Model\n(JSON-only decisions)]
    AI --> API
    API --> SUP
  end

  SUP <-->|contacts / threads / events| API

  API -->|flat JSON\n(reply_text, booking_flag, booking_url, ...)| MC

  MC -->|booking_flag = true| BookFlow[Booking Flow\n(buttons, image, A/B, CTR)]
  MC -->|else| Reply[Send {{reply_text}}]

  API -->|if flagged| CAPI[Meta/Google CAPI]
  API -->|if purchase| Stripe((Stripe Webhook))
  Stripe --> API
  API --> SUP

  U -->|Link with mcid| Funnel[Perspective / Landing Page]
  Funnel -->|Webhook\n(mcid, email, phone)| API

  SUP -->|views| Dash[Metrics Page /dashboard]
```

---

# **Build Specification (for Claude Code & VS Code)**

## **Stack & Principles**

* **Framework:** Next.js (App Router) on **Vercel**
* **Data:** **Supabase** (Postgres + Row Level Security)
* **Bot Endpoint:** single route `POST /api/ai-router` (server-only writes, idempotent)
* **Auth:** **None** for the dashboard (shareable link, read-only views)
* **Philosophy:** MED-first, event-driven, configurable toggles, easy to clone per client

## **Environment Variables**

* `OPENAI_API_KEY` (server)
* `MANYCHAT_API_KEY` (server)
* `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server)
* `SUPABASE_ANON_KEY` (client read for views only)
* Optional: `META_ACCESS_TOKEN` (CAPI, phase 2), `STRIPE_WEBHOOK_SECRET` (phase 2)

## **Config Toggles (per client)**

* `capture_mode`: `dm` | `funnel`
* `bot_version` / `prompt_version`: strings
* `features`: `{ booking:boolean, resources:boolean, capi:boolean }`
* `tenant_id`: string (if multi-tenant hosting)

## **API Contract: `/api/ai-router`**

**Request (from ManyChat External Request)**

```json
{
  "subscriber_id": "string",
  "message": "string",
  "channel": "ig|fb",
  "profile": {"name":"","username":"","email":"","phone":""},
  "tags": ["trigger:xyz","ab:A","source:paid"],
  "message_id": "string|null"
}
```

**Server responsibilities**

1. Upsert **contacts** (derive `ab_variant`, `acquisition_source`, `trigger_tag` from tags)
2. Append to conversation history
3. Update timestamp fields (`dm_started_at`, `lead_captured_at`, etc.) as applicable
4. Call AI (JSON-only) → parse decision flags
5. Update contact with AI response and new state
6. **Return flat JSON** to ManyChat (reply + flags)

**Response (to ManyChat mapping)**

```json
{
  "reply_text": "string",
  "booking_flag": true,
  "booking_url": "https://...",
  "objections_json": "[\"price\"]",
  "set_fields_json": "{\"score\":82}",
  "lead_stage": "qualified"
}
```

## **Tracking Points (update timestamp fields)**

Track key moments by setting timestamp fields: `dm_started_at`, `lead_captured_at`, `booking_shown_at`, `booking_clicked_at`, `booked_at`, `attended_at`, `purchased_at`.

---

# **Dashboard Specification (public, read-only)**

* **Route:** `/dashboard` (Next.js page)
* **Data source:** Supabase **views** only
* **Access:** public link, no login
* **Filters:** date range, `ab_variant`, `acquisition_source`
* **Primary widget:** **Funnel Ladder** table (counts + % of total + % of previous)

**Data feeding the funnel:** use SQL function below to compute the ladder.

### **Public Read Policy (views only)**

```sql
-- Allow anonymous SELECT on views (not on base tables)
create role if not exists dashboard_anonymous;
-- In Supabase: map anon key to this role via RLS policies on views

alter view public.vw_funnel_events        owner to postgres;
alter view public.vw_funnel_steps_daily   owner to postgres;
alter view public.vw_variant_performance  owner to postgres;

-- Policies for views (Postgres treats views with security barrier via policies on base; we’ll expose via a helper view):
-- Simplest: create dedicated MATERIALIZED VIEWs and grant read.
grant select on public.vw_funnel_steps_daily to anon;
grant select on public.vw_variant_performance to anon;
```

> If you prefer not to grant anon, proxy through `/api/funnel` that calls the function server-side.

### **Funnel Roll‑Up (function)**

Use the ladder you asked for (cumulative counts, two % columns).  See **Appendix B** for the full function `public.funnel_rollup(_ab_variant, _acq_source)`.

---

# **Data & Stage Logic**

* Keep **MED** schema from above.
* Stage precedence lives in `public.stage_rules` (editable).
* On each **event insert**, trigger updates `contacts.stage`, `stage_label`, `stage_rank`, and month buckets.
* Nightly archive job: set `archived_at` if no interaction for 90 days and not `booked/attended/purchased`.

---

# **Integrations (ingest sources)**

* **ManyChat** → External Request → `/api/ai-router` (primary)
* **Perspective.co** → Webhook with `{ mcid, email, phone }` → `/ai-router`
* **Stripe** (phase 2) → Webhook → `/api/ai-router` (map to `purchased`)
* **Meta CAPI** (optional): fire server-side on flagged events

---

# **Directory Layout (suggested)**

```
/apps
  /web
    /app
      /api/ai-router/route.ts    # main endpoint
      /dashboard/page.tsx        # funnel table
    /lib/supabase.ts             # client + server clients
    /lib/config.ts               # toggles (capture_mode, versions)
    /lib/model.ts                # AI call helpers
    /lib/events.ts               # write events + stage sync
/docs
  project-charter.md             # this file
/sql
  001_med_schema.sql             # tables + indexes
  002_stage_rules.sql            # seed/updates
  003_views_rollup.sql           # views + funnel_rollup()
```

---

# **Deployment Notes**

1. Run SQL in `/sql` (schema, rules, views, function).
2. Deploy Next.js on Vercel; set env vars.
3. Wire ManyChat External Request → `/api/ai-router`; map response fields.
4. Share `/dashboard` link with client.

**SLOs**: p95 < 2.5s per reply, error rate < 1%.
**Logging**: store `latency_ms`, `status`, `version`, `variant_id` per event.

---

# **Appendix A – Single Table DDL**

*(Simplified single-table approach)*

```sql
create table if not exists public.contacts (
  mcid text primary key,
  channel text,
  name text,
  username text,
  email text,
  phone text,
  stage text default 'new',
  tags jsonb default '[]'::jsonb,
  ab_variant text,
  acquisition_source text,
  trigger_tag text,
  
  -- Conversation data
  conversation_history jsonb default '[]'::jsonb,
  last_ai_response text,
  total_messages int default 0,
  
  -- Event timestamps for funnel tracking
  dm_started_at timestamptz,
  lead_captured_at timestamptz,
  booking_shown_at timestamptz,
  booking_clicked_at timestamptz,
  booked_at timestamptz,
  attended_at timestamptz,
  purchased_at timestamptz,
  
  -- Client-specific fields
  symptoms text,
  months_postpartum int,
  objections_json jsonb,
  
  -- Metadata
  last_igfb_interaction_at timestamptz,
  last_mc_interaction_at timestamptz,
  purchase_amount_cents int,
  currency text default 'USD',
  attribution_json jsonb,
  custom_json jsonb,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz
);

-- Index for faster queries
create index idx_contacts_stage on public.contacts(stage);
create index idx_contacts_dm_started on public.contacts(dm_started_at);
create index idx_contacts_lead_captured on public.contacts(lead_captured_at);
create index idx_contacts_ab_variant on public.contacts(ab_variant);
create index idx_contacts_acquisition_source on public.contacts(acquisition_source);
```

---

# **Appendix B – Simplified Funnel Queries**

```sql
-- Simple funnel metrics query
select 
  date_trunc('day', dm_started_at) as date,
  ab_variant,
  acquisition_source,
  count(*) filter (where dm_started_at is not null) as dm_starts,
  count(*) filter (where lead_captured_at is not null) as leads,
  count(*) filter (where booking_shown_at is not null) as bookings_shown,
  count(*) filter (where booking_clicked_at is not null) as bookings_clicked,
  count(*) filter (where booked_at is not null) as booked,
  count(*) filter (where attended_at is not null) as attended,
  count(*) filter (where purchased_at is not null) as purchased
from public.contacts
where dm_started_at >= current_date - interval '30 days'
group by 1, 2, 3
order by 1 desc;

-- Conversion rates function
create or replace function public.calculate_funnel_rates(
  _ab_variant text default null,
  _acq_source text default null
) returns table (
  metric_name text,
  value numeric(6,2)
) language sql as $$
with counts as (
  select 
    count(*) filter (where dm_started_at is not null) as dm_starts,
    count(*) filter (where lead_captured_at is not null) as leads,
    count(*) filter (where booking_clicked_at is not null) as bookings_clicked,
    count(*) filter (where booked_at is not null) as booked,
    count(*) filter (where attended_at is not null) as attended,
    count(*) filter (where purchased_at is not null) as purchased
  from public.contacts
  where (_ab_variant is null or ab_variant = _ab_variant)
    and (_acq_source is null or acquisition_source = _acq_source)
)
select 'Lead Capture Rate' as metric_name, 
       case when dm_starts > 0 then round(100.0 * leads / dm_starts, 2) else 0 end as value
from counts
union all
select 'Booking Click Rate',
       case when leads > 0 then round(100.0 * bookings_clicked / leads, 2) else 0 end
from counts
union all
select 'Booking Conversion',
       case when leads > 0 then round(100.0 * booked / leads, 2) else 0 end
from counts
union all
select 'Show Rate',
       case when booked > 0 then round(100.0 * attended / booked, 2) else 0 end
from counts
union all
select 'Purchase Rate',
       case when leads > 0 then round(100.0 * purchased / leads, 2) else 0 end
from counts; $$;
```
