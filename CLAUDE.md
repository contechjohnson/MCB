# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🚨 CURRENT STATUS (Read This First!)

**Date:** Nov 3, 2025, 10:45 PM
**Phase:** ✅ WEBHOOKS BUILT & DEPLOYED - Ready for Platform Configuration

**DEPLOYMENT STATUS:**
- ✅ Schema v2.1 migrated to Supabase (UUID primary keys, flexible matching)
- ✅ All 4 webhook endpoints built (ManyChat, GHL, Stripe, Denefits)
- ✅ Code pushed to GitHub
- ✅ Deployed to Vercel: `https://mcb-dun.vercel.app/`
- ⏳ Waiting: Environment variables need to be added to Vercel
- ⏳ Waiting: Webhooks need to be configured in each platform

**IMMEDIATE NEXT STEPS (Morning):**
1. Follow `DEPLOYMENT_CHECKLIST.md` (start at Step 2)
2. Add environment variables to Vercel (especially Stripe keys)
3. Set up Stripe webhook (easiest, do first)
4. Set up GHL webhook in workflows
5. Set up ManyChat External Request blocks
6. Update Denefits Make.com scenario URL

**User Note:** ManyChat will pass full contact data in webhook payload (not use custom fields for dates). Webhook will map data appropriately on server side.

**Full context:** See `START_HERE_WEBHOOKS.md` and `DEPLOYMENT_CHECKLIST.md`

---

## Project Overview

MCB is a **data collection system** (not a dashboard app). It captures events from multiple sources (Stripe payments, GoHighLevel bookings, ManyChat conversations) and stores them in Supabase for automated reporting.

**What this is FOR**: Collecting clean, queryable data and sending automated email reports
**What this is NOT**: A web app with dashboards or UI that users will look at

## How to Talk to the User

The user is doing "vibe coding" - they understand the concepts but not all the technical details. When helping:
- Explain things simply, like teaching a friend
- Show the actual commands to run, don't just describe them
- If something breaks, explain what went wrong in plain English
- Don't assume deep knowledge of Next.js, databases, or TypeScript

## Project Structure (Updated Nov 3, 2025)

```
/app
  /api
    /manychat/route.ts        # ManyChat webhook (DM qualified, link tracking)
    /ghl-webhook/route.ts     # GoHighLevel webhook (bookings, meetings)
    /stripe-webhook/route.ts  # Stripe webhook (payments, refunds)
    /denefits-webhook/route.ts # Denefits webhook (BNPL financing)
  layout.tsx
  page.tsx

/historical_data    # CSV files and Airtable exports (not in database)

/Setup Guides       # Copy-paste guides for each platform
  DEPLOYMENT_CHECKLIST.md    # Main deployment guide (START HERE)
  START_HERE_WEBHOOKS.md     # Overview of webhook system
  SETUP_STRIPE.md            # Stripe webhook setup (easiest)
  SETUP_GHL.md               # GoHighLevel webhook setup
  SETUP_MANYCHAT.md          # ManyChat webhook setup
  SETUP_DENEFITS.md          # Denefits Make.com setup
  WEBHOOK_GUIDE.md           # Technical reference
  WEBHOOK_FLOW_DIAGRAM.md    # Visual flow diagrams

/Schema Files
  schema_v2.1.sql            # Current schema (UUID primary keys)

.env.local        # Your secrets (not in git)
package.json      # Dependencies (includes Stripe package)
```

## Development Commands

```bash
# Start the dev server (lets you test webhooks locally)
npm run dev

# Build for production
npm run build

# Check for errors (doesn't fix them, just finds them)
npm run lint
npm run type-check
```

## How This System Works

### The Data Flow (Simple Version)

1. **Something happens** → Customer books appointment, makes payment, etc.
2. **Webhook fires** → Stripe/GHL/ManyChat sends data to your API endpoint
3. **Your code catches it** → API route receives the webhook
4. **Store in Supabase** → Data gets saved to database
5. **Query later** → Run reports, send emails with insights

### The Three Main Webhooks

**1. Stripe Webhook** (`/api/stripe-webhook`)
- Fires when: Someone pays, refunds happen, checkout expires
- What it does: Saves payment info, links it to a contact by email
- **Important**: Always returns status 200 (even on errors) so Stripe doesn't retry endlessly

**2. GoHighLevel Webhook** (`/api/ghl-webhook`)
- Fires when: Someone books, attends, or gets sent a package
- What it does: Creates or updates contact records
- **Important**: Auto-creates contacts if they don't exist (finds by email)

