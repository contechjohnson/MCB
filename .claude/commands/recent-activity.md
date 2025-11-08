---
description: Display recent database activity and new contacts
---

Show recent database activity with limit: $ARGUMENTS.

Use the analytics-agent subagent to display:
1. New contacts in the last 24 hours
2. Recent purchases
3. Recent meetings held
4. Recent webhook events (if available via logs)

For each contact, include: name, email, source, stage, timestamp

Present as a chronological timeline with key events highlighted.

If no limit is specified, default to 20 contacts.
