---
description: Generate comprehensive weekly performance report with funnel metrics and recommendations
---

Generate a comprehensive weekly report for $ARGUMENTS.

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
