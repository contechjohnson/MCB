# Cleanup Action Checklist

**Based on:** Project Audit Report - November 8, 2025
**Priority:** Immediate (This Week - 4 hours)
**Goal:** Reduce clutter, improve navigation

---

## Phase 1: Documentation Reorganization (2 hours)

### Step 1: Create Archive Structure (5 min)

```bash
cd /Users/connorjohnson/CLAUDE_CODE/MCB
mkdir -p docs/archive/issues
mkdir -p docs/archive/migrations
mkdir -p docs/archive/setups
mkdir -p docs/archive/summaries
```

### Step 2: Move Issue/Fix Documentation (30 min)

**To docs/archive/issues/:**
```bash
mv CSV_FIX_SUMMARY.md docs/archive/issues/
mv DYNAMIC_UPDATE_SUMMARY.md docs/archive/issues/
mv MERGE_RESULTS_SUMMARY.md docs/archive/issues/
mv URGENT_FIX_SUMMARY.md docs/archive/issues/
mv SOPHIE_PAYMENT_RECOVERY.md docs/archive/issues/
mv SUPABASE_COMPARISON_SUMMARY.md docs/archive/issues/
mv FIELD_MAPPING_ISSUE_REPORT.md docs/archive/issues/
mv MANYCHAT_FIELD_MAPPING_AUDIT.md docs/archive/issues/
```

### Step 3: Move Migration Documentation (30 min)

**To docs/archive/migrations/:**
```bash
mv MIGRATION_PLAN.md docs/archive/migrations/
mv MIGRATION_INSTRUCTIONS.md docs/archive/migrations/
mv MIGRATION_QUICK_START.md docs/archive/migrations/
mv MIGRATION_FILE_REVIEW.md docs/archive/migrations/
mv APPLY_DYNAMIC_UPDATE_CHECKLIST.md docs/archive/migrations/
mv APPLY_FRESH_SCHEMA.md docs/archive/migrations/
mv apply-migration-mc-id-fix.md docs/archive/migrations/
mv SCHEMA_FIX_SUMMARY.md docs/archive/migrations/
```

### Step 4: Move Setup Completion Documentation (30 min)

**To docs/archive/setups/:**
```bash
mv SETUP_COMPLETE.md docs/archive/setups/
mv FINAL_SETUP_SUMMARY.md docs/archive/setups/
mv ANALYTICS_SETUP_COMPLETE.md docs/archive/setups/
mv META_ADS_SETUP_COMPLETE.md docs/archive/setups/
mv META_ADS_SYNC_SUCCESS.md docs/archive/setups/
mv PHASE1_CLEANUP_COMPLETE.md docs/archive/setups/
```

### Step 5: Consolidate AI Reporting Docs (30 min)

**Keep:** AI_REPORTING_SYSTEM_OVERVIEW.md (comprehensive)

**Archive duplicate quick starts:**
```bash
mv AI_WEEKLY_REPORTS_SETUP.md docs/archive/setups/
mv QUICK_START_AI_REPORTS.md docs/archive/setups/
```

**Update CLAUDE.md references:**
- Find references to archived AI reporting docs
- Update to point to AI_REPORTING_SYSTEM_OVERVIEW.md

**Expected Outcome:** Root directory reduced from 72 to ~45 markdown files

---

## Phase 2: Script Cleanup (1 hour)

### Step 1: Create Script Archive Structure (5 min)

```bash
mkdir -p scripts/archive/sophie-case
mkdir -p scripts/archive/schema-checks
mkdir -p scripts/archive/csv-tests
mkdir -p scripts/archive/utilities
```

### Step 2: Archive Sophie Payment Debugging Scripts (15 min)

**Issue: Resolved per SOPHIE_PAYMENT_RECOVERY.md**

```bash
cd scripts/
mv investigate-sophie-payment.js archive/sophie-case/
mv retrieve-sophie-payment.js archive/sophie-case/
mv show-sophie-payment.js archive/sophie-case/
mv insert-sophie-payment.js archive/sophie-case/
mv verify-sophie-payment.js archive/sophie-case/
mv fix-sophie-payment.js archive/sophie-case/
```

### Step 3: Archive Duplicate Schema Check Scripts (15 min)

**Keep:** check-schema.js (main production script)

