# System Architecture Overview

**Last Updated:** November 8, 2025
**System Version:** v2.2
**Status:** Production (Deployed & Active)

---

## 🎯 System Purpose

MCB is a **data collection and analytics system** for Postpartum Care USA. It captures customer journey events from multiple platforms and generates automated weekly reports with AI-powered insights.

**What it IS:**
- Real-time event tracking from 5 platforms
- Centralized data warehouse (Supabase)
- Automated weekly AI reports
- Meta Ads performance attribution

**What it is NOT:**
- A user-facing dashboard (no login/UI for customers)
- A booking/checkout system (uses GoHighLevel)
- A chatbot platform (uses ManyChat)

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL PLATFORMS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ManyChat    GoHighLevel    Stripe    Denefits    Perspective  │
│  (Chatbot)   (CRM/Booking)  (Payment) (BNPL)      (Checkout)   │
│                                                                  │
└───┬──────────────┬───────────┬───────────┬─────────────┬────────┘
    │              │           │           │             │
    │ Webhooks     │ Webhooks  │ Webhooks  │ Webhooks    │ Webhooks
    │              │           │           │             │
    ↓              ↓           ↓           ↓             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL API (Next.js)                         │
│               https://mcb-dun.vercel.app/                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  /api/manychat          → DM qualification tracking             │
│  /api/ghl-webhook       → Booking/attendance events             │
│  /api/stripe-webhook    → Payment processing                    │
│  /api/denefits-webhook  → BNPL financing                        │
│  /api/perspective-webhook → Checkout abandonment                │
│                                                                  │
│  /api/reports/weekly-data → JSON for AI reports                │
│  /api/cron/generate-report → Trigger AI report                 │
│                                                                  │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ Store Events
             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                            │
│                    (PostgreSQL)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  contacts               → Main customer records (UUID)          │
│  payments               → All payment transactions              │
│  webhook_logs           → Event history (debugging)             │
│  stripe_webhook_logs    → Stripe-specific events                │
│  meta_ads               → Ad performance data                   │
│  meta_ad_creatives      → Creative themes & messaging           │
│  meta_ad_insights       → Daily spend/metrics                   │
│  weekly_snapshots       → Weekly summary for reports            │
│                                                                  │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ Query Data
             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOMATION LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Make.com Scenario (Fridays 5:17 PM UTC)                       │
│    ├─→ Fetch weekly data from /api/reports/weekly-data        │
│    ├─→ Send to OpenAI Assistant (Clara)                       │
│    ├─→ AI generates report with insights                      │
│    └─→ Email to stakeholders                                  │
│                                                                  │
│  Meta Ads Sync (Manual/Scheduled)                              │
│    └─→ scripts/sync-meta-ads.js                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow: Customer Journey

### Phase 1: Ad Click → Subscribe

```
1. User sees Meta Ad
   ├─→ Clicks ad (tracked: AD_ID)
   └─→ Lands on landing page

2. User subscribes to ManyChat bot
   ├─→ ManyChat webhook fires
   ├─→ /api/manychat receives event
   ├─→ Creates contact record
   └─→ Stores: MC_ID, AD_ID, subscribe_date

Database: contacts table
Fields Set: id (UUID), mc_id, ad_id, subscribe_date, source
```

### Phase 2: Bot Conversation → Qualification

```
3. User answers bot questions
   ├─→ ManyChat tracks progress
   ├─→ Webhook fires on qualification
   ├─→ /api/manychat updates contact
   └─→ Stores: dm_qualified_date, symptoms, transformation_theme

Database: contacts table
Fields Set: dm_qualified_date, [symptom fields]
```

### Phase 3: Booking → Meeting

```
4. User clicks booking link
   ├─→ GoHighLevel form submission
   ├─→ GHL webhook fires
   ├─→ /api/ghl-webhook receives event
   └─→ Matches contact by email/mc_id
   └─→ Stores: ghl_id, meeting_booked_date

5. User attends discovery call
   ├─→ GHL webhook fires (OpportunityStageUpdate)
   ├─→ /api/ghl-webhook updates contact
   └─→ Stores: meeting_held_date

Database: contacts table
Fields Set: ghl_id, meeting_booked_date, meeting_held_date
```

