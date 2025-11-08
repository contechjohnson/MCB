# Historical Data Migration Mapping Guide

**Purpose**: Bridge the gap between historical data (Airtable, CSVs, old systems) and the new Supabase database structure.

**Last Updated**: January 6, 2025

**Goal**: Map historical contacts to correct stages so purchases can be attributed properly, even without complete timestamp data.

---

## 🎯 The Customer Journey & Stage Progression

### **Complete Stage Flow (Linear Progression)**

```
new_lead → dm_qualified → link_sent → link_clicked → form_submitted →
meeting_booked → meeting_held → package_sent → checkout_started → purchased
```

### **Stage Definitions (What Each Stage Means)**

| Stage | What Happened | Timestamp Field | Triggered By |
|-------|---------------|-----------------|--------------|
| `new_lead` | First contact/subscribe | `subscribe_date` | ManyChat: contact created |
| `dm_qualified` | Answered Q1 & Q2 in bot | `dm_qualified_date` | ManyChat: Q2 answered |
| `link_sent` | Bot sent booking link | `link_send_date` | ManyChat: link sent |
| `link_clicked` | Clicked booking link | `link_click_date` | ManyChat: link clicked |
| `form_submitted` | Submitted funnel form | `form_submit_date` | GHL: form webhook |
| `meeting_booked` | Booked discovery call | `appointment_date` | GHL: opportunity created |
| `meeting_held` | Attended discovery call | `appointment_held_date` | GHL: meeting completed |
| `package_sent` | Received package/proposal | `package_sent_date` | GHL: package sent |
| `checkout_started` | Started checkout process | `checkout_started` | Perspective: form submitted |
| `purchased` | Completed payment | `purchase_date` | Stripe/Denefits webhook |

**Key Rule**: A contact's `stage` field always reflects their **furthest point** in the journey.

---

## 📊 Database Structure

### **Contacts Table - Complete Field Reference**

#### **Identification Fields** (Who is this person?)
```
id                  UUID (auto-generated)
mc_id               Text - ManyChat subscriber ID (unique)
ghl_id              Text - GoHighLevel contact ID (unique)
stripe_customer_id  Text - Stripe customer ID
thread_id           Text - OpenAI Assistant thread ID
```

#### **Personal Information**
```
first_name          Text
last_name           Text
email_primary       Text - Main email (from ManyChat/first contact)
email_booking       Text - Email used for GHL booking
email_payment       Text - Email used for payment
phone               Text - E.164 format (+1XXXXXXXXXX)
ig                  Text - Instagram username
ig_id               BigInt - Instagram user ID
fb                  Text - Facebook profile
```

#### **Attribution Fields** (Where did they come from?)
```
source              Text - 'instagram', 'website', 'facebook'
ad_id               Text - Meta ad campaign ID
chatbot_ab          Text - A/B test variant for chatbot
misc_ab             Text - Other A/B test data
trigger_word        Text - Word that triggered bot
```

#### **Conversation Data** (What did they say?)
```
q1_question         Text - Answer to Q1 (symptom/concern)
q2_question         Text - Answer to Q2 (details/objections)
objections          Text - Objections raised
lead_summary        Text - AI-generated summary of conversation
```

#### **Timeline Fields** (When did each event happen?)
```
subscribe_date          Timestamp - First contact
subscribed              Timestamp - (legacy, use subscribe_date)
ig_last_interaction     Timestamp - Last IG message
dm_qualified_date       Timestamp - Finished bot questions
link_send_date          Timestamp - Bot sent booking link
link_click_date         Timestamp - Clicked booking link
form_submit_date        Timestamp - Submitted funnel form
appointment_date        Timestamp - When meeting is scheduled
appointment_held_date   Timestamp - When meeting occurred
package_sent_date       Timestamp - When package/proposal sent
checkout_started        Timestamp - Started checkout
purchase_date           Timestamp - Completed purchase
created_at              Timestamp - Record created
updated_at              Timestamp - Last updated
```

#### **Stage & Revenue**
```
stage               Text - Current stage (see flow above)
purchase_amount     Numeric - Total revenue from this customer
```

---

## 🗺️ Historical Data → Database Mapping

### **Priority 1: Identify the Contact (Required)**

At minimum, you need ONE of these to create/match a contact:
- `email` → maps to `email_primary`
- `phone` → maps to `phone` (normalize to E.164: +1XXXXXXXXXX)
- `mc_id` → maps to `mc_id`
- `ghl_id` → maps to `ghl_id`

### **Priority 2: Determine the Stage (Critical for Attribution)**

**Stage Inference Rules** (use in this order):

1. **If they purchased** → `stage = 'purchased'`
   - Look for: Payment records, Stripe charges, Denefits contracts
   - Set: `purchase_date`, `purchase_amount`

2. **If they started checkout but didn't buy** → `stage = 'checkout_started'`
   - Look for: Perspective form submissions, abandoned carts
   - Set: `checkout_started`

3. **If they received package/proposal** → `stage = 'package_sent'`
   - Look for: GHL pipeline stage = "Package Sent"
   - Set: `package_sent_date`

