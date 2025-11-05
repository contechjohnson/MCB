# 🚀 Deployment Checklist - Do This NOW

**Your code is live on GitHub! Vercel is deploying...**

Follow these steps in order to get everything working.

---

## ✅ Step 1: Check Vercel Deployment (2 minutes)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Find your project (MCB or similar)
3. Click on it
4. Wait for deployment to finish (should be done already!)
5. **Copy your production URL**: `https://your-app-name.vercel.app`

**Write it down here:**
```
My Vercel URL: https://mcb-dun.vercel.app/
```

---

## ✅ Step 2: Add Environment Variables to Vercel (5 minutes)

1. In Vercel Dashboard → Your Project → **Settings**
2. Click **Environment Variables** (left sidebar)
3. Add these one by one:

### Required (Copy from .env.local):

```bash
# Supabase (you already have these)
NEXT_PUBLIC_SUPABASE_URL=https://succdcwblbzikenhhlrz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[copy from .env.local]
SUPABASE_SERVICE_ROLE_KEY=[copy from .env.local]

# ManyChat (you already have this)
MANYCHAT_API_KEY=1284829:1de3c287c5bb0a2488a65875eb62f103

# Stripe (GET THESE NOW - see below)
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here

# GHL (optional, only if using Make.com)
GHL_API_KEY=your_ghl_key_here
```

### How to Get Stripe Keys:

**Secret Key:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Click **Developers** → **API Keys**
3. Find "Secret key"
4. Click **Reveal test key** (or live key)
5. Copy it → Add to Vercel

**Webhook Secret (get after Step 4):**
- We'll get this when we create the webhook in Stripe

### After Adding All Variables:

4. Click **Redeploy** (top right in Vercel)
5. Wait 1-2 minutes for deployment

---

## ✅ Step 3: Test Endpoints are Live (1 minute)

Open these URLs in your browser (replace with YOUR Vercel URL):

```
https://mcb-dun.vercel.app/api/manychat
https://mcb-dun.vercel.app/api/ghl-webhook
https://mcb-dun.vercel.app/api/stripe-webhook
https://mcb-dun.vercel.app/api/denefits-webhook
```

**You should see:** `{"status": "ok", "message": "...webhook endpoint is live"}`

If you see this, **WEBHOOKS ARE READY!** ✅

---

## ✅ Step 4: Set Up Stripe Webhook (5 minutes) ⭐ DO THIS FIRST

### 4a. Create Webhook in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks)
2. Click **Add endpoint**
3. **Endpoint URL:** `https://mcb-dun.vercel.app/api/stripe-webhook`
4. **Description:** MCB Payment Tracking
5. **Events to send:**
   - ✅ `checkout.session.completed`
   - ✅ `checkout.session.expired`
   - ✅ `charge.refunded`
6. Click **Add endpoint**

### 4b. Get Webhook Secret

1. Click on the webhook you just created
2. Find **Signing secret**
3. Click **Reveal**
4. Copy the secret (starts with `whsec_`)

### 4c. Add to Vercel

1. Go back to Vercel → Settings → Environment Variables
2. Add new variable:
   - Name: `STRIPE_WEBHOOK_SECRET`
   - Value: `whsec_your_secret_here`
3. Click **Redeploy**

### 4d. Test It

1. In Stripe webhook page, click **Send test webhook**
2. Choose `checkout.session.completed`
3. Click **Send test webhook**
4. Check your Supabase database:

```sql
SELECT * FROM webhook_logs WHERE source = 'stripe' ORDER BY created_at DESC LIMIT 1;
SELECT * FROM stripe_events ORDER BY created_at DESC LIMIT 1;
```

**If you see data, Stripe is working!** ✅

---

## ✅ Step 5: Set Up GHL Webhook (10 minutes)

Open `SETUP_GHL.md` and follow the instructions.

**Quick version:**

1. Go to GHL → **Automation** → **Workflows**
2. Click **Create Workflow**
3. Name it: "New Booking to Database"
4. **Trigger:** Opportunity Created
5. **Action:** Custom Webhook
   - URL: `https://mcb-dun.vercel.app/api/ghl-webhook`
   - Method: POST
   - Body: (copy from SETUP_GHL.md)
6. **Save & Activate**

**Test:** Create test appointment → Check database

```sql
SELECT * FROM contacts WHERE GHL_ID IS NOT NULL ORDER BY created_at DESC LIMIT 1;
```

**If you see data, GHL is working!** ✅

---

## ✅ Step 6: Set Up ManyChat Webhooks (15 minutes)

Open `SETUP_MANYCHAT.md` and follow the instructions.