### Phase 4: Purchase → Payment

```
6. User purchases program
   ├─→ Stripe checkout session
   ├─→ Stripe webhook fires (checkout.session.completed)
   ├─→ /api/stripe-webhook receives event
   ├─→ Creates payment record
   ├─→ Links to contact by email
   └─→ Updates contact: purchase_date, purchase_amount

Database:
  contacts → purchase_date, purchase_amount
  payments → id, contact_id, amount, payment_source
```

### Alternative: BNPL Payment

```
6b. User chooses Denefits BNPL
   ├─→ Denefits processes financing
   ├─→ Make.com receives notification
   ├─→ Calls /api/denefits-webhook
   ├─→ Creates payment record
   └─→ Links to contact by email

Database: Same as Stripe payment
```

---

## 🔌 Webhook Endpoints (Detail)

### 1. ManyChat Webhook (`/api/manychat`)

**Purpose:** Track chatbot conversations and qualification

**Events Handled:**
- New subscriber
- DM qualified (answered all questions)
- Link sent/clicked
- Symptom tracking
- Transformation theme detection

**Data Stored:**
- `mc_id` (Manychat subscriber ID)
- `subscribe_date`
- `dm_qualified_date`
- Symptom fields (energy, weight, diastasis, etc.)
- `transformation_theme` (overwhelm_to_relief, confusion_to_clarity, etc.)

**Matching Strategy:** Creates new contact if MC_ID doesn't exist

---

### 2. GoHighLevel Webhook (`/api/ghl-webhook`)

**Purpose:** Track bookings and meeting attendance

**Events Handled:**
- Contact created/updated
- Form submission (booking)
- Opportunity stage change (meeting held)
- Package shipment

**Data Stored:**
- `ghl_id` (GoHighLevel contact ID)
- `meeting_booked_date`
- `meeting_held_date`
- `package_sent_date`
- Contact details (name, email, phone)

**Matching Strategy:**
1. Try MC_ID from customData (if provided)
2. Try GHL_ID (if contact exists)
3. Try email (case-insensitive)
4. Create new contact if no match

---

### 3. Stripe Webhook (`/api/stripe-webhook`)

**Purpose:** Track payments and checkouts

**Events Handled:**
- `checkout.session.completed` → Payment received
- `charge.refunded` → Refund processed
- `checkout.session.expired` → Checkout abandoned

**Data Stored:**
- Creates `payments` record
- Links to `contacts` by email
- Updates `purchase_date` and `purchase_amount` on contact
- Logs all events to `stripe_webhook_logs`

**Matching Strategy:** Links payment to contact by customer_email

---

### 4. Denefits Webhook (`/api/denefits-webhook`)

**Purpose:** Track BNPL financing payments

**Triggered By:** Make.com scenario (Denefits → Make.com → Vercel)

**Data Stored:**
- Creates `payments` record with source = 'denefits'
- Links to `contacts` by email
- Updates purchase fields

**Matching Strategy:** Same as Stripe (email-based)

---

### 5. Perspective Webhook (`/api/perspective-webhook`)

**Purpose:** Track checkout abandonment

**Events Handled:**
- Checkout session abandoned
- Cart details captured

**Data Stored:**
- Logs to `webhook_logs`
- Can be used for remarketing

---

## 📊 Database Schema (v2.2)

### Core Tables

**contacts**
```sql
Primary Key: id (UUID)
Foreign Keys: None (central table)

Key Fields:
├── Identity
│   ├── mc_id (ManyChat ID)
│   ├── ghl_id (GoHighLevel ID)
│   ├── ad_id (Meta Ad ID)
│   └── email_primary, email_booking
│
├── Journey Timestamps
│   ├── subscribe_date
│   ├── dm_qualified_date
│   ├── link_sent_date, link_clicked_date
│   ├── form_submitted_date
│   ├── meeting_booked_date
│   ├── meeting_held_date
│   ├── package_sent_date
│   └── purchase_date
│
└── Revenue & Attribution
    ├── purchase_amount (cumulative)
    ├── ad_id (for ROAS calculation)
    └── source (instagram, website, etc.)
```

