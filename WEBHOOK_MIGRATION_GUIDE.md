# Webhook URL Migration Guide

**Date:** December 9, 2025
**Status:** Ready for migration
**Estimated Time:** 15 minutes per webhook source

---

## Overview

You need to update webhook URLs in 4 external systems to point to the new multi-tenant endpoints. The old URLs still work, but the new ones are cleaner and multi-tenant ready.

**Important:** The old legacy URLs will continue working - there's no urgency, but migrating gives you cleaner URLs and prepares for future tenants.

---

## Quick Reference

| Source | Old URL | New URL |
|--------|---------|---------|
| ManyChat | `https://mcb-dun.vercel.app/api/manychat` | `https://mcb-dun.vercel.app/api/webhooks/ppcu/manychat` |
| GoHighLevel | `https://mcb-dun.vercel.app/api/ghl-webhook` | `https://mcb-dun.vercel.app/api/webhooks/ppcu/ghl` |
| Stripe | `https://mcb-dun.vercel.app/api/stripe-webhook` | `https://mcb-dun.vercel.app/api/webhooks/ppcu/stripe` |
| Denefits | `https://mcb-dun.vercel.app/api/denefits-webhook` | `https://mcb-dun.vercel.app/api/webhooks/ppcu/denefits` |
| Perspective | `https://mcb-dun.vercel.app/api/perspective-webhook` | `https://mcb-dun.vercel.app/api/webhooks/ppcu/perspective` |

---

## Migration Steps

### 1. ManyChat (15 minutes)

**Where:** ManyChat Dashboard → Settings → Integrations → Custom Webhooks

**Steps:**
1. Log into ManyChat
2. Go to Settings → Integrations
3. Find "Custom Webhooks" or wherever you configured the webhook
4. Update URL from:
   ```
   https://mcb-dun.vercel.app/api/manychat
   ```
   To:
   ```
   https://mcb-dun.vercel.app/api/webhooks/ppcu/manychat
   ```
5. Test by sending yourself a DM and checking `/recent-activity ppcu 1h`

**Rollback:** Change URL back to old one if issues occur

---

### 2. GoHighLevel (10 minutes)

**Where:** GoHighLevel → Settings → Integrations → Webhooks

**Steps:**
1. Log into GoHighLevel
2. Navigate to Settings → Integrations → Webhooks
3. Find the MCB webhook configuration
4. Update URL from:
   ```
   https://mcb-dun.vercel.app/api/ghl-webhook
   ```
   To:
   ```
   https://mcb-dun.vercel.app/api/webhooks/ppcu/ghl
   ```
5. Test by submitting a test form and checking the database

**Rollback:** Change URL back to old one if issues occur

---

### 3. Stripe (10 minutes)

**Where:** Stripe Dashboard → Developers → Webhooks

**Steps:**
1. Log into Stripe Dashboard
2. Go to Developers → Webhooks
3. Find the existing webhook endpoint
4. Either:
   - **Option A (Recommended):** Add new endpoint `https://mcb-dun.vercel.app/api/webhooks/ppcu/stripe`, test it, then remove old one
   - **Option B:** Edit existing endpoint URL to new one
5. Make sure to select the same events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `charge.refunded`
6. Copy the new webhook signing secret and update `STRIPE_WEBHOOK_SECRET` in Vercel if needed
7. Test with a test payment

**Important:** Stripe webhook secrets change when you create a new endpoint! You'll need to update the environment variable.

**Rollback:** Keep old endpoint active while testing new one

---

### 4. Denefits (via Make.com) (5 minutes)

**Where:** Make.com scenario that sends webhooks to MCB

**Steps:**
1. Log into Make.com
2. Find the scenario that sends Denefits data to MCB
3. Update the HTTP module URL from:
   ```
   https://mcb-dun.vercel.app/api/denefits-webhook
   ```
   To:
   ```
   https://mcb-dun.vercel.app/api/webhooks/ppcu/denefits
   ```
4. Test the scenario manually
5. Check `/recent-activity ppcu 1h` to verify

**Rollback:** Change URL back in Make.com scenario

---

### 5. Perspective (via Make.com) (5 minutes)

**Where:** Make.com scenario that sends Perspective checkout abandonment data

**Steps:**
1. Log into Make.com
2. Find the Perspective scenario
3. Update the HTTP module URL from:
   ```
   https://mcb-dun.vercel.app/api/perspective-webhook
   ```
   To:
   ```
   https://mcb-dun.vercel.app/api/webhooks/ppcu/perspective
   ```
