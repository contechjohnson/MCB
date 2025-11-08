# Client #2 Onboarding Checklist

**Estimated Time:** 2-4 hours
**Prerequisites:** Client #2 has active accounts with platforms (ManyChat, GHL, Stripe)
**Goal:** Deploy fully functional analytics system for Client #2

---

## Pre-Onboarding (Info Gathering - 30 min)

### Client Information
- [ ] Client name: _______________
- [ ] Company name (full): _______________
- [ ] Domain: _______________
- [ ] Timezone: _______________
- [ ] Industry: _______________
- [ ] Business model: _______________

### Platform Access
- [ ] ManyChat account: Yes / No
- [ ] GoHighLevel account: Yes / No
- [ ] Stripe account: Yes / No
- [ ] Denefits account: Yes / No
- [ ] Meta Ads account: Yes / No

### Custom Requirements
- [ ] What are your qualification questions?
  - Q1: _______________
  - Q2: _______________
- [ ] What are your funnel stages?
  - List: _______________
- [ ] What payment methods do you accept?
  - Stripe: Yes / No
  - Denefits: Yes / No
  - Other: _______________

---

## Phase 1: Configuration (1 hour)

### Step 1: Create Client Config (20 min)

**File:** `config/clients/client2.json`

```bash
# Copy MCB template
cp config/clients/mcb.json config/clients/client2.json

# Edit client2.json - Update these fields:
# - client.id: "client2"
# - client.name: "Client2"
# - client.full_name: "Client Two Inc"
# - client.domain: "client2.com"
# - platforms.manychat.field_mappings: [adjust to Client #2 fields]
# - platforms.gohighlevel.stage_mapping: [adjust stages]
# - funnel.stages: [adjust funnel]
# - reporting.email.recipients: [Client #2 team]
```

**Checklist:**
- [ ] Updated client info (name, domain, timezone)
- [ ] Configured ManyChat field mappings
- [ ] Configured GHL stage mappings
- [ ] Defined funnel stages
- [ ] Set email recipients
- [ ] Reviewed AI assistant prompt

### Step 2: Environment Variables (15 min)

**File:** `.env.client2`

```bash
# Copy template
cp .env.template .env.client2

# Fill in Client #2 credentials
CLIENT_ID=client2
CLIENT_NAME=Client2

# Supabase (create new project for Client #2)
NEXT_PUBLIC_SUPABASE_URL=https://client2-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Stripe
STRIPE_SECRET_KEY=sk_live_...  # Client #2's Stripe key
STRIPE_WEBHOOK_SECRET=whsec_...  # Generated in next step

# ManyChat
MANYCHAT_API_KEY=...  # Client #2's ManyChat API key

# Meta Ads (if applicable)
META_ACCESS_TOKEN=...
META_AD_ACCOUNT_ID=act_...

# AI Reports
OPENAI_API_KEY=...  # Can reuse MCB's key
RESEND_API_KEY=...  # Can reuse MCB's key
REPORT_RECIPIENT_EMAIL=team@client2.com

# Cron Security
CRON_SECRET=...  # Generate new random secret
```

**Checklist:**
- [ ] Created Supabase project for Client #2
- [ ] Added Supabase credentials
- [ ] Added Stripe credentials
- [ ] Added ManyChat API key
- [ ] Added Meta Ads credentials (if applicable)
- [ ] Set report recipient email
- [ ] Generated CRON_SECRET

### Step 3: Database Setup (25 min)

**Run migrations:**

```bash
# Connect to Client #2's Supabase project
export SUPABASE_URL=https://client2-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...

# Run core migrations (universal)
psql $SUPABASE_URL -f migrations/core/001_create_contacts_table.sql
psql $SUPABASE_URL -f migrations/core/002_create_payments_table.sql
psql $SUPABASE_URL -f migrations/core/003_create_webhook_logs.sql
psql $SUPABASE_URL -f migrations/core/004_create_helper_functions.sql
psql $SUPABASE_URL -f migrations/core/005_create_analytics_views.sql

# Run client-specific migrations (if needed)
# Example: If Client #2 needs custom columns
psql $SUPABASE_URL -f migrations/clients/client2/001_add_custom_columns.sql
```

**Checklist:**
- [ ] Created Supabase project
- [ ] Ran core migrations (contacts, payments, logs)
- [ ] Ran analytics migrations (views, functions)
- [ ] Created client-specific columns (if needed)
- [ ] Verified tables exist (run test query)

---

## Phase 2: Platform Integration (1 hour)

### Step 1: Stripe Webhook Setup (15 min)

