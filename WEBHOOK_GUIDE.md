# MCB Webhook Integration Guide

Complete guide for setting up and testing your attribution tracking webhooks.

---

## ✅ What's Been Built

### Schema v2.1 Database
- **UUID primary keys** - Flexible contact creation at any funnel stage
- **Multiple email fields** - Tracks primary, booking, and payment emails
- **Smart matching functions** - Finds contacts across platforms (MC_ID, GHL_ID, email, phone)
- **Comprehensive timestamps** - Every funnel stage tracked with exact time
- **Feedback tracking** - 3-month post-purchase feedback system

### Three Webhook Endpoints

1. **ManyChat Webhook** (`/api/manychat`)
   - Creates contacts early in funnel
   - Pulls full data from ManyChat API
   - Tracks DM qualification, link sends, link clicks

2. **GoHighLevel Webhook** (`/api/ghl-webhook`)
   - Links ManyChat contacts when they book
   - Creates direct-to-funnel contacts
   - Tracks bookings, meeting attendance, package sent

3. **Stripe Webhook** (`/api/stripe-webhook`)
   - Matches payments to contacts by email
   - Tracks successful payments, abandoned checkouts, refunds
   - Deduplicates events automatically

---

## 🔧 Environment Variables Required

Update your `.env.local` file with these values:

```bash
# Supabase (✅ Already configured)
NEXT_PUBLIC_SUPABASE_URL=https://succdcwblbzikenhhlrz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your_key]
SUPABASE_SERVICE_ROLE_KEY=[your_key]

# ManyChat (✅ Already configured)
MANYCHAT_API_KEY=1284829:1de3c287c5bb0a2488a65875eb62f103

# GoHighLevel (❌ NEEDS YOUR API KEY)
GHL_API_KEY=your_ghl_api_key_here

# Stripe (❌ NEEDS YOUR KEYS)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here
```

### Where to Find Missing Keys

**GHL API Key:**
1. Go to GoHighLevel → Settings → API
2. Create new API key with "Contacts" and "Opportunities" permissions
3. Copy the key

**Stripe Secret Key:**
1. Go to Stripe Dashboard → Developers → API Keys
2. Copy "Secret key" (starts with `sk_live_` or `sk_test_`)

**Stripe Webhook Secret:**
1. We'll get this after setting up the webhook endpoint (see below)

---

## 🚀 Testing Webhooks Locally

### 1. Start Dev Server

```bash
npm run dev
```

Server runs on: `http://localhost:3001`

### 2. Test Endpoints are Live

```bash
# ManyChat
curl http://localhost:3001/api/manychat

# GHL
curl http://localhost:3001/api/ghl-webhook

# Stripe
curl http://localhost:3001/api/stripe-webhook
```

All should return `{"status": "ok"}` responses.

### 3. Test with ngrok (for real webhooks)

Install ngrok: `brew install ngrok` (Mac) or download from ngrok.com

```bash
# Expose local server to internet
ngrok http 3001
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

---

## 📡 Configuring Webhooks in Each Platform

### ManyChat Webhook Setup

1. **Create Webhook in ManyChat:**
   - Go to ManyChat → Settings → Integrations → Webhooks
   - Create new webhook
   - URL: `https://your-app.vercel.app/api/manychat` (or ngrok URL for testing)
   - Method: POST

2. **Configure Events:**
   You'll need to set up automation triggers in your bot flows:

   **Event: `contact_created`**
   - Trigger: When someone first messages the bot
   - Action: Send webhook with `subscriber_id` and `event_type: 'contact_created'`

   **Event: `dm_qualified`**
   - Trigger: After they answer BOTH qualification questions (final state)
   - Action: Send webhook with `subscriber_id` and `event_type: 'dm_qualified'`

   **Event: `link_sent`**
   - Trigger: When bot sends booking link
   - Action: Send webhook with `subscriber_id` and `event_type: 'link_sent'`

   **Event: `link_clicked`**
   - Trigger: When they click the booking link
   - Action: Send webhook with `subscriber_id` and `event_type: 'link_clicked'`