4. Test the scenario
5. Verify in database

**Rollback:** Change URL back in Make.com scenario

---

## Testing Checklist

After migrating each webhook, verify it's working:

- [ ] ManyChat: Send a test DM → Check `/recent-activity ppcu 1h`
- [ ] GoHighLevel: Submit a test form → Check database for new contact
- [ ] Stripe: Process a test payment → Check `payments` table
- [ ] Denefits: Trigger test scenario → Check database
- [ ] Perspective: Trigger test scenario → Check `checkout_abandoned_date`

---

## Database Migration (Manual Step Required)

**What:** Add `report_recipients` to tenant config for email reports
**When:** Anytime (not urgent, reports still work without it)
**How:**

1. Go to Supabase Dashboard → SQL Editor
2. Run this migration:

```sql
-- Update PPCU tenant config with report recipients
UPDATE tenants
SET config = config || jsonb_build_object(
  'report_recipients', jsonb_build_array(
    'eric@ppcareusa.com',
    'connor@columnline.com',
    'yulia@theadgirls.com',
    'hannah@theadgirls.com',
    'jennifer@theadgirls.com',
    'team@theadgirls.com',
    'courtney@theadgirls.com',
    'kristen@columnline.com'
  )
)
WHERE slug = 'ppcu';

-- Update Centner (placeholder)
UPDATE tenants
SET config = config || jsonb_build_object(
  'report_recipients', jsonb_build_array(
    'connor@columnline.com'
  )
)
WHERE slug = 'centner';

-- Update Columnline (internal)
UPDATE tenants
SET config = config || jsonb_build_object(
  'report_recipients', jsonb_build_array(
    'connor@columnline.com'
  )
)
WHERE slug = 'columnline';

-- Verify
SELECT slug, name, config->'report_recipients' as recipients
FROM tenants
ORDER BY slug;
```

3. Verify you see the recipients array for each tenant
4. Weekly/monthly reports will now use these instead of the single `report_email` field

**Fallback:** If you don't run this, reports will still send to the `report_email` field (currently configured)

---

## Multi-Tenant Email Reports

**What's New:**
- Weekly and monthly reports now support multiple tenants
- Each tenant has their own recipient list in the database
- Test mode sends only to connor@columnline.com

**Test the New System:**

```bash
# Test mode (sends to connor@columnline.com only)
curl "https://mcb-dun.vercel.app/api/cron/weekly-report?test=true&tenant=ppcu"

# Production mode (sends to all configured recipients)
curl "https://mcb-dun.vercel.app/api/cron/weekly-report?tenant=ppcu"

# All tenants at once
curl "https://mcb-dun.vercel.app/api/cron/weekly-report?all=true"
```

**URL Parameters:**
- `?test=true` - Send to connor@columnline.com only (for testing)
- `?tenant=slug` - Run for specific tenant (default: ppcu)
- `?all=true` - Run for all active tenants
- `?intro=true` - Include intro banner in email

---

## Troubleshooting

### Webhook Not Firing
**Symptom:** No new entries in `webhook_logs` table
**Fix:**
1. Check Vercel function logs: `vercel logs --follow`
2. Test endpoint: `curl https://mcb-dun.vercel.app/api/webhooks/ppcu/manychat`
3. Check external system's webhook delivery logs

### Stripe Signature Verification Failed
**Symptom:** Stripe webhooks return 400 error
**Fix:**
1. Check that `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
2. Remember: secrets change when you create new endpoints!

### Email Reports Not Sending
**Symptom:** Weekly report succeeds but email doesn't arrive
**Fix:**
1. Run migration to add `report_recipients` to tenant config
2. Or set `report_email` field in `tenants` table
3. Check Resend dashboard for delivery logs

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Code deployment | Complete | ✅ Done |
| Database migration | 2 minutes | ⏳ Pending (run SQL above) |
| Webhook URL updates | 15-45 minutes | ⏳ Up to you |
| Testing | 15 minutes | ⏳ After updates |

---

## Support

If anything breaks during migration:
1. Revert the webhook URL to the old one (legacy endpoints still work)
2. Check Vercel logs: `vercel logs --follow`
3. Check `/recent-activity ppcu 24h` to see if webhooks are processing
4. All webhook payloads are logged to `webhook_logs` table for debugging

---

**Questions?** The system is backward compatible - old URLs still work, so there's no rush. Migrate at your own pace and test each webhook individually.
