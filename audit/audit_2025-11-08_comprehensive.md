# Project Audit Report - November 8, 2025

**Project:** MCB Data Collection System
**Auditor:** Claude Code
**Date:** November 8, 2025
**Focus:** File cleanup, dependency analysis, and documentation rationalization

---

## Executive Summary

**Current State:**
- 📄 **72 Markdown files** (70 in root directory, 2 in archive)
- 📜 **56 JavaScript files** in `/scripts/` directory
- 🚀 **9 Active API routes** (webhooks + cron jobs + admin)
- 📦 **3 Library files** (`/lib/email-sender.js` + email templates)

**Key Findings:**
- ✅ **Only 3 scripts** are actively used in production (6% of total)
- ❌ **53 scripts** (94%) are one-time analysis/debugging tools
- ✅ **Core files protected**: All API routes, migrations, config files intact
- ⚠️ **Documentation bloat**: ~50+ markdown files are one-time reports/summaries

**Cleanup Potential:**
- 🔥 **Safe to delete**: 45+ scripts (80% reduction)
- 🔥 **Safe to archive**: 40+ markdown files (55% reduction)
- 💾 **Disk space savings**: ~500KB (scripts) + ~1.2MB (docs) ≈ **1.7MB total**

---

## Production Dependencies Map

### 🟢 ACTIVELY USED IN PRODUCTION (Keep These!)

#### Scripts Referenced by API Routes
```
/scripts/
├── sync-meta-ads-enhanced.js     ← Used by /api/cron/sync-meta-ads
├── generate-weekly-report.js     ← Used by /api/cron/weekly-report & /api/admin/trigger-report
└── import-historical-contacts.js ← Referenced in docs, useful for re-imports
```

#### Production API Routes (All Active)
```
/app/api/
├── webhooks (5 active)
│   ├── stripe-webhook/route.ts       ← Stripe payments
│   ├── ghl-webhook/route.ts          ← GoHighLevel bookings
│   ├── manychat/route.ts             ← ManyChat conversations
│   ├── denefits-webhook/route.ts     ← BNPL financing
│   └── perspective-webhook/route.ts  ← Perspective events
├── cron (2 active)
│   ├── weekly-report/route.ts        ← Every Friday 5pm UTC
│   └── sync-meta-ads/route.ts        ← Daily 6am UTC
├── admin (1 active)
│   └── trigger-report/route.ts       ← Manual report trigger
└── reports (1 active)
    └── weekly-data/route.ts          ← Report data API
```

#### Library Files (Keep All)
```
/lib/
├── email-sender.js                ← Email sending logic
└── email-templates/
    └── weekly-report.js           ← HTML email template
```

---

## Scripts Inventory (56 Total)

### ✅ KEEP - Production Scripts (3 files, 6%)

| File | Purpose | Used By | Last Modified |
|------|---------|---------|---------------|
| `sync-meta-ads-enhanced.js` | Daily Meta Ads sync | `/api/cron/sync-meta-ads` | Nov 8 |
| `generate-weekly-report.js` | Weekly report generation | `/api/cron/weekly-report` | Nov 6 |
| `import-historical-contacts.js` | Historical data import | Documentation reference | Nov 7 |

**Rationale:** Actively imported by production API routes or critical for ongoing operations.

---

### 🔶 KEEP - Utility Scripts (8 files, 14%)

These are useful for maintenance and ad-hoc analysis:

| File | Purpose | Keep Reason | Last Used |
|------|---------|-------------|-----------|
| `sync-meta-ads.js` | Original Meta sync (non-enhanced) | Fallback version | Nov 6 |
| `apply-analytics-views.js` | Apply SQL views to database | Database maintenance | Nov 7 |
| `weekly-report-ai.js` | AI-powered report variant | Alternative reporting | Nov 6 |
| `eric-weekly-report.js` | Custom report for Eric | Stakeholder reporting | Nov 6 |
| `save-weekly-snapshot.js` | Save report snapshots | Historical tracking | Nov 6 |
| `test-weekly-api.js` | Test report API endpoint | Testing/debugging | Nov 6 |
| `prepare-migration-data.js` | Prepare CSV for migration | Data migration | Nov 7 |
| `safe-reimport-historical.js` | Safe historical re-import | Data recovery | Nov 7 |