**In Stripe Dashboard:**
1. Go to: Developers → Webhooks → Add endpoint
2. URL: `https://client2.vercel.app/api/stripe-webhook`
3. Events:
   - `checkout.session.created`
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `charge.refunded`
4. Copy signing secret → `.env.client2` as `STRIPE_WEBHOOK_SECRET`

**Test:**
```bash
# Send test event from Stripe dashboard
# Check Supabase webhook_logs table for event
```

**Checklist:**
- [ ] Created webhook endpoint in Stripe
- [ ] Selected events
- [ ] Copied webhook secret to .env
- [ ] Tested with Stripe test event
- [ ] Verified log in webhook_logs table

### Step 2: GoHighLevel Webhook Setup (15 min)

**In GHL Dashboard:**
1. Go to: Settings → Integrations → Webhooks
2. Create new webhook:
   - Name: "Client2 Analytics"
   - URL: `https://client2.vercel.app/api/ghl-webhook`
   - Events: OpportunityCreate, OpportunityStageUpdate
3. Add custom fields to pass:
   - MC_ID (from ManyChat)
   - AD_ID (from Meta Ads)
   - pipeline_stage

**Checklist:**
- [ ] Created webhook in GHL
- [ ] Set URL
- [ ] Selected events
- [ ] Configured custom fields
- [ ] Tested with sample contact

### Step 3: ManyChat Webhook Setup (15 min)

**In ManyChat Dashboard:**
1. Go to: Settings → Integrations → API
2. Copy API key → `.env.client2` as `MANYCHAT_API_KEY`
3. Set up bot flows to send webhooks:
   - On subscription: Send to `https://client2.vercel.app/api/manychat`
   - On DM qualified: Send to `https://client2.vercel.app/api/manychat`
   - On link sent: Send to `https://client2.vercel.app/api/manychat`
   - On link clicked: Send to `https://client2.vercel.app/api/manychat`

**Bot Flow Example:**
```
Action: HTTP Request
Method: POST
URL: https://client2.vercel.app/api/manychat
Body: {
  "event_type": "dm_qualified",
  "subscriber": {{subscriber_data}}
}
```

**Checklist:**
- [ ] Copied ManyChat API key
- [ ] Set up webhook calls in bot flows
- [ ] Tested each webhook trigger
- [ ] Verified data in contacts table

### Step 4: Meta Ads Connection (Optional - 15 min)

**If Client #2 uses Meta Ads:**

```bash
# Get access token from Meta Business Manager
# Add to .env.client2

# Run sync script
node scripts/sync-meta-ads.js
```

**Checklist:**
- [ ] Generated Meta access token
- [ ] Added ad account ID
- [ ] Ran sync script
- [ ] Verified ads in meta_ads table

---

## Phase 3: Deployment (30 min)

### Step 1: Deploy to Vercel (15 min)

**Create new Vercel project:**
```bash
# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# Copy all vars from .env.client2
```

**In Vercel Dashboard:**
1. Settings → Environment Variables
2. Add all vars from `.env.client2`
3. Redeploy

**Checklist:**
- [ ] Created Vercel project
- [ ] Deployed code
- [ ] Added environment variables
- [ ] Verified deployment URL works

### Step 2: Configure Cron Jobs (15 min)

**File:** `vercel.json`

