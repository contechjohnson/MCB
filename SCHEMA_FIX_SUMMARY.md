# Schema Fix Complete - Ready to Apply

## Problem
The contacts table was missing three columns needed by the Perspective webhook:
- `subscribed` (TIMESTAMPTZ)
- `ig_last_interaction` (TIMESTAMPTZ)
- `ig_id` (BIGINT)

We had schema cache issues from trying to add columns incrementally.

## Solution
Drop and recreate the entire contacts table fresh with ALL columns included.

## Files Created

### 1. Fresh Migration (The Schema)
**File:** `supabase/migrations/20250105000003_fresh_contacts_table_with_new_columns.sql`

This is the complete DDL that:
- Drops the old contacts table
- Creates a new one with ALL 41 columns
- Creates all indexes
- Creates all helper functions
- Creates the updated_at trigger

### 2. Application Instructions
**File:** `APPLY_FRESH_SCHEMA.md`

Step-by-step guide for you to apply the migration via Supabase SQL Editor.

### 3. Verification Script
**File:** `verify-schema.js`

Run this AFTER applying the schema to confirm everything works:
```bash
node verify-schema.js
```

## What You Need to Do

### Step 1: Apply the Schema
1. Open: https://supabase.com/dashboard/project/jllwlymufzzflhkxuhlg/editor
2. Create new query
3. Copy/paste contents of: `supabase/migrations/20250105000003_fresh_contacts_table_with_new_columns.sql`
4. Run it
5. Should see success messages

### Step 2: Verify It Worked
```bash
node verify-schema.js
```

Should output:
```
✅ ALL TESTS PASSED!
```

### Step 3: Test the Perspective Webhook
Once verified, the Perspective webhook will be able to:
- Insert contacts with `subscribed` date
- Track `ig_last_interaction`
- Store `ig_id` (Instagram user ID)

## Complete Column List (41 Total)

**Identifiers:**
- id (UUID, primary key)
- MC_ID
- GHL_ID
- AD_ID
- stripe_customer_id
- ig_id ← NEW

**Contact Info:**
- first_name
- last_name
- email_primary
- email_booking
- email_payment
- phone
- IG
- FB

**Funnel Stage:**
- stage
- chatbot_AB
- MISC_AB
- trigger_word

**Questions:**
- Q1_question
- Q2_question
- objections

**Timestamps:**
- subscribe_date
- subscribed ← NEW
- followed_date
- DM_qualified_date
- link_send_date
- link_click_date
- ig_last_interaction ← NEW
- form_submit_date
- meeting_book_date
- meeting_held_date
- checkout_started
- purchase_date
- feedback_sent_date
- feedback_received_date

**Purchase:**
- purchase_amount

**AI Context:**
- lead_summary
- thread_ID
- feedback_text

**Metadata:**
- created_at
- updated_at

## Why This Works

Fresh table = no schema cache issues. Supabase will see all columns immediately.

The migration is idempotent - you can run it multiple times safely (it drops first).

## After This

Your Perspective webhook (`/api/perspective`) will work perfectly with all the fields it needs.

All other webhooks (ManyChat, GHL, Stripe, Denefits) will continue to work unchanged.

## Questions?

If anything fails:
1. Check the error message in Supabase SQL Editor
2. Look at `APPLY_FRESH_SCHEMA.md` troubleshooting section
3. Run `node verify-schema.js` to see what's wrong

## Success Checklist

- [ ] Migration applied successfully in Supabase SQL Editor
- [ ] No errors in SQL Editor output
- [ ] `node verify-schema.js` shows all tests passing
- [ ] Ready to test Perspective webhook

---

**Next:** Once verified, update the Perspective webhook URL in your integration and send a test event!