**Rationale:** Frequently needed for operational tasks, testing, or data maintenance.

---

### 🔴 DELETE - One-Time Analysis Scripts (45 files, 80%)

These were created to debug specific issues and are no longer needed:

#### Payment Debugging (Sophie Payment Investigation - Nov 8)
```
❌ check-payments-table.js
❌ investigate-sophie-payment.js
❌ fix-sophie-payment.js
❌ retrieve-sophie-payment.js
❌ show-sophie-payment.js
❌ insert-sophie-payment.js
❌ verify-sophie-payment.js
```
**Why delete:** Sophie payment issue resolved, one-time debugging

#### Webhook Analysis (Nov 8)
```
❌ check-webhook-log-schema.js
❌ debug-webhook-logs.js
❌ test-webhook-logic-safe.js
❌ check-website-webhooks.js
❌ check-all-webhook-sources.js
❌ check-website-contacts.js
❌ investigate-empty-website-contacts.js
```
**Why delete:** Webhook debugging complete, system now stable

#### Metrics Clarification (Nov 8)
```
❌ clarify-metrics.js
❌ verify-close-rate.js
❌ analyze-weekly-breakdown.js
❌ analyze-funnel-health.js
```
**Why delete:** One-time analysis for understanding metrics, findings documented

#### Historical Data Investigation (Nov 7)
```
❌ analyze-both-datasets.js
❌ fix-both-datasets.js
❌ check-field-mapping-issues.js
❌ fix-historical-field-swapping.js
❌ check-airtable-csv-parsing.js
❌ compare-csv-rows.js
❌ analyze-filtering.js
❌ analyze-filtering-detailed.js
❌ analyze-historical-data.js
```
**Why delete:** Historical data issues fixed, import complete

#### Meta Ads Investigation (Nov 6-7)
```
❌ check-meta-ads.js
❌ check-ad-performance.js
```
**Why delete:** Meta Ads working correctly, using enhanced sync now

#### CSV Parsing Tests (Nov 7)
```
❌ test-csv-parsing.js
```
**Why delete:** CSV parsing fixed, test no longer needed

#### Legacy Schema Scripts (Nov 8)
```
❌ check-schema.js
```
**Why delete:** Schema stable, no longer needed

#### Legacy Analysis Scripts (Old)
```
❌ query-historical.js
❌ generate-historical-report.js
❌ analyze-denefits.js
❌ apply_migrations.js (note: migrations are in /migrations/ folder)
❌ analyze-supabase-data.js
❌ analyze-stripe.js
❌ compare-supabase-with-unified.js
❌ merge-supabase-into-unified.js
❌ analyze-revenue.js
❌ analyze-funnel.js
❌ analyze-cohorts.js
❌ analyze-all.js
❌ analyze-business-intelligence.js
❌ analyze-actionable-insights.js
```
**Why delete:** Old analysis scripts from initial data exploration phase

---

## Markdown Files Inventory (72 Total)

### ✅ KEEP - Core Documentation (12 files, 17%)

| File | Purpose | Status | Keep Reason |
|------|---------|--------|-------------|
| `CLAUDE.md` | AI agent instructions | 🟢 Active | Protected, primary agent guide |
| `CURRENT_STATUS.md` | Single source of truth | 🟢 Active | Protected, weekly updates |
| `README.md` | Project overview | 🟢 Active | Protected, main entry point |
| `START_HERE.md` | Quick start guide | 🟢 Active | Entry point for new users |
| `SYSTEM_ARCHITECTURE.md` | System design | 🟢 Active | Technical reference |
| `DATABASE_SCHEMA.md` | Database structure | 🟢 Active | Schema documentation |
| `WEBHOOK_GUIDE.md` | Webhook technical reference | 🟢 Active | Technical documentation |
| `HISTORICAL_DATA_MAPPING.md` | Data migration guide | 🟢 Active | Referenced in CLAUDE.md |
| `WEEKLY_REPORT_DEPLOYMENT.md` | Report system docs | 🟢 Active | Operational guide |
| `META_ADS_INTEGRATION_GUIDE.md` | Meta Ads setup | 🟢 Active | Integration docs |
| `MCP_STATUS.md` | MCP server setup | 🟢 Active | Development tools |
| `DEPLOYMENT_CHECKLIST.md` | Deployment guide | 🟢 Active | Operations |

