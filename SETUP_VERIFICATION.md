# Setup Verification Checklist

**Last Updated**: January 6, 2025
**Purpose**: Step-by-step verification of all webhook integrations

---

## 🎯 Complete System Verification

Use this checklist to verify the entire webhook system is working end-to-end. Do this:
- **Initially**: When first setting up the system
- **Monthly**: As routine maintenance
- **After changes**: Anytime you modify ManyChat flows, GHL workflows, or funnel forms

---

## ✅ Prerequisites

Before starting, ensure you have access to:

- [ ] Supabase dashboard (database access)
- [ ] ManyChat dashboard (bot flow editor)
- [ ] GoHighLevel dashboard (workflows, custom fields)
- [ ] Funnel page admin (to edit forms)
- [ ] Stripe dashboard (webhook settings)
- [ ] Denefits dashboard (or Make.com if using webhook proxy)
- [ ] Perspective dashboard (webhook settings)

---

## 📍 Section 1: ManyChat Integration

### **1.1 Verify ManyChat Webhook Endpoint**

- [ ] Go to ManyChat → Settings → Webhooks
- [ ] Verify webhook URL: `https://mcb-dun.vercel.app/api/manychat`
- [ ] Verify webhook is **ENABLED**
- [ ] Test webhook: Send test event from ManyChat
- [ ] Check webhook_logs table: Should see test event logged

**SQL Verification**:
```sql
-- Check recent ManyChat webhooks
SELECT event_type, status, created_at
FROM webhook_logs
WHERE source = 'manychat'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**: Recent webhook events with status = 'processed'

---

### **1.2 Verify ManyChat Custom Fields**

- [ ] Go to ManyChat → Settings → Custom Fields
- [ ] Verify field exists: `AD_ID` (type: Text)
- [ ] Verify field is populated from Meta ad clicks
- [ ] Send yourself a test DM from a paid ad link
- [ ] Check that `AD_ID` field populates with ad campaign ID

**Testing**:
1. Click on one of your Meta ads
2. Send a DM to the bot
3. In ManyChat dashboard, view this subscriber
4. Check "Custom Fields" tab → AD_ID should have a value like `ad_xyz_123`

---

### **1.3 Verify ManyChat Booking Link Includes Parameters**

- [ ] Go to ManyChat → Flows → Your booking flow
- [ ] Find the step where booking link is sent
- [ ] Verify link format: `https://funnel.com/quiz?mc_id={{subscriber_id}}&ad_id={{AD_ID}}`
- [ ] Test: Go through bot as test user
- [ ] When bot sends link, click it
- [ ] Check browser address bar: URL should include `?mc_id=XXX&ad_id=YYY`

**Testing**:
```
Expected URL format:
https://yourfunnel.com/quiz?mc_id=1234567890&ad_id=ad_campaign_xyz
                           ^^^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^
                           MC subscriber ID     Ad campaign ID
```

**Troubleshooting**:
- If `mc_id` missing → Link template is broken, add `{{subscriber_id}}`
- If `ad_id` missing → Custom field not set, or template uses wrong variable name

---

### **1.4 Test Complete ManyChat Flow**

- [ ] Start as new test user (use phone number you can reset)
- [ ] Go through complete flow:
  - Send first DM (trigger: contact_created)
  - Answer Q1 (trigger: dm_qualified if this is 2nd question)
  - Answer Q2 (trigger: dm_qualified)
  - Receive booking link (trigger: link_sent)
  - Click booking link (trigger: link_clicked)

