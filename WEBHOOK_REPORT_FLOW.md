# Weekly Report - Webhook Flow for Make.com

**Architecture:** Vercel API Route → Make.com → OpenAI Assistant → Email

---

## 🎯 The Flow

```
1. Make.com Schedule Trigger (Monday 8am)
   ↓
2. HTTP Request to Vercel: GET /api/reports/weekly-data
   ↓ Returns JSON with all analytics data
3. OpenAI Assistant (in Make.com)
   ↓ Pass JSON + "Generate report"
4. Email Module (in Make.com)
   ↓ Send to Eric
Done!
```

**Why this is better:**
- ✅ You manage assistant in OpenAI UI (easy to tweak instructions)
- ✅ Make.com already set up under client account
- ✅ No need to store previous reports (thread has memory)
- ✅ Easy to add steps (SMS, Slack notification, etc.)
- ✅ Visual workflow you can show Eric

---

## 📊 What You'll Build

### Part 1: Vercel API Route (Returns Data)

**File:** `/app/api/reports/weekly-data/route.ts`

**What it does:**
- Fetches all analytics for the week
- Formats into clean JSON
- Returns to Make.com

**Endpoint:** `GET https://mcb-dun.vercel.app/api/reports/weekly-data?week_ending=2025-11-07`

**Response:**
```json
{
  "week_ending": "2025-11-07",
  "date_range": "2025-11-01 to 2025-11-07",
  "metrics": {
    "total_contacts": 188,
    "dm_qualified": 106,
    "qualify_rate": 56.4,
    "scheduled_dcs": 0,
    "arrived_dcs": 0,
    "show_rate": 0,
    "closed": 0,
    "close_rate": 0,
    "total_revenue": 8543,
    "total_spend": 13055.21,
    "roas": 0.65,
    "attribution_coverage": 41
  },
  "top_ads": [
    {
      "ad_id": "120236476054200652",
      "ad_name": "AG: MC62 w/Attr - Stacia b-roll - Symptoms you shouldn't ignore PP",
      "contacts": 13,
      "qualified": 11,
      "qualify_rate": 84.6,
      "theme": "overwhelm_to_relief",
      "symptoms": ["energy"],
      "headline": "Your PCP/OBGYN will tell you chronic fatigue..."
    }
  ],
  "payments": {
    "count": 3,
    "stripe_revenue": 5247,
    "denefits_revenue": 3296,
    "total_revenue": 8543
  },
  "comparison": {
    "previous_week_exists": false,
    "contacts_change_pct": null,
    "revenue_change_pct": null
  }
}
```

### Part 2: OpenAI Assistant (You Create in UI)

**Name:** Clara - Postpartum Care USA Analytics