**Rationale:** Referenced in CLAUDE.md, actively maintained, or essential documentation.

---

### 🔶 KEEP - Setup Guides (6 files, 8%)

| File | Purpose | Keep Reason |
|------|---------|-------------|
| `SETUP_STRIPE.md` | Stripe webhook setup | Active webhook |
| `SETUP_GHL.md` | GoHighLevel webhook setup | Active webhook |
| `SETUP_MANYCHAT.md` | ManyChat webhook setup | Active webhook |
| `SETUP_DENEFITS.md` | Denefits webhook setup | Active webhook |
| `START_HERE_WEBHOOKS.md` | Webhook overview | Referenced guide |
| `MAKE_COM_SETUP.md` | Make.com automation | Active integration |

**Rationale:** Active integrations that may need reconfiguration.

---

### 🔶 KEEP - Reference Guides (4 files, 6%)

| File | Purpose | Keep Reason |
|------|---------|-------------|
| `WEBHOOK_FLOW_DIAGRAM.md` | Visual flow diagrams | Technical reference |
| `SOURCE_FIELD_CONVENTIONS.md` | Data field standards | Data quality reference |
| `HISTORICAL_DATA_FILTER_RULE.md` | Historical data rules | Migration reference |
| `CLAUDE_CODE_SETUP_GUIDE.md` | Claude Code setup | Development onboarding |

**Rationale:** Technical references useful for troubleshooting.

---

### 🔴 DELETE - One-Time Reports (50+ files, 69%)

#### Completion/Summary Reports (Move to `/audit/completed/`)
```
❌ PHASE1_CLEANUP_COMPLETE.md          (Nov 7) - Cleanup report
❌ ANALYTICS_SETUP_COMPLETE.md         (Nov 6) - Analytics setup
❌ META_ADS_SETUP_COMPLETE.md          (Nov 6) - Meta Ads setup
❌ META_ADS_SYNC_SUCCESS.md            (Nov 6) - Sync success report
❌ SETUP_COMPLETE.md                   (Old) - Initial setup
❌ WEBHOOK_FLOW_COMPLETE.md            (Old) - Webhook completion
❌ FINAL_SETUP_SUMMARY.md              (Old) - Setup summary
❌ MIGRATION_PLAN.md                   (Old) - Migration plan
❌ SETUP_VERIFICATION.md               (Old) - Verification report
```

#### Issue/Fix Reports (Move to `/audit/issues/`)
```
❌ CSV_FIX_SUMMARY.md                  (Nov 7) - CSV parsing fix
❌ URGENT_FIX_SUMMARY.md               (Nov 7) - Field swapping fix
❌ FIELD_MAPPING_ISSUE_REPORT.md       (Nov 7) - Field mapping issues
❌ MANYCHAT_FIELD_MAPPING_AUDIT.md     (Nov 7) - ManyChat audit
❌ SOPHIE_PAYMENT_RECOVERY.md          (Nov 8) - Payment recovery
❌ SCHEMA_FIX_SUMMARY.md               (Old) - Schema fixes
❌ SUB_AGENT_FIXES.md                  (Old) - Agent fixes
❌ WEBHOOK_RISKS.md                    (Old) - Risk assessment
```

#### Audit Reports (Already in `/audit/` context, consolidate)
```
❌ DOCUMENTATION_AUDIT_REPORT.md       (Nov 7) - Doc audit
❌ AUDIT_README.md                     (Nov 7) - Audit overview
❌ AUDIT_ISSUE_MATRIX.md               (Nov 7) - Issue matrix
❌ AUDIT_EXECUTIVE_SUMMARY.md          (Nov 7) - Executive summary
❌ AUDIT_ACTION_ITEMS.md               (Nov 7) - Action items
```

