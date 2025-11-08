# Scripts Index

**Last Updated:** November 8, 2025
**Total Scripts:** 47

This directory contains utility scripts for production operations, analytics, debugging, and historical data management.

---

## 🟢 Production Scripts (Safe to Run Regularly)

### Reporting & Analytics
| Script | Purpose | Usage |
|--------|---------|-------|
| `weekly-report-ai.js` | Generate AI-powered weekly report | `node scripts/weekly-report-ai.js [date]` |
| `save-weekly-snapshot.js` | Save weekly metrics to database | `node scripts/save-weekly-snapshot.js` |
| `generate-weekly-report.js` | Generate structured weekly data | `node scripts/generate-weekly-report.js` |
| `test-weekly-api.js` | Test weekly data API endpoint | `node scripts/test-weekly-api.js [date]` |

### Meta Ads
| Script | Purpose | Usage |
|--------|---------|-------|
| `sync-meta-ads.js` | Sync Meta Ads API data to database | `node scripts/sync-meta-ads.js` |
| `check-meta-ads.js` | Verify Meta Ads sync status | `node scripts/check-meta-ads.js` |
| `check-ad-performance.js` | Check ad performance metrics | `node scripts/check-ad-performance.js` |

### Database Management
| Script | Purpose | Usage |
|--------|---------|-------|
| `apply_migrations.js` | Apply SQL migrations to Supabase | `node scripts/apply_migrations.js` |
| `apply-analytics-views.js` | Create/update analytics views | `node scripts/apply-analytics-views.js` |
| `check-schema.js` | Verify database schema | `node scripts/check-schema.js` |
| `check-payments-table.js` | Verify payments table structure | `node scripts/check-payments-table.js` |

---

## 🔵 Analysis Scripts (Ad-Hoc Queries)

### Funnel Analysis
| Script | Purpose | When to Use |
|--------|---------|-------------|
| `analyze-funnel.js` | Analyze conversion funnel | Check funnel metrics |
| `analyze-funnel-health.js` | Detailed funnel health report | Deep dive on funnel issues |
| `analyze-cohorts.js` | Cohort analysis by time period | Compare performance over time |
| `verify-close-rate.js` | Verify purchase conversion rates | Validate revenue calculations |

### Revenue & Payments
| Script | Purpose | When to Use |
|--------|---------|-------------|
| `analyze-revenue.js` | Revenue analysis and attribution | Monthly revenue review |
| `analyze-stripe.js` | Stripe-specific payment analysis | Stripe payment debugging |
| `analyze-denefits.js` | Denefits BNPL analysis | BNPL payment verification |

### Business Intelligence
| Script | Purpose | When to Use |
|--------|---------|-------------|
| `analyze-all.js` | Comprehensive system analysis | Full system health check |
| `analyze-business-intelligence.js` | BI metrics and KPIs | Executive reporting |
| `analyze-actionable-insights.js` | Actionable recommendations | Strategy planning |
| `analyze-weekly-breakdown.js` | Week-by-week breakdown | Trend analysis |
| `clarify-metrics.js` | Explain metric calculations | Metric validation |

### Data Source Analysis
| Script | Purpose | When to Use |
|--------|---------|-------------|
| `analyze-supabase-data.js` | Analyze Supabase contacts | Database health check |
| `analyze-historical-data.js` | Analyze historical imports | Historical data verification |
| `analyze-both-datasets.js` | Compare live vs historical | Data consistency check |
| `compare-supabase-with-unified.js` | Cross-reference datasets | Attribution verification |

---

## 🟡 Historical Data Scripts (One-Time/Periodic Use)

### Import & Migration
| Script | Purpose | When to Use |
|--------|---------|-------------|
| `import-historical-contacts.js` | Import historical Airtable data | Initial migration or re-import |
| `safe-reimport-historical.js` | Safe re-import with duplicate check | Fix historical data issues |
| `prepare-migration-data.js` | Prepare CSV for migration | Data cleaning before import |
| `merge-supabase-into-unified.js` | Merge datasets | Data consolidation |

### Historical Analysis
| Script | Purpose | When to Use |
|--------|---------|-------------|
| `generate-historical-report.js` | Report on historical data | Historical performance review |
| `query-historical.js` | Query historical dataset | Ad-hoc historical queries |
| `eric-weekly-report.js` | Custom report for Eric | Weekly stakeholder report |

### Data Quality
| Script | Purpose | When to Use |
|--------|---------|-------------|
| `fix-historical-field-swapping.js` | Fix Q1/Q2 field swaps | Data correction |
| `fix-both-datasets.js` | Fix issues in both datasets | Bulk data fixes |
| `check-field-mapping-issues.js` | Identify field mapping problems | Data audit |
| `analyze-filtering.js` | Analyze data filtering logic | Filter validation |
| `analyze-filtering-detailed.js` | Detailed filter analysis | Deep filter debugging |

---

## 🔴 Debug Scripts (Development Only)

