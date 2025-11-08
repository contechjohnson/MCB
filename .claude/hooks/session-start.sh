#!/bin/bash

# SessionStart hook for MCB project
# Provides critical context at the beginning of every session

CURRENT_DATE=$(date +"%B %d, %Y")
CURRENT_MONTH=$(date +"%B %Y")

cat <<EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 MCB PROJECT SESSION CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 CURRENT DATE: ${CURRENT_DATE}
   System went live: November 2025
   When asked for "last 30 days": Calculate from ${CURRENT_MONTH}

🗄️  HISTORICAL DATA FILTER:
   ⚠️  ALWAYS use: WHERE source != 'instagram_historical'
   (537 imported contacts to exclude from analytics)

📊 TWO SUBSCRIBE FIELDS:
   ✓ 'subscribed' = TRUE date (from ManyChat API)
   ✓ 'subscribe_date' = When we started tracking
   Use 'subscribed' for analytics!

🎯 THREE CUSTOMER ENTRY POINTS:
   1. Instagram DM Flow (full attribution)
   2. Website Traffic (no attribution)
   3. Direct-to-Funnel (partial attribution)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

exit 0