#### Analysis Reports (Move to `/audit/analysis/`)
```
❌ SAMPLE_ANALYSIS_REPORT.md           (Nov 6) - Sample report
❌ ERIC_REPORT_LIVE_DATA.md            (Nov 6) - Eric's report
❌ AUTOMATION_ROADMAP.md               (Nov 6) - Roadmap (outdated)
❌ CURRENT_STATUS_REPORT.md            (Nov 7) - Duplicate of CURRENT_STATUS
❌ SUPABASE_COMPARISON_SUMMARY.md      (Old) - Data comparison
❌ MERGE_RESULTS_SUMMARY.md            (Old) - Merge results
❌ ANALYSIS_GUIDE.md                   (Old) - Analysis guide
❌ ANALYTICS_GUIDE.md                  (Old) - Analytics guide
❌ IMPORT_TO_SUPABASE_GUIDE.md         (Old) - Import guide (covered by HISTORICAL_DATA_MAPPING)
❌ HISTORICAL_DATA_GUIDE.md            (Old) - Duplicate guide
```

#### Quick Start Guides (Consolidate into main docs)
```
❌ QUICK_START_AI_REPORTS.md           (Nov 6) - Covered by WEEKLY_REPORT_DEPLOYMENT
❌ MIGRATION_QUICK_START.md            (Old) - Covered by HISTORICAL_DATA_MAPPING
❌ AB_TESTING_QUICK_START.md           (Nov 6) - Future feature, premature
```

#### System Overview Docs (Consolidate)
```
❌ AI_REPORTING_SYSTEM_OVERVIEW.md     (Nov 6) - Covered by WEEKLY_REPORT_DEPLOYMENT
❌ AI_WEEKLY_REPORTS_SETUP.md          (Nov 6) - Covered by WEEKLY_REPORT_DEPLOYMENT
❌ WEEKLY_INSIGHTS_FRAMEWORK.md        (Nov 6) - Design doc, findings in production code
❌ WEBHOOK_REPORT_FLOW.md              (Nov 6) - Covered by WEBHOOK_FLOW_DIAGRAM
```

#### Migration Docs (Old, migration complete)
```
❌ MIGRATION_INSTRUCTIONS.md           (Old)
❌ MIGRATION_FILE_REVIEW.md            (Old)
❌ SCHEMA_V2_README.md                 (Old) - Covered by DATABASE_SCHEMA
```

#### Dynamic Update Docs (One-time feature)
```
❌ DYNAMIC_UPDATE_FLOW.md              (Old)
❌ DYNAMIC_UPDATE_SUMMARY.md           (Old)
❌ README_DYNAMIC_UPDATE.md            (Old)
❌ APPLY_DYNAMIC_UPDATE_CHECKLIST.md   (Old)
❌ APPLY_FRESH_SCHEMA.md               (Old)
❌ apply-migration-mc-id-fix.md        (Old) - Already applied
```

#### Restart/Verification Docs (Outdated)
```
❌ RESTART_CHECKLIST.md                (Old)
❌ VERIFICATION_QUERIES.md             (Old)
```

---

## Dependency Map

### Production Code Dependencies

```
API Routes (9 files)
├── /api/cron/sync-meta-ads/route.ts
│   └── requires: scripts/sync-meta-ads-enhanced.js
│
├── /api/cron/weekly-report/route.ts
│   ├── requires: scripts/generate-weekly-report.js
│   ├── requires: lib/email-templates/weekly-report.js
│   └── requires: lib/email-sender.js
│
├── /api/admin/trigger-report/route.ts
│   ├── requires: scripts/generate-weekly-report.js
│   ├── requires: lib/email-templates/weekly-report.js
│   └── requires: lib/email-sender.js
│
└── /api/reports/weekly-data/route.ts
    └── requires: (direct Supabase queries)

Webhooks (5 files) - No script dependencies
├── stripe-webhook/route.ts
├── ghl-webhook/route.ts
├── manychat/route.ts
├── denefits-webhook/route.ts
└── perspective-webhook/route.ts
```

### Documentation Dependencies

