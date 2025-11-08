---
description: Run analytics queries using the web-optimized analytics agent
---

Run analytics query using the web agent: $ARGUMENTS

**IMPORTANT:** Always filter `WHERE source != 'instagram_historical'` to exclude imported historical data.

Use the **analytics-agent-web** subagent (optimized for Claude Code Web) to:

## Common Query Types

### Funnel Analysis
- Stage-by-stage breakdown with counts and percentages
- Conversion rates between each stage
- Drop-off point identification

### Performance by Source
- Compare instagram vs website vs other sources
- Source-specific conversion rates
- Attribution analysis

### Data Quality Checks
- Missing emails/phones
- Orphaned payments
- MC→GHL linkage rates
- AD_ID capture rates

### Recent Activity
- New contacts (last 24h, 7d, 30d)
- Recent purchases
- Recent bookings
- Recent webhook events

### Custom Queries
- Any SQL query or analysis request
- Time-based cohort analysis
- A/B test performance
- Meta Ads attribution

## Default Behavior

If no specific query is provided, show a dashboard with:
1. Total contacts (excluding historical)
2. Contacts by stage
3. Conversion funnel
4. Recent activity (last 7 days)
5. Data quality metrics

## Example Usage

```
/web-analytics show funnel for last 30 days
/web-analytics what are the orphan payments
/web-analytics compare conversion by source
/web-analytics show recent purchases
/web-analytics MC to GHL linkage rate
```

## Notes

- This agent uses the web-optimized MCP configuration
- READ-ONLY access (never modifies data)
- Results are formatted for web display
- Supports natural language queries

Present results as markdown tables with insights and actionable recommendations.
