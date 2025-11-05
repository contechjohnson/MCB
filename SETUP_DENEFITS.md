# Denefits Webhook Setup (Copy-Paste Guide)

**What we're doing:** Track when customers use Denefits (Buy Now Pay Later) to finance their purchase.

**Difficulty:** Medium (depends on Denefits webhook availability)

---

## Important: Check Your Make.com Scenario First!

Since you've already set this up with Make.com before, **look at your existing scenario** to see:
1. What events Denefits sends
2. What fields are in the payload
3. How you mapped the data

This will help you customize the webhook endpoint.

---

## Option 1: Keep Using Make.com (Easiest)

**If your Make.com integration already works, just update the destination URL:**

### Step 1: Open Your Make.com Scenario

Find your existing "Denefits → Database" scenario

### Step 2: Update the Webhook URL

Find the HTTP module (where you send data) and change URL to:
```
https://mcb-dun.vercel.app/api/denefits-webhook
```

### Step 3: Update the Body

Make sure the body matches the actual Denefits payload structure:
```json
{
  "webhook_type": "{{webhook_type}}",
  "data": {
    "contract": {
      "customer_email": "{{data.contract.customer_email}}",
      "customer_first_name": "{{data.contract.customer_first_name}}",
      "customer_last_name": "{{data.contract.customer_last_name}}",
      "customer_mobile": "{{data.contract.customer_mobile}}",
      "financed_amount": "{{data.contract.financed_amount}}",
      "contract_id": "{{data.contract.contract_id}}",
      "contract_code": "{{data.contract.contract_code}}",
      "contract_status": "{{data.contract.contract_status}}",
      "date_added": "{{data.contract.date_added}}"
    }
  }
}
```

**Note:** Currently using `financed_amount` (the total they're financing). You can adjust if needed.

### Step 4: Test It

1. Create test financing application in Denefits
2. Check Make.com execution history
3. Check your database:
```sql
SELECT * FROM webhook_logs WHERE source = 'denefits';
SELECT * FROM contacts WHERE purchase_date IS NOT NULL ORDER BY created_at DESC;
```

---

## Option 2: Direct Webhook (If Denefits Supports It)

### Step 1: Check if Denefits Has Webhooks

1. Log into Denefits dashboard
2. Look for: Settings → API → Webhooks (or similar)
3. If you see webhook settings, continue. If not, use Make.com (Option 1)

### Step 2: Create Webhook in Denefits

**Webhook URL:**
```
https://mcb-dun.vercel.app/api/denefits-webhook
```

**Events to Subscribe:**
- Payment plan created (or application approved)
- Payment received
- Payment completed
- Payment failed (optional)

### Step 3: Get Webhook Secret (if available)

If Denefits provides a webhook signing secret:
1. Copy the secret
2. Add to `.env.local`:
   ```bash
   DENEFITS_WEBHOOK_SECRET=your_secret_here
   ```
3. Add to Vercel environment variables

### Step 4: Test It

Send test webhook from Denefits dashboard (if available) or create test transaction.

---

## What Gets Tracked

### When customer gets approved for financing:
- ✅ Finds contact by email
- ✅ Updates `checkout_started` = now
- ✅ Updates `stage` = "checkout_started"

### When payment plan is created:
- ✅ Finds contact by email
- ✅ Updates `purchase_date` = now
- ✅ Updates `purchase_amount` = total plan amount
- ✅ Updates `email_payment` = email from Denefits
- ✅ Updates `stage` = "purchased"

### When individual payment is made:
- ✅ Logged but doesn't change purchase_amount (that's the total)
- ✅ Could track payment progress if needed

### When plan is paid off:
- ✅ Updates `stage` = "purchased" (if not already)

---

## Customizing the Webhook

**You MUST customize the webhook endpoint based on actual Denefits data.**

### Step 1: Check Make.com Payload

In your existing Make.com scenario:
1. Run it once
2. Look at the execution history
3. See what data Denefits sends
4. Note the field names

### Step 2: Update the Webhook Code

Open `/app/api/denefits-webhook/route.ts` and update these lines:

**Line 34-38 (Field extraction):**
```typescript
// CHANGE THESE to match actual Denefits field names:
const email = body.customer_email || body.email;
const amount = body.amount || body.total_amount;
const eventType = body.event_type || body.type;
```