```bash
mv check-actual-schema.js archive/schema-checks/
mv check-schema-raw-sql.js archive/schema-checks/
mv get-exact-schema.js archive/schema-checks/
mv verify-schema.js archive/schema-checks/
```

### Step 4: Archive CSV Testing Scripts (15 min)

**Issue: Historical data import complete**

```bash
mv test-csv-parsing.js archive/csv-tests/
mv check-airtable-csv-parsing.js archive/csv-tests/
mv compare-csv-rows.js archive/csv-tests/
```

### Step 5: Update scripts/README.md (10 min)

- Add "Archive" section documenting moved scripts
- Update script counts (62 → 46 active)
- Note: Archived scripts remain accessible for reference

**Expected Outcome:** Scripts reduced from 62 to 46 active (26% reduction)

---

## Phase 3: Root Directory Cleanup (1 hour)

### Step 1: Move Root JavaScript Files (20 min)

**Create utilities folder:**
```bash
mkdir -p scripts/utilities
```

**Move schema/migration utilities:**
```bash
mv apply-fresh-schema.js scripts/utilities/
mv apply-migration.js scripts/utilities/
mv run-migration.js scripts/utilities/
mv test-dynamic-update.js scripts/utilities/
mv test-supabase.js scripts/utilities/
```

**Move to archive (duplicates of scripts/ versions):**
```bash
mv check-actual-schema.js scripts/archive/schema-checks/
mv check-schema-raw-sql.js scripts/archive/schema-checks/
mv check-schema.js scripts/utilities/  # Keep one production version
mv get-exact-schema.js scripts/archive/schema-checks/
mv verify-schema.js scripts/archive/schema-checks/
```

### Step 2: Move Root SQL Files (20 min)

**Create migrations archive:**
```bash
mkdir -p migrations/archive
```

**Move schema versions to archive:**
```bash
mv schema_v2.sql migrations/archive/
mv schema_v2.1.sql migrations/archive/
mv schema_v2.2_payments_table.sql migrations/archive/
```

**Move one-off migration files:**
```bash
mv migration_update_contact_dynamic.sql migrations/archive/
mv fix-find-smart-function.sql migrations/archive/
```

**Note:** Keep schema_v2.1.sql as current reference in main migrations/ folder

### Step 3: Update Documentation References (20 min)

**Files to check for broken links:**
- CLAUDE.md
- CURRENT_STATUS.md
- DATABASE_SCHEMA.md
- scripts/README.md

**Common patterns to update:**
- `scripts/[filename]` → `scripts/utilities/[filename]`
- `[ARCHIVED_DOC].md` → `docs/archive/[category]/[ARCHIVED_DOC].md`

**Test that key documentation still works:**
```bash
# Quick test: Open CLAUDE.md and verify all @-referenced files exist
grep "@" CLAUDE.md
```

**Expected Outcome:** Root directory cleaner, all utilities in organized folders

---

## Phase 4: Data Directory Cleanup (Optional - Do Later)

### Prerequisites Before Data Cleanup

**STOP: DO NOT DELETE DATA WITHOUT BACKUPS**

**Before proceeding:**
1. Confirm historical data is fully imported (537 contacts in database)
2. Create backup of historical_data folder
3. Upload backup to cloud storage (S3, Backblaze, Google Drive)
4. Verify backup integrity
5. Only then proceed with deletion

### Step 1: Backup Historical Data

```bash
cd /Users/connorjohnson/CLAUDE_CODE/MCB
tar -czf historical_data_backup_2025-11-08.tar.gz historical_data/
# Upload to cloud storage
# Verify download works
```

### Step 2: Clean Historical Data Folder (After Backup)

```bash
cd historical_data/
# Keep only README.md
find . -type f ! -name "README.md" -delete
```

### Step 3: Clean Import Folder

```bash
cd ../import/
# Delete files older than 30 days (if import complete)
find . -type f -mtime +30 -delete
```

**Expected Outcome:** 39MB historical_data → <1MB (README only)

---

## Verification Checklist

After completing cleanup:

### File Count Verification

```bash
# Root-level markdown files (should be ~45, down from 72)
ls -1 *.md | wc -l

# Root-level JavaScript files (should be 0-2, down from 10)
ls -1 *.js | wc -l

# Root-level SQL files (should be 0-1, down from 5)
ls -1 *.sql | wc -l

# Active scripts (should be ~46, down from 62)
ls -1 scripts/*.js | wc -l
```

