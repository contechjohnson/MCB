# Historical Data Migration - Quick Start Guide

**For the other terminal working on migration**

---

## 🎯 Goal

Import historical customer data into Supabase so purchases can be attributed to the full customer journey (ad → DM → booking → purchase).

---

## 📖 Full Documentation

**Complete guide**: `HISTORICAL_DATA_MAPPING.md`

This quick start gives you the essentials. Read the full guide for details.

---

## 🚀 Quick Process (3 Steps)

### **Step 1: Identify What Stage the Contact Reached**

Use this decision tree:

```
Did they purchase? → stage = 'purchased'
  ├─ YES: Set purchase_date, purchase_amount
  └─ NO: Continue...

Did they start checkout? → stage = 'checkout_started'
  ├─ YES: Set checkout_started
  └─ NO: Continue...

Did they get a package/proposal? → stage = 'package_sent'
  ├─ YES: Set package_sent_date
  └─ NO: Continue...

Did they attend a meeting? → stage = 'meeting_held'
  ├─ YES: Set appointment_held_date
  └─ NO: Continue...

Did they book a meeting? → stage = 'meeting_booked'
  ├─ YES: Set appointment_date
  └─ NO: Continue...

Did they submit a form? → stage = 'form_submitted'
  ├─ YES: Set form_submit_date
  └─ NO: Continue...

Did they have a DM conversation? → stage = 'dm_qualified'
  ├─ YES: Set dm_qualified_date
  └─ NO: stage = 'new_lead'
```

### **Step 2: Gather Required Data**

**Minimum Required** (to create contact):
- ✅ Email OR Phone OR mc_id OR ghl_id (at least one!)
- ✅ stage (from Step 1)

**Critical for Revenue Attribution**:
- ✅ purchase_amount (if they purchased)
- ✅ purchase_date (if they purchased)

**Nice to Have**:
- First name, last name
- Source ('instagram' or 'website')
- Timeline dates (subscribe_date, appointment_held_date, etc.)

### **Step 3: Insert or Update Contact**

```sql
-- Check if contact exists first
SELECT id FROM contacts
WHERE email_primary ILIKE 'customer@example.com'
   OR mc_id = 'MC_ID_HERE'
   OR ghl_id = 'GHL_ID_HERE'
   OR phone = '+1XXXXXXXXXX'
LIMIT 1;

-- If NOT found, INSERT
INSERT INTO contacts (
  -- Identification (fill what you have)
  mc_id,
  ghl_id,
  email_primary,
  phone,
  first_name,
  last_name,

  -- Attribution
  source,

  -- Timeline (fill what you have)
  purchase_date,
  purchase_amount,

  -- MOST IMPORTANT: Stage
  stage
) VALUES (
  'MC_ID_OR_NULL',
  'GHL_ID_OR_NULL',
  'customer@example.com',
  '+11234567890',
  'John',
  'Doe',
  'instagram',
  '2025-01-10 00:00:00',
  2500.00,
  'purchased'
)
RETURNING id, email_primary, stage, purchase_amount;

-- If found, UPDATE with new data
UPDATE contacts
SET
  purchase_date = '2025-01-10 00:00:00',
  purchase_amount = 2500.00,
  stage = 'purchased'
WHERE id = 'UUID_FROM_STEP_1'
RETURNING id, email_primary, stage;
```

---

## 📊 Common Historical Data Sources

### **Stripe Export**
```
Customer Email → email_primary
Amount → purchase_amount
Created → purchase_date
Status = 'succeeded' → stage = 'purchased'
```

### **Denefits Export**
```
Customer Email → email_primary
Financed Amount → purchase_amount
Date Added → purchase_date
Contract created → stage = 'purchased'
```

### **GoHighLevel Export**
```
Contact ID → ghl_id
Email → email_primary
Pipeline Stage:
  - "Show" / "Attended" → stage = 'meeting_held'
  - "Scheduled" / "Booked" → stage = 'meeting_booked'
  - "Package Sent" → stage = 'package_sent'
```

### **ManyChat Export**
```
Subscriber ID → mc_id
Phone → phone (normalize to +1XXXXXXXXXX)
Subscribed → subscribe_date
Has conversation data → stage = 'dm_qualified'
No conversation data → stage = 'new_lead'
```

### **Airtable Export**
```
Email → email_primary
ManyChat ID → mc_id
GHL Contact ID → ghl_id
Stage field → map to our stages
Created Time → subscribe_date
```

---

## ⚠️ Common Mistakes to Avoid

1. **Phone Format**: Always use `+1XXXXXXXXXX` (E.164 format)
   - ❌ Wrong: `(123) 456-7890`
   - ✅ Right: `+11234567890`

2. **Email Case**: Use lowercase
   - ❌ Wrong: `John@Example.COM`
   - ✅ Right: `john@example.com`

3. **Duplicate Check**: ALWAYS check if contact exists before inserting
   - Use email, mc_id, ghl_id, or phone to search first

4. **Stage Priority**: If a contact has multiple data points, use the FURTHEST stage
   - Example: If data shows "form submitted" AND "purchased", use `stage = 'purchased'`

5. **NULL vs Missing**: Use `NULL` in SQL for missing data, not empty strings

---

## 🎯 Stage Progression (Furthest Wins)

```
purchased (10)
    ↑
checkout_started (9)
    ↑
package_sent (8)
    ↑
meeting_held (7)
    ↑
meeting_booked (6)
    ↑
form_submitted (5)
    ↑
link_clicked (4)
    ↑
link_sent (3)
    ↑
dm_qualified (2)
    ↑
new_lead (1)
```

**Rule**: Always set contact to the highest stage they reached.

---

## ✅ Validation Checklist

After migration, run these queries:

```sql
-- 1. Check for orphan payments
SELECT customer_email, amount
FROM payments
WHERE contact_id IS NULL;

-- 2. Check purchased contacts have purchase_date
SELECT email_primary, stage, purchase_date, purchase_amount
FROM contacts
WHERE stage = 'purchased'
  AND (purchase_date IS NULL OR purchase_amount IS NULL);

-- 3. Count contacts by stage
SELECT stage, COUNT(*) as count
FROM contacts
GROUP BY stage
ORDER BY COUNT(*) DESC;
```

---

## 🔧 Tools Available

You have access to:
- Supabase MCP (natural language SQL queries)
- Direct SQL via `execute_sql` tool
- CSV files in `/historical_data/` folder

**Project ID**: `succdcwblbzikenhhlrz` (MCB_PPCU)

---

## 📞 Need Help?

If you get stuck:
1. Check `HISTORICAL_DATA_MAPPING.md` for detailed examples
2. Check `CURRENT_STATUS_REPORT.md` for current database state
3. Run validation queries to see what's wrong
4. Ask for clarification on stage mapping

---

**Remember**: The goal is to link purchases to customers. Stage + purchase data are most critical. Everything else is bonus.
