# Denefits → Make.com → Vercel Complete Setup

**Status:** Ready to configure ✅
**Last Updated:** November 13, 2025

---

## 📋 Quick Reference

### Your Credentials

**Denefits Auth Token:**
```
c0b21789bb74c9e8534762e3c43bd382
```

**Make.com Webhook URL:**
```
https://hook.us2.make.com/15fn280oj21071gnh2xls9f7ixvblu0u
```

**Denefits Endpoint ID:**
```
end_swqaihcb6lhop8spwh6w
```

**Secret Key (for validation):**
```
key_lmi8ohcoc9wdntg
```

**Your Vercel Endpoint:**
```
https://mcb-dun.vercel.app/api/denefits-webhook
```

---

## ✅ What's Already Done

- ✅ Denefits webhook endpoint configured (endpoint_swqaihcb6lhop8spwh6w)
- ✅ Subscribed to events: `contract.created`, `contract.status`
- ✅ Make.com webhook URL active
- ✅ Vercel endpoint updated to handle all event types
- ✅ Code deployed to production

---

## 🔧 Make.com Configuration (5 minutes)

### Step 1: Open Make.com Scenario

1. Go to: https://www.make.com/login
2. Find scenario: **"TEST MODE - Contract tracking"**
   - Or create a new scenario if it doesn't exist

### Step 2: Configure Webhook Trigger (Module 1)

**Module Type:** Webhooks → Custom Webhook

**Settings:**
- Webhook name: `Denefits Contracts`
- Webhook URL: `https://hook.us2.make.com/15fn280oj21071gnh2xls9f7ixvblu0u` (already created)
- This receives webhooks FROM Denefits

### Step 3: Add HTTP Module (Module 2)

**Module Type:** HTTP → Make a request

**URL:**
```
https://mcb-dun.vercel.app/api/denefits-webhook
```

**Method:** `POST`

**Headers:**
```
Content-Type: application/json
```

**Body Type:** `Raw`

**Request Content:**
```
{{1.payload}}
```

**What this does:** Forwards the entire webhook from Denefits to your Vercel endpoint.

### Step 4: Save and Activate

1. Click **Save** (bottom right)
2. Toggle **ON** (top right)
3. Scenario is now active!

---

## 🧪 Testing (10 minutes)

### Test 1: Check Make.com Webhook

```bash
curl -X POST https://hook.us2.make.com/15fn280oj21071gnh2xls9f7ixvblu0u \
  -H "Content-Type: application/json" \
  -d '[{
    "webhook_type": "contract.created",
    "data": {
      "contract": {
        "contract_id": 999999,
        "contract_code": "TEST999",
        "customer_email": "test@example.com",
        "customer_first_name": "Test",
        "customer_last_name": "User",
        "financed_amount": 1500,
        "date_added": "2025-11-13T20:00:00.000Z",
        "contract_status": "Active",
        "recurring_amount": 125,
        "number_of_payments": 12,
        "remaining_payments": 12
      }
    },
    "secret_key": "key_lmi8ohcoc9wdntg"
  }]'
```

**Expected:**
- ✅ Make.com execution appears in history
- ✅ HTTP request sent to Vercel
- ✅ Response 200

### Test 2: Check Your Database

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

(async () => {
  // Check webhook logs
  const { data: logs } = await supabase
    .from('webhook_logs')
    .select('*')
    .eq('source', 'denefits')
    .order('created_at', { ascending: false })
    .limit(1);

  console.log('Latest webhook:', logs[0]);

  // Check payments
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('denefits_contract_code', 'TEST999');

  console.log('Test payment:', payment);
})();
"
```

**Expected:**
- ✅ Webhook log created with `contract.created` event
- ✅ Payment record created (or orphan if test email doesn't exist)

### Test 3: Test Recurring Payment Event

```bash
curl -X POST https://hook.us2.make.com/15fn280oj21071gnh2xls9f7ixvblu0u \
  -H "Content-Type: application/json" \
  -d '[{
    "webhook_type": "contract.payments.recurring_payment",
    "data": {
      "contract": {
        "contract_id": 999999,
        "contract_code": "TEST999",
        "customer_email": "test@example.com",
        "recurring_amount": 125,
        "remaining_payments": 11,
        "financed_amount": 1500,
        "date_added": "2025-11-13T20:00:00.000Z"
      }
    },
    "secret_key": "key_lmi8ohcoc9wdntg"
  }]'
