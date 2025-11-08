---
description: Analyze conversion funnel with stage-by-stage breakdown and conversion rates
---

Analyze the conversion funnel for $ARGUMENTS.

Use the analytics-agent subagent to:
1. Query stage-by-stage breakdown with counts and percentages
2. Calculate conversion rates between each stage
3. Identify drop-off points (where we lose the most people)
4. Present results as a markdown table with insights and recommendations

**IMPORTANT:**
- Always filter `WHERE source != 'instagram_historical'` to exclude imported historical data
- If no time range is specified, default to "last 30 days"
