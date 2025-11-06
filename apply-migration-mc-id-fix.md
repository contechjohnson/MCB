# Apply Migration: Fix Duplicate mc_id Error

## Problem
When contacts progress through the ManyChat funnel quickly (e.g., completing form and booking meeting in rapid succession), multiple webhooks fire at nearly the same time. Both try to create a contact with the same `mc_id`, causing one to fail with:

```
duplicate key value violates unique constraint "contacts_mc_id_key"
```

## Solution
Updated the `create_contact_with_mc_id` function to use `INSERT ... ON CONFLICT`, which:
1. Tries to insert the new contact
2. If `mc_id` already exists, updates the existing contact instead
3. Returns the contact ID either way (no error!)

## How to Apply This Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the contents of `migrations/fix_duplicate_mc_id_upsert.sql`
5. Click **Run**
6. You should see: "Migration complete: create_contact_with_mc_id now handles duplicates gracefully"

### Option 2: Command Line (if you have psql installed)

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR_PASSWORD]@[YOUR_PROJECT_REF].supabase.co:5432/postgres" \
  -f migrations/fix_duplicate_mc_id_upsert.sql
```

## What Changed

**Before:**
```sql
INSERT INTO contacts (MC_ID, subscribe_date, stage, created_at, updated_at)
VALUES (mc_id, sub_date, contact_stage, NOW(), NOW())
RETURNING id INTO new_id;
-- ❌ Fails if mc_id already exists
```

**After:**
```sql
INSERT INTO contacts (MC_ID, subscribe_date, stage, created_at, updated_at)
VALUES (mc_id, sub_date, contact_stage, NOW(), NOW())
ON CONFLICT (MC_ID)
DO UPDATE SET
  subscribe_date = CASE WHEN contacts.subscribe_date IS NULL OR contacts.subscribe_date > EXCLUDED.subscribe_date
                        THEN EXCLUDED.subscribe_date ELSE contacts.subscribe_date END,
  stage = CASE WHEN contacts.stage IS NULL THEN EXCLUDED.stage ELSE contacts.stage END,
  updated_at = NOW()
RETURNING id INTO result_id;
-- ✅ Returns existing contact ID if duplicate, no error
```

## Testing

After applying, test with your ManyChat funnel:
1. Have a contact go through the full funnel quickly
2. Check webhook_logs: `SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 10;`
3. All should have `status = 'processed'` (no more duplicate key errors!)

## Rollback (if needed)

If you need to revert to the old version:
```bash
psql "your_connection_string" -f migrations/create_contact_insert_function.sql
```

---

**Created:** Nov 6, 2025
**Status:** Ready to apply
**Impact:** Fixes race condition for ManyChat webhooks
