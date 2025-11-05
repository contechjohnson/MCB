# Stripe Webhook Setup (Copy-Paste Guide)

**What we're doing:** Making Stripe tell your database when someone pays (or their checkout expires).

**Difficulty:** Easy (Stripe has the best webhook UI)

---

## Step 1: Get Your API Keys

### Secret Key

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Click **Developers** (top right)
3. Click **API Keys**
4. Find "Secret key" (starts with `sk_test_` or `sk_live_`)
5. Click **Reveal test key** (or live key if in production)
6. **Copy it**

Add to `.env.local`:
```bash
STRIPE_SECRET_KEY=sk_test_your_key_here
```

---

## Step 2: Create Webhook in Stripe

1. Still in **Developers** section
2. Click **Webhooks** (left sidebar)
3. Click **Add endpoint**

**Endpoint URL:**
```
https://mcb-dun.vercel.app/api/stripe-webhook
```

**Description (optional):**
```
MCB Payment Tracking
```

**Events to send:**

Click **Select events** and choose these 3:

- ✅ `checkout.session.completed` (payment successful)
- ✅ `checkout.session.expired` (they abandoned checkout)
- ✅ `charge.refunded` (refund processed)

**Click Add endpoint**

---

## Step 3: Get Webhook Signing Secret

1. After creating the endpoint, you'll see it in the list
2. Click on the endpoint you just created
3. Find **Signing secret** section
4. Click **Reveal**
5. **Copy it** (starts with `whsec_`)

Add to `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
```

**Restart your server** (if running locally):
```bash
npm run dev
```

---

## Step 4: Test It

### Option A: Use Stripe CLI (Recommended for Local Testing)

**Install Stripe CLI:**
```bash
# Mac
brew install stripe/stripe-cli/stripe

# Windows
Download from: https://github.com/stripe/stripe-cli/releases
```

**Login to Stripe:**
```bash
stripe login
```

**Forward webhooks to local server:**
```bash
stripe listen --forward-to localhost:3001/api/stripe-webhook
```

This gives you a **temporary webhook secret** - add it to `.env.local` for testing.

**Trigger test payment:**
```bash
stripe trigger checkout.session.completed
```

**Check database:**
```sql
SELECT * FROM contacts WHERE purchase_date IS NOT NULL;
SELECT * FROM stripe_events ORDER BY created_at DESC;
```

### Option B: Test in Dashboard

1. Go to **Developers → Webhooks**
2. Click your endpoint
3. Click **Send test webhook**
4. Choose `checkout.session.completed`
5. Edit the test event to include an email:
```json
{
  "customer_email": "test@example.com"
}
```
6. Click **Send test webhook**

**Check database** (same queries as above)

---

## What Gets Tracked

### When payment succeeds (checkout.session.completed):
- ✅ Finds contact by email (checks all 3 email fields)
- ✅ Updates `purchase_date` = now
- ✅ Updates `purchase_amount` = amount paid
- ✅ Updates `email_payment` = email from Stripe
- ✅ Updates `stripe_customer_id` = Stripe customer ID
- ✅ Updates `stage` = "purchased"
- ✅ Logs event in `stripe_events` table

### When checkout expires (checkout.session.expired):
- ✅ Finds contact by email
- ✅ Updates `checkout_started` = when they started
- ✅ Useful for abandoned cart analysis

### When refund happens (charge.refunded):
- ✅ Finds contact by email
- ✅ Reduces `purchase_amount` by refund amount
- ✅ Logs refund in `stripe_events` table

---

## Important Notes

### Email Matching
Stripe webhook finds contacts by checking **all 3 email fields**:
1. `email_primary` (from ManyChat)
2. `email_booking` (from GHL)
3. `email_payment` (from previous Stripe checkout)

So if someone uses a different email to pay, it will STILL match them if they used that email before.

### What if contact not found?
- Event is still logged in `stripe_events` table
- You can manually link it later by checking:
```sql
SELECT * FROM stripe_events WHERE contact_id IS NULL;
```

### Duplicate Prevention
- Stripe sends same event multiple times sometimes
- Webhook automatically deduplicates using `event_id`
- Safe to re-send test events, won't create duplicates

---

## Testing Checklist

- [ ] Added `STRIPE_SECRET_KEY` to `.env.local`
- [ ] Added `STRIPE_WEBHOOK_SECRET` to `.env.local`
- [ ] Created webhook endpoint in Stripe dashboard
- [ ] Selected 3 events (completed, expired, refunded)
- [ ] Sent test webhook → Check `stripe_events` table
- [ ] Triggered real test payment → Check contact updated

---

## Troubleshooting

**Webhook signature verification failed:**
1. Make sure `STRIPE_WEBHOOK_SECRET` matches the secret in Stripe dashboard
2. Restart your server after updating `.env.local`
3. If using Stripe CLI, use the CLI's webhook secret (it's different)

**Contact not found by email:**
1. Check the email in Stripe matches email in database
2. Verify `find_contact_by_email` function exists in Supabase
3. Check `stripe_events` table - event is still logged even if no match

**Webhook not firing:**
1. Verify endpoint URL is correct in Stripe dashboard
2. Check webhook is "Enabled" (not disabled)
3. Look at "Recent deliveries" in Stripe to see if it tried to send

**Amount is wrong:**
1. Stripe amounts are in cents - webhook divides by 100 automatically
2. Check `stripe_events.amount` to see what was recorded

---

## Production Checklist

When going live:

- [ ] Create webhook endpoint using LIVE Stripe keys
- [ ] Get new webhook signing secret (different for live mode)
- [ ] Update `.env.local` with live keys:
  - `STRIPE_SECRET_KEY=sk_live_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_live_...`
- [ ] Deploy to Vercel
- [ ] Add environment variables to Vercel (not just `.env.local`)
- [ ] Test with real test payment in live mode

---

## Monitoring

### Check recent payments:
```sql
SELECT
  customer_email,
  amount,
  status,
  created_at
FROM stripe_events
WHERE event_type = 'checkout.session.completed'
ORDER BY created_at DESC
LIMIT 20;
```

### Check abandoned checkouts:
```sql
SELECT
  customer_email,
  created_at
FROM stripe_events
WHERE event_type = 'checkout.session.expired'
ORDER BY created_at DESC;
```

### Check refunds:
```sql
SELECT
  customer_email,
  amount,
  created_at
FROM stripe_events
WHERE event_type = 'charge.refunded'
ORDER BY created_at DESC;
```

### Check for unmatched payments:
```sql
SELECT
  event_type,
  customer_email,
  amount,
  created_at
FROM stripe_events
WHERE contact_id IS NULL
ORDER BY created_at DESC;
```

---

## Need Help?

1. Check **Recent deliveries** in Stripe webhook dashboard
2. Check `webhook_logs` table in Supabase
3. Look for `status = 'error'` and read `error_message`
4. Verify email from Stripe matches database (case doesn't matter)
5. Make sure contact exists BEFORE payment (from ManyChat or GHL)

---

## FAQ

**Q: What if someone pays before they're in the database?**
A: Event is logged in `stripe_events` table, but contact won't be updated. You can manually link later or wait for them to book a call (which creates the contact).

**Q: Can I test with real payments?**
A: Use Stripe's test mode! Test card: `4242 4242 4242 4242`, any future date, any CVC.

**Q: Do I need to do anything for subscriptions?**
A: If you charge subscriptions (not one-time), add these events:
- `invoice.payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.deleted`

**Q: How do I see webhook delivery attempts?**
A: Stripe Dashboard → Developers → Webhooks → Your endpoint → Recent deliveries