4. **If they attended meeting** → `stage = 'meeting_held'`
   - Look for: GHL pipeline stage = "Show", calendar events marked complete
   - Set: `appointment_held_date`

5. **If they booked meeting but didn't attend** → `stage = 'meeting_booked'`
   - Look for: GHL opportunities, calendar bookings
   - Set: `appointment_date`

6. **If they submitted form** → `stage = 'form_submitted'`
   - Look for: GHL contacts with no opportunity
   - Set: `form_submit_date`

7. **If they engaged in DMs** → `stage = 'dm_qualified'`
   - Look for: ManyChat subscribers with conversation data
   - Set: `dm_qualified_date`, `q1_question`, `q2_question`

8. **If they just subscribed** → `stage = 'new_lead'`
   - Look for: ManyChat subscribers with no conversation
   - Set: `subscribe_date`

### **Priority 3: Fill in Timeline (If Available)**

**Timestamp Estimation Strategy**:

If you don't have exact dates, use these fallback rules:

1. **Working Backwards from Purchase**:
   ```
   purchase_date = (known payment date)
   checkout_started = purchase_date - 1 hour
   package_sent_date = purchase_date - 2 days
   appointment_held_date = purchase_date - 5 days
   appointment_date = appointment_held_date - 7 days
   form_submit_date = appointment_date - 1 day
   ```

2. **Use Record Metadata**:
   - `created_at` in Airtable → earliest event date
   - `updated_at` in Airtable → latest event date
   - For missing dates: Use `updated_at` as best estimate

3. **If Only One Date Known**:
   - If only payment date: Set `purchase_date` and `stage = 'purchased'`
   - If only meeting date: Set `appointment_held_date` and `stage = 'meeting_held'`

### **Priority 4: Attribution Data (Optional but Valuable)**

```
source              'instagram' (if mc_id exists), 'website' (if no mc_id)
ad_id               Meta ad campaign ID (if available)
mc_id               ManyChat subscriber ID
ghl_id              GoHighLevel contact ID
stripe_customer_id  Stripe customer ID
```

---

## 📁 Common Historical Data Sources & How to Map

### **Airtable Contacts Export**

**Common Fields**:
```
Email → email_primary
Phone → phone (normalize to +1XXXXXXXXXX)
First Name → first_name
Last Name → last_name
ManyChat ID → mc_id
GHL Contact ID → ghl_id
Stage → stage (map to our stage names)
Created Time → subscribe_date or created_at
Last Modified → updated_at
```

### **Stripe Payments Export**

**Common Fields**:
```
Customer Email → email_payment (use to find contact)
Amount → purchase_amount
Created → purchase_date
Customer ID → stripe_customer_id
Description → (use to infer product/service)
Status → if 'succeeded', set stage = 'purchased'
```

### **Denefits Contracts CSV**

**Common Fields**:
```
Customer Email → email_payment
Contract Code → (store in payments table)
Financed Amount → purchase_amount
Date Added → purchase_date
Customer First Name → first_name
Customer Last Name → last_name
Customer Mobile → phone
```

### **GoHighLevel Export**

**Common Fields**:
```
Contact ID → ghl_id
Email → email_booking
Phone → phone
First Name → first_name
Last Name → last_name
Pipeline Stage → map to stage:
  - "Lead" → form_submitted
  - "Scheduled" → meeting_booked
  - "Show" → meeting_held
  - "Package Sent" → package_sent
Opportunity Created → appointment_date
Last Activity → updated_at
Custom Field: MC_ID → mc_id
Custom Field: AD_ID → ad_id
```

### **ManyChat Export**

**Common Fields**:
```
Subscriber ID → mc_id
First Name → first_name
Last Name → last_name
Phone → phone
Subscribed → subscribe_date
Last Interaction → ig_last_interaction
Custom Field: AD_ID → ad_id
Tags → (infer stage from tags like "Qualified", "Link Sent")
```

---

## 🔧 Migration Script Template

### **Step-by-Step Process**

