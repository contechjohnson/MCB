---
description: Manage tenants and their configurations
---

Tenant management command for $ARGUMENTS.

## Usage
- `/tenant list` - List all active tenants with status
- `/tenant [name] status` - Show tenant status and integrations
- `/tenant [name] configure` - Help configure integrations
- `/tenant add [name]` - Guide through adding new tenant

## Current Tenants
- **ppcu** - Postpartum Care USA (Active)
- **centner** - Centner Wellness (Pending)
- **columnline** - Columnline AI (Pending)

## Actions

### For `/tenant list`:
Query the tenants table and show all active tenants with their integration status.

### For `/tenant [name] status`:
Use the analytics-agent to query:
1. Tenant info from `tenants` table
2. Configured integrations from `tenant_integrations`
3. Recent contact/payment counts
4. Webhook activity in last 24 hours

### For `/tenant add [name]`:
Walk through the steps in `directives/multi-tenancy.md`:
1. Create tenant record
2. Add integrations
3. Configure external services
4. Test webhook endpoints

**Reference:** See `directives/multi-tenancy.md` for complete tenant onboarding guide.