```
CLAUDE.md (Primary entry point)
├── References: CURRENT_STATUS.md
├── References: HISTORICAL_DATA_MAPPING.md
├── References: WEBHOOK_GUIDE.md
├── References: WEEKLY_REPORT_DEPLOYMENT.md
├── References: META_ADS_INTEGRATION_GUIDE.md
└── References: MCP_STATUS.md

CURRENT_STATUS.md (Single source of truth)
└── References: CURRENT_STATUS_REPORT.md (can be deleted, outdated)

README.md (Public entry point)
└── References: START_HERE.md

START_HERE.md (Quick start)
└── References: CURRENT_STATUS.md
```

**Orphaned Documentation:** 50+ markdown files not referenced by core docs.

---

## Recommendations

### 🔥 Phase 1: Immediate Cleanup (High Impact, Low Risk)

**Action:** Delete 45 one-time analysis scripts

```bash
# Sophie Payment Investigation (7 files)
rm scripts/check-payments-table.js
rm scripts/investigate-sophie-payment.js
rm scripts/fix-sophie-payment.js
rm scripts/retrieve-sophie-payment.js
rm scripts/show-sophie-payment.js
rm scripts/insert-sophie-payment.js
rm scripts/verify-sophie-payment.js

# Webhook Debugging (7 files)
rm scripts/check-webhook-log-schema.js
rm scripts/debug-webhook-logs.js
rm scripts/test-webhook-logic-safe.js
rm scripts/check-website-webhooks.js
rm scripts/check-all-webhook-sources.js
rm scripts/check-website-contacts.js
rm scripts/investigate-empty-website-contacts.js

# Metrics Analysis (4 files)
rm scripts/clarify-metrics.js
rm scripts/verify-close-rate.js
rm scripts/analyze-weekly-breakdown.js
rm scripts/analyze-funnel-health.js

# Historical Data Investigation (9 files)
rm scripts/analyze-both-datasets.js
rm scripts/fix-both-datasets.js
rm scripts/check-field-mapping-issues.js
rm scripts/fix-historical-field-swapping.js
rm scripts/check-airtable-csv-parsing.js
rm scripts/compare-csv-rows.js
rm scripts/analyze-filtering.js
rm scripts/analyze-filtering-detailed.js
rm scripts/analyze-historical-data.js

# Meta Ads Investigation (2 files)
rm scripts/check-meta-ads.js
rm scripts/check-ad-performance.js

# Misc Tests (2 files)
rm scripts/test-csv-parsing.js
rm scripts/check-schema.js

# Legacy Analysis (14 files)
rm scripts/query-historical.js
rm scripts/generate-historical-report.js
rm scripts/analyze-denefits.js
rm scripts/apply_migrations.js
rm scripts/analyze-supabase-data.js
rm scripts/analyze-stripe.js
rm scripts/compare-supabase-with-unified.js
rm scripts/merge-supabase-into-unified.js
rm scripts/analyze-revenue.js
rm scripts/analyze-funnel.js
rm scripts/analyze-cohorts.js
rm scripts/analyze-all.js
rm scripts/analyze-business-intelligence.js
rm scripts/analyze-actionable-insights.js
```

**Impact:**
- ✅ **80% reduction** in scripts folder (56 → 11 files)
- ✅ **~500KB saved**
- ✅ Clearer project structure
- ✅ Faster file navigation

**Risk:** ⚠️ **VERY LOW** - These are all one-time debugging scripts with no production dependencies.

---

### 📦 Phase 2: Archive Completed Reports (Medium Impact, Low Risk)

**Action:** Move one-time reports to `/audit/archive/`

