---
description: Analyze performance by traffic source (Instagram, Facebook, website, etc.)
---

Analyze performance by traffic source for $ARGUMENTS.

**IMPORTANT:** Always filter `WHERE source != 'instagram_historical'` to exclude imported historical data.

Use the analytics-agent subagent to compare each source (instagram, website, instagram_lm, instagram_historical) with:
1. Total contacts
2. Number of purchases
3. Conversion rate
4. Average time to purchase (if available)
5. Quality metrics (email capture rate, Q1/Q2 completion)

Present results as a comparison table with recommendations on which sources to prioritize.

If no time range is specified, default to "last 30 days".
