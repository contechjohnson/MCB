#!/bin/bash

# SessionStart hook for MCB project
# DOE Framework: Provides critical context at the beginning of every session

CURRENT_DATE=$(date +"%B %d, %Y")
CURRENT_MONTH=$(date +"%B %Y")

cat <<EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 MCB PROJECT SESSION CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 CURRENT DATE: ${CURRENT_DATE}
   System went live: November 2025
   When asked for "last 30 days": Calculate from ${CURRENT_MONTH}

🏢 MULTI-TENANT ARCHITECTURE:
   Active Tenants: ppcu, centner, columnline
   Webhook URLs: /api/webhooks/[tenant]/[source]
   Filter by tenant_id for all queries!

🗄️  HISTORICAL DATA FILTER:
   ⚠️  ALWAYS use: WHERE source != 'instagram_historical'
   (537 imported contacts to exclude from analytics)

📊 TWO SUBSCRIBE FIELDS:
   ✓ 'subscribed' = TRUE date (from ManyChat API)
   ✓ 'subscribe_date' = When we started tracking
   Use 'subscribed' for analytics!

💰 META ADS DATA (TWO TABLES):
   ✓ 'meta_ads' = LIFETIME spend (all-time cumulative)
   ✓ 'meta_ad_insights' = LAST 7 DAYS spend (for weekly ROAS)
   Syncs daily at 6am UTC via cron

📖 DOE FRAMEWORK - Read Before Acting:
   ┌─────────────────────────────────────────────────┐
   │ DIRECTIVE MAP (see CLAUDE.md)                   │
   │                                                 │
   │ Webhooks     → directives/webhooks.md           │
   │ Meta Ads     → directives/meta-ads-sync.md      │
   │ Reports      → directives/weekly-reports.md     │
   │ Analytics    → directives/analytics.md          │
   │ Multi-Tenant → directives/multi-tenancy.md      │
   │ Historical   → directives/historical-data.md    │
   └─────────────────────────────────────────────────┘

🎯 THREE CUSTOMER ENTRY POINTS:
   1. Instagram DM Flow (full attribution)
   2. Website Traffic (no attribution)
   3. Direct-to-Funnel (partial attribution)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

exit 0