### Documentation Link Test

```bash
# Test that CLAUDE.md references work
# Open in VS Code or browser, click through @-references
```

### Git Status

```bash
# Check what changed
git status

# Review moved files
git diff --name-status
```

---

## Commit Strategy

**Do NOT commit all changes at once. Break into logical commits:**

### Commit 1: Documentation Archive
```bash
git add docs/archive/
git add -u # Stages deletions
git commit -m "Archive completed documentation to docs/archive/

Moved to archive:
- 8 issue/fix reports (CSV_FIX, SOPHIE_PAYMENT, etc.)
- 8 migration documents (MIGRATION_PLAN, APPLY_*, etc.)
- 6 setup completion summaries (SETUP_COMPLETE, etc.)

Total: 22 files moved to docs/archive/{issues,migrations,setups}

These docs represent completed work and are kept for historical reference."
```

### Commit 2: Script Archive
```bash
git add scripts/archive/
git add scripts/README.md
git add -u
git commit -m "Archive resolved debugging scripts to scripts/archive/

Moved to archive:
- 6 Sophie payment debugging scripts (issue resolved)
- 4 duplicate schema check scripts (consolidated to check-schema.js)
- 3 CSV parsing test scripts (imports complete)

Active scripts: 62 → 46 (26% reduction)

Archived scripts remain accessible for reference."
```

### Commit 3: Root Directory Cleanup
```bash
git add scripts/utilities/
git add migrations/archive/
git add -u
git commit -m "Reorganize root utilities and SQL files

Moved JavaScript utilities to scripts/utilities/:
- apply-fresh-schema.js, apply-migration.js, run-migration.js
- test-dynamic-update.js, test-supabase.js

Moved SQL schema files to migrations/archive/:
- schema_v2.sql, schema_v2.1.sql, schema_v2.2_payments_table.sql
- migration_update_contact_dynamic.sql, fix-find-smart-function.sql

Result: Root directory reduced from 125 to ~80 files (36% reduction)"
```

### Commit 4: Documentation Updates
```bash
git add CLAUDE.md CURRENT_STATUS.md scripts/README.md
git commit -m "Update documentation references after cleanup

Updated links in:
- CLAUDE.md (archived doc references)
- CURRENT_STATUS.md (if applicable)
- scripts/README.md (script locations)

All @-references verified working."
```

---

## Rollback Plan

**If something breaks:**

### Option 1: Revert Specific Commit
```bash
git log --oneline  # Find commit hash
git revert [commit-hash]
```

### Option 2: Restore Specific File
```bash
git checkout HEAD~1 -- path/to/file.md
```

### Option 3: Full Rollback
```bash
# Before cleanup, create safety branch
git checkout -b before-cleanup
git checkout main
# ... do cleanup ...
# If issues:
git checkout before-cleanup
```

---

## Timeline

### Monday (1 hour)
- Phase 1: Steps 1-2 (Create structure, move issue docs)

### Tuesday (1 hour)
- Phase 1: Steps 3-5 (Move migration and setup docs)
- Commit 1

### Wednesday (1 hour)
- Phase 2: All steps (Archive scripts)
- Commit 2

### Thursday (1 hour)
- Phase 3: All steps (Root cleanup, update references)
- Commit 3-4

### Total Time: 4 hours over 4 days

---

## Expected Results

**Before Cleanup:**
- Root files: 125
- Root .md files: 72
- Active scripts: 62
- Root .js files: 10
- Root .sql files: 5

**After Cleanup:**
- Root files: ~80 (36% reduction)
- Root .md files: ~45 (38% reduction)
- Active scripts: 46 (26% reduction)
- Root .js files: 0-2 (80-100% reduction)
- Root .sql files: 0-1 (80-100% reduction)

**Benefit:**
- Clearer project structure
- Easier navigation for new AI agents
- Faster file searches
- Better organized for Client #2 onboarding

---

## Notes

- All archived files remain in git history
- Archived files are still accessible in their archive folders
- No files are permanently deleted (except optionally historical_data CSVs after backup)
- All changes are reversible via git
- Documentation links are updated to new locations

---

**Status:** Ready to execute
**Risk Level:** Low (no code changes, just organization)
**Estimated Time:** 4 hours
**Next Step:** Create safety branch, then start Phase 1
