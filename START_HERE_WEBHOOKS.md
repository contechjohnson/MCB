# 🚀 Quick Start: Setting Up Your Webhooks

**Read this first, then follow the individual guides.**

---

## What You're Setting Up

Your system tracks people through this journey:

```
ManyChat → GoHighLevel → Stripe
   ↓            ↓           ↓
Subscribe    Book Call    Pay
  ↓            ↓           ↓
   YOUR DATABASE (Supabase)
```

**3 webhooks = 3 platforms sending data to your database.**

---

## The Easiest Path (Recommended Order)

### 1. Stripe (15 minutes) ⭐ START HERE
**Why first:** Easiest to set up, instant testing, no dependencies

**Guide:** [`SETUP_STRIPE.md`](./SETUP_STRIPE.md)

**Quick steps:**
1. Get Stripe API keys
2. Create webhook in Stripe dashboard (3 clicks)
3. Copy webhook URL, done

**Test:** Send test payment → Check database

---

### 2. GoHighLevel (20 minutes)
**Why second:** Also pretty easy, uses GHL's built-in workflows

**Guide:** [`SETUP_GHL.md`](./SETUP_GHL.md)

**Quick steps:**
1. Create workflow in GHL
2. Add "Custom Webhook" action
3. Copy-paste JSON payload

**Test:** Book test appointment → Check database

**Alternative:** Use Make.com if GHL webhooks are giving you trouble

---

### 3. ManyChat (30 minutes)
**Why last:** Requires editing bot flows, more setup

**Guide:** [`SETUP_MANYCHAT.md`](./SETUP_MANYCHAT.md)

**Quick steps:**
1. Add 4 "External Request" blocks to your bot
2. Copy-paste JSON payloads
3. Publish bot

**Test:** Message bot → Check database

**Alternative:** Use Make.com to watch ManyChat events (easier but costs operations)

---

## Before You Start

### 1. Deploy to Vercel (5 minutes)

```bash
# In your terminal
git add .
git commit -m "Add webhook endpoints"
git push origin main
```

Vercel auto-deploys. Get your URL: `https://your-app-name.vercel.app`

### 2. Add Environment Variables to Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add these:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MANYCHAT_API_KEY`
- `STRIPE_SECRET_KEY` (get from Stripe)
- `STRIPE_WEBHOOK_SECRET` (get after creating webhook)
- `GHL_API_KEY` (optional, only if using Make.com)

Then **redeploy**.

### 3. Your Webhook URLs

**ManyChat:**
```
https://mcb-dun.vercel.app/api/manychat
```

**GoHighLevel:**
```
https://mcb-dun.vercel.app/api/ghl-webhook
```

**Stripe:**
```
https://mcb-dun.vercel.app/api/stripe-webhook
```

---

## Testing Each Platform

### After Stripe Setup
```sql
-- Check for payments
SELECT * FROM stripe_events ORDER BY created_at DESC LIMIT 5;

-- Check contact was updated
SELECT email_payment, purchase_date, purchase_amount
FROM contacts
WHERE purchase_date IS NOT NULL;
```

### After GHL Setup
```sql
-- Check for bookings
SELECT GHL_ID, email_booking, meeting_book_date, stage
FROM contacts
WHERE GHL_ID IS NOT NULL
ORDER BY created_at DESC;
```

### After ManyChat Setup
```sql
-- Check for ManyChat contacts
SELECT MC_ID, email_primary, subscribe_date, DM_qualified_date, stage
FROM contacts
WHERE MC_ID IS NOT NULL
ORDER BY created_at DESC;
```

### Check Everything is Working
```sql
-- Full funnel view
SELECT
  MC_ID,
  GHL_ID,
  email_primary,
  subscribe_date,
  DM_qualified_date,
  meeting_book_date,
  purchase_date,
  stage
FROM contacts
ORDER BY created_at DESC
LIMIT 10;
```

---

## Make.com Alternative (Easier but Costs $)

**If platforms give you trouble with direct webhooks, use Make.com:**

### Pros:
- Visual interface (no code editing)
- Easy to debug (see each step)
- Can add logic (filters, conditions)
- Centralized monitoring

### Cons:
- Costs operations (free tier = 1,000/month)
- Adds dependency (if Make goes down, webhooks stop)
- Slight delay (seconds vs instant)

### When to Use Make.com:
- ✅ GHL custom webhooks not working
- ✅ ManyChat flows too complex to edit
- ✅ You want to see webhook activity in dashboard
- ✅ You need to transform data before sending

### How to Use:
Each setup guide includes Make.com instructions as "Alternative" option.

Basic flow:
1. Trigger: Watch [Platform] events
2. Action: HTTP request to your webhook URL
3. Body: Copy-paste from guide

---

## Troubleshooting Master List

### "Webhook not firing"
1. Check endpoint is enabled/active in platform
2. Verify URL is correct (no typos)
3. Check platform's webhook delivery logs
4. Look at `webhook_logs` table in Supabase

### "Contact not found/created"
1. Email is required for matching (check it exists)
2. Verify `find_contact_smart` function exists in Supabase
3. Check `webhook_logs.error_message`

### "Data not updating"
1. Environment variables set correctly?
2. Server restarted after changing `.env.local`?
3. Check `webhook_logs.status = 'error'`

### "Duplicate contacts"
1. Shouldn't happen! UNIQUE constraints prevent this
2. If it does: Check MC_ID and GHL_ID are being sent
3. Verify smart matching functions are working

---

## Success Checklist

After setting up all three:

- [ ] Stripe test payment → Contact updated with purchase info
- [ ] GHL test booking → Contact created or linked with GHL_ID
- [ ] ManyChat test flow → Contact created early, then linked to GHL
- [ ] Full journey test: ManyChat → GHL → Stripe → All data in one contact
- [ ] No errors in `webhook_logs` table
- [ ] Environment variables set in Vercel
- [ ] Webhooks configured in all 3 platforms

---

## What's Next?

Once webhooks are working:

1. **Let it run for 7 days** - Collect real data
2. **Check for issues** - Monitor `webhook_logs` daily
3. **Analyze the funnel** - See where people drop off
4. **Build reporting** - Automated emails with insights (Phase 2)

---

## Need Help?

**Priority order for debugging:**

1. Check platform's webhook delivery logs (Stripe/GHL/Make.com)
2. Check `webhook_logs` table in Supabase
3. Look for `status = 'error'` and read `error_message`
4. Check Vercel deployment logs
5. Verify environment variables match

**Common fixes:**
- 90% of issues = wrong URL or missing environment variable
- 9% = platform webhook not enabled/active
- 1% = actual code issue (check `webhook_logs.error_message`)

---

## Files You Need

- [`SETUP_STRIPE.md`](./SETUP_STRIPE.md) - Stripe webhook setup
- [`SETUP_GHL.md`](./SETUP_GHL.md) - GoHighLevel webhook setup
- [`SETUP_MANYCHAT.md`](./SETUP_MANYCHAT.md) - ManyChat webhook setup
- [`WEBHOOK_GUIDE.md`](./WEBHOOK_GUIDE.md) - Technical reference

**Start with SETUP_STRIPE.md and work your way through!**
