# Make.com → Denefits Webhook Setup

## 🎯 Goal
Forward Denefits webhooks through Make.com to your Vercel endpoint.

---

## 📝 Your Denefits Webhook Details

**Endpoint ID:** `end_swqaihcb6lhop8spwh6w`
**Make.com Webhook URL:** `https://hook.us2.make.com/15fn280oj21071gnh2xls9f7ixvblu0u`
**Secret Key:** `key_lmi8ohcoc9wdntg`
**Events:** `contract.status`, `contract.created`

**Auth Token:** `c0b21789bb74c9e8534762e3c43bd382`

---

## 🔧 Make.com Scenario Setup

### Module 1: Webhooks (Trigger)
- **Type:** Custom Webhook
- **Webhook URL:** Already set up: `https://hook.us2.make.com/15fn280oj21071gnh2xls9f7ixvblu0u`
- **Data structure:** JSON (Denefits will send to this URL)

### Module 2: HTTP Request
- **URL:** `https://mcb-dun.vercel.app/api/denefits-webhook`
- **Method:** POST
- **Headers:**
  - `Content-Type`: `application/json`
- **Body type:** Raw
- **Request content:**
  ```
  {{1.payload}}
  ```
  (This forwards the entire webhook payload from Denefits)

### Module 3: Error Handler (Optional)
- **Type:** Error handler on Module 2
- **Action:** Email notification or Slack alert
- **Retry:** 3 times with 5 min intervals

---

## 🎬 Quick Setup Steps

1. Log into Make.com: https://www.make.com
2. Find scenario: "TEST MODE - Contract tracking" (or create new)
3. Edit the HTTP module (Module 2)
4. Set URL to: `https://mcb-dun.vercel.app/api/denefits-webhook`
5. Set Body to forward entire payload: `{{1.payload}}`
6. Save and activate scenario

---

## ✅ Events That Will Be Forwarded

### contract.created
When a new contract is created (customer financed).
- Used to create initial payment record
- Sets purchase_date to contract.date_added
- Sets purchase_amount to contract.financed_amount

### contract.payments.recurring_payment
When a monthly payment is made by the customer.
- Logs the payment event
- **Does NOT overwrite** original purchase_date
- **Does NOT overwrite** original purchase_amount
- Updates payment tracking if needed

### contract.status
When contract status changes (Active → Overdue, etc.).
- Optional: Update contact stage based on status

---

## 🧪 Testing

### Test the Make.com → Vercel Flow

1. **Trigger a test webhook in Denefits dashboard** (if available)

2. **Or manually trigger Make.com webhook:**
```bash
curl -X POST https://hook.us2.make.com/15fn280oj21071gnh2xls9f7ixvblu0u \
  -H "Content-Type: application/json" \
  -d '[{
    "webhook_type": "contract.created",
    "data": {
      "contract": {
        "contract_id": 999999,
        "contract_code": "TEST123",
        "customer_email": "test@example.com",
        "customer_first_name": "Test",
        "customer_last_name": "User",
        "customer_mobile": "1234567890",
        "financed_amount": 1000,
        "date_added": "2025-11-13T20:00:00.000Z",
        "contract_status": "Active"
      }
    },
    "secret_key": "key_lmi8ohcoc9wdntg"
  }]'
```

3. **Check Make.com execution history**
   - Should show webhook received
   - Should show HTTP request sent to Vercel
   - Response should be 200

4. **Check your database**
```sql
SELECT * FROM webhook_logs WHERE source = 'denefits' ORDER BY created_at DESC LIMIT 5;
SELECT * FROM payments WHERE denefits_contract_code = 'TEST123';
```

---

## 🔐 Security Note

The Make.com scenario is passing through the `secret_key` from Denefits. Your endpoint will receive:
- `key_lmi8ohcoc9wdntg` (from Make.com endpoint)

You can optionally validate this in your webhook handler.

---

## 📊 Monitoring

**Make.com Dashboard:**
- View execution history
- See success/failure rate
- Check error logs

**Your Webhook Logs Table:**
- All forwarded webhooks logged
- Check `webhook_logs` table for status

---

## 🚨 If Make.com Fails

Make.com has auto-retry built in. If your Vercel endpoint is down:
1. Make.com will retry 3 times
2. Check Make.com error logs
3. Manually resend from Make.com execution history

---

## 💰 Make.com Operations Cost

- Each webhook = 1 operation
- Each retry = 1 operation
- Estimated: ~100 operations/month (depends on contract volume)

Free tier: 1,000 operations/month (plenty for this use case)

---

## ✅ Advantages of This Setup

1. **Make.com acts as buffer** - Retries automatically
2. **Visual debugging** - See exactly what was sent/received
3. **Easy to modify** - Change routing, add filters, etc.
4. **Reliable** - Make.com is enterprise-grade
5. **Multiple events** - Already subscribed to status changes too

---

## 🔄 What Changed

**Before:** Denefits → Vercel (direct, failing)
**After:** Denefits → Make.com → Vercel (working)

Same endpoint code, just routing through Make.com first.