**SQL Verification**:
```sql
-- Find your test contact
SELECT
  mc_id,
  subscribe_date,
  dm_qualified_date,
  link_send_date,
  link_click_date,
  Q1_question,
  Q2_question
FROM contacts
WHERE phone = '+1YOUR_TEST_NUMBER'  -- Your test phone
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**:
- All timestamp fields populated
- Q1 and Q2 answers stored

---

## 📍 Section 2: Funnel Page Integration

### **2.1 Verify Hidden Form Fields**

- [ ] Open funnel page in browser
- [ ] Right-click → Inspect Element
- [ ] Find the form element
- [ ] Verify hidden fields exist:

```html
<input type="hidden" name="MC_ID" id="mc_id_field" value="">
<input type="hidden" name="AD_ID" id="ad_id_field" value="">
```

- [ ] Verify JavaScript populates these fields from URL parameters

**Testing**:
1. Open funnel page with test parameters:
   ```
   https://yourfunnel.com/quiz?mc_id=TEST123&ad_id=TEST_AD
   ```

2. Open browser console (F12)

3. Check hidden field values:
   ```javascript
   console.log(document.getElementById('mc_id_field').value);  // Should show: TEST123
   console.log(document.getElementById('ad_id_field').value);  // Should show: TEST_AD
   ```

**Expected**: Console shows TEST123 and TEST_AD

---

### **2.2 Test Funnel Form Submission**

- [ ] Fill out funnel form with test data:
  - Email: `test+funnel@yourdomain.com`
  - Phone: Your test number
  - MC_ID: Should auto-populate from URL
  - AD_ID: Should auto-populate from URL

- [ ] Submit form

- [ ] Check GHL dashboard: New contact should appear immediately

- [ ] Verify GHL contact has custom fields populated:
  - Custom Field "MC_ID": Should match URL parameter
  - Custom Field "AD_ID": Should match URL parameter

---

## 📍 Section 3: GoHighLevel Integration

### **3.1 Verify GHL Custom Fields Exist**

- [ ] Go to GHL → Settings → Custom Fields
- [ ] Verify field exists: `MC_ID`
  - Field type: Text
  - Source: Forms / Opportunities
  - **Exact name match** (case-sensitive)

- [ ] Verify field exists: `AD_ID`
  - Field type: Text
  - Source: Forms / Opportunities
  - **Exact name match** (case-sensitive)

**Critical**: Field names must be EXACTLY `MC_ID` and `AD_ID` (uppercase)

---

### **3.2 Verify GHL Webhook Configuration**

- [ ] Go to GHL → Settings → Webhooks
- [ ] Verify webhook exists: `https://mcb-dun.vercel.app/api/ghl-webhook`
- [ ] Verify webhook is **ENABLED**
- [ ] Verify webhook triggers:
  - Opportunity Created
  - Opportunity Updated
  - (Or pipeline stage changes, depending on your setup)

- [ ] Verify webhook sends **ALL FIELDS** (not just default fields)

---

### **3.3 Verify GHL Passes Custom Fields in Webhook**

This is the **MOST CRITICAL** step.

- [ ] Create a test opportunity in GHL with custom fields:
  - MC_ID: `TEST_MC_123`
  - AD_ID: `TEST_AD_XYZ`

- [ ] Check webhook_logs table for this event:

```sql
-- Find recent GHL webhook with test data
SELECT
  payload
FROM webhook_logs
WHERE source = 'ghl'
  AND payload::text LIKE '%TEST_MC_123%'
ORDER BY created_at DESC
LIMIT 1;
```

- [ ] Verify payload includes customData:

```json
{
  "contact_id": "ghl_abc123",
  "customData": {
    "MC_ID": "TEST_MC_123",     // ← MUST BE HERE
    "AD_ID": "TEST_AD_XYZ"       // ← MUST BE HERE
  }
}
```

**If customData is missing**:
- GHL webhook is not configured to send custom fields
- Check GHL webhook settings → "Include Custom Fields" = ON
- OR manually configure workflow to pass fields

---

### **3.4 Test Complete GHL Flow**

- [ ] Continue from your ManyChat test (Section 1.4)
- [ ] Fill out funnel form (should create GHL contact)
- [ ] Book a test appointment in GHL calendar
- [ ] Mark appointment as completed
- [ ] (Optional) Trigger package sent workflow

**SQL Verification**:
```sql
-- Find your test contact (by test email)
SELECT
  mc_id,
  ghl_id,
  ad_id,
  email_primary,
  form_submit_date,
  appointment_date,
  appointment_held_date,
  stage
FROM contacts
WHERE email_primary ILIKE '%test+funnel%'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**:
- mc_id populated (from funnel form)
- ghl_id populated (from GHL webhook)
- ad_id populated (from funnel form)
- All timestamps in correct order
- stage = 'meeting_held' (or whatever final stage you tested)

---

## 📍 Section 4: Stripe Integration

### **4.1 Verify Stripe Webhook Endpoint**

- [ ] Go to Stripe Dashboard → Developers → Webhooks
- [ ] Verify webhook exists: `https://mcb-dun.vercel.app/api/stripe-webhook`
- [ ] Verify webhook is listening to events:
  - `checkout.session.created`
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `charge.refunded`

