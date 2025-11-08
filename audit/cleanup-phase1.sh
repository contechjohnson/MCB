#!/bin/bash

# MCB Project Cleanup - Phase 1: Delete One-Time Scripts
# Date: November 8, 2025
# Impact: Remove 45 debugging scripts (80% reduction)
# Risk: VERY LOW - No production dependencies

echo "🧹 MCB Project Cleanup - Phase 1"
echo "================================"
echo ""
echo "This will DELETE 45 one-time analysis/debugging scripts"
echo "Production code is unaffected (only 3 scripts are used in production)"
echo ""
echo "⚠️  WARNING: These files will be permanently deleted (but saved in git history)"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Cleanup cancelled"
    exit 1
fi

echo ""
echo "🗑️  Deleting files..."
echo ""

# Sophie Payment Investigation (7 files)
echo "Removing Sophie Payment Investigation scripts..."
rm -v scripts/check-payments-table.js
rm -v scripts/investigate-sophie-payment.js
rm -v scripts/fix-sophie-payment.js
rm -v scripts/retrieve-sophie-payment.js
rm -v scripts/show-sophie-payment.js
rm -v scripts/insert-sophie-payment.js
rm -v scripts/verify-sophie-payment.js

# Webhook Debugging (7 files)
echo "Removing Webhook Debugging scripts..."
rm -v scripts/check-webhook-log-schema.js
rm -v scripts/debug-webhook-logs.js
rm -v scripts/test-webhook-logic-safe.js
rm -v scripts/check-website-webhooks.js
rm -v scripts/check-all-webhook-sources.js
rm -v scripts/check-website-contacts.js
rm -v scripts/investigate-empty-website-contacts.js

# Metrics Analysis (4 files)
echo "Removing Metrics Analysis scripts..."
rm -v scripts/clarify-metrics.js
rm -v scripts/verify-close-rate.js
rm -v scripts/analyze-weekly-breakdown.js
rm -v scripts/analyze-funnel-health.js

# Historical Data Investigation (9 files)
echo "Removing Historical Data Investigation scripts..."
rm -v scripts/analyze-both-datasets.js
rm -v scripts/fix-both-datasets.js
rm -v scripts/check-field-mapping-issues.js
rm -v scripts/fix-historical-field-swapping.js
rm -v scripts/check-airtable-csv-parsing.js
rm -v scripts/compare-csv-rows.js
rm -v scripts/analyze-filtering.js
rm -v scripts/analyze-filtering-detailed.js
rm -v scripts/analyze-historical-data.js

# Meta Ads Investigation (2 files)
echo "Removing Meta Ads Investigation scripts..."
rm -v scripts/check-meta-ads.js
rm -v scripts/check-ad-performance.js

# Misc Tests (2 files)
echo "Removing test scripts..."
rm -v scripts/test-csv-parsing.js
rm -v scripts/check-schema.js

# Legacy Analysis (14 files)
echo "Removing legacy analysis scripts..."
rm -v scripts/query-historical.js
rm -v scripts/generate-historical-report.js
rm -v scripts/analyze-denefits.js
rm -v scripts/apply_migrations.js
rm -v scripts/analyze-supabase-data.js
rm -v scripts/analyze-stripe.js
rm -v scripts/compare-supabase-with-unified.js
rm -v scripts/merge-supabase-into-unified.js
rm -v scripts/analyze-revenue.js
rm -v scripts/analyze-funnel.js
rm -v scripts/analyze-cohorts.js
rm -v scripts/analyze-all.js
rm -v scripts/analyze-business-intelligence.js
rm -v scripts/analyze-actionable-insights.js

echo ""
echo "✅ Phase 1 Complete!"
echo ""
echo "📊 Summary:"
echo "   - Deleted: 45 scripts"
echo "   - Remaining: ~11 scripts (3 production + 8 utility)"
echo "   - Reduction: 80%"
echo ""
echo "🔍 Remaining scripts:"
ls -1 scripts/*.js
echo ""
echo "💡 Next steps:"
echo "   1. Review remaining scripts: ls -la scripts/"
echo "   2. Test production build: npm run build"
echo "   3. Commit changes: git add . && git commit -m 'Phase 1 cleanup: Remove one-time scripts'"
echo "   4. Review Phase 2 in audit/audit_2025-11-08_comprehensive.md"
echo ""
