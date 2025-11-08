---
description: Display recent database activity and new contacts
---

Show recent database activity with limit: $ARGUMENTS.

**IMPORTANT:** Always filter `WHERE source != 'instagram_historical'` to exclude imported historical data.

**CRITICAL: Return ALL information from the subagent.**
- DO NOT summarize the agent's response
- DO NOT filter or condense the report
- Pass through the COMPLETE report exactly as the agent returns it
- The user wants to see all details, tables, and insights

Use the analytics-agent subagent to display:
1. New contacts in the last 24 hours
2. Recent purchases
3. Recent meetings held
4. Recent webhook events (if available via logs)

For each contact, include: name, email, source, stage, timestamp

Present as a chronological timeline with key events highlighted.

If no limit is specified, default to 20 contacts.