- [ ] Verify webhook signing secret is set in environment variables:
  - `.env.local` has `STRIPE_WEBHOOK_SECRET=whsec_...`
  - Vercel environment variables also have it

---

### **4.2 Test Stripe Webhook (Test Mode)**

- [ ] In Stripe Dashboard → Developers → Webhooks
- [ ] Click your webhook endpoint
- [ ] Click "Send test webhook"
- [ ] Select event: `checkout.session.completed`
- [ ] Click "Send test webhook"

**Verification**:
```sql
-- Check for test webhook
SELECT event_type, status, payload
FROM webhook_logs
WHERE source = 'stripe'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**: Event logged with status = 'processed' or 'error' (error is OK for test - it's fake data)

---

### **4.3 Test Real Stripe Payment (Live Mode)**

⚠️ **Do this with actual payment or use Stripe test credit card**

- [ ] Create test contact in system with known email:
  - Email: `test+stripe@yourdomain.com`
  - Ensure contact exists in contacts table

- [ ] Create Stripe checkout session with that email
- [ ] Complete payment (use test card: `4242 4242 4242 4242`)

**SQL Verification**:
```sql
-- Check payment was logged
SELECT
  contact_id,
  payment_source,
  customer_email,
  amount,
  status,
  payment_date
FROM payments
WHERE customer_email ILIKE '%test+stripe%'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**:
- Payment record exists
- contact_id is NOT NULL (linked to test contact)
- payment_source = 'stripe'
- status = 'paid'
- Amount matches what you paid

---

### **4.4 Test Email Mismatch (Orphan Payment)**

- [ ] Create Stripe checkout with DIFFERENT email:
  - Use email that does NOT exist in contacts: `orphan-test@example.com`

- [ ] Complete payment

**SQL Verification**:
```sql
-- Check orphan payment was logged
SELECT
  contact_id,
  customer_email,
  amount
FROM payments
WHERE customer_email = 'orphan-test@example.com';
```

**Expected**:
- Payment exists
- contact_id = NULL (orphan)
- Still logged (revenue tracked even though attribution lost)

---

## 📍 Section 5: Denefits Integration

### **5.1 Verify Denefits Webhook (via Make.com or Direct)**

**If using Make.com**:

- [ ] Go to Make.com dashboard
- [ ] Find Denefits webhook scenario
- [ ] Verify scenario is **ACTIVE** (not paused)
- [ ] Verify scenario forwards to: `https://mcb-dun.vercel.app/api/denefits-webhook`
- [ ] Check scenario run history for recent executions

**If using direct webhook**:

- [ ] Go to Denefits dashboard → Settings → Webhooks
- [ ] Verify webhook: `https://mcb-dun.vercel.app/api/denefits-webhook`
- [ ] Verify webhook is ENABLED

---

### **5.2 Test Denefits Webhook**

This is harder to test without real Denefits payment. Options:

**Option A: Wait for real payment, then verify**
```sql
-- Check for recent Denefits payments
SELECT
  contact_id,
  customer_email,
  amount,
  denefits_contract_code,
  payment_date
FROM payments
WHERE payment_source = 'denefits'
ORDER BY created_at DESC
LIMIT 5;
```

**Option B: Trigger test event from Make.com**
- Manually run Make.com scenario with test data
- Verify webhook arrives and payment logged

---

## 📍 Section 6: Perspective Integration

### **6.1 Verify Perspective Webhook**

- [ ] Go to Perspective dashboard → Settings → Integrations
- [ ] Verify webhook URL: `https://mcb-dun.vercel.app/api/perspective-webhook`
- [ ] Verify webhook is **ENABLED**
- [ ] Verify webhook fires on: Form submission

---

### **6.2 Test Perspective Checkout Form**

- [ ] Go to Perspective checkout page
- [ ] Fill out checkout qualification form
  - Use test email that EXISTS in contacts table
  - Email: `test+perspective@yourdomain.com`

