# Complete Webhook Flow & Data Architecture

**Last Updated**: January 6, 2025
**Status**: Production System Documentation

---

## 🎯 System Overview

This system tracks customer journeys from **first touch to purchase** across 5 platforms, using **3 primary identifiers** (MC_ID, GHL_ID, AD_ID) with email as the universal fallback for payment attribution.

**Key Success Metrics**:
- MC_ID → GHL_ID linkage rate: **Target >90%**
- Orphan payment rate: **Target <10%**
- AD_ID capture rate: **Target >80%** (for paid traffic)

---

## 📍 All Entry Points (Complete Map)

### **Path A: Instagram Ad → ManyChat → Funnel Page → GHL → Payment** (~70% of contacts)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ENTRY: User sees Instagram ad, clicks, sends DM                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. ManyChat Webhook: contact_created                                │
│    Endpoint: /api/manychat                                           │
│    Trigger: First DM received                                        │
│                                                                       │
│    IDs Available:                                                    │
│    ✅ MC_ID (subscriber ID) - PRIMARY KEY                           │
│    ✅ AD_ID (from Meta custom field) - FOR ATTRIBUTION              │
│    ❌ Email - NOT collected yet                                     │
│    ⚠️ Phone - Optional, may not exist                               │
│                                                                       │
│    Creates: New contact with MC_ID                                   │
│    Stage: new_lead                                                   │
│    Source: instagram                                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. ManyChat Webhook: dm_qualified                                   │
│    Trigger: User answered BOTH Q1 and Q2                            │
│                                                                       │
│    Updates: Q1_question, Q2_question, DM_qualified_date             │
│    Stage: DM_qualified                                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. ManyChat Webhook: link_sent                                      │
│    Trigger: Bot sends funnel page link                              │
│                                                                       │
│    Updates: link_send_date                                           │
│    Stage: landing_link_sent                                          │
│                                                                       │
│    🔗 CRITICAL: Link includes UTM parameters:                       │
│    https://funnel.com?mc_id={{subscriber_id}}&ad_id={{AD_ID}}       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. ManyChat Webhook: link_clicked                                   │
│    Trigger: User clicks funnel link                                 │
│                                                                       │
│    Updates: link_click_date                                          │
│    Stage: landing_link_clicked                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. User fills out FUNNEL PAGE FORM (quiz + email/phone)            │
│    NOT a webhook - this is user action                              │
│                                                                       │
│    Form captures:                                                    │
│    ✅ Email (required field) - FIRST TIME EMAIL COLLECTED           │
│    ✅ Phone (usually required)                                      │
│    ✅ MC_ID (from URL parameter ?mc_id=XXX)                         │
│    ✅ AD_ID (from URL parameter ?ad_id=YYY)                         │
│    ✅ Quiz answers / qualification data                             │
│                                                                       │
│    Form submits to GoHighLevel → Creates contact/opportunity        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 🚨 CRITICAL HANDOFF #1: Funnel Page → GoHighLevel                  │
│                                                                       │
│    GHL receives form submission with:                                │
│    - Email (from form field)                                         │
│    - Phone (from form field)                                         │
│    - MC_ID (from hidden field populated via URL param)              │
│    - AD_ID (from hidden field populated via URL param)              │
│                                                                       │
│    GHL stores these in CUSTOM FIELDS                                 │
│                                                                       │
│    ⚠️ RISK: If custom fields not configured in GHL, MC_ID/AD_ID lost│
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. GHL Webhook: OpportunityCreate (pipeline_stage: form_filled)     │
│    Endpoint: /api/ghl-webhook                                        │
│    Trigger: Form submission creates contact in GHL                   │
│                                                                       │
│    IDs Available:                                                    │
│    ✅ GHL_ID (contact_id) - PRIMARY KEY for this contact            │
│    ✅ Email - From form                                             │
│    ✅ Phone - From form                                             │
│    ✅ MC_ID - From customData.MC_ID (passed from form)              │
│    ✅ AD_ID - From customData.AD_ID (passed from form)              │
│                                                                       │
│    Smart Matching Logic:                                             │
│    1. find_contact_smart(ghl_id, mc_id, email, phone)               │
│    2. Checks in priority order:                                      │
│       - GHL_ID match? (won't find - this is first GHL contact)      │
│       - MC_ID match? ✅ FINDS existing ManyChat contact!            │
│       - Email match?                                                 │
│       - Phone match?                                                 │
│                                                                       │
│    Result: LINKS existing MC contact by adding GHL_ID               │
│    Updates: ghl_id, email_booking, form_submit_date                 │
│    Stage: form_submitted                                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. User books appointment via GHL calendar page                     │
│    (Calendar page link shown after form submission)                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 8. GHL Webhook: OpportunityCreate (pipeline_stage: meeting_booked)  │
│    Trigger: Appointment scheduled in GHL                             │
│                                                                       │
│    Updates: appointment_date, email_booking                          │
│    Stage: meeting_booked                                             │
│                                                                       │
│    Note: Contact already exists from step 6, just updating timestamp│
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 9. Discovery call happens → Marked complete in GHL                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 10. GHL Webhook: MeetingCompleted (pipeline_stage: meeting_attended)│
│     Trigger: Opportunity moved to "meeting_attended" stage          │
│                                                                       │
│     Updates: appointment_held_date                                   │
│     Stage: meeting_held                                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 11. GHL Webhook: PackageSent (automated workflow trigger)           │
│     Trigger: User sent package/proposal link                        │
│                                                                       │
│     Updates: package_sent_date                                       │
│     Stage: package_sent                                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 12. OPTIONAL: Perspective Webhook (checkout_form_submitted)         │
│     Endpoint: /api/perspective-webhook                               │
│     Trigger: User fills out Perspective checkout qualification form │
│                                                                       │
│     IDs Available:                                                   │
│     ✅ Email - ONLY identifier                                      │
│                                                                       │
│     Matching: find_contact_by_email() only                          │
│     Updates: checkout_started timestamp                              │
│                                                                       │
│     ⚠️ RISK: If email doesn't match, checkout intent is lost        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 🚨 CRITICAL HANDOFF #2: GHL → Stripe/Denefits                      │
│                                                                       │
│    User clicks payment link → Enters checkout                        │
│    Checkout asks for email                                           │
│                                                                       │
│    IDs Available at Payment:                                         │
│    ✅ Email - ONLY identifier (from checkout form)                  │
│    ❌ MC_ID - NOT passed to Stripe/Denefits                         │
│    ❌ GHL_ID - NOT passed to Stripe/Denefits                        │
│    ❌ AD_ID - NOT passed to Stripe/Denefits                         │
│                                                                       │
│    ⚠️ CRITICAL: Email MUST match one of:                            │
│    - email_primary (from ManyChat or funnel form)                   │
│    - email_booking (from GHL booking)                                │
│    - email_payment (from previous payment)                           │
│                                                                       │
│    If mismatch → Payment becomes ORPHAN                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 13. Stripe Webhook: checkout.session.completed                      │
│     Endpoint: /api/stripe-webhook                                    │
│     Trigger: Payment successful                                      │
│                                                                       │
│     Creates: Payment record in payments table                        │
│     - payment_source: 'stripe'                                       │
│     - payment_type: 'buy_in_full'                                    │
│     - amount, currency, date                                         │
│     - contact_id: (from email match) OR NULL if no match            │
│                                                                       │
│     If contact found by email:                                       │
│     Updates: purchase_date, purchase_amount, stripe_customer_id      │
│     Stage: purchased                                                 │
│                                                                       │
│     If NO contact found:                                             │
│     Payment logged as ORPHAN (contact_id = NULL)                     │
│     Revenue tracked, attribution LOST                                │
└─────────────────────────────────────────────────────────────────────┘
```

**Final State**: Contact has complete journey tracked from Instagram ad → ManyChat → Funnel → GHL → Payment

**ID Coverage**:
- MC_ID: ✅ (from ManyChat)
- GHL_ID: ✅ (from funnel form submission)
- AD_ID: ✅ (from ManyChat, passed through funnel)
- Email: ✅ (from funnel form)
- Purchase: ✅ (from Stripe, linked by email)

---

### **Path B: Direct Ad → Funnel Page → GHL → Payment** (~20% of contacts)

**Entry Point**: User clicks Instagram/Facebook ad that goes DIRECTLY to funnel page (skips ManyChat bot)

**Use Cases**:
- Bottom-of-funnel ads (retargeting warm audience)
- Lead magnet resource ads (downloadable content offers)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ENTRY: User clicks ad → Lands on funnel page                        │
│        (Skips ManyChat entirely)                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. User fills out FUNNEL PAGE FORM                                  │
│                                                                       │
│    Form captures:                                                    │
│    ✅ Email (required)                                              │
│    ✅ Phone (required)                                              │
│    ✅ AD_ID (from UTM parameter ?utm_campaign=XXX)                  │
│    ❌ MC_ID - Does NOT exist (never went through ManyChat)          │
│                                                                       │
│    Form submits to GoHighLevel                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. GHL Webhook: OpportunityCreate                                   │
│    Endpoint: /api/ghl-webhook                                        │
│                                                                       │
│    IDs Available:                                                    │
│    ✅ GHL_ID (contact_id)                                           │
│    ✅ Email                                                          │
│    ✅ Phone                                                          │
│    ✅ AD_ID (from customData, captured from UTM)                    │
│    ❌ MC_ID - Does NOT exist                                        │
│                                                                       │
│    Smart Matching: Checks GHL_ID, email, phone                      │
│    Result: No match found → Creates NEW contact                     │
│                                                                       │
│    Creates: New contact with GHL_ID as primary key                  │
│    Stage: form_submitted                                             │
│    Source: website (since no MC_ID)                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ (Continues same as Path A from step 7 onward)                       │
│ - Meeting booked                                                     │
│ - Meeting attended                                                   │
│ - Package sent                                                       │
│ - Payment                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

**Final State**: Contact has AD_ID for attribution but no ManyChat engagement data

**ID Coverage**:
- MC_ID: ❌ (never existed - expected)
- GHL_ID: ✅
- AD_ID: ✅ (from UTM parameter)
- Email: ✅
- Purchase: ✅

---

### **Path C: Website Form → GHL → Payment** (~10% of contacts)

**Entry Point**: Organic traffic to main website, submits contact form

```
┌─────────────────────────────────────────────────────────────────────┐
│ ENTRY: User visits website organically → Fills contact form         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. GHL Webhook: OpportunityCreate or ContactCreate                  │
│    Trigger: Website form submission → Creates GHL contact           │
│                                                                       │
│    IDs Available:                                                    │
│    ✅ GHL_ID                                                         │
│    ✅ Email                                                          │
│    ✅ Phone (usually)                                                │
│    ❌ MC_ID - Does NOT exist                                        │
│    ❌ AD_ID - Does NOT exist (organic traffic)                      │
│                                                                       │
│    Creates: New contact                                              │
│    Stage: form_submitted                                             │
│    Source: website                                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ (Continues same as Path A from step 7 onward)                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Final State**: Contact is ORGANIC (no AD_ID), no ManyChat data

**ID Coverage**:
- MC_ID: ❌ (expected)
- GHL_ID: ✅
- AD_ID: ❌ (expected - organic traffic)
- Email: ✅
- Purchase: ✅

**Note**: This is expected behavior - organic traffic won't have AD_ID or MC_ID

---

### **Path D: Direct to Checkout (Rare Edge Case)**

**Entry Point**: User receives direct checkout link (via email, SMS, or retargeting ad)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ENTRY: User clicks direct Stripe/Perspective checkout link          │
│        (May or may not have gone through GHL booking first)         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Perspective Webhook: checkout_form_submitted (optional)             │
│ OR                                                                   │
│ Stripe Webhook: checkout.session.completed                          │
│                                                                       │
│    IDs Available: Email ONLY                                         │
│                                                                       │
│    Matching: find_contact_by_email()                                │
│                                                                       │
│    If match found: Links payment, updates purchase info             │
│    If NO match: Creates ORPHAN payment                              │
└─────────────────────────────────────────────────────────────────────┘
```

**Risk**: If user never went through GHL booking, they may not exist in database → Orphan payment

---

## 🆔 ID Availability Matrix

| Stage | MC_ID | GHL_ID | AD_ID | Email | Phone |
|-------|-------|--------|-------|-------|-------|
| **ManyChat: contact_created** | ✅ | ❌ | ✅ (if from ad) | ❌ | ⚠️ |
| **ManyChat: dm_qualified** | ✅ | ❌ | ✅ | ❌ | ⚠️ |
| **ManyChat: link_sent/clicked** | ✅ | ❌ | ✅ | ❌ | ⚠️ |
| **Funnel Page Form Submit** | ✅ (via URL) | ❌ | ✅ (via URL) | ✅ | ✅ |
| **GHL: form_submitted** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **GHL: meeting_booked** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **GHL: meeting_attended** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Perspective: checkout_started** | ❌ | ❌ | ❌ | ✅ | ⚠️ |
| **Stripe: payment** | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Denefits: payment** | ❌ | ❌ | ❌ | ✅ | ⚠️ |

**Key**:
- ✅ = Always available
- ⚠️ = Sometimes available (optional or conditional)
- ❌ = Never available (expected)

---

## 🔗 Critical Handoff Points

### **Handoff 1: ManyChat → Funnel Page**
**Method**: URL parameters in booking link

**ManyChat sends**:
```
https://funnel.com/quiz?mc_id={{subscriber_id}}&ad_id={{AD_ID}}
```

**Funnel page captures**:
- Hidden form field `mc_id` populated from URL parameter
- Hidden form field `ad_id` populated from URL parameter

**Risk**: If URL parameters not included in link or form doesn't have hidden fields → MC_ID/AD_ID lost

**Verification**:
```javascript
// Check actual ManyChat link in bot flow includes parameters
// Test: Click link, check URL in browser includes ?mc_id=XXX&ad_id=YYY
```

---

### **Handoff 2: Funnel Page → GoHighLevel**
**Method**: Form submission with hidden fields

**Funnel page submits**:
```json
{
  "email": "user@example.com",
  "phone": "+15551234567",
  "mc_id": "1234567890",      // From hidden field
  "ad_id": "ad_xyz_123"        // From hidden field
}
```

**GHL must**:
- Store `mc_id` in custom field "MC_ID"
- Store `ad_id` in custom field "AD_ID"
- Include these custom fields in webhook payload as `customData.MC_ID` and `customData.AD_ID`

**Risk**: If GHL custom fields not configured or webhook doesn't pass customData → MC_ID/AD_ID lost

**Verification**:
```sql
-- Check if GHL contacts have MC_ID when they should
SELECT
  ghl_id,
  mc_id,
  email_primary,
  created_at
FROM contacts
WHERE ghl_id IS NOT NULL
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;

-- If mc_id is NULL for recent contacts from ManyChat flow → handoff is broken
```

---

### **Handoff 3: GoHighLevel → Stripe/Denefits**
**Method**: Email matching (ONLY identifier)

**User action**:
1. Receives Stripe checkout link via email
2. Opens link, enters email in checkout form
3. Completes payment

**Stripe sends**:
```json
{
  "customer_email": "user@example.com"
  // NO MC_ID, NO GHL_ID, NO AD_ID
}
```

**System matches**:
```sql
SELECT id FROM contacts
WHERE email_primary ILIKE 'user@example.com'
   OR email_booking ILIKE 'user@example.com'
   OR email_payment ILIKE 'user@example.com'
LIMIT 1;
```

**Risk**: Email mismatch → Payment becomes orphan

**Common causes**:
- User enters different email in Stripe than they used in GHL booking
- Typo in email
- User has multiple email addresses

**Verification**:
```sql
-- Check orphan payment rate
SELECT
  COUNT(*) FILTER (WHERE contact_id IS NULL) as orphans,
  COUNT(*) as total_payments,
  ROUND(100.0 * COUNT(*) FILTER (WHERE contact_id IS NULL) / COUNT(*), 2) as orphan_rate
FROM payments
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Target: orphan_rate < 10%
```

---

## 🔍 Smart Matching Logic

When a webhook arrives, the system uses **priority-based matching**:

### **find_contact_smart() Function**
```sql
CREATE OR REPLACE FUNCTION find_contact_smart(
  search_ghl_id TEXT,
  search_mc_id TEXT,
  search_email TEXT,
  search_phone TEXT
)
RETURNS UUID
```

**Matching Priority**:
1. **GHL_ID match** (most reliable for GHL webhooks)
   - If found → Return existing contact
2. **MC_ID match** (links ManyChat contact to GHL)
   - If found → Return existing contact + update with GHL_ID
3. **Email match** (fallback for payments)
   - Checks email_primary, email_booking, email_payment
   - If found → Return existing contact
4. **Phone match** (last resort)
   - If found → Return existing contact
5. **No match** → Return NULL (caller creates new contact)

**Example Scenarios**:

**Scenario 1: ManyChat contact books appointment**
```
Webhook: GHL OpportunityCreate
Data: { ghl_id: "ghl_123", mc_id: "mc_456", email: "user@example.com" }

Matching:
1. Check ghl_id = "ghl_123" → Not found (first time in GHL)
2. Check mc_id = "mc_456" → ✅ FOUND! (existing ManyChat contact)
3. Return existing contact ID
4. Update contact: SET ghl_id = "ghl_123"

Result: ManyChat contact linked to GHL, no duplicate created
```

**Scenario 2: Website form submission (no ManyChat)**
```
Webhook: GHL OpportunityCreate
Data: { ghl_id: "ghl_789", mc_id: null, email: "newuser@example.com" }

Matching:
1. Check ghl_id = "ghl_789" → Not found
2. Check mc_id = null → Skip (not provided)
3. Check email = "newuser@example.com" → Not found
4. Check phone → Not found
5. Return NULL

Result: New contact created with ghl_id as primary key
```

**Scenario 3: Stripe payment**
```
Webhook: Stripe checkout.session.completed
Data: { email: "user@example.com" }

Matching:
1. Check ghl_id → Not provided (Stripe doesn't have it)
2. Check mc_id → Not provided
3. Check email = "user@example.com" → ✅ FOUND!
4. Return existing contact ID

Result: Payment linked to existing contact
```

---

## 📊 Data Completeness by Source

### **ManyChat-Originated Contacts** (Path A)
| Field | Available? | Notes |
|-------|------------|-------|
| mc_id | ✅ Always | Primary key from ManyChat |
| ghl_id | ✅ After form | Added when funnel form submitted |
| ad_id | ✅ If from paid ad | Captured in ManyChat custom field |
| email_primary | ✅ After form | Collected in funnel form |
| email_booking | ✅ After booking | From GHL booking |
| email_payment | ✅ After purchase | From Stripe/Denefits |
| phone | ✅ After form | From funnel form |
| Q1/Q2 answers | ✅ Always | From ManyChat bot |
| source | ✅ Always | Set to "instagram" |

### **Direct-to-Funnel Contacts** (Path B)
| Field | Available? | Notes |
|-------|------------|-------|
| mc_id | ❌ Never | Expected - didn't use ManyChat |
| ghl_id | ✅ Always | Primary key from GHL |
| ad_id | ✅ If UTMs captured | From URL parameters |
| email_primary | ✅ Always | From funnel form |
| email_booking | ✅ After booking | From GHL booking |
| email_payment | ✅ After purchase | From Stripe/Denefits |
| phone | ✅ Usually | From funnel form |
| Q1/Q2 answers | ❌ Never | No ManyChat flow |
| source | ✅ Always | Set to "website" |

### **Website Form Contacts** (Path C)
| Field | Available? | Notes |
|-------|------------|-------|
| mc_id | ❌ Never | Expected - organic traffic |
| ghl_id | ✅ Always | Primary key from GHL |
| ad_id | ❌ Never | Expected - no UTM tracking |
| email_primary | ✅ Always | From website form |
| email_booking | ✅ After booking | From GHL booking |
| email_payment | ✅ After purchase | From Stripe/Denefits |
| phone | ✅ Usually | From website form |
| Q1/Q2 answers | ❌ Never | No ManyChat flow |
| source | ✅ Always | Set to "website" |

---

## 🎯 Expected Data Patterns

### **Healthy System Indicators**

1. **MC_ID → GHL_ID linkage** (Path A contacts)
   - Expected: >90% of ManyChat contacts should have both MC_ID and GHL_ID
   - If lower: Funnel form not passing MC_ID to GHL

2. **AD_ID capture rate** (Paid traffic)
   - Expected: >80% of ManyChat contacts should have AD_ID
   - If lower: ManyChat not capturing AD_ID from Meta or not passing to funnel

3. **Orphan payment rate**
   - Expected: <10% of payments should be orphans
   - If higher: Email mismatch issue between GHL booking and Stripe checkout

4. **Duplicate contacts**
   - Expected: <5% of emails should have multiple contact records
   - If higher: MC_ID not being passed to GHL, creating duplicates

### **Normal Patterns (Not Issues)**

1. **Contacts with GHL_ID but no MC_ID**
   - Expected for Path B (direct to funnel) and Path C (website forms)
   - Check `source` field: Should be "website" not "instagram"

2. **Contacts with no AD_ID**
   - Expected for organic traffic (Path C)
   - Expected for Path A contacts if they didn't click ad (direct DM)

3. **Early-stage ManyChat contacts with no email**
   - Expected - email collected in funnel form, not in ManyChat bot
   - These contacts should have email_primary NULL until they submit funnel form

---

## 🔄 Webhook Event Sequence Examples

### **Example 1: Complete Happy Path (ManyChat → Payment)**

```
Time: T+0min
Event: ManyChat contact_created
Contact: { mc_id: "mc_123", ad_id: "ad_xyz", email: null }
Stage: new_lead

Time: T+2min
Event: ManyChat dm_qualified
Contact: { mc_id: "mc_123", Q1: "3 months", Q2: "back pain" }
Stage: DM_qualified

Time: T+5min
Event: ManyChat link_sent
Contact: { link_send_date: "2025-01-06 10:05:00" }
Stage: landing_link_sent

Time: T+6min
Event: ManyChat link_clicked
Contact: { link_click_date: "2025-01-06 10:06:00" }
Stage: landing_link_clicked

Time: T+10min
Event: GHL OpportunityCreate (form_filled)
Contact: {
  ghl_id: "ghl_456",           // NEW
  mc_id: "mc_123",              // LINKED to existing
  email_primary: "user@example.com",  // NEW
  phone: "+15551234567"
}
Stage: form_submitted
Action: find_contact_smart() finds MC contact by mc_id → Links GHL_ID

Time: T+15min
Event: GHL OpportunityCreate (meeting_booked)
Contact: { appointment_date: "2025-01-08 14:00:00" }
Stage: meeting_booked

Time: T+2 days
Event: GHL MeetingCompleted
Contact: { appointment_held_date: "2025-01-08 14:00:00" }
Stage: meeting_held

Time: T+2 days + 1hr
Event: GHL PackageSent
Contact: { package_sent_date: "2025-01-08 15:00:00" }
Stage: package_sent

Time: T+3 days
Event: Perspective checkout_form_submitted
Contact: { checkout_started: "2025-01-09 10:00:00" }
Stage: (no change)

Time: T+3 days + 10min
Event: Stripe checkout.session.completed
Contact: {
  purchase_date: "2025-01-09 10:10:00",
  purchase_amount: 2500.00,
  stripe_customer_id: "cus_abc123"
}
Stage: purchased

Payment Record Created:
{
  contact_id: "uuid_of_contact",     // ✅ LINKED
  payment_source: "stripe",
  amount: 2500.00,
  customer_email: "user@example.com"
}
```

**Result**: Complete attribution chain from ad → ManyChat → GHL → payment

---

### **Example 2: Orphan Payment (Email Mismatch)**

```
Time: T+0min
Event: GHL OpportunityCreate
Contact: { ghl_id: "ghl_789", email_booking: "work@company.com" }

Time: T+2 days
Event: GHL MeetingCompleted
Stage: meeting_held

Time: T+3 days
Event: Stripe checkout.session.completed
Data: { customer_email: "personal@gmail.com" }  // ⚠️ DIFFERENT EMAIL!

Matching: find_contact_by_email("personal@gmail.com")
- Check email_primary → No match
- Check email_booking → No match (is "work@company.com")
- Check email_payment → No match
Result: NULL (no contact found)

Payment Record Created:
{
  contact_id: NULL,                  // ⚠️ ORPHAN
  payment_source: "stripe",
  amount: 2500.00,
  customer_email: "personal@gmail.com"
}

Status: Revenue tracked, but attribution lost
```

**Resolution**: Manual reconciliation or wait for contact to be created later with that email

---

This document provides the complete data architecture for the MCB attribution tracking system. Use this as the source of truth for understanding how contacts flow through the system and where risks exist.