3. **Test Payload:**
   ```json
   {
     "subscriber_id": "7234567890123456",
     "event_type": "dm_qualified"
   }
   ```

### GoHighLevel Webhook Setup

1. **Create Workflow in GHL:**
   - Go to Automation → Workflows
   - Create new workflow
   - Trigger: "Opportunity Created" or "Opportunity Stage Changed"

2. **Add Webhook Action:**
   - URL: `https://your-app.vercel.app/api/ghl-webhook`
   - Method: POST
   - Payload includes:
     ```json
     {
       "type": "OpportunityCreate",
       "contact_id": "ghl_contact_id",
       "email": "user@example.com",
       "phone": "+15551234567",
       "first_name": "John",
       "last_name": "Doe",
       "opportunity_stage": "meeting_booked",
       "appointment_start_time": "2025-11-15T10:00:00Z"
     }
     ```

3. **Test in GHL:**
   - Create a test contact
   - Create an opportunity for them
   - Check webhook logs in Supabase

### Stripe Webhook Setup

1. **Create Webhook in Stripe:**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Click "Add endpoint"
   - URL: `https://your-app.vercel.app/api/stripe-webhook`
   - Events to send:
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `charge.refunded`

2. **Get Webhook Secret:**
   - After creating webhook, click "Reveal" next to "Signing secret"
   - Copy the secret (starts with `whsec_`)
   - Add to `.env.local`: `STRIPE_WEBHOOK_SECRET=whsec_...`
   - Restart dev server

3. **Test with Stripe CLI:**
   ```bash
   # Install Stripe CLI
   brew install stripe/stripe-cli/stripe

   # Login
   stripe login

   # Forward webhooks to local server
   stripe listen --forward-to localhost:3001/api/stripe-webhook

   # Trigger test event
   stripe trigger checkout.session.completed
   ```

---

## 🧪 Testing the Full Flow

### Scenario 1: ManyChat → Booking → Payment (70% of traffic)

1. **User messages bot** → `/api/manychat` fires with `contact_created`
   - Creates contact with `MC_ID`, `email_primary`, `subscribe_date`
   - Stage: `new_lead`

2. **User answers questions** → `/api/manychat` fires with `dm_qualified`
   - Updates contact with `Q1_question`, `Q2_question`, `DM_qualified_date`
   - Stage: `DM_qualified`

3. **Bot sends link** → `/api/manychat` fires with `link_sent`
   - Updates `link_send_date`
   - Stage: `landing_link_sent`

4. **User clicks link** → `/api/manychat` fires with `link_clicked`
   - Updates `link_click_date`
   - Stage: `landing_link_clicked`

5. **User books meeting** → `/api/ghl-webhook` fires with `OpportunityCreate`
   - Finds existing contact by email
   - Adds `GHL_ID`, `meeting_book_date`
   - Stage: `meeting_booked`

6. **User attends meeting** → `/api/ghl-webhook` fires with `OpportunityStageUpdate`
   - Updates `meeting_held_date`
   - Stage: `meeting_held`

7. **User purchases** → `/api/stripe-webhook` fires with `checkout.session.completed`
   - Finds contact by email (checks all 3 email fields)
   - Updates `purchase_date`, `purchase_amount`, `stripe_customer_id`
   - Stage: `purchased`

### Scenario 2: Direct to Funnel → Payment (30% of traffic)

