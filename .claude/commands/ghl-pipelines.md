---
description: List all GHL pipelines and stages for a tenant (project)
---

List GoHighLevel pipelines and stages for $ARGUMENTS.

Use the ghl-agent subagent to:

1. Parse the tenant slug from arguments (default: ppcu)
2. Load tenant context with `getTenantContext(slug)`
3. Create GHL client with `GHLClient.fromTenant(tenant)`
4. Call `client.getPipelines()` to fetch all pipelines
5. Display results in a formatted table showing:
   - Pipeline name and ID
   - Each stage with name and ID
   - Stage position/order

## Example Output

```
## Pipelines for PPCU

### 1. Main DC Pipeline
- ID: `abc123`
- Stages:
  1. DC Booked (ID: `stage_001`)
  2. Completed DC (ID: `stage_002`)
  3. No Show (ID: `stage_003`)

### 2. Calendly Pipeline
- ID: `xyz789`
- Stages:
  1. Scheduled (ID: `stage_004`)
  2. Meeting Attended (ID: `stage_005`)
  3. No Show (ID: `stage_006`)
```

Use this to discover pipeline structure before running `/ghl-meetings`.
