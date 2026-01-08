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
/ppcu-stats last 7 days               # PPCU leads & meetings from GHL
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
| Full funnel/revenue report | `.claude/skills/funnel-report.md` | `/funnel-report [time]` |
| Analyze funnel | `directives/analytics.md` | `/funnel [tenant] [time]` |
| Check data quality | `directives/analytics.md` | `/data-quality [tenant]` |
| View recent activity | `directives/analytics.md` | `/recent-activity [tenant]` |
| Source comparison | `directives/analytics.md` | `/source-performance [tenant]` |

### GHL Queries (PPCU)

| I Want To... | Directive | Command |
|--------------|-----------|---------|
| PPCU leads & meetings | `.claude/commands/ppcu-stats.md` | `/ppcu-stats [time]` |
| PPCU meetings only | `.claude/commands/ppcu-meetings.md` | `/ppcu-meetings [time]` |
| List GHL pipelines | `.claude/commands/ghl-pipelines.md` | `/ghl-pipelines [tenant]` |

### Content Marketing

| I Want To... | Directive | Command |
|--------------|-----------|---------|
| Find content outliers | `directives/content-outlier-detection.md` | `/content-outliers [niche]` |

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

## Events-First Architecture (Dec 2025)

**Critical Change:** `funnel_events` is the single source of truth. Contacts table holds only identity + current state.

### Contacts Table (Minimal - 20 columns)
```
id, tenant_id, created_at, updated_at
mc_id, ghl_id, ig, ig_id, fb, stripe_customer_id
email_primary, email_booking, email_payment
phone, first_name, last_name
stage, source, ad_id, tags (JSONB)
```

### Funnel Events Table (Source of Truth)
Every webhook writes here. Query this for all analytics.
```sql
-- Stage counts
SELECT event_type, COUNT(DISTINCT contact_id)
FROM funnel_events
WHERE tenant_id = 'ppcu-uuid' AND event_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY event_type;

-- Chatbot A/B (via tags)
SELECT tags->>'chatbot' as variant, COUNT(DISTINCT contact_id)
FROM funnel_events
WHERE tags->>'chatbot' IS NOT NULL
GROUP BY tags->>'chatbot';
```

### DEPRECATED Columns (Removed Dec 2025)
These columns no longer exist on contacts - query `funnel_events` instead:
- ~~subscribe_date~~, ~~dm_qualified_date~~, ~~link_send_date~~, ~~link_click_date~~
- ~~form_submit_date~~, ~~appointment_date~~, ~~appointment_held_date~~
- ~~purchase_date~~, ~~deposit_paid_date~~, ~~package_sent_date~~
- ~~chatbot_ab~~, ~~funnel_variant~~ (use `tags` JSONB instead)
- ~~purchase_amount~~ (use `payments` table)

---

## Critical Rules

### 1. Always Check Today's Date
Before any date-based query, verify the date in `<env>`. System went live November 2025.

### 2. Always Filter Historical Data
```sql
WHERE source != 'instagram_historical'
```
537 imported contacts must be excluded from go-forward analytics. See `directives/historical-data.md`.

### 3. Query funnel_events for Analytics
**OLD (BROKEN):** `SELECT COUNT(*) FROM contacts WHERE form_submit_date IS NOT NULL`
**NEW (CORRECT):** `SELECT COUNT(DISTINCT contact_id) FROM funnel_events WHERE event_type = 'form_submitted'`

### 4. Webhooks Always Return 200
Even on errors. Prevents retry storms from external systems.

### 5. Email Matching is Case-Insensitive
Use `.ilike()` not `.eq()` when searching by email.

### 6. Tags for Flexible Metadata
Use JSONB `tags` column for any metadata: `tags->>'chatbot'`, `tags->>'funnel'`, etc.

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
| `content-outlier-detection.md` | `execution/content-outlier-detection.js` | Find high-performing Instagram content |
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
| `/funnel-report [time]` | Full funnel/revenue report with attribution |
| `/funnel [tenant] [time]` | Conversion funnel analysis |
| `/data-quality [tenant]` | Find missing fields, orphans |
| `/source-performance [tenant]` | Compare Instagram vs website |
| `/recent-activity [tenant] [time]` | New contacts/events |
| `/db-status` | Database health check |
| `/weekly-report [tenant]` | Generate full report |
| `/web-analytics [query]` | Natural language queries |
| `/content-outliers [niche]` | Find high-performing Instagram content |
| `/ppcu-stats [time]` | PPCU leads & meetings from GHL (source/attribution breakdowns) |
| `/ppcu-meetings [time]` | PPCU meetings held only (Calendly + Jane) |
| `/ghl-pipelines [tenant]` | List GHL pipelines and stages |

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
| Full funnel/revenue report | `funnel-report.md` | `/funnel-report last 7 days` |
| Check funnel | `analytics.md` | `/funnel ppcu` |
| Debug webhook | `webhooks.md` | Query `webhook_logs` |
| Sync ads | `meta-ads-sync.md` | `node execution/sync-meta-ads.js` |
| Generate report | `weekly-reports.md` | `node execution/weekly-report-ai.js` |
| Find content outliers | `content-outlier-detection.md` | `/content-outliers "niche"` |
| Understand historical | `historical-data.md` | Filter `instagram_historical` |
| PPCU leads & meetings | `ppcu-stats.md` | `/ppcu-stats last 7 days` |
| PPCU meetings only | `ppcu-meetings.md` | `/ppcu-meetings last 30 days` |

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