**Line 95-140 (Event handling):**
```typescript
// CHANGE event names to match actual Denefits events:
case 'payment_approved':  // ← Replace with actual event name
case 'payment_plan_created':  // ← Replace with actual event name
```

### Step 3: Test with Sample Payload

Create a test file with the ACTUAL Denefits payload structure:

```bash
# test-denefits.sh
curl -X POST http://localhost:3001/api/denefits-webhook \
  -H "Content-Type: application/json" \
  -d '[{
    "webhook_type": "contract.payments.recurring_payment",
    "data": {
      "contract": {
        "customer_email": "test@example.com",
        "customer_first_name": "Test",
        "customer_last_name": "User",
        "customer_mobile": "6162831574",
        "financed_amount": 1497,
        "contract_id": 136294,
        "contract_code": "TESTCODE123",
        "contract_status": "Active",
        "date_added": "2025-11-04T16:28:57.000Z"
      }
    },
    "secret_key": "key_x9nnpj3cw4103ed"
  }]'
```

Run it:
```bash
bash test-denefits.sh
```

Check database:
```sql
SELECT * FROM webhook_logs WHERE source = 'denefits' ORDER BY created_at DESC LIMIT 1;
```

---

## Common Denefits Events (Guess - Verify with Your Setup)

Based on typical BNPL platforms, Denefits likely sends:

**Application Events:**
- `application_submitted` - Customer applied for financing
- `application_approved` - Approved for financing
- `application_declined` - Denied financing

**Plan Events:**
- `payment_plan_created` - Payment plan set up
- `payment_plan_updated` - Plan terms changed

**Payment Events:**
- `payment_received` - Customer made a payment
- `payment_failed` - Payment failed
- `payment_plan_completed` - Fully paid off

**Update the webhook code to match YOUR actual events!**

---

## Database Schema Note

The webhook updates these fields in `contacts` table:
- `email_payment` - Email used in Denefits
- `purchase_date` - When plan was created
- `purchase_amount` - Total plan amount
- `checkout_started` - When they were approved (optional)
- `stage` - Current funnel stage

If you need to track **Denefits-specific data** (like payment plan ID, monthly amount, etc.):

### Option A: Add to contacts table
```sql
ALTER TABLE contacts ADD COLUMN denefits_plan_id TEXT;
ALTER TABLE contacts ADD COLUMN denefits_customer_id TEXT;
```

### Option B: Create separate table
```sql
CREATE TABLE denefits_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id),
  plan_id TEXT,
  customer_id TEXT,
  total_amount DECIMAL(10,2),
  monthly_amount DECIMAL(10,2),
  term_months INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Make.com Recommendation

**Honestly, just keep using Make.com for Denefits.**

**Why:**
- ✅ You already have it working
- ✅ Denefits webhook documentation is unclear
- ✅ Make.com gives you visual debugging
- ✅ Easy to adjust field mapping

**Cost:** Minimal - Denefits events are infrequent (only when someone finances)

**Setup:**
1. Keep your existing Make.com scenario
2. Just change the destination URL to your new endpoint
3. Test it
4. Done

---

## Testing Checklist

- [ ] Make.com scenario updated with new webhook URL
- [ ] Test Denefits transaction → Check webhook_logs
- [ ] Contact found by email
- [ ] purchase_date and purchase_amount updated
- [ ] stage set to "purchased"
- [ ] No errors in webhook_logs

---

## Troubleshooting

**Contact not found:**
- Verify email from Denefits matches database
- Check `find_contact_by_email` function works
- Ensure contact exists (from ManyChat or GHL first)

**Wrong amount recorded:**
- Check if Denefits sends amount in cents or dollars
- Adjust code if needed (multiply/divide by 100)

**Event not recognized:**
- Check actual event name in Make.com
- Update switch statement in webhook code
- Add console.log to see raw payload

**Make.com not sending:**
- Check scenario is Active
- Verify Denefits trigger is configured correctly
- Check Make.com execution history for errors

---

## Next Steps

1. **Find your existing Make.com scenario** for Denefits
2. **Check what data it sends** (execution history)
3. **Update webhook endpoint** with correct field names
4. **Change Make.com destination URL** to your new endpoint
5. **Test with real transaction**

---

## Need Help?

1. Share your Make.com scenario payload (what Denefits actually sends)
2. I'll help you customize the webhook endpoint
3. Or just keep using Make.com - it works!

The webhook endpoint I created is a **template** - customize it based on YOUR actual Denefits integration!