**payments**
```sql
Primary Key: id (UUID)
Foreign Key: contact_id → contacts(id)

Fields:
├── amount
├── payment_source (stripe, denefits)
├── payment_date
├── customer_email (used for matching)
└── stripe_payment_intent_id (if Stripe)
```

**webhook_logs**
```sql
Primary Key: id (UUID)
Foreign Key: contact_id → contacts(id)

Fields:
├── source (manychat, ghl, stripe, etc.)
├── event_type
├── event_data (JSONB)
├── contact_id (if matched)
└── created_at
```

### Meta Ads Tables

**meta_ads**
- Ad performance data (impressions, clicks, spend)

**meta_ad_creatives**
- Creative content analysis
- Transformation themes (overwhelm_to_relief, etc.)
- Symptom focus (energy, weight, etc.)
- Headlines and primary text

**meta_ad_insights**
- Daily performance snapshots
- Spend by date
- Used for ROAS calculations

### Reporting Tables

**weekly_snapshots**
- High-level weekly metrics
- Used for week-over-week comparisons
- Stores recommendations given to user

**ab_tests**
- A/B test tracking
- Hypothesis, variants, results
- Statistical significance

**ad_performance_weekly**
- Detailed ad history by week
- Contacts, qualified, qualify rate
- Revenue and ROAS per ad

---

## 🤖 AI Reporting System

### Architecture

```
Friday 5:17 PM UTC
     ↓
Make.com Trigger
     ↓
HTTP GET → /api/reports/weekly-data
     ↓
Returns JSON:
  - Metrics (contacts, revenue, ROAS)
  - Top 5 ads with creative data
  - Week-over-week comparison
  - Previous recommendations
     ↓
Make.com → OpenAI Assistant (Clara)
     ↓
Clara generates report:
  - Uses thread memory (remembers previous weeks)
  - Compares to last week
  - Identifies patterns
  - Gives specific recommendations
     ↓
Make.com → Email
     ↓
Sent to stakeholders
```

### OpenAI Assistant ("Clara")

**Model:** GPT-4o
**Temperature:** 0.7 (creative but consistent)

**Context Awareness:**
- Phase 1: 536 contacts, $120K revenue (historical)
- Phase 2: Attribution push (2 months)
- Phase 3: 30-day holding pattern (current)
- Key insight: "Overwhelm to Relief" > "Confusion to Clarity"
- Conversion timeline: ~28 days

**Memory:** Thread stores all previous reports automatically

**Report Structure:**
1. Hi Eric (personal intro)
2. System Status (current phase)
3. This Week's Numbers (metrics + comparisons)
4. Top Performing Ads (with creative insights)
5. What We're Learning (patterns)
6. Action Items (2-5 specific recommendations)
7. Bottom Line (TL;DR)

---

## 🔐 Security & Authentication

### Webhook Security

**Stripe:**
- Signature verification using `stripe-signature` header
- Secret: `STRIPE_WEBHOOK_SECRET`

**GoHighLevel:**
- No signature verification (GHL limitation)
- Validates event structure and required fields

**ManyChat:**
- Optional token verification
- Validates MC_ID format

**Denefits/Perspective:**
- Currently no authentication
- Low risk (creates payment records only)

### API Route Security

**Weekly Data API:**
- Requires `Authorization: Bearer CRON_SECRET`
- Returns 401 if missing/incorrect
- Only called by Make.com (scheduled)

**Cron Jobs:**
- Vercel cron authentication
- CRON_SECRET environment variable

---

## 🚀 Deployment

### Vercel (API & Webhooks)

**Auto-deploy:**
- Push to GitHub main branch
- Vercel detects changes
- Runs `npm run build`
- Deploys to https://mcb-dun.vercel.app/

**Environment Variables:**
- Set in Vercel dashboard
- Available to all API routes
- Include: Supabase, Stripe, Meta, OpenAI keys

### Supabase (Database)

**Managed PostgreSQL:**
- No manual deployment
- Migrations applied via SQL editor or scripts
- Automatic backups

### Make.com (Automation)

**Weekly Report Scenario:**
- 6 modules (HTTP, OpenAI x3, Email)
- Scheduled: Fridays 5:17 PM UTC
- Can be triggered manually for testing

