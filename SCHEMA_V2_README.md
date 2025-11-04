# MCB Database Schema v2.0

**Created:** November 2, 2025
**Philosophy:** Simple, timestamp-based tracking. No complex calculations, just raw data.

## Core Principle

If a timestamp field has a value, that event happened. No boolean flags needed.

## The Contacts Table

### Primary Identifiers

| Field | Type | Purpose |
|-------|------|---------|
| `MC_ID` | TEXT (PRIMARY KEY) | Manychat ID - the main identifier for anyone in the funnel |
| `GHL_ID` | TEXT | Go High Level ID - added when contact is pushed to GHL |
| `AD_ID` | TEXT | Facebook/Meta Ad ID - critical for ROAS tracking |

**Why MC_ID is primary:**
- Every lead starts in Manychat
- MC_ID is assigned immediately on first interaction
- Other IDs (GHL_ID, email) come later in the funnel

### Contact Information

| Field | Type | Notes |
|-------|------|-------|
| `first_name` | TEXT | |
| `last_name` | TEXT | |
| `email` | TEXT | Critical for matching Stripe payments |
| `phone` | TEXT | |
| `IG` | TEXT | Instagram username |
| `FB` | TEXT | Facebook name (rarely used) |

### Funnel Stage & Testing

| Field | Type | Values/Purpose |
|-------|------|----------------|
| `stage` | TEXT | `new_lead`, `DM_qualified`, `landing_link_sent`, `landing_link_clicked`, `form_submitted`, `meeting_booked`, `meeting_held`, `purchased`, `feedback_requested`, `feedback_received` |
| `chatbot_AB` | TEXT | Which chatbot variant: A or B |
| `MISC_AB` | TEXT | Any other AB tests |
| `trigger_word` | TEXT | Word that triggered conversation (comma-separated if multiple) |

**Stage is descriptive only** - it tells you where they are, but timestamps tell you when they got there.

### Qualification Questions

| Field | Type | Purpose |
|-------|------|---------|
| `Q1_question` | TEXT | Answer to first softball question |
| `Q2_question` | TEXT | Answer to second question |
| `objections` | TEXT | Recorded objections for later analysis |

### Timestamps (The Heart of the Schema)

All timestamps are `TIMESTAMPTZ` (includes date + time + timezone).

| Field | Event It Represents |
|-------|---------------------|
| `subscribe_date` | When they first opted in to Manychat |
| `followed_date` | When they became a follower (may be before subscribe) |
| `DM_qualified_date` | When they answered both qualification questions |
| `link_send_date` | When chatbot sent the booking link |
| `link_click_date` | When lead clicked the link |
| `form_submit_date` | When they submitted the form on funnel page |
| `meeting_book_date` | When they booked the meeting |
| `meeting_held_date` | When they actually attended |
| `purchase_date` | When they made their first purchase |

**Why timestamps matter:**
- Calculate time-to-conversion at each stage
- Identify bottlenecks (e.g., "Why does it take 2 weeks from book to held?")
- Track performance over time
- No need for separate boolean flags

### Purchase & Revenue

| Field | Type | Purpose |
|-------|------|---------|
| `purchase_amount` | DECIMAL(10,2) | Total lifetime purchase value (cumulative) |

**Important:** When a new purchase comes in via Stripe:
```sql
UPDATE contacts
SET purchase_amount = purchase_amount + [new_amount],
    purchase_date = COALESCE(purchase_date, NOW())
WHERE MC_ID = [matched_contact];
```

This gives you **lifetime value (LTV)** per contact.

### AI & Context

| Field | Type | Purpose |
|-------|------|---------|
| `lead_summary` | TEXT | AI-generated summary from chatbot memory |
| `thread_ID` | TEXT | OpenAI Assistant API conversation ID |

These help sales teams by providing context about the lead.

## Supporting Tables

### webhook_logs

Logs ALL incoming webhooks for debugging and auditing.

```sql
CREATE TABLE webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  source TEXT,           -- 'manychat', 'ghl', 'stripe', 'make'
  event_type TEXT,
  MC_ID TEXT,            -- Associated contact
  payload JSONB,         -- Full payload
  status TEXT,           -- 'received', 'processed', 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ
);
```