Update for Client #2:
```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 17 * * 5"
    },
    {
      "path": "/api/cron/sync-meta-ads",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Set up Make.com scenario:**
1. Create new scenario: "Client2 Weekly Report"
2. Schedule: Every Friday 5:17 PM UTC
3. HTTP Request: `https://client2.vercel.app/api/reports/weekly-data`
4. OpenAI: Send to Assistant (same as MCB's)
5. Email: Send via Resend to Client #2 team

**Checklist:**
- [ ] Updated vercel.json cron config
- [ ] Created Make.com scenario
- [ ] Tested weekly report generation
- [ ] Verified email delivery

---

## Phase 4: Testing (1 hour)

### Test 1: End-to-End Funnel (30 min)

**Create test contact:**
1. Subscribe to ManyChat bot
2. Answer qualification questions
3. Click booking link
4. Submit GHL form
5. Make test payment in Stripe

**Verify each step:**
- [ ] ManyChat webhook creates contact
- [ ] DM qualification updates contact
- [ ] GHL webhook links MC_ID → GHL_ID
- [ ] Stripe payment updates purchase_date
- [ ] Contact progresses through stages correctly

**Check database:**
```sql
-- Find test contact
SELECT * FROM contacts WHERE email_primary = 'test@client2.com';

-- Check webhook logs
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 20;

-- Check payments
SELECT * FROM payments ORDER BY created_at DESC LIMIT 10;
```

### Test 2: Weekly Report (15 min)

**Trigger manually:**
```bash
# Hit the cron endpoint
curl -X GET https://client2.vercel.app/api/cron/weekly-report \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Verify:**
- [ ] Report generates without errors
- [ ] Email is sent to Client #2 team
- [ ] Metrics look correct
- [ ] AI insights are relevant

### Test 3: Error Handling (15 min)

**Test edge cases:**
1. Duplicate webhook (same event sent twice)
2. Orphan payment (email not in database)
3. Missing required field
4. Invalid event type

**Verify:**
- [ ] Duplicate events are ignored
- [ ] Orphan payments logged but don't crash
- [ ] Missing fields don't crash webhooks
- [ ] Unknown events logged safely

---

## Phase 5: Documentation (30 min)

### Generate Client Docs (15 min)

**Run doc generator:**
```bash
# Generate Client #2 docs from templates
npm run generate-docs -- --client=client2
```

**Generated files:**
```
docs/client2/
  WEBHOOK_GUIDE.md
  DEPLOYMENT_CHECKLIST.md
  SYSTEM_ARCHITECTURE.md
  CURRENT_STATUS.md
  TROUBLESHOOTING.md
```

**Checklist:**
- [ ] Generated docs from templates
- [ ] Reviewed for accuracy
- [ ] Customized client-specific sections
- [ ] Sent to Client #2 team

### Training Materials (15 min)

**Create:**
- [ ] Walkthrough video (5 min)
- [ ] FAQ document
- [ ] Support contact info
- [ ] Admin access guide

---

## Phase 6: Handoff (15 min)

### Client Handoff Checklist

**Provide to Client #2:**
- [ ] Access to Supabase dashboard
- [ ] Access to Vercel dashboard
- [ ] Documentation folder
- [ ] Webhook endpoint URLs
- [ ] Support contact
- [ ] Training video

**Review with Client:**
- [ ] How to read weekly reports
- [ ] How to check webhook logs
- [ ] How to export data
- [ ] How to request changes

---

## Success Criteria

At the end of onboarding, Client #2 should have:

✅ **Functional System:**
- [ ] All webhooks receiving data
- [ ] Contacts being created/updated
- [ ] Payments being tracked
- [ ] Weekly reports being sent

✅ **Data Quality:**
- [ ] 90%+ webhook success rate
- [ ] Contact matching working (MC_ID ↔ GHL_ID)
- [ ] No orphan payments for valid emails

✅ **Reporting:**
- [ ] AI reports generating weekly
- [ ] Metrics accurate
- [ ] Insights actionable

✅ **Documentation:**
- [ ] Client has full docs
- [ ] Team is trained
- [ ] Support process established

---

## Post-Onboarding (Week 1)

### Monitor & Optimize

**Day 1-7 Tasks:**
- [ ] Monitor webhook logs daily
- [ ] Check for errors in Vercel logs
- [ ] Verify email deliverability
- [ ] Review first weekly report with client
- [ ] Collect feedback
- [ ] Make adjustments as needed

**Key Metrics to Watch:**
- Webhook success rate (target: >95%)
- Contact matching rate (target: >90%)
- Payment linkage rate (target: >90%)
- Report generation success (target: 100%)

---

## Troubleshooting

### Common Issues

**Issue 1: Webhook not receiving data**
- Check webhook URL is correct
- Verify HTTPS (not HTTP)
- Check platform webhook settings
- Review Vercel function logs

**Issue 2: Contact not matching**
- Verify email format is consistent
- Check for typos in email
- Ensure find_contact_by_email() function exists
- Review smart matching logic

**Issue 3: Payment not linking to contact**
- Verify email in Stripe matches contact email
- Check email_payment vs email_primary vs email_booking
- Look for orphan payments in payments table (contact_id = NULL)

**Issue 4: Weekly report not sending**
- Check CRON_SECRET is correct
- Verify Make.com scenario is active
- Check OPENAI_API_KEY is valid
- Review Resend API logs

---

## Estimated Timeline

| Phase | Tasks | Time |
|-------|-------|------|
| Pre-Onboarding | Info gathering | 30 min |
| Phase 1 | Configuration | 1 hour |
| Phase 2 | Platform integration | 1 hour |
| Phase 3 | Deployment | 30 min |
| Phase 4 | Testing | 1 hour |
| Phase 5 | Documentation | 30 min |
| Phase 6 | Handoff | 15 min |
| **TOTAL** | | **~4 hours** |

---

## Notes

- First client takes longer (learning curve)
- Subsequent clients will be faster (~2-3 hours)
- Template improvements based on Client #2 learnings
- Update this checklist after each onboarding

---

**Status:** ✅ Ready for Client #2
**Last Updated:** November 8, 2025
**Next Review:** After Client #2 onboarding