```sql
-- STEP 1: Check if contact exists
SELECT id FROM contacts
WHERE email_primary ILIKE 'customer@example.com'
   OR mc_id = '1234567890'
   OR ghl_id = 'ghl_abc123'
   OR phone = '+11234567890'
LIMIT 1;

-- STEP 2: If not found, INSERT new contact
INSERT INTO contacts (
  -- Identification
  mc_id,
  ghl_id,
  stripe_customer_id,

  -- Personal Info
  first_name,
  last_name,
  email_primary,
  email_booking,
  email_payment,
  phone,
  ig,

  -- Attribution
  source,
  ad_id,

  -- Timeline (fill what you have)
  subscribe_date,
  dm_qualified_date,
  form_submit_date,
  appointment_date,
  appointment_held_date,
  package_sent_date,
  checkout_started,
  purchase_date,

  -- Revenue
  purchase_amount,

  -- Stage (most important!)
  stage,

  -- Metadata
  created_at,
  updated_at
) VALUES (
  '1234567890',                    -- mc_id
  'ghl_abc123',                    -- ghl_id
  'cus_xyz',                       -- stripe_customer_id
  'John',                          -- first_name
  'Doe',                           -- last_name
  'john@example.com',              -- email_primary
  'john@example.com',              -- email_booking
  'john@example.com',              -- email_payment
  '+11234567890',                  -- phone
  'johndoe_ig',                    -- ig
  'instagram',                     -- source
  'ad_campaign_123',               -- ad_id
  '2025-01-01 00:00:00',          -- subscribe_date
  '2025-01-02 00:00:00',          -- dm_qualified_date
  '2025-01-03 00:00:00',          -- form_submit_date
  '2025-01-05 00:00:00',          -- appointment_date
  '2025-01-05 14:00:00',          -- appointment_held_date
  '2025-01-06 00:00:00',          -- package_sent_date
  '2025-01-10 00:00:00',          -- checkout_started
  '2025-01-10 15:30:00',          -- purchase_date
  2500.00,                         -- purchase_amount
  'purchased',                     -- stage
  '2025-01-01 00:00:00',          -- created_at
  '2025-01-10 15:30:00'           -- updated_at
)
RETURNING id, email_primary, stage, purchase_amount;

-- STEP 3: If contact exists, UPDATE with new data
UPDATE contacts
SET
  ghl_id = COALESCE(ghl_id, 'ghl_abc123'),  -- Don't overwrite if exists
  purchase_date = '2025-01-10 15:30:00',
  purchase_amount = 2500.00,
  stage = 'purchased',  -- Update to furthest stage
  updated_at = NOW()
WHERE email_primary ILIKE 'john@example.com'
RETURNING id, email_primary, stage;
```

---

## 🎯 Stage Priority Rules

**When migrating historical data, if a contact has multiple data points, use the FURTHEST stage**:

```
purchased > checkout_started > package_sent > meeting_held >
meeting_booked > form_submitted > dm_qualified > new_lead
```

**Example**: If historical data shows:
- Contact submitted form on 1/1
- Contact attended meeting on 1/5
- Contact purchased on 1/10

**Correct migration**:
```sql
stage = 'purchased'
form_submit_date = '2025-01-01'
appointment_held_date = '2025-01-05'
purchase_date = '2025-01-10'
```

---

## 🚨 Common Migration Pitfalls

### **1. Email Mismatches**
- Historical data might have `user@gmail.com`
- Payment might have `user@yahoo.com`
- **Solution**: Use smart matching, check all 3 email fields, manual reconciliation

### **2. Phone Number Formats**
- Historical: `(123) 456-7890`
- Database needs: `+11234567890`
- **Solution**: Always normalize to E.164

### **3. Incomplete Timeline**
- Don't worry if you don't have every timestamp
- **Most critical**: `stage` and `purchase_date` (for revenue attribution)
- **Nice to have**: `subscribe_date`, `appointment_held_date`

### **4. Duplicate Contacts**
- Check for existing contacts BEFORE inserting
- Match on: `mc_id`, `ghl_id`, `email_primary`, `phone`
- **Solution**: Update existing records, don't create duplicates

### **5. Stage Confusion**
- Historical system might use different stage names
- **Solution**: Use the mapping table above to convert

---

## 📋 Quick Reference: Minimal Migration Requirements

**To link a purchase to attribution, you need AT MINIMUM**:

1. ✅ **Email** (to find the contact)
2. ✅ **Stage = 'purchased'** (to mark as customer)
3. ✅ **Purchase Amount** (for revenue tracking)
4. ✅ **Purchase Date** (for time-based analysis)

**Everything else is optional but helpful for funnel analysis.**

---

## 🔍 Validation Queries (Run After Migration)

```sql
-- Check for orphan payments (no contact match)
SELECT
  customer_email,
  amount,
  payment_date
FROM payments
WHERE contact_id IS NULL
ORDER BY payment_date DESC;

-- Check for purchased stage without purchase_date
SELECT
  id,
  email_primary,
  stage,
  purchase_date,
  purchase_amount
FROM contacts
WHERE stage = 'purchased'
  AND purchase_date IS NULL;

-- Count contacts by stage
SELECT
  stage,
  COUNT(*) as count,
  SUM(purchase_amount) as total_revenue
FROM contacts
GROUP BY stage
ORDER BY
  CASE stage
    WHEN 'purchased' THEN 1
    WHEN 'checkout_started' THEN 2
    WHEN 'package_sent' THEN 3
    WHEN 'meeting_held' THEN 4
    WHEN 'meeting_booked' THEN 5
    WHEN 'form_submitted' THEN 6
    WHEN 'dm_qualified' THEN 7
    WHEN 'new_lead' THEN 8
  END;
```

---

## 📝 Notes for Future Migrations

- **Save this file** in project root for reference
- **Update CLAUDE.md** with link to this guide
- **Run validation queries** after every migration
- **Document edge cases** you encounter
- **Keep historical CSV files** in `/historical_data/` folder

---

**This mapping guide ensures historical data integrates seamlessly with the live webhook system, enabling complete attribution from ad → DM → booking → purchase.**