### Webhook Debugging
| Script | Purpose | When to Use |
|--------|---------|-------------|
| `debug-webhook-logs.js` | Debug webhook events | Webhook troubleshooting |
| `check-webhook-log-schema.js` | Verify webhook log structure | Schema validation |

### Payment Debugging (Sophie Case)
| Script | Purpose | When to Use |
|--------|---------|-------------|
| `investigate-sophie-payment.js` | Investigate specific payment | Payment attribution issue |
| `retrieve-sophie-payment.js` | Retrieve payment details | Payment lookup |
| `show-sophie-payment.js` | Display payment info | Payment verification |
| `insert-sophie-payment.js` | Insert missing payment | Fix orphan payment |
| `verify-sophie-payment.js` | Verify payment linkage | Confirm fix worked |
| `fix-sophie-payment.js` | Fix payment attribution | Payment correction |

### CSV & Data Validation
| Script | Purpose | When to Use |
|--------|---------|-------------|
| `test-csv-parsing.js` | Test CSV parsing logic | CSV import issues |
| `check-airtable-csv-parsing.js` | Test Airtable CSV parsing | Airtable import validation |
| `compare-csv-rows.js` | Compare CSV row formats | Data format debugging |

---

## 📋 Script Categories Summary

| Category | Count | Purpose |
|----------|-------|---------|
| **Production** | 10 | Run regularly or as needed |
| **Analysis** | 17 | Ad-hoc queries and reporting |
| **Historical** | 11 | One-time imports and fixes |
| **Debug** | 9 | Development troubleshooting |

---

## 🚀 Common Usage Patterns

### Weekly Operations
```bash
# Friday afternoon (automated via cron)
node scripts/weekly-report-ai.js

# Manual weekly report
node scripts/weekly-report-ai.js 2025-01-07
node scripts/save-weekly-snapshot.js
```

### Monthly Operations
```bash
# Sync Meta Ads
node scripts/sync-meta-ads.js

# Revenue analysis
node scripts/analyze-revenue.js

# Business intelligence report
node scripts/analyze-business-intelligence.js
```

### Debugging Workflows
```bash
# Webhook not working?
node scripts/debug-webhook-logs.js
node scripts/check-webhook-log-schema.js

# Payment missing?
node scripts/investigate-sophie-payment.js
node scripts/retrieve-sophie-payment.js

# Data quality issue?
node scripts/check-field-mapping-issues.js
node scripts/analyze-filtering-detailed.js
```

### Historical Data Management
```bash
# Initial import
node scripts/prepare-migration-data.js
node scripts/import-historical-contacts.js

# Fix data issues
node scripts/fix-historical-field-swapping.js
node scripts/safe-reimport-historical.js
```

---

## ⚠️ Important Notes

### Before Running Scripts

1. **Check environment variables** - Most scripts need:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Understand the impact** - Some scripts modify data:
   - `fix-*.js` - Changes existing records
   - `import-*.js` - Inserts new records
   - `insert-*.js` - Creates new entries
   - `analyze-*.js` - Read-only (safe)
   - `check-*.js` - Read-only (safe)

3. **Test locally first** - Run against dev database before production

### Script Naming Conventions

- `analyze-*.js` → Read-only analysis
- `check-*.js` → Verification/validation
- `fix-*.js` → Data correction (MODIFIES DATA)
- `import-*.js` → Data import (ADDS DATA)
- `sync-*.js` → External API sync
- `generate-*.js` → Report generation
- `test-*.js` → Testing utilities
- `debug-*.js` → Debugging tools

---

## 🗑️ Deprecated Scripts (Candidates for Removal)

These scripts may no longer be needed:

- `compare-csv-rows.js` - Used during initial migration
- `analyze-filtering.js` - Replaced by detailed version
- `merge-supabase-into-unified.js` - One-time migration
- `*-sophie-payment.js` (6 scripts) - Specific debugging case (resolved)

**Before deleting:** Verify the issue they addressed is permanently fixed.

---

## 📝 Adding New Scripts

When creating new scripts:

1. **Use descriptive names** - Follow naming conventions above
2. **Add to this README** - Document purpose and usage
3. **Include comments** - Explain what the script does
4. **Handle errors** - Log failures, don't crash silently
5. **Use admin client** - Always use service role key for Supabase

**Template:**
```javascript
// scripts/new-script.js
// Purpose: [What this script does]
// Usage: node scripts/new-script.js [args]

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  console.log('Starting script...');

  try {
    // Your logic here
    console.log('✅ Success');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
```

---

## 🔗 Related Documentation

- **System Architecture:** `SYSTEM_ARCHITECTURE.md` - Overall system design
- **Database Schema:** `DATABASE_SCHEMA.md` - Table structures
- **Project Guide:** `CLAUDE.md` - Developer guide
- **Current Status:** `CURRENT_STATUS.md` - System state

---

**Questions?** Check the main docs or use `/db-status` for quick health check.
