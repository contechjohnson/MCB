---
description: Run comprehensive data quality checks on contacts database
---

Run a comprehensive data quality check with filter: $ARGUMENTS.

**IMPORTANT:** Always filter `WHERE source != 'instagram_historical'` to exclude imported historical data from quality checks.

Use the analytics-agent subagent to check for:
1. Missing critical fields (email, name, mc_id/ghl_id)
2. Q1/Q2 field mapping issues (swapped or incorrect data)
3. Chatbot AB field issues
4. Duplicate contacts (same email with different IDs)
5. Stage progression anomalies
6. Date field issues (future dates, null dates where expected)

Present results with:
- Issue count per category
- Sample problematic records
- Severity assessment (critical/warning/info)
- Recommended fixes

If no filter is specified, check "all sources".
