---
description: Count meetings held for PPCU (Calendly + Jane pipelines) (project)
---

Count meetings held for PPCU in the specified time period: $ARGUMENTS

Run this command:

```bash
node scripts/production/ppcu-meetings-held.js "$ARGUMENTS"
```

## Usage Examples

```
/ppcu-meetings last 7 days
/ppcu-meetings last 8 days
/ppcu-meetings last 30 days
/ppcu-meetings november 2025
/ppcu-meetings december 2025
```

## What It Queries

**Calendly Free (FREE DISCOVERY CALL PIPELINE):**
- All stages EXCEPT "DC BOOKED" and "NO SHOW" = meetings held

**Jane Paid (Discovery Call Main Pipeline):**
- "Completed DC" stage only
