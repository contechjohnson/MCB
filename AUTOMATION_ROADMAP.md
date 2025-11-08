# Weekly Reporting Automation Roadmap

**Status:** Manual (for now)
**Goal:** Fully automated AI-generated reports with persistent memory

---

## Current State (Manual)

### What We're Doing Now
1. Run analytics scripts manually: `node scripts/eric-weekly-report.js`
2. Review output and refine messaging
3. Copy insights into email template
4. Send to Eric manually

**Why Manual?**
- Still dialing in the flow Eric likes
- Testing different report formats
- Validating data accuracy
- Building confidence in the system

---

## Future State (Automated)

### The Vision
**AI Assistant with Persistent Memory**
- Remembers previous reports sent to Eric
- Knows company context, history, goals
- Writes reports in Clara's voice
- Adapts messaging based on what's working
- Sends weekly emails automatically

### Technical Architecture

**Data Layer:**
```
Weekly cron job (Monday 8am)
  ↓
Runs analytics queries (Supabase)
  ↓
Calculates week-over-week changes
  ↓
Fetches Meta Ads data (latest spend)
  ↓
Formats data into JSON
```

**AI Layer:**
```
JSON data → AI Assistant (with persistent memory)
  ↓
Analyzes trends vs. previous weeks
  ↓
Identifies notable changes
  ↓
Writes report in Clara's voice
  ↓
Includes actionable recommendations
```

**Delivery Layer:**
```
AI-generated report → Email template
  ↓
Sent via Resend API
  ↓
Delivered to Eric (Monday morning)
```

### AI Assistant Features

**Persistent Memory:**
- Previous reports sent (what insights were highlighted)
- Eric's responses/questions (if he replies)
- Actions taken (which ads were scaled)
- Performance trends (week-over-week context)

**Context Awareness:**
- Company goals ($1M/month revenue)
- Current phase (30-day holding pattern)
- Historical context (Phase 1, 2, 3)
- Emotional themes (Overwhelm to Relief wins)

**Adaptive Messaging:**
- If qualify rate drops, contextualizes it
- If ROAS improves, celebrates it
- If new pattern emerges, calls it out
- If conversion window hits, shifts focus to revenue

---

## Implementation Options

### Option 1: Make.com Workflow
**Pros:**
- Visual workflow builder
- Built-in scheduling
- Easy to modify flow
- Can integrate with Resend API

**Cons:**
- Limited AI capabilities (would need external API)
- Less sophisticated memory/context

**Flow:**
```
Make.com Scheduler (Monday 8am)
  → Supabase API (fetch data)
  → OpenAI API (generate report with prompt)
  → Resend API (send email)
```

### Option 2: Vercel Cron + OpenAI Assistant
**Pros:**
- Native TypeScript/Next.js
- OpenAI Assistants API has persistent memory
- Full control over logic
- Can use threads for conversation history

**Cons:**
- More code to maintain
- Requires API route setup

**Flow:**
```
Vercel Cron (/api/cron/weekly-report)
  → Query Supabase (analytics data)
  → OpenAI Assistant API (with thread/memory)
  → Format HTML email
  → Resend API (send)
```

### Option 3: GitHub Actions + Custom Script
**Pros:**
- Free tier covers weekly execution
- Version control for scripts
- Can run any Node.js code

**Cons:**
- Less visual than Make.com
- Need to handle secrets carefully

**Flow:**
```
GitHub Actions (schedule: cron)
  → Node script (fetch + analyze data)
  → OpenAI API (generate report)
  → Resend API (send email)
```

---

## Recommended Approach

**Phase 1 (Current): Manual Refinement**
- Run reports manually for 4 weeks
- Nail the messaging, format, insights
- Validate data accuracy
- Build Eric's trust

**Phase 2 (Next): Semi-Automated**
- Build Make.com workflow
- Auto-fetch data, but human reviews before sending
- Test AI-generated insights against manual ones
- Iterate on prompts

**Phase 3 (Future): Full Automation**
- Deploy OpenAI Assistant with persistent memory
- Set up Vercel cron job (or Make.com)
- Monitor first few automated reports
- Transition to fully hands-off

---

## Data Sources for Automation

### Weekly Analytics Query
```sql
-- Lives in: migrations/create_analytics_functions.sql
SELECT * FROM fn_get_weekly_report(
  start_date := CURRENT_DATE - INTERVAL '7 days',
  end_date := CURRENT_DATE
);
```

**Returns:**
- New contacts
- Qualification rates
- Bookings, shows, purchases
- Revenue by source (Stripe, Denefits)
- Ad performance by ID
- Week-over-week changes

### Meta Ads Sync
```bash
node scripts/sync-meta-ads.js
```

**Returns:**
- Latest ad spend (daily snapshots)
- Active ad count
- Creative themes
- New ads launched

### Payment Tracking
```sql
SELECT
  payment_date,
  payment_source,
  amount,
  customer_email
FROM payments
WHERE payment_date >= CURRENT_DATE - INTERVAL '7 days';
```

---

## AI Assistant Prompt Template

**System Prompt:**
```
You are Clara, the ManyChat chatbot and analytics system for Postpartum Care USA.
You send weekly performance reports to Eric (the business owner).

Your tone:
- Friendly but professional
- Data-driven, not fluffy
- Actionable recommendations only
- Celebrate wins, contextualize drops

Your memory:
- Previous reports sent (what you highlighted last week)
- Company context (Phase 1, 2, 3 journey)
- Current goals ($1M/month revenue)
- Known patterns (Overwhelm to Relief > Confusion to Clarity)

This week's data:
{JSON_DATA_HERE}

Previous week's data:
{PREVIOUS_WEEK_JSON}

Generate a report following this structure:
1. Executive Summary (what's working, what changed)
2. Top Performing Ads (with creative insights)
3. What We're Learning (insights from data)
4. Action Items (specific, measurable recommendations)
5. Bottom Line (system status, 30-day context)

Keep it concise. Eric doesn't want fluff.
```

---

## Next Steps

1. **This week:** Send 2-3 more manual reports to Eric
2. **Week 2:** Build Make.com prototype (semi-automated)
3. **Week 3:** Test AI-generated vs. manual (compare quality)
4. **Week 4:** Deploy automated system (with human oversight)
5. **Month 2:** Full hands-off automation

---

**Status:** 🟡 Manual (refining the flow Eric likes)
**Timeline:** 4 weeks to full automation
**Owner:** Connor