```bash
mkdir -p audit/archive/completed
mkdir -p audit/archive/issues
mkdir -p audit/archive/analysis

# Completion Reports
mv PHASE1_CLEANUP_COMPLETE.md audit/archive/completed/
mv ANALYTICS_SETUP_COMPLETE.md audit/archive/completed/
mv META_ADS_SETUP_COMPLETE.md audit/archive/completed/
mv META_ADS_SYNC_SUCCESS.md audit/archive/completed/
mv SETUP_COMPLETE.md audit/archive/completed/
mv WEBHOOK_FLOW_COMPLETE.md audit/archive/completed/
mv FINAL_SETUP_SUMMARY.md audit/archive/completed/
mv MIGRATION_PLAN.md audit/archive/completed/
mv SETUP_VERIFICATION.md audit/archive/completed/

# Issue/Fix Reports
mv CSV_FIX_SUMMARY.md audit/archive/issues/
mv URGENT_FIX_SUMMARY.md audit/archive/issues/
mv FIELD_MAPPING_ISSUE_REPORT.md audit/archive/issues/
mv MANYCHAT_FIELD_MAPPING_AUDIT.md audit/archive/issues/
mv SOPHIE_PAYMENT_RECOVERY.md audit/archive/issues/
mv SCHEMA_FIX_SUMMARY.md audit/archive/issues/
mv SUB_AGENT_FIXES.md audit/archive/issues/
mv WEBHOOK_RISKS.md audit/archive/issues/

# Analysis Reports
mv SAMPLE_ANALYSIS_REPORT.md audit/archive/analysis/
mv ERIC_REPORT_LIVE_DATA.md audit/archive/analysis/
mv AUTOMATION_ROADMAP.md audit/archive/analysis/
mv SUPABASE_COMPARISON_SUMMARY.md audit/archive/analysis/
mv MERGE_RESULTS_SUMMARY.md audit/archive/analysis/

# Consolidate Audit Reports
mv DOCUMENTATION_AUDIT_REPORT.md audit/archive/
mv AUDIT_README.md audit/archive/
mv AUDIT_ISSUE_MATRIX.md audit/archive/
mv AUDIT_EXECUTIVE_SUMMARY.md audit/archive/
mv AUDIT_ACTION_ITEMS.md audit/archive/
```

**Impact:**
- ✅ **~30 files** moved to archive
- ✅ **Root directory reduced** by 40%
- ✅ **~800KB saved** from root
- ✅ History preserved for reference

**Risk:** ⚠️ **LOW** - Files archived, not deleted, can be referenced if needed.

---

### 🗑️ Phase 3: Delete Redundant Guides (High Impact, Medium Risk)

**Action:** Delete duplicate/outdated documentation

```bash
# Delete guides that duplicate existing docs
rm QUICK_START_AI_REPORTS.md              # Covered by WEEKLY_REPORT_DEPLOYMENT.md
rm AI_REPORTING_SYSTEM_OVERVIEW.md        # Covered by WEEKLY_REPORT_DEPLOYMENT.md
rm AI_WEEKLY_REPORTS_SETUP.md             # Covered by WEEKLY_REPORT_DEPLOYMENT.md
rm WEEKLY_INSIGHTS_FRAMEWORK.md           # Design doc, obsolete
rm WEBHOOK_REPORT_FLOW.md                 # Covered by WEBHOOK_FLOW_DIAGRAM.md

# Delete old migration docs (migration complete)
rm MIGRATION_INSTRUCTIONS.md
rm MIGRATION_FILE_REVIEW.md
rm SCHEMA_V2_README.md                    # Covered by DATABASE_SCHEMA.md
rm HISTORICAL_DATA_GUIDE.md               # Covered by HISTORICAL_DATA_MAPPING.md
rm IMPORT_TO_SUPABASE_GUIDE.md            # Covered by HISTORICAL_DATA_MAPPING.md
rm MIGRATION_QUICK_START.md               # Covered by HISTORICAL_DATA_MAPPING.md

# Delete old update docs
rm DYNAMIC_UPDATE_FLOW.md
rm DYNAMIC_UPDATE_SUMMARY.md
rm README_DYNAMIC_UPDATE.md
rm APPLY_DYNAMIC_UPDATE_CHECKLIST.md
rm APPLY_FRESH_SCHEMA.md
rm apply-migration-mc-id-fix.md

# Delete outdated checklists
rm RESTART_CHECKLIST.md
rm VERIFICATION_QUERIES.md

# Delete duplicate status doc
rm CURRENT_STATUS_REPORT.md               # Use CURRENT_STATUS.md instead

# Delete premature AB testing guide
rm AB_TESTING_QUICK_START.md              # Feature not yet implemented

# Delete redundant analysis guides
rm ANALYSIS_GUIDE.md                      # Use CURRENT_STATUS.md
rm ANALYTICS_GUIDE.md                     # Use WEEKLY_REPORT_DEPLOYMENT.md
```