---

## 📦 Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 15.4.6 | API routes (no UI) |
| **Database** | Supabase (PostgreSQL) | Data storage |
| **Payments** | Stripe 18.5.0 | Payment processing |
| **AI** | OpenAI GPT-4o | Weekly reports |
| **Automation** | Make.com | Workflow orchestration |
| **Hosting** | Vercel | API deployment |
| **Language** | TypeScript 5 | Type safety |

**Dependencies:**
- `@supabase/supabase-js` (2.54.0)
- `stripe` (18.5.0)
- `openai` (6.8.1)
- `resend` (6.4.1) - optional email
- `dotenv` (17.2.3)

---

## 🔧 Development Workflow

### Local Development

```bash
# Setup
git clone [repo]
cd MCB
npm install

# Add .env.local with all keys

# Start dev server
npm run dev

# Test webhooks
curl http://localhost:3000/api/stripe-webhook
```

### Testing Webhooks

**Stripe:**
- Use Stripe CLI for local testing
- `stripe listen --forward-to localhost:3000/api/stripe-webhook`

**GoHighLevel:**
- Use webhook test in GHL UI
- Set URL to localhost using ngrok

**ManyChat:**
- Test via ManyChat test tool
- Or use Postman with sample payload

### Database Queries

```bash
# Supabase SQL Editor or scripts
node scripts/check-database-status.js
node scripts/analyze-contacts.js
```

### Meta Ads Sync

```bash
# Manual sync (respects rate limits)
node scripts/sync-meta-ads.js
```

---

## 📈 Monitoring & Debugging

### Vercel Logs

```
vercel.com/dashboard → [project] → Logs
- View real-time API requests
- Filter by endpoint
- See errors and stack traces
```

### Supabase Logs

```
supabase.com/dashboard → [project] → Logs
- Database queries
- Slow queries
- Error logs
```

### Webhook Logs (Database)

```sql
-- View recent webhook events
SELECT * FROM webhook_logs
ORDER BY created_at DESC
LIMIT 20;

-- Check for errors
SELECT * FROM webhook_logs
WHERE event_data->>'error' IS NOT NULL;

-- View Stripe events
SELECT * FROM stripe_webhook_logs
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🐛 Common Issues & Solutions

### Issue: Orphan Payments

**Symptom:** Payments not linked to contacts
**Cause:** Email mismatch (customer_email doesn't match contact)
**Solution:**
1. Check for contacts with similar names/phones
2. Manually link payment to contact
3. Update contact email if needed

### Issue: Low MC→GHL Linkage

**Symptom:** Few contacts have both MC_ID and GHL_ID
**Cause:** GHL not receiving MC_ID in form submission
**Solution:**
1. Verify hidden fields in GHL form
2. Check URL parameters are passing
3. Review GHL webhook customData

### Issue: Meta Ads Rate Limit

**Symptom:** Sync script throws "rate limit reached"
**Cause:** Too many API calls in short time
**Solution:** Wait 30 minutes, retry

---

## 🔗 External Integrations

### Meta Business Suite

**Purpose:** Ad performance tracking
**API:** Graph API v20.0
**Credentials:** `META_ACCESS_TOKEN`
**Rate Limits:** ~200 calls per hour

### Stripe

**Purpose:** Payment processing
**Webhooks:** Auto-retry on failure
**Test Mode:** Available for development

### GoHighLevel

**Purpose:** CRM and booking system
**Webhooks:** Configured per workflow
**API:** Limited use (mostly incoming webhooks)

### ManyChat

**Purpose:** Instagram DM chatbot
**Webhooks:** External Request blocks
**API:** Used for fetching subscriber data

---

## 📚 Related Documentation

- **System Status:** `CURRENT_STATUS.md`
- **Database Schema:** `DATABASE_SCHEMA.md` *[to be created]*
- **Webhook Guide:** `WEBHOOK_GUIDE.md`
- **API Reference:** `API_ENDPOINTS.md` *[to be created]*
- **Project Guide:** `CLAUDE.md`

---

**Last Updated:** November 8, 2025
**Maintained By:** Connor Johnson / AI Agents
**Review Schedule:** Monthly or after major changes
