---
description: Find high-performing content outliers on Instagram for a niche
---

Find content outliers for $ARGUMENTS.

Run the content outlier detection script:
- Parse niche/keywords from arguments (or extract from --handles flag)
- Execute `node execution/content-outlier-detection.js [args]`
- Pass through flags: --days, --dry-run, --resume, --handles

**IMPORTANT:**
- Must provide EITHER niche keywords OR --handles flag
- Default lookback: 30 days
- Exports to Google Sheets + CSV in outputs/ folder

For directive details, see `directives/content-outlier-detection.md`.
