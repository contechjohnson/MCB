# Multi-Tenant Migration Guide

**Project:** succdcwblbzikenhhlrz
**Date:** December 6, 2025
**Purpose:** Enable multi-tenant database architecture for tracking multiple clients

---

## 🎯 What This Migration Does

This migration transforms your single-tenant database into a multi-tenant system that can track:
- **PPCU** (Postpartum Care USA) - Your existing client (all current data)
- **Centner** (Centner Wellness) - New client
- **Columnline** (Columnline AI) - Your own business

**Changes:**
1. Creates `tenants` table with 3 initial tenants
2. Creates `tenant_integrations` table for per-tenant API credentials
3. Adds `tenant_id` column to all core tables (contacts, payments, webhook_logs, meta_ads, etc.)
4. Migrates all existing PPCU data to the PPCU tenant
5. Updates unique constraints to be tenant-scoped (e.g., mc_id must be unique per tenant)

---

## 📋 Prerequisites

- Access to Supabase Dashboard (https://supabase.com/dashboard)
- Project: succdcwblbzikenhhlrz
- Admin permissions

---

## 🚀 Migration Steps

### Step 1: Backup Current Database (CRITICAL!)

Before making any changes, create a backup:

1. Go to Supabase Dashboard
2. Navigate to your project: succdcwblbzikenhhlrz
3. Click "Database" → "Backups"
4. Click "Create Backup" (manual backup)
5. Wait for backup to complete (~2-5 minutes)

**VERIFY:** Check that backup shows "Completed" before proceeding

---

### Step 2: Run Migration SQL

1. In Supabase Dashboard, go to "SQL Editor"
2. Click "+ New query"
3. Copy the entire contents of `/migrations/multi_tenant_migration.sql`
4. Paste into the SQL Editor
5. Click "Run" (bottom right)

**Expected output:**
- Success messages for each statement
- No errors

**If you see errors:**
- Check if tables already exist (rerunning is safe - we use `IF NOT EXISTS`)
- Check constraint errors (may mean data conflicts)
- Screenshot any errors and stop

---

### Step 3: Verify Migration

Run the verification script:

```bash
cd /Users/connorjohnson/CLAUDE_CODE/MCB
node scripts/verify-multi-tenant-migration.js
```

**Expected output:**
```
✓ Test 1: Tenants table
  ✅ PASSED: Found 3 tenants
     - ppcu         | Postpartum Care USA | Eric
     - centner      | Centner Wellness | No owner
     - columnline   | Columnline AI | Connor

✓ Test 2: Tenant integrations table
  ✅ PASSED: Table exists

✓ Test 3: Tenant_id columns
     ✅ contacts
     ✅ payments
     ✅ webhook_logs
     ✅ meta_ads
     ✅ meta_ad_creatives
     ✅ meta_ad_insights
  ✅ PASSED: All tenant_id columns exist

✓ Test 4: NULL tenant_ids check
     - Contacts with NULL tenant_id: 0
     - Payments with NULL tenant_id: 0
  ✅ PASSED: No NULL tenant_ids

✓ Test 5: Tenant distribution
  Distribution by tenant:
     - ppcu (Postpartum Care USA): 1578 contacts
  ✅ PASSED

✓ Test 6: Unique constraints
  ✅ PASSED: Unique constraint working (tenant_id + mc_id)

===========================================
✅ ALL TESTS PASSED - Migration successful!
===========================================
```

**If tests fail:**
- Read error messages carefully
- Check if migration was fully applied
- May need to rollback and retry

---

## 🔄 Rollback (If Needed)

If something goes wrong, you can rollback:

### Option 1: Restore from Backup (Safest)

1. Go to Supabase Dashboard → Database → Backups
2. Find your pre-migration backup
3. Click "Restore"
4. Wait for restore to complete

### Option 2: Manual Rollback (Advanced)

```sql
-- Remove tenant_id columns
ALTER TABLE contacts DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE payments DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE webhook_logs DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE meta_ads DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE meta_ad_creatives DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE meta_ad_insights DROP COLUMN IF EXISTS tenant_id;

-- Restore original constraints
ALTER TABLE contacts ADD CONSTRAINT contacts_mc_id_key UNIQUE(mc_id);
ALTER TABLE contacts ADD CONSTRAINT contacts_ghl_id_key UNIQUE(ghl_id);
ALTER TABLE payments ADD CONSTRAINT payments_payment_event_id_key UNIQUE(payment_event_id);
ALTER TABLE meta_ads ADD CONSTRAINT meta_ads_ad_id_key UNIQUE(ad_id);

-- Drop new tables
DROP TABLE IF EXISTS tenant_integrations CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
```

---

## 📊 Post-Migration Checklist

After successful migration:

- [ ] All 6 verification tests pass
- [ ] No NULL tenant_ids on contacts or payments
- [ ] All existing contacts assigned to PPCU tenant
- [ ] Unique constraints working (tenant_id + mc_id)
- [ ] Webhooks still working (test by triggering a new contact)

---

## 🔍 What Changed

### New Tables

**tenants**
- Stores tenant configuration
- 3 initial rows: ppcu, centner, columnline

**tenant_integrations**
- Stores per-tenant API credentials
- Empty initially (credentials moved here later)

### Modified Tables

**All core tables now have:**
- `tenant_id UUID NOT NULL` (links to tenants.id)
- Tenant-scoped indexes (e.g., tenant_id + stage)

**Changed unique constraints:**
- OLD: `mc_id` must be unique globally
- NEW: `mc_id` must be unique per tenant

**Why:** Two tenants can have contacts with same mc_id (different ManyChat instances)

---

## 🚨 Known Issues & Gotchas

### Issue 1: Webhooks Need Updates
After migration, webhooks need to detect which tenant the event belongs to.

**Solution:** Update webhook routes to include tenant detection (separate task)

### Issue 2: Environment Variables
Current `.env.local` has global credentials. Need to migrate these to `tenant_integrations`.

**Solution:** Run credential migration script (separate task)

### Issue 3: Analytics Queries
Existing queries may need `WHERE tenant_id = ?` filters.

**Solution:** Update analytics agent to include tenant context (separate task)

---

## 📝 Migration Log

| Step | Status | Timestamp | Notes |
|------|--------|-----------|-------|
| Backup created | ⏳ Pending | - | - |
| Migration SQL run | ⏳ Pending | - | - |
| Verification passed | ⏳ Pending | - | - |
| Webhooks tested | ⏳ Pending | - | - |

**Update this table as you complete each step.**

---

## 🆘 Troubleshooting

### Error: "relation already exists"
**Cause:** Migration was partially run before
**Fix:** Safe to ignore - `IF NOT EXISTS` prevents duplicates

### Error: "column tenant_id does not exist"
**Cause:** Migration didn't complete
**Fix:** Rerun the migration SQL

### Error: "violates foreign key constraint"
**Cause:** Tenant ID doesn't exist in tenants table
**Fix:** Check tenants table has 3 rows, verify UUIDs match

### Error: "duplicate key value violates unique constraint"
**Cause:** Trying to insert duplicate tenant slug
**Fix:** Safe to ignore - `ON CONFLICT DO NOTHING` prevents duplicates

### Verification shows NULL tenant_ids
**Cause:** Migration 4 didn't run or failed
**Fix:** Manually run Migration 4 UPDATE statements

---

## 📚 Related Files

- **Migration SQL:** `/migrations/multi_tenant_migration.sql`
- **Verification Script:** `/scripts/verify-multi-tenant-migration.js`
- **Run Script:** `/scripts/run-multi-tenant-migration.js`

---

## ✅ Success Criteria

Migration is successful when:
1. All verification tests pass
2. 3 tenants exist (ppcu, centner, columnline)
3. All existing contacts have `tenant_id = [ppcu tenant id]`
4. No NULL tenant_ids on contacts or payments
5. Unique constraints are tenant-scoped
6. Webhooks still create new contacts (test manually)

---

**Questions? Check the verification output or contact Connor.**