- [ ] Submit form (don't complete payment)

**SQL Verification**:
```sql
-- Check that checkout_started was set
SELECT
  email_primary,
  checkout_started,
  stage
FROM contacts
WHERE email_primary ILIKE '%test+perspective%';
```

**Expected**:
- checkout_started timestamp is populated
- stage unchanged (Perspective only sets timestamp, not stage)

---

### **6.3 Test Perspective with No Matching Contact**

- [ ] Fill out Perspective form with email that does NOT exist:
  - Email: `nocontact@example.com`

- [ ] Submit form

**SQL Verification**:
```sql
-- Check webhook log
SELECT status, payload
FROM webhook_logs
WHERE source = 'perspective'
  AND payload::text LIKE '%nocontact@example.com%'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**:
- status = 'no_contact_found'
- This is OK - means user hasn't gone through discovery call yet

---

## 📊 Section 7: End-to-End System Test

### **Complete Journey Test**

Run a FULL test from Instagram ad → Payment:

1. **ManyChat (5 min)**:
   - [ ] Send DM to bot
   - [ ] Answer Q1, Q2
   - [ ] Receive + click booking link

2. **Funnel Page (5 min)**:
   - [ ] Fill out quiz form
   - [ ] Submit with test email: `e2e-test@yourdomain.com`

3. **GoHighLevel (10 min)**:
   - [ ] Verify contact created in GHL with MC_ID and AD_ID
   - [ ] Book test appointment
   - [ ] Mark appointment as completed

4. **Perspective (2 min)**:
   - [ ] Fill out Perspective checkout form
   - [ ] Use same email: `e2e-test@yourdomain.com`

5. **Stripe (5 min)**:
   - [ ] Complete test payment
   - [ ] Use same email: `e2e-test@yourdomain.com`

**Final Verification**:
```sql
-- Check complete contact record
SELECT * FROM contacts
WHERE email_primary = 'e2e-test@yourdomain.com';

-- Should have:
-- - mc_id (from ManyChat)
-- - ghl_id (from funnel form)
-- - ad_id (from ManyChat → funnel)
-- - All timestamps populated
-- - stage = 'purchased'

-- Check payment record
SELECT * FROM payments
WHERE customer_email = 'e2e-test@yourdomain.com';

-- Should have:
-- - contact_id linked to above contact
-- - payment_source = 'stripe'
-- - amount matches test payment
```

**Expected Result**: Complete attribution chain from ad → DM → form → booking → payment

---

## 🎯 Weekly Maintenance Checklist

Run this every Monday:

- [ ] Run weekly health dashboard query (from VERIFICATION_QUERIES.md)
- [ ] Check MC linkage rate (target >90%)
- [ ] Check orphan payment rate (target <10%)
- [ ] Check webhook error logs (investigate any errors)
- [ ] Review duplicate contacts (merge if needed)
- [ ] Link orphan payments (manual reconciliation)

---

## 🚨 Troubleshooting Guide

### **Problem: MC_ID not showing up in GHL contacts**

**Diagnosis**:
1. Check ManyChat link includes `?mc_id={{subscriber_id}}`
2. Check funnel form has hidden field for MC_ID
3. Check GHL custom field "MC_ID" exists
4. Check GHL webhook includes customData.MC_ID

**Fix**: See Section 3.3

---

### **Problem: Payments showing as orphans (contact_id = NULL)**

**Diagnosis**:
1. Check if email in Stripe matches email in GHL booking
2. Check if contact exists BEFORE payment
3. Check for typos in email

**Fix**:
```sql
-- Manually link orphan payment
UPDATE payments
SET contact_id = (
  SELECT id FROM contacts
  WHERE email_primary ILIKE 'user@example.com'
  LIMIT 1
)
WHERE customer_email = 'user@example.com'
  AND contact_id IS NULL;
```

---

### **Problem: No Denefits payments logging**

**Diagnosis**:
1. Check Make.com scenario is active
2. Check webhook URL is correct
3. Check webhook_logs for denefits source

**Fix**: Restart Make.com scenario, verify URL

---

This checklist ensures every part of the webhook system is working correctly. Complete the full checklist initially, then run weekly maintenance checks.
