# Tenant Migration Instructions

## Summary

The tenant migrations cannot be applied programmatically via the Supabase JavaScript client because it doesn't support executing DDL (CREATE TABLE, ALTER TABLE) statements.

All 5 migrations have been combined into a single file for manual execution.

## Files Created

1. **combined-tenant-migrations.sql** - All 5 migrations in one file (ready to execute)
2. **scripts/apply-migrations-simple.js** - Verification script (run after manual migration)

## Steps to Apply Migrations

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select project: **succdcwblbzikenhhlrz** (mcb_ppcu)
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Copy and Execute SQL

1. Open the file: `/Users/connorjohnson/CLAUDE_CODE/MCB/combined-tenant-migrations.sql`
2. Copy the ENTIRE contents (all ~280 lines)
3. Paste into the SQL Editor
4. Click **Run** (or press Cmd+Enter)

### Step 3: Verify Success

After running, you should see output showing:

```
-- Table created
-- Indexes created
-- 3 rows inserted into tenants
-- Columns added to contacts, payments, etc.
-- Constraints updated
```

### Step 4: Run Verification Script

From terminal:

```bash
cd /Users/connorjohnson/CLAUDE_CODE/MCB
node scripts/apply-migrations-simple.js
```

Expected output:
```
✅ tenants: 3 rows
   - ppcu: Postpartum Care USA
   - centner: Centner Wellness
   - columnline: Columnline AI
✅ tenant_integrations exists
✅ contacts.tenant_id column exists
   1578 contacts with tenant_id
```

## What These Migrations Do

### Migration 1: Create tenants table
- Creates `tenants` table with 3 initial tenants (ppcu, centner, columnline)
- Adds indexes for performance

### Migration 2: Create tenant_integrations table
- Stores per-tenant API credentials (Stripe, ManyChat, GHL, Meta, etc.)
- Links to tenants table

### Migration 3: Add tenant_id columns
- Adds `tenant_id` column to:
  - contacts
  - payments
  - webhook_logs
  - meta_ads
  - meta_ad_creatives
  - meta_ad_insights
  - stripe_webhook_logs (if exists)
  - weekly_snapshots (if exists)

### Migration 4: Migrate PPCU data
- Assigns ALL existing data to the 'ppcu' tenant
- Updates ~1578 contacts
- Updates all payments, webhook_logs, meta_ads, etc.

### Migration 5: Update constraints
- Makes `tenant_id` NOT NULL on contacts and payments
- Drops old global unique constraints (mc_id, ghl_id, ad_id)
- Adds new composite unique constraints (tenant-scoped)
  - contacts: UNIQUE(tenant_id, mc_id)
  - contacts: UNIQUE(tenant_id, ghl_id)
  - payments: UNIQUE(tenant_id, payment_event_id)
  - meta_ads: UNIQUE(tenant_id, ad_id)
- Adds composite indexes for performance

## Why This Is Necessary

**Before:** Single-tenant database
- One set of data for PPCU
- Global unique constraints on mc_id, ghl_id, etc.

**After:** Multi-tenant database
- Can have multiple clients (ppcu, centner, columnline)
- Each tenant has isolated data
- Same mc_id can exist across different tenants
- Enables scaling to multiple businesses

## Rollback (If Needed)

If something goes wrong, you can rollback by:

```sql
-- Drop new tables
DROP TABLE IF EXISTS tenant_integrations;
DROP TABLE IF EXISTS tenants CASCADE;

-- Remove tenant_id columns
ALTER TABLE contacts DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE payments DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE webhook_logs DROP COLUMN IF EXISTS tenant_id;
-- etc.

-- Restore old constraints
ALTER TABLE contacts ADD CONSTRAINT contacts_mc_id_key UNIQUE(mc_id);
ALTER TABLE contacts ADD CONSTRAINT contacts_ghl_id_key UNIQUE(ghl_id);
-- etc.
```

## Next Steps After Migration

1. Update webhook routes to:
   - Detect tenant from request (subdomain, header, etc.)
   - Set `tenant_id` when creating/updating records

2. Update analytics queries to:
   - Filter by `tenant_id`
   - Use tenant-scoped queries

3. Populate `tenant_integrations` table with:
   - Per-tenant API keys
   - Per-tenant webhook secrets

4. Update environment variables to support multi-tenant config

## Questions?

Run the verification script and report:
- How many tenants were created
- How many contacts have tenant_id
- Any error messages