**Quick version:**

1. Edit your ManyChat bot flow
2. Add **External Request** blocks at 4 points:
   - After first message (contact_created)
   - After both questions answered (dm_qualified)
   - After sending booking link (link_sent)
   - After link clicked (link_clicked)
3. Each webhook:
   - URL: `https://mcb-dun.vercel.app/api/manychat`
   - Method: POST
   - Body: (copy from SETUP_MANYCHAT.md)
4. **Publish bot**

**Test:** Message your bot → Check database

```sql
SELECT * FROM contacts WHERE MC_ID IS NOT NULL ORDER BY created_at DESC LIMIT 1;
```

**If you see data, ManyChat is working!** ✅

---

## ✅ Step 7: Update Denefits Make.com (5 minutes)

1. Go to [Make.com](https://www.make.com)
2. Find your Denefits scenario
3. Click the HTTP module
4. Change URL to: `https://mcb-dun.vercel.app/api/denefits-webhook`
5. **Activate scenario**

**Test:** Create test Denefits transaction → Check database

```sql
SELECT * FROM webhook_logs WHERE source = 'denefits' ORDER BY created_at DESC LIMIT 1;
```

**If you see data, Denefits is working!** ✅

---

## ✅ Step 8: Test Full Funnel Flow (10 minutes)

Create a test user that goes through the entire journey:

### Test Journey:

1. **Message your ManyChat bot** (as test account)
   - Check: `contacts` table has new row with `MC_ID`

2. **Answer both qualification questions**
   - Check: `DM_qualified_date` is set

3. **Get booking link, click it**
   - Check: `link_send_date` and `link_click_date` set

4. **Book appointment in GHL** (using same email)
   - Check: `GHL_ID` added to same contact

5. **Make test payment in Stripe** (using same email)
   - Check: `purchase_date` and `purchase_amount` set

### Verification Query:

```sql
SELECT
  MC_ID,
  GHL_ID,
  email_primary,
  subscribe_date,
  DM_qualified_date,
  meeting_book_date,
  purchase_date,
  purchase_amount,
  stage
FROM contacts
ORDER BY created_at DESC
LIMIT 1;
```

**You should see ONE contact with data from all 3 platforms!** 🎉

---

## ✅ Step 9: Monitor for Errors (Ongoing)

### Check webhook logs daily:

```sql
-- See recent webhooks
SELECT source, event_type, status, created_at
FROM webhook_logs
ORDER BY created_at DESC
LIMIT 20;

-- Find errors
SELECT source, event_type, error_message, created_at
FROM webhook_logs
WHERE status = 'error'
ORDER BY created_at DESC;
```

### Check unmatched Stripe payments:

```sql
SELECT customer_email, amount, created_at
FROM stripe_events
WHERE contact_id IS NULL
ORDER BY created_at DESC;
```

---

## 🎯 Success Criteria

You're done when:

- [ ] All 4 webhook endpoints return `{"status": "ok"}`
- [ ] Stripe test webhook shows up in database
- [ ] GHL test booking creates/updates contact
- [ ] ManyChat test flow creates contact
- [ ] Denefits Make.com sends to new endpoint
- [ ] Full test journey creates ONE contact with all data
- [ ] No errors in `webhook_logs`

---

## 🆘 Troubleshooting

**Webhook not receiving data:**
1. Check endpoint URL is correct (no typos)
2. Verify environment variables are set in Vercel
3. Check platform's webhook delivery logs
4. Look at `webhook_logs.error_message`

**Contact not found:**
1. Verify email exists in payload
2. Check email matches database (case doesn't matter)
3. Ensure contact was created by earlier webhook

**Deployment failed:**
1. Check Vercel deployment logs
2. Look for build errors
3. Verify all dependencies installed (`package.json`)

---

## 📋 Your Webhook URLs

**Write these down for easy reference:**

```
ManyChat:  https://mcb-dun.vercel.app/api/manychat
GHL:       https://mcb-dun.vercel.app/api/ghl-webhook
Stripe:    https://mcb-dun.vercel.app/api/stripe-webhook
Denefits:  https://mcb-dun.vercel.app/api/denefits-webhook
```

---

## 🎉 You're Live!

Once all checkboxes are ✅, your attribution tracking system is LIVE!

**What happens now:**
- Every ManyChat conversation tracked
- Every GHL booking tracked
- Every Stripe payment tracked
- Every Denefits financing tracked
- Full funnel attribution in Supabase

**Next steps:**
1. Let it run for 7-14 days
2. Collect real data
3. Build automated reports (Phase 2)

---

**Ready to start? Begin with Step 1!** 🚀