### stripe_events

Simplified Stripe event tracking.

```sql
CREATE TABLE stripe_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT UNIQUE,
  event_type TEXT,
  customer_email TEXT,
  MC_ID TEXT,            -- Matched contact
  amount DECIMAL(10,2),
  status TEXT,
  raw_event JSONB,
  created_at TIMESTAMPTZ
);
```

## Data Flow

### 1. Lead Enters Funnel (Manychat)
```
New DM/comment → MC_ID assigned → subscribe_date set → stage = 'new_lead'
```

### 2. Qualification
```
Answers Q1 & Q2 → DM_qualified_date set → stage = 'DM_qualified'
```

### 3. Link Sent & Clicked
```
Chatbot sends link → link_send_date set → stage = 'landing_link_sent'
Lead clicks → link_click_date set → stage = 'landing_link_clicked'
```

### 4. Form Submission (On Funnel Page)
```
Lead submits email/phone → form_submit_date set → stage = 'form_submitted'
→ Trigger: Create contact in GHL → GHL_ID returned → Save GHL_ID to contacts
```

### 5. Meeting Booked
```
GHL webhook: "appointment_booked" → meeting_book_date set → stage = 'meeting_booked'
```

### 6. Meeting Held
```
GHL webhook: "appointment_attended" → meeting_held_date set → stage = 'meeting_held'
```

### 7. Purchase
```
Stripe webhook: "checkout.session.completed" → Match by email →
purchase_date set (if first purchase) → purchase_amount += amount → stage = 'purchased'
```

## Insights You Can Extract

### Conversion Rates
```sql
-- DM to Qualified rate
SELECT
  COUNT(*) FILTER (WHERE DM_qualified_date IS NOT NULL) * 100.0 / COUNT(*) as qualified_rate
FROM contacts
WHERE subscribe_date >= NOW() - INTERVAL '30 days';
```

### Time-to-Conversion
```sql
-- Average time from subscribe to purchase
SELECT
  AVG(purchase_date - subscribe_date) as avg_time_to_purchase
FROM contacts
WHERE purchase_date IS NOT NULL;
```

### Ad Performance (ROAS)
```sql
-- Revenue by Ad ID
SELECT
  AD_ID,
  COUNT(*) as leads,
  SUM(purchase_amount) as revenue,
  SUM(purchase_amount) / NULLIF(COUNT(*), 0) as revenue_per_lead
FROM contacts
WHERE AD_ID IS NOT NULL
GROUP BY AD_ID
ORDER BY revenue DESC;
```

### AB Test Results
```sql
-- Chatbot performance
SELECT
  chatbot_AB,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) as purchases,
  SUM(purchase_amount) as revenue
FROM contacts
GROUP BY chatbot_AB;
```

### Funnel Drop-off Analysis
```sql
-- Where are people dropping off?
SELECT
  COUNT(*) as total_subscribed,
  COUNT(*) FILTER (WHERE DM_qualified_date IS NOT NULL) as qualified,
  COUNT(*) FILTER (WHERE link_click_date IS NOT NULL) as clicked_link,
  COUNT(*) FILTER (WHERE meeting_book_date IS NOT NULL) as booked,
  COUNT(*) FILTER (WHERE meeting_held_date IS NOT NULL) as attended,
  COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) as purchased
FROM contacts
WHERE subscribe_date >= NOW() - INTERVAL '30 days';
```

## Installation

Run `schema_v2.sql` in your Supabase SQL Editor:

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy/paste the entire `schema_v2.sql` file
4. Run it

This will:
- ✅ Archive your old tables (safe, still queryable)
- ✅ Create new clean v2.0 tables
- ✅ Set up indexes for fast queries
- ✅ Create auto-update triggers

## Migration Notes

**Old data is NOT migrated automatically.**

Why? The old schema was different enough that automatic migration would be messy. Instead:
- Old data lives in `contacts_archive_20251102` (you can query it anytime)
- New system starts fresh with clean data
- Historical analysis uses the archive table

If you need to migrate specific contacts, we can write a custom migration script.

## What's Next

1. Run the migration SQL
2. Build webhook endpoints to populate this data
3. Create automated report queries
4. Set up email reporting
