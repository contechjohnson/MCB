---
description: Count opportunities in a GHL pipeline stage (project)
---

Count opportunities in a GHL pipeline stage for $ARGUMENTS.

## Usage

```
/ghl-meetings ppcu "Pipeline Name" "Stage Name"
/ghl-meetings ppcu "Main DC" "Completed DC"
/ghl-meetings ppcu "Calendly Pipeline" "Meeting Attended" last 30 days
```

## Arguments

- **tenant** (required): Tenant slug (ppcu, centner)
- **pipeline** (required): Pipeline name (in quotes if contains spaces)
- **stage** (required): Stage name (in quotes if contains spaces)
- **date range** (optional): "last 7 days", "last 30 days", "november 2025"

Use the ghl-agent subagent to:

1. Parse arguments to extract tenant, pipeline name, stage name, and optional date range
2. Load tenant context and create GHL client
3. Fetch pipelines to find the pipeline ID by name
4. Find the stage ID within that pipeline by name
5. Call `client.countInStage(pipelineId, stageId, dateRange)` to get count
6. Display result with context

## Example Output

```
## GHL Meeting Count - PPCU

**Pipeline:** Main DC
**Stage:** Completed DC
**Date Range:** Last 30 days (Nov 24 - Dec 24, 2025)

**Count:** 15 opportunities

---

Run `/ghl-pipelines ppcu` to see all available pipelines and stages.
```

**Tip:** Run `/ghl-pipelines` first to discover exact pipeline and stage names.
