# MCB - Social Media Funnel Tracking Framework

**What this is:** Multi-tenant funnel tracking for social media businesses.

**Active Tenants:** PPCU (Postpartum Care USA), Centner Wellness, Columnline AI

**Tech Stack:** Next.js, Supabase, ManyChat, GoHighLevel, Stripe, Meta Ads

**Production URL:** https://mcb-dun.vercel.app/

---

## Quick Start

```bash
npm run dev                           # Start local server
/db-status                            # Check database health
/funnel ppcu last 30 days             # Analyze PPCU funnel
node execution/sync-meta-ads.js       # Sync Meta Ads manually
```

---

## Supabase Project

**CRITICAL:** Always use the correct Supabase project ID when using MCP tools.

**Project ID:** `succdcwblbzikenhhlrz`
**Project Name:** MCB_PPCU
**Region:** us-east-2
**Database Host:** db.succdcwblbzikenhhlrz.supabase.co

When using Supabase MCP tools (`mcp__supabase__*`), always use project_id: `succdcwblbzikenhhlrz`

---

## Directive Map (What Do I Run?)

**Philosophy:** Read the directive first, then run the command.

### Core Operations

| I Want To... | Directive | Command |
|--------------|-----------|---------|
| Understand webhooks | `directives/webhooks.md` | (auto in production) |
| Sync Meta Ads | `directives/meta-ads-sync.md` | `node execution/sync-meta-ads.js` |
| Generate weekly report | `directives/weekly-reports.md` | `node execution/weekly-report-ai.js` |

### Analytics

| I Want To... | Directive | Command |
|--------------|-----------|---------|
| Analyze funnel | `directives/analytics.md` | `/funnel [tenant] [time]` |
| Check data quality | `directives/analytics.md` | `/data-quality [tenant]` |
| View recent activity | `directives/analytics.md` | `/recent-activity [tenant]` |
| Source comparison | `directives/analytics.md` | `/source-performance [tenant]` |

### Tenant Management

| I Want To... | Directive | Command |
|--------------|-----------|---------|
| Add new tenant | `directives/multi-tenancy.md` | (coming soon) |
| Configure integrations | `directives/multi-tenancy.md` | (coming soon) |

### Debugging

| I Want To... | Directive | Command |
|--------------|-----------|---------|
| Debug webhook | `directives/webhooks.md` | Check `webhook_logs` table |
| Fix orphan payments | `directives/webhooks.md` | See troubleshooting section |
| Understand historical filter | `directives/historical-data.md` | Always filter analytics |

---

## Critical Rules

### 1. Always Check Today's Date
Before any date-based query, verify the date in `<env>`. System went live November 2025.

### 2. Always Filter Historical Data
```sql
WHERE source != 'instagram_historical'
```
537 imported contacts must be excluded from go-forward analytics. See `directives/historical-data.md`.

### 3. Webhooks Always Return 200
Even on errors. Prevents retry storms from external systems.

### 4. Email Matching is Case-Insensitive
Use `.ilike()` not `.eq()` when searching by email.

---

## Directory Structure

```
/MCB/
├── CLAUDE.md                    # This file - entry point
├── directives/                  # SOPs - Read before executing
│   ├── webhooks.md              # All webhook handling
│   ├── meta-ads-sync.md         # Meta Ads integration
│   ├── weekly-reports.md        # AI report generation
│   ├── analytics.md             # Query patterns
│   └── historical-data.md       # Filter rules
│
├── execution/                   # Production scripts
│   ├── sync-meta-ads.js
│   ├── weekly-report-ai.js
│   └── apply-migrations.js
│
├── app/api/                     # Webhook endpoints
│   ├── webhooks/[tenant]/       # Multi-tenant (new)
│   ├── manychat/                # Legacy
│   ├── ghl-webhook/
│   ├── stripe-webhook/
│   └── cron/
│
├── scripts/                     # Organized scripts
│   ├── production/              # Core scripts
│   ├── analysis/                # Reusable analysis
│   └── archive/                 # Historical investigations
│
├── migrations/                  # SQL migrations
├── .claude/                     # AI agents & commands
└── _archive/                    # Old code, investigations
```

---

## Directives

| Directive | Script | Purpose |
|-----------|--------|---------|
| `webhooks.md` | `app/api/webhooks/` | Receive events from 5 sources |
| `meta-ads-sync.md` | `execution/sync-meta-ads.js` | Daily Meta Ads sync |
| `weekly-reports.md` | `execution/weekly-report-ai.js` | AI-generated reports |
| `analytics.md` | Slash commands | Funnel analysis, data quality |
| `historical-data.md` | N/A | Filtering rules |

---

## Environment Variables

| Variable | Purpose | Per-Tenant? |
|----------|---------|-------------|
| `SUPABASE_*` | Database access | No (shared) |
| `OPENAI_API_KEY` | AI reports | No (shared) |
| `META_ACCESS_TOKEN` | Meta Ads API | Yes (in DB) |
| `STRIPE_*` | Payment processing | Yes (in DB) |
| `MANYCHAT_*` | DM automation | Yes (in DB) |

For multi-tenant, credentials are stored in `tenant_integrations` table.

---

## Slash Commands

| Command | Description |
|---------|-------------|
| `/funnel [tenant] [time]` | Conversion funnel analysis |
| `/data-quality [tenant]` | Find missing fields, orphans |
| `/source-performance [tenant]` | Compare Instagram vs website |
| `/recent-activity [tenant] [time]` | New contacts/events |
| `/db-status` | Database health check |
| `/weekly-report [tenant]` | Generate full report |
| `/web-analytics [query]` | Natural language queries |

---

## Self-Annealing

When something breaks:
1. Fix the issue
2. Update the directive's **Self-Annealing Log**
3. Add prevention to the process

Directives are living SOPs. They evolve with the system.

---

## Quick Reference

| Task | Directive | Quick Command |
|------|-----------|---------------|
| Check funnel | `analytics.md` | `/funnel ppcu` |
| Debug webhook | `webhooks.md` | Query `webhook_logs` |
| Sync ads | `meta-ads-sync.md` | `node execution/sync-meta-ads.js` |
| Generate report | `weekly-reports.md` | `node execution/weekly-report-ai.js` |
| Understand historical | `historical-data.md` | Filter `instagram_historical` |

---

## User Communication Style

The user does "vibe coding" - understands concepts but not all technical details:
- Explain simply, like teaching a friend
- Show actual commands to run
- If something breaks, explain in plain English
- Don't assume deep Next.js/TypeScript knowledge

---

## MCP Tools

**Primary:** Firecrawl for all web scraping/search

**Analytics:** Supabase MCP for natural language queries

**Reference:** Context7 for library documentation

See individual directives for tool-specific guidance.

---

## Related Documentation

- `CURRENT_STATUS.md` - System state, known issues
- `DATABASE_SCHEMA.md` - Complete schema reference
- `docs/` - Setup guides (archived)

---

**For detailed information on any topic, read the appropriate directive first.**