```

**Expected:**
- ✅ Webhook logged
- ❌ **No new payment record created** (correct behavior)
- ❌ **Purchase date NOT updated** (correct behavior)

---

## 📊 What Each Event Does

### contract.created
**When it fires:** Customer signs up for BNPL financing

**What happens:**
1. ✅ Creates payment record in `payments` table
2. ✅ Sets `amount` = `financed_amount` (full amount, not recurring)
3. ✅ Sets `payment_date` = `date_added` (contract creation date)
4. ✅ Updates contact `purchase_date` = contract creation date
5. ✅ Updates contact `purchase_amount` = total (Stripe + Denefits)
6. ✅ Updates contact `stage` = 'purchased'

**Example:**
- Customer finances $3,296 on Nov 11, 2025
- Payment record: amount=$3,296, date=Nov 11
- Contact: purchase_date=Nov 11, purchase_amount=$3,296

### contract.payments.recurring_payment
**When it fires:** Customer makes monthly payment

**What happens:**
1. ✅ Logs webhook event
2. ❌ **Does NOT create new payment record**
3. ❌ **Does NOT update purchase_date**
4. ❌ **Does NOT update purchase_amount**

**Why:** The purchase already happened when contract was created. Monthly payments are just installments.

### contract.status
**When it fires:** Contract status changes (Active → Overdue, etc.)

**What happens:**
1. ✅ Logs webhook event with status change info
2. ❌ **Does NOT update contact** (for now)

**Future:** Could update contact stage based on status (e.g., mark overdue)

---

## 🎯 Event Subscription Configuration

**Current subscription (Make.com endpoint):**
- ✅ `contract.created`
- ✅ `contract.status`
- ❌ `contract.payments.recurring_payment` (not subscribed yet)

### To Add Recurring Payment Events

**Option 1: Via Denefits Dashboard**
1. Log into Denefits
2. Go to API → Webhooks
3. Find endpoint: `end_swqaihcb6lhop8spwh6w`
4. Add event: `contract.payments.recurring_payment`
5. Save

**Option 2: Via API**

```bash
curl -X PUT https://endpoint.denefits.com/v1/webhook/endpoint \
  -H "Authorization: Bearer c0b21789bb74c9e8534762e3c43bd382" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint_id": "end_swqaihcb6lhop8spwh6w",
    "endpoint_url": "https://hook.us2.make.com/15fn280oj21071gnh2xls9f7ixvblu0u",
    "description": "TEST MODE - Contract tracking",
    "is_active": 1,
    "is_deleted": 0,
    "auto_retry_on_failure": 1,
    "webhook_type_action": [
      {
        "webhook_type": "contract.payments.recurring_payment",
        "action": 1
      }
    ]
  }'
```

---

## 📈 Monitoring

### Make.com Dashboard
- Execution history: See all webhooks received
- Success/failure rate: Monitor reliability
- Error logs: Debug issues

### Your Database
```sql
-- Recent Denefits webhooks
SELECT event_type, status, created_at
FROM webhook_logs
WHERE source = 'denefits'
ORDER BY created_at DESC
LIMIT 10;

-- Denefits payments
SELECT
  denefits_contract_code,
  customer_email,
  amount,
  payment_date,
  status
FROM payments
WHERE payment_source = 'denefits'
ORDER BY payment_date DESC;

-- Contacts with Denefits purchases
SELECT
  first_name,
  last_name,
  email_primary,
  purchase_date,
  purchase_amount,
  stage
FROM contacts
WHERE email_payment IN (
  SELECT customer_email
  FROM payments
  WHERE payment_source = 'denefits'
);
```

---

## 🚨 Troubleshooting

### Webhooks not arriving

**Check 1: Make.com scenario active?**
- Go to Make.com dashboard
- Check scenario is ON (green toggle)

**Check 2: Denefits endpoint active?**
```bash
curl -X GET "https://endpoint.denefits.com/v1/webhook/endpoint?limit=10&skip=0" \
  -H "Authorization: Bearer c0b21789bb74c9e8534762e3c43bd382"
```
- Look for `end_swqaihcb6lhop8spwh6w`
- Check `is_active: 1`

**Check 3: Make.com execution history**
- View recent runs
- Check for errors
- Resend failed webhooks

### Payment not linking to contact

**Cause:** Email mismatch
- Payment email: `customer_email` from Denefits
- Contact emails: `email_primary`, `email_booking`, `email_payment`

**Solution:**
- Payment logs as "orphan"
- Check `payments` table for `contact_id: null`
- Manually link by updating contact email or payment email

### Purchase date is wrong

**Cause:** Using current date instead of contract date
- ✅ **Fixed:** Now uses `contract.date_added`

**Verify:**
```sql
SELECT
  p.denefits_contract_code,
  p.payment_date as payment_record_date,
  c.purchase_date as contact_purchase_date,
  p.raw_payload->'data'->'contract'->>'date_added' as contract_created_date
FROM payments p
JOIN contacts c ON p.contact_id = c.id
WHERE p.payment_source = 'denefits'
ORDER BY p.payment_date DESC;
```

All three dates should match!

---

## 💰 Cost Estimate

**Make.com:**
- 1 webhook = 1 operation
- ~100 contracts/month = 100 operations
- Free tier: 1,000 operations/month
- **Cost: $0**

**Vercel:**
- Webhook endpoints included in free tier
- **Cost: $0**

**Total:** **FREE** 🎉

---

## ✅ Final Checklist

Before you're done, verify:

- [ ] Make.com scenario created and active
- [ ] HTTP module forwards to: `https://mcb-dun.vercel.app/api/denefits-webhook`
- [ ] Test webhook sent successfully
- [ ] Test payment appears in database
- [ ] Webhook logs show "processed" status
- [ ] Subscribe to `contract.payments.recurring_payment` event (optional)

---

## 🎉 You're Done!

**What happens now:**

1. **New Denefits contract created**
   - Denefits sends webhook → Make.com
   - Make.com forwards → Your Vercel endpoint
   - Payment record created with correct date
   - Contact updated to "purchased"

2. **Monthly payment made**
   - Denefits sends webhook → Make.com
   - Make.com forwards → Your Vercel endpoint
   - Event logged, nothing else changes

3. **Contract status changes**
   - Denefits sends webhook → Make.com
   - Make.com forwards → Your Vercel endpoint
   - Status change logged

**No more manual webhook processing needed!** 🚀

---

## 📞 Support

**Make.com Issues:**
- Dashboard: https://www.make.com
- Support: https://www.make.com/en/help

**Denefits Issues:**
- Contact Denefits support
- Reference endpoint: `end_swqaihcb6lhop8spwh6w`

**Your Endpoint Issues:**
- Check Vercel logs: https://vercel.com/dashboard
- Check webhook_logs table in Supabase
- Test endpoint: `curl https://mcb-dun.vercel.app/api/denefits-webhook`