**Impact:**
- ✅ **~20 files** deleted
- ✅ **~400KB saved**
- ✅ Documentation clarity improved
- ✅ Single source of truth enforced

**Risk:** ⚠️ **MEDIUM** - Some docs may have useful details. **RECOMMENDATION:** Review each file before deletion to extract any unique information and merge into core docs.

---

### 📊 Final State After Cleanup

**Before:**
```
Root Directory:
- 72 markdown files
- 56 scripts

Total: 128 files
```

**After:**
```
Root Directory:
- 22 markdown files (core docs + setup guides)
- 11 scripts (3 production + 8 utility)

Archive:
- 30+ archived reports
- 20+ deleted redundant docs
- 45 deleted one-time scripts

Total: 33 active files (74% reduction)
```

**Benefits:**
- ✅ **Faster onboarding** - New agents read 22 docs instead of 72
- ✅ **Clearer structure** - Only active docs in root
- ✅ **Easier maintenance** - Less to update
- ✅ **Better focus** - Core documentation stands out
- ✅ **Disk space** - ~1.7MB saved
- ✅ **Git history** - Cleaner repo

---

## Action Plan

### Step 1: Backup
```bash
# Create backup branch
git checkout -b cleanup-backup-2025-11-08
git add .
git commit -m "Backup before major cleanup"
git push origin cleanup-backup-2025-11-08
```

### Step 2: Create Archive Structure
```bash
mkdir -p audit/archive/completed
mkdir -p audit/archive/issues
mkdir -p audit/archive/analysis
```

### Step 3: Execute Cleanup (Choose One)

**Option A: Conservative (Archive Everything)**
1. Run Phase 1 (delete scripts)
2. Run Phase 2 (archive reports)
3. Review Phase 3 carefully, extract unique info first

**Option B: Aggressive (Delete + Archive)**
1. Run Phase 1 (delete scripts)
2. Run Phase 2 (archive reports)
3. Run Phase 3 (delete redundant docs)

**Option C: Minimal (Scripts Only)**
1. Run Phase 1 only (delete scripts)
2. Leave documentation for manual review

### Step 4: Verify
```bash
# Check production API routes still work
npm run build
npm run dev

# Test cron jobs
curl http://localhost:3000/api/cron/weekly-report
curl http://localhost:3000/api/cron/sync-meta-ads
```

### Step 5: Commit
```bash
git add .
git commit -m "Major cleanup: Remove one-time scripts and archive completed reports"
git push origin main
```

---

## Risk Assessment

| Phase | Risk Level | Reversibility | Impact |
|-------|-----------|---------------|---------|
| Phase 1 (Delete Scripts) | 🟢 **VERY LOW** | Git history | High clarity |
| Phase 2 (Archive Reports) | 🟢 **LOW** | Files preserved | High organization |
| Phase 3 (Delete Docs) | 🟡 **MEDIUM** | Git history only | High clarity |

**Overall Risk:** 🟢 **LOW** - All changes reversible via Git, production code untouched.

---

## Notes

1. **Protected Files:** All files in `/app/api/`, `/migrations/`, and config files (`package.json`, `vercel.json`) are untouched.

2. **Production Dependencies:** Only 3 scripts are actively used in production. The other 53 scripts are safe to delete.

3. **Documentation Strategy:** Core documentation (CLAUDE.md, CURRENT_STATUS.md, README.md) already references the important guides. Removing redundant docs will improve clarity.

4. **Historical Context:** All deleted files are in Git history and can be recovered if needed. Archive files are preserved in `/audit/archive/`.

5. **Future Prevention:** Consider adding a policy: "One-time analysis scripts go in `/scripts/temp/`, get deleted after issue is resolved."

---

## Conclusion

This project has accumulated significant technical debt in the form of one-time debugging scripts and completion reports. Cleaning up will:

- ✅ Reduce onboarding time for new AI agents
- ✅ Make the codebase more maintainable
- ✅ Enforce single source of truth (CURRENT_STATUS.md)
- ✅ Improve developer experience

**Recommended Action:** Execute **Phase 1** immediately (delete scripts), then review **Phase 2** and **Phase 3** with user for final approval.

---

**End of Report**
