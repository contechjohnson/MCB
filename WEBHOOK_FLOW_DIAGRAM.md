# Webhook Flow Diagram

**How data flows from each platform into your database.**

---

## The Big Picture

```
┌─────────────┐       ┌──────────────┐       ┌─────────┐
│  ManyChat   │       │ GoHighLevel  │       │ Stripe  │
│   (Bot)     │       │  (Booking)   │       │  (Pay)  │
└──────┬──────┘       └──────┬───────┘       └────┬────┘
       │                     │                     │
       │ Webhook             │ Webhook             │ Webhook
       ▼                     ▼                     ▼
┌──────────────────────────────────────────────────────┐
│           YOUR NEXT.JS API ENDPOINTS                 │
│                                                      │
│  /api/manychat    /api/ghl-webhook   /api/stripe    │
└──────┬────────────────┬──────────────────┬──────────┘
       │                │                  │
       │ Insert/Update  │ Insert/Update    │ Insert/Update
       ▼                ▼                  ▼
┌──────────────────────────────────────────────────────┐
│              SUPABASE DATABASE                       │
│                                                      │
│  ┌─────────────────────────────────────┐            │
│  │         contacts table              │            │
│  │                                     │            │
│  │ • MC_ID (ManyChat ID)              │            │
│  │ • GHL_ID (GoHighLevel ID)          │            │
│  │ • stripe_customer_id               │            │
│  │ • All timestamps & data            │            │
│  └─────────────────────────────────────┘            │
│                                                      │
│  ┌─────────────────────────────────────┐            │
│  │       webhook_logs table            │            │
│  │  (Every webhook attempt logged)     │            │
│  └─────────────────────────────────────┘            │
│                                                      │
│  ┌─────────────────────────────────────┐            │
│  │      stripe_events table            │            │
│  │   (Stripe-specific event data)      │            │
│  └─────────────────────────────────────┘            │
└──────────────────────────────────────────────────────┘
```

---

## Scenario 1: ManyChat → GHL → Stripe (70% of traffic)

### Step-by-Step Flow

```
USER MESSAGES BOT
     │
     ▼
ManyChat fires webhook: "contact_created"
     │
     ▼
/api/manychat receives webhook
     │
     ├─ Logs to webhook_logs
     ├─ Fetches full data from ManyChat API
     ├─ Creates new contact with MC_ID
     └─ Sets: subscribe_date, stage = "new_lead"
     │
     ▼
DATABASE: Contact created
┌────────────────────────────┐
│ MC_ID: mc_12345           │
│ email_primary: user@ex.com│
│ subscribe_date: NOW()     │
│ stage: "new_lead"         │
└────────────────────────────┘

═══════════════════════════════════

USER ANSWERS BOTH QUESTIONS
     │
     ▼
ManyChat fires webhook: "dm_qualified"
     │
     ▼
/api/manychat receives webhook
     │
     ├─ Logs to webhook_logs
     ├─ Fetches updated data from ManyChat API
     ├─ Finds contact by MC_ID
     └─ Updates: Q1, Q2, DM_qualified_date, stage
     │
     ▼
DATABASE: Contact updated
┌────────────────────────────┐
│ MC_ID: mc_12345           │
│ email_primary: user@ex.com│
│ Q1_question: "3 months"   │
│ Q2_question: "back pain"  │
│ DM_qualified_date: NOW()  │
│ stage: "DM_qualified"     │
└────────────────────────────┘

═══════════════════════════════════

USER CLICKS LINK & BOOKS
     │
     ▼
GHL fires webhook: "OpportunityCreate"
     │
     ▼
/api/ghl-webhook receives webhook
     │
     ├─ Logs to webhook_logs
     ├─ Smart match by: GHL_ID → email → phone
     ├─ FINDS existing contact (by email)
     └─ Updates: GHL_ID, meeting_book_date, stage
     │
     ▼
DATABASE: Contact linked
┌────────────────────────────┐
│ MC_ID: mc_12345           │ ← From ManyChat
│ GHL_ID: ghl_67890         │ ← NEW!
│ email_primary: user@ex.com│
│ email_booking: user@ex.com│ ← Confirmed
│ meeting_book_date: NOW()  │ ← NEW!
│ stage: "meeting_booked"   │ ← Updated
└────────────────────────────┘

═══════════════════════════════════

USER ATTENDS MEETING
     │
     ▼
GHL fires webhook: "OpportunityStageUpdate"
     │
     ▼
/api/ghl-webhook receives webhook
     │
     ├─ Finds contact by GHL_ID
     └─ Updates: meeting_held_date, stage
     │
     ▼
DATABASE: Contact updated
┌────────────────────────────┐
│ GHL_ID: ghl_67890         │
│ meeting_held_date: NOW()  │ ← NEW!
│ stage: "meeting_held"     │ ← Updated
└────────────────────────────┘

═══════════════════════════════════

USER PURCHASES
     │
     ▼
Stripe fires webhook: "checkout.session.completed"
     │
     ▼
/api/stripe-webhook receives webhook
     │
     ├─ Verifies webhook signature
     ├─ Logs to webhook_logs & stripe_events
     ├─ Finds contact by email (checks all 3 fields)
     └─ Updates: purchase info, stage
     │
     ▼
DATABASE: Contact completed journey!
┌────────────────────────────┐
│ MC_ID: mc_12345           │ ← ManyChat
│ GHL_ID: ghl_67890         │ ← GHL
│ stripe_customer_id: cus_X │ ← Stripe
│ email_payment: user@ex.com│ ← Confirmed
│ purchase_date: NOW()      │ ← NEW!
│ purchase_amount: 997.00   │ ← NEW!
│ stage: "purchased"        │ ← Final!
└────────────────────────────┘

FULL ATTRIBUTION TRACKED! 🎉
```