**3. ManyChat Webhook** (`/api/manychat` or `/api/ai-router`)
- Fires when: Bot conversations happen
- What it does: Tracks conversation progress, symptoms, engagement
- Not built yet in clean version

## Supabase Database (Where the Data Lives)

You have a PostgreSQL database hosted on Supabase. Think of it like a big Excel spreadsheet in the cloud that your code can write to.

### Two Ways to Connect

1. **From API routes**: Use the "admin" client (has full access, no restrictions)
2. **From web pages**: Use the regular client (has security rules) - but you probably won't need this

**In your code, always use the admin client**:
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

### Environment Variables (The Secrets)

These live in `.env.local` (which doesn't get committed to git):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...  # Safe to expose in browser
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...     # NEVER expose in browser, API routes only

# Stripe
STRIPE_SECRET_KEY=sk_live_...            # For reading Stripe data
STRIPE_WEBHOOK_SECRET=whsec_...          # For verifying webhooks are real

# GoHighLevel (if needed)
GHL_API_KEY=...

# ManyChat (if needed)
MANYCHAT_VERIFY_TOKEN=...
MANYCHAT_API_KEY=...
```

## Creating a New Webhook

When you need to add a new webhook endpoint:

1. **Create the file**: `app/api/[name]/route.ts`
2. **Basic structure**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Received webhook:', body);

    // Do stuff with the data
    await supabaseAdmin
      .from('your_table')
      .insert({ some_data: body.whatever });

    // Always return 200 for webhooks
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Error:', error);
    // Still return 200 to prevent retries
    return NextResponse.json({ error: 'Internal error' }, { status: 200 });
  }
}

// Add GET for testing
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Webhook is alive'
  });
}
```

3. **Test it locally**:
   - Run `npm run dev`
   - Visit `http://localhost:3000/api/[name]` (should see "ok" message)
   - Test POST with curl or Postman

4. **Deploy to production**: Just push to git, Vercel auto-deploys

## Common Tasks

### Check if webhook is working
```bash
# Test locally
curl http://localhost:3000/api/stripe-webhook

# Test production
curl https://your-app.vercel.app/api/stripe-webhook
```

### Query the database (from code)
```typescript
// Get all contacts
const { data, error } = await supabaseAdmin
  .from('contacts')
  .select('*');

// Get contacts who paid
const { data, error } = await supabaseAdmin
  .from('contacts')
  .select('*')
  .eq('has_paid', true);

// Count contacts
const { count } = await supabaseAdmin
  .from('contacts')
  .select('*', { count: 'exact', head: true });
```

### Looking at webhook logs
All webhook data gets logged to Supabase tables:
- Check `stripe_webhook_logs` for Stripe events
- Check `webhook_logs` for GHL/ManyChat events

You can query these in the Supabase dashboard (SQL Editor).

## Historical Data (CSVs & Airtable)

Your old data lives in `/historical_data/` folder. This data **doesn't** go into the Supabase database.

When you need to analyze it:
1. Drop the CSV in that folder
2. We'll write a quick Python script or Node.js script to read it
3. Generate insights separate from the main system

This keeps the database clean and purpose-built for new data only.

## Archived Code

Everything from the old version is in `/_archive_2025_11_02/`. You can:
- Look at it for reference
- Copy useful functions
- But we're not maintaining it

Claude will ignore this folder (it's in `.claudeignore`).

## Deployment

The app deploys to Vercel automatically:
1. Push code to git (`git push origin main`)
2. Vercel detects the push
3. Runs `npm run build`
4. Deploys to your URL (same URL, new code)

No need to create a new project or change URLs.

## Getting Help

If something breaks:
1. Check the Vercel deployment logs (in Vercel dashboard)
2. Check the browser console (F12 in Chrome)
3. Check Supabase logs (in Supabase dashboard → Logs)
4. Ask Claude to help debug (describe what you expected vs what happened)

## What's Next

The immediate tasks are:
1. ✅ Archive old code (done)
2. 🔨 Create new clean folder structure
3. 🔨 Set up basic API endpoints
4. 🔨 Build the webhook handlers
5. 🔨 Set up automated email reports
6. 🔨 Test with real data

## Tool & MCP Usage Guide

### Web Scraping & Search - ALWAYS Use Firecrawl

**Primary Tool: Firecrawl MCP** - This is your go-to for ANY web-related task.

When you need to:
- Search for documentation
- Scrape a website
- Look up package info (npm, GitHub, etc.)
- Find examples or tutorials
- Get any information from the web

**Use Firecrawl MCP tools**:
```typescript
// For searching the web
mcp__mcp-server-firecrawl__firecrawl_search

// For scraping a specific page
mcp__mcp-server-firecrawl__firecrawl_scrape

// For discovering URLs on a site
mcp__mcp-server-firecrawl__firecrawl_map
```

**DO NOT use**:
- ❌ WebSearch (native tool) - Skip this entirely
- ❌ WebFetch - Only use if Firecrawl fails
- ❌ Puppeteer MCP - Firecrawl is faster and more reliable

**Example scenarios**:
- "Find Supabase documentation" → Use `firecrawl_search`
- "Get the latest Next.js docs" → Use `firecrawl_scrape`
- "Look up how to use Stripe webhooks" → Use `firecrawl_search`

### Available MCP Servers

This project has several MCP servers configured. Here's when to use each:

**Firecrawl** - Web scraping and search (USE THIS FOR ALL WEB TASKS)
- `firecrawl_search` - Search the web
- `firecrawl_scrape` - Scrape a specific URL
- `firecrawl_map` - Discover URLs on a website
- `firecrawl_crawl` - Deep crawl a site
- `firecrawl_extract` - Extract structured data

**Filesystem** - File operations (already have Read/Write, but this adds more)
- Use built-in Read/Write/Edit tools instead unless you need special filesystem features

**Playwright** - Browser automation (rarely needed)
- Only use if you need actual browser interaction
- Firecrawl handles most scraping without needing a real browser

**Memory** - Knowledge graph (not currently needed)
- Skip for now unless building a knowledge base

**Context7** - Library documentation (useful for package docs)
- Use when you need up-to-date docs for a specific library
- Example: Getting latest Stripe API docs

**Notion** - Notion API integration (not currently used)
- Skip unless integrating with Notion

**Supabase MCP** - Direct database access (HIGHLY RECOMMENDED TO INSTALL)
- Natural language database queries
- Schema exploration
- Quick data analysis
- Table creation/modification
- **Status**: Check `MCP_STATUS.md` for installation instructions
- **Use for**: Development, testing, exploration (NOT production operations)
- **Installation**: Add to Claude config, restart terminal

### Database Operations

**Two Ways to Work with Supabase:**

**1. Via Supabase MCP (Recommended for exploration/testing)**
- Ask in natural language: "Show me all contacts who purchased"
- Automatic query generation and formatting
- Great for quick analysis and debugging
- See `MCP_STATUS.md` for setup

**2. Via Code (Required for webhooks/production)**
```typescript
// ALWAYS create admin client in API routes
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

**When to use which:**
- 🔍 MCP: Exploring, analyzing, testing queries, schema changes
- 💻 Code: Webhooks, automated processes, production endpoints

**For testing connections**:
- Create Node.js test scripts (see `test-supabase.js` example)
- Run with `node test-supabase.js`

### File Operations Priority

1. **Read** - For reading files (use this, not `cat`)
2. **Write** - For creating new files (use this, not `echo >`)
3. **Edit** - For modifying existing files (use this, not `sed`)
4. **Glob** - For finding files by pattern (use this, not `find`)
5. **Grep** - For searching file contents (use this, not `grep` command)
6. **Bash** - Only for actual shell commands (git, npm, node scripts)

### Running Scripts

**Node.js scripts**:
```bash
node your-script.js
```

**NPM commands**:
```bash
npm run dev
npm run build
npm install package-name
```

**Git operations** (if needed):
```bash
git add .
git commit -m "message"
git push origin main
```

### Task/Agent Tool

Use the Task tool sparingly. Most operations should be done directly:
- ❌ Don't use agents for simple file searches
- ❌ Don't use agents for straightforward coding tasks
- ✅ Do use agents for complex multi-step research
- ✅ Do use agents when you need to coordinate multiple searches

### Permissions

All tools should work without prompts. If you're asked for permission:
1. Check `.claude/settings.local.json`
2. It should contain: `{"permissions": {"allow": ["*"], "deny": [], "ask": []}}`
3. If it doesn't, update it and tell the user to restart their terminal

## Important Rules

1. **Webhooks always return 200** - Even if there's an error, return success status to prevent infinite retries
2. **Email matching is case-insensitive** - Use `.ilike()` not `.eq()` when searching by email
3. **Log everything** - When in doubt, console.log() and save to a logs table
4. **Keep it simple** - Don't over-engineer, just make it work
5. **Data first** - Focus on collecting clean data, not building fancy UIs
6. **Always use Firecrawl for web tasks** - Never use WebSearch, always use Firecrawl MCP
