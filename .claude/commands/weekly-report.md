---
description: Generate comprehensive weekly performance report with funnel metrics and recommendations
---

Generate a comprehensive weekly report for $ARGUMENTS.

**IMPORTANT:** Always filter `WHERE source != 'instagram_historical'` to exclude imported historical data from weekly analytics.

**CRITICAL: Return ALL information from the subagent.**
- DO NOT summarize the agent's response
- DO NOT filter or condense the report
- Pass through the COMPLETE report exactly as the agent returns it
- The user wants to see all details, tables, and insights

Use the analytics-agent subagent to create a markdown report file with:

## Executive Summary
- Total new contacts this week
- Total purchases
- Overall conversion rate
- Week-over-week comparison (if previous week data available)

## Funnel Performance
- Stage-by-stage breakdown
- Conversion rates
- Bottlenecks identified

## Source Attribution
- Performance by source
- Best performing source
- Recommended budget allocation

## Data Quality
- Any issues detected
- Data completeness metrics

## Recommendations
- Top 3 action items based on data

Save the report as: `reports/weekly_report_YYYY-MM-DD.md`

If no time range is specified, default to "last 7 days".