---

## Scenario 2: Direct to Funnel → Stripe (30% of traffic)

### Step-by-Step Flow

```
USER FILLS FORM ON WEBSITE/AD
     │
     ▼
GHL fires webhook: "OpportunityCreate"
     │
     ▼
/api/ghl-webhook receives webhook
     │
     ├─ Logs to webhook_logs
     ├─ Smart match finds NO existing contact
     └─ Creates NEW contact with GHL_ID
     │
     ▼
DATABASE: Contact created (no ManyChat data)
┌────────────────────────────┐
│ MC_ID: NULL               │ ← No ManyChat
│ GHL_ID: ghl_99999         │ ← Starts here
│ email_primary: new@ex.com │
│ meeting_book_date: NOW()  │
│ stage: "meeting_booked"   │
└────────────────────────────┘

═══════════════════════════════════

REST OF FLOW SAME AS SCENARIO 1
(Meeting attended → Purchase)

FINAL STATE:
┌────────────────────────────┐
│ MC_ID: NULL               │ ← Never in ManyChat
│ GHL_ID: ghl_99999         │ ← GHL only
│ stripe_customer_id: cus_Y │ ← Stripe
│ purchase_date: NOW()      │
│ purchase_amount: 997.00   │
│ stage: "purchased"        │
└────────────────────────────┘

Still tracked! Just missing early funnel data.
```

---

## Smart Matching Logic

**How webhooks find existing contacts:**

```
┌─────────────────────────────────────┐
│   Webhook receives data             │
│   (MC_ID, GHL_ID, email, phone)     │
└──────────────┬──────────────────────┘
               │
               ▼
       ┌───────────────┐
       │ Try GHL_ID    │──── Found? ──→ UPDATE
       └───────┬───────┘              contact
               │ Not found
               ▼
       ┌───────────────┐
       │ Try MC_ID     │──── Found? ──→ UPDATE
       └───────┬───────┘              contact
               │ Not found
               ▼
       ┌───────────────┐
       │ Try Email     │──── Found? ──→ UPDATE
       │ (all 3 fields)│              contact
       └───────┬───────┘
               │ Not found
               ▼
       ┌───────────────┐
       │ Try Phone     │──── Found? ──→ UPDATE
       │ (normalized)  │              contact
       └───────┬───────┘
               │ Not found
               ▼
       ┌───────────────┐
       │ CREATE NEW    │────────────→ NEW
       │ contact       │              contact
       └───────────────┘
```

**This means:**
- ManyChat contact who books → Gets linked (by email)
- Direct booking who then uses ManyChat → Gets linked (by email)
- Same person, different emails → Gets linked if they use same email anywhere
- Completely new person → New contact created

---

## Data Flow Summary

### ManyChat Webhook Flow
```
Webhook → Log → Fetch ManyChat API → Find/Create Contact → Update Fields
```
**Updates:** subscribe_date, DM_qualified_date, Q1, Q2, link dates

### GHL Webhook Flow
```
Webhook → Log → Smart Match → Find/Create Contact → Update Fields
```
**Updates:** GHL_ID, meeting dates, stage

### Stripe Webhook Flow
```
Webhook → Verify Signature → Log → Find by Email → Update Fields
```
**Updates:** purchase_date, purchase_amount, stripe_customer_id

---

## What Gets Logged

### webhook_logs table
```sql
┌────────────────────────────────────────┐
│ Every webhook attempt logged here     │
├────────────────────────────────────────┤
│ source: 'manychat', 'ghl', 'stripe'   │
│ event_type: 'dm_qualified', etc.      │
│ contact_id: UUID (if matched)         │
│ payload: Full JSON received           │
│ status: 'received', 'processed', etc. │
│ error_message: If something failed    │
└────────────────────────────────────────┘
```

### stripe_events table
```sql
┌────────────────────────────────────────┐
│ Stripe-specific event details         │
├────────────────────────────────────────┤
│ event_id: Stripe's unique ID          │
│ event_type: 'checkout.session...'     │
│ customer_email: Email from Stripe     │
│ contact_id: Matched contact (or NULL) │
│ amount: Payment amount                │
│ status: 'paid', 'refunded', etc.      │
│ raw_event: Full Stripe event JSON     │
└────────────────────────────────────────┘
```

---

## Debugging Flows

### If ManyChat webhook fails:
```
1. Check webhook_logs for error
2. Check MANYCHAT_API_KEY is set
3. Verify subscriber_id is valid
4. Check ManyChat API response
```

### If GHL webhook fails:
```
1. Check webhook_logs for error
2. Verify email exists in payload
3. Check smart matching function
4. Look at GHL workflow execution logs
```

### If Stripe webhook fails:
```
1. Check signature verification
2. Verify STRIPE_WEBHOOK_SECRET
3. Check email exists in Stripe event
4. Look at stripe_events for logged event
```

---

## Performance Notes

- **Webhooks are async** - Don't block user actions
- **All return 200** - Even on errors (prevents infinite retries)
- **Deduplication** - Stripe events won't create duplicates
- **Smart matching** - Finds contacts across platforms
- **Logging** - Every webhook attempt is logged for debugging

---

**This is how it all works! Follow START_HERE_WEBHOOKS.md to set it up.**