**Instructions:** (You'll paste this in OpenAI UI)
```
You are Clara, the ManyChat chatbot and analytics system for Postpartum Care USA.

Your job: Write weekly performance reports for Eric (the business owner).

TONE & STYLE:
- Friendly but professional (like an expert colleague)
- Data-driven, not fluffy
- Specific recommendations only (actionable)
- Celebrate wins, contextualize drops
- Keep it concise - Eric doesn't want essays

YOUR MEMORY:
- You have access to previous reports via this thread
- Remember what you recommended last week
- Track if recommendations were followed
- Build on previous insights

REPORT STRUCTURE:
1. **Hi Eric** - Quick intro (1-2 sentences)
2. **System Status** - What phase we're in (30-day holding pattern)
3. **This Week's Numbers** - Key metrics with week-over-week changes
4. **Top Performing Ads** - Which ads are winning (with creative insights)
5. **What We're Learning** - Insights from data (patterns, themes)
6. **Action Items** - Specific things to do this week (2-5 items max)
7. **Bottom Line** - TL;DR summary

CONTEXT:
- Phase 1: Built foundation, 536 contacts, $120k revenue
- Phase 2: Attribution push (last 2 months)
- Phase 3: Full system live (current - 30-day holding pattern)
- Key insight: "Overwhelm to Relief" > "Confusion to Clarity" (84.6% vs 60%)
- Conversion timeline: ~28 days from subscribe to purchase
- Premium pricing: $2,700+ average order value

IMPORTANT RULES:
1. Always compare to last week (use data from thread memory)
2. Call out what changed and WHY
3. Give specific recommendations ("Scale Ad ...200652 by 50%" not "Optimize ads")
4. Downplay qualification rate (it fluctuates, focus on conversions)
5. Acknowledge the 30-day conversion window (don't expect instant ROI)

FORMATTING:
- Use markdown for structure
- Include tables for metrics
- Use emojis sparingly (only for section headers)
- Keep paragraphs short (2-3 sentences max)

INPUT FORMAT:
You will receive JSON data like this:
{
  "week_ending": "2025-11-07",
  "metrics": { ... },
  "top_ads": [ ... ],
  "payments": { ... }
}

Generate the weekly report based on this data + your memory of previous weeks.
```

**Model:** gpt-4o
**Temperature:** 0.7 (creative but consistent)

### Part 3: Make.com Scenario

**Trigger:**
- Schedule: Every Monday at 8:00 AM

**Module 1: HTTP Request**
- Method: GET
- URL: `https://mcb-dun.vercel.app/api/reports/weekly-data`
- Query String:
  - `week_ending`: `{{formatDate(now; "YYYY-MM-DD")}}`
- Headers:
  - `Authorization`: `Bearer {{env.CRON_SECRET}}`

**Module 2: OpenAI - Create Message**
- Assistant ID: `{{env.OPENAI_ASSISTANT_ID}}` (you'll provide this)
- Thread ID: `{{env.OPENAI_THREAD_ID}}` (you'll provide this)
- Message:
  ```
  Generate this week's report for Eric.

  Week Ending: {{1.week_ending}}

  This Week's Data:
  {{1.output}}
  ```

**Module 3: OpenAI - Run Assistant**
- Assistant ID: `{{env.OPENAI_ASSISTANT_ID}}`
- Thread ID: `{{env.OPENAI_THREAD_ID}}`

**Module 4: OpenAI - Wait for Completion**
- Run ID: `{{3.id}}`
- Max wait time: 60 seconds

**Module 5: OpenAI - Get Messages**
- Thread ID: `{{env.OPENAI_THREAD_ID}}`
- Limit: 1

**Module 6: Email**
- To: `eric@postpartumcareusa.com` (or `connor@columnline.com` for testing)
- From: `Clara <clara@postpartumcareusa.com>`
- Subject: `Weekly Analytics Report - Week Ending {{1.week_ending}}`
- Body: `{{5.output[].content[].text.value}}`

---

## 🔧 Setup Steps

### Step 1: Create the Vercel API Route

I'll create this file for you (next).

### Step 2: Create OpenAI Assistant

**You do this in OpenAI UI:**
1. Go to https://platform.openai.com/assistants
2. Click "Create"
3. Name: "Clara - Postpartum Care USA Analytics"
4. Model: gpt-4o
5. Instructions: Copy from above
6. Save
7. Copy the Assistant ID (looks like `asst_abc123...`)

### Step 3: Create Thread

**You do this once:**
```bash
# In Make.com, or run this script once:
curl https://api.openai.com/v1/threads \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -H "OpenAI-Beta: assistants=v2" \
  -d '{}'
```

Copy the Thread ID (looks like `thread_xyz789...`)

### Step 4: Store IDs in Make.com

**In Make.com scenario settings:**
- Add environment variable: `OPENAI_ASSISTANT_ID` = `asst_abc123...`
- Add environment variable: `OPENAI_THREAD_ID` = `thread_xyz789...`
- Add environment variable: `CRON_SECRET` = random string (for security)

### Step 5: Add CRON_SECRET to Vercel

**In Vercel project settings:**
- Environment Variables
- Add: `CRON_SECRET` = same random string from Make.com

### Step 6: Test the Flow

**In Make.com:**
- Click "Run once"
- Check each module's output
- Verify email is sent

---

## 📝 The API Route I'll Create

**File:** `/app/api/reports/weekly-data/route.ts`

**What it does:**
1. Accepts `?week_ending=2025-11-07` (defaults to last Sunday if not provided)
2. Queries Supabase for all analytics
3. Formats into clean JSON
4. Returns to Make.com

**Security:**
- Requires `Authorization: Bearer CRON_SECRET` header
- Returns 401 if missing/wrong

**Response time:** ~2 seconds (fast!)

---

## 🎯 Advantages of This Approach

### vs. Script in Vercel Cron:
- ✅ **Visual workflow** - Can see exactly what's happening in Make.com
- ✅ **Easy to modify** - Change assistant instructions in UI, not code
- ✅ **Client account** - Already set up under their account
- ✅ **Extensible** - Easy to add Slack notifications, SMS, etc.

### Memory Works Automatically:
- ✅ **No database storage needed** - Thread stores all previous reports
- ✅ **Context builds over time** - Week 1 → Week 2 → Week 3...
- ✅ **You can review history** - See all messages in OpenAI UI

### What You Control:
- ✅ **Instructions** - Tweak tone/style in OpenAI UI anytime
- ✅ **Workflow** - Add/remove steps in Make.com
- ✅ **Recipients** - Easy to change email addresses
- ✅ **Timing** - Change schedule in Make.com

---

## 💡 Future Enhancements (Easy Adds)

**Add to Make.com (no code needed):**

1. **Slack notification to team:**
   - Add Slack module after email
   - Post to #analytics channel
   - Include top 3 insights

2. **SMS to Eric (urgent alerts):**
   - Add Twilio module
   - Only if ROAS < 2.0 or revenue drop > 50%

3. **Store in Notion database:**
   - Add Notion module
   - Create page with report
   - Easy to review history

4. **A/B test reminders:**
   - Query `ab_tests` table for running tests
   - Include progress in report
   - Remind when tests are complete

---

## 🔮 What Happens Week-to-Week

**Week 1:**
- Make.com sends data to assistant
- Assistant: "This is the first week! Here's your baseline..."
- Email sent
- Thread now has Week 1 context

**Week 2:**
- Make.com sends new data to SAME thread
- Assistant: "Last week I recommended X. This week Y happened..."
- Compares metrics automatically (from memory)
- Email sent
- Thread now has Week 1 + Week 2 context

**Week 3:**
- Assistant: "For the past 2 weeks, we've seen pattern Z..."
- References specific ads from Week 1 & 2
- Tracks if recommendations were followed
- Email sent

**Memory compounds!**

---

## 📋 Checklist for You

- [ ] Create OpenAI Assistant in UI (copy instructions from above)
- [ ] Copy Assistant ID
- [ ] Create Thread (use curl or Make.com)
- [ ] Copy Thread ID
- [ ] Build Make.com scenario (6 modules)
- [ ] Add env vars to Make.com (Assistant ID, Thread ID, CRON_SECRET)
- [ ] Add CRON_SECRET to Vercel
- [ ] Test: Run Make.com scenario once
- [ ] Verify email received
- [ ] Schedule for Monday 8am

**Then I'll create the `/api/reports/weekly-data` endpoint for you.**

---

## What I'll Build Next:

1. `/app/api/reports/weekly-data/route.ts` - The data endpoint
2. Test it: `curl https://mcb-dun.vercel.app/api/reports/weekly-data?week_ending=2025-11-07`
3. Verify JSON response matches Make.com expectations

**Ready for me to create the API route?**