1. **User submits form** → `/api/ghl-webhook` fires with `OpportunityCreate`
   - Creates new contact with `GHL_ID`, `email_primary`, `meeting_book_date`
   - Stage: `meeting_booked`
   - (No MC_ID, that's fine!)

2. **Rest of flow same as above** (meeting held → purchase)

### Testing Queries

```sql
-- See all contacts
SELECT id, MC_ID, GHL_ID, email_primary, stage, created_at
FROM contacts
ORDER BY created_at DESC;

-- Find ManyChat contacts who haven't booked yet
SELECT MC_ID, email_primary, DM_qualified_date, link_send_date, link_click_date
FROM contacts
WHERE MC_ID IS NOT NULL
AND GHL_ID IS NULL
ORDER BY DM_qualified_date DESC;

-- Find contacts who booked but didn't purchase
SELECT GHL_ID, email_primary, meeting_book_date, purchase_date
FROM contacts
WHERE meeting_book_date IS NOT NULL
AND purchase_date IS NULL;

-- Calculate conversion rate at each stage
SELECT
  COUNT(*) FILTER (WHERE subscribe_date IS NOT NULL) as total_subscribers,
  COUNT(*) FILTER (WHERE DM_qualified_date IS NOT NULL) as dm_qualified,
  COUNT(*) FILTER (WHERE link_click_date IS NOT NULL) as link_clicked,
  COUNT(*) FILTER (WHERE meeting_book_date IS NOT NULL) as booked,
  COUNT(*) FILTER (WHERE meeting_held_date IS NOT NULL) as attended,
  COUNT(*) FILTER (WHERE purchase_date IS NOT NULL) as purchased
FROM contacts;
```

---

## 📊 Monitoring & Debugging

### Check Webhook Logs

```sql
-- See recent webhooks
SELECT source, event_type, status, created_at, error_message
FROM webhook_logs
ORDER BY created_at DESC
LIMIT 50;

-- Find failed webhooks
SELECT *
FROM webhook_logs
WHERE status = 'error'
ORDER BY created_at DESC;

-- See Stripe events
SELECT event_type, customer_email, amount, status, created_at
FROM stripe_events
ORDER BY created_at DESC;
```

### Common Issues

**1. Contact not found by email**
- Check spelling/casing (matching is case-insensitive)
- Verify email exists in `email_primary`, `email_booking`, OR `email_payment`
- Check `webhook_logs` table for the actual payload

**2. Duplicate contacts created**
- Shouldn't happen due to UNIQUE constraints on MC_ID and GHL_ID
- If it does, check that you're using the smart matching functions

**3. ManyChat API returns no data**
- Verify `MANYCHAT_API_KEY` is correct
- Check ManyChat API rate limits
- Subscriber might not exist or was deleted

**4. Stripe webhook signature verification fails**
- Ensure `STRIPE_WEBHOOK_SECRET` matches webhook in Stripe dashboard
- Restart server after updating `.env.local`
- Check webhook is sending to correct URL

---

## 🚢 Deploying to Production

### 1. Deploy to Vercel

```bash
# Commit changes
git add .
git commit -m "Add webhook endpoints for attribution tracking"
git push origin main
```

Vercel auto-deploys on push (if connected to GitHub).

### 2. Update Webhook URLs

Once deployed, update all webhook URLs to your production domain:
- ManyChat: `https://your-app.vercel.app/api/manychat`
- GHL: `https://your-app.vercel.app/api/ghl-webhook`
- Stripe: `https://your-app.vercel.app/api/stripe-webhook`

### 3. Set Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add all keys from `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MANYCHAT_API_KEY`
- `GHL_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### 4. Redeploy

Vercel will automatically redeploy with new environment variables.

---

## 📝 Next Steps

1. **Get your API keys** (GHL, Stripe)
2. **Test locally with ngrok**
3. **Configure webhooks in each platform**
4. **Monitor webhook_logs table** to verify events are flowing
5. **Deploy to Vercel**
6. **Update production webhook URLs**
7. **Run for 60 days** while building advanced analytics

---

## 🆘 Need Help?

Check logs in this order:
1. **Browser console** (F12) - Frontend errors
2. **Vercel deployment logs** - Build/deploy errors
3. **Supabase logs** - Database errors
4. **webhook_logs table** - Webhook processing errors

All webhooks return `200` status even on errors (to prevent infinite retries).
Check `webhook_logs.status = 'error'` for failures.
