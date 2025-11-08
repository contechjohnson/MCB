# Weekly Report Automation - Deployment Checklist

**Status:** ✅ Code Complete - Ready for Setup
**Architecture:** Vercel API → Make.com → OpenAI Assistant → Email

---

## 📋 What's Already Done

✅ API endpoint built: `/app/api/reports/weekly-data/route.ts`
✅ Assistant instructions written (ready to paste)
✅ Make.com scenario documented (6 modules)
✅ Dependencies installed (`openai`, `resend`)
✅ Documentation complete

**What's needed:** Just setup and configuration (no more coding!)

---

## 🚀 Deployment Steps (Do These)

### Step 1: Get API Keys

**OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Name: "Clara - Weekly Reports"
4. Copy the key (starts with `sk-proj-...`)
5. Save it somewhere safe

**Resend API Key (Optional - only if using email directly):**
1. Go to https://resend.com/api-keys
2. Create new key: "Weekly Reports"
3. Copy the key (starts with `re_...`)

**Note:** If using Make.com's built-in email, you don't need Resend.

---

### Step 2: Create OpenAI Assistant in UI

**Do this in OpenAI UI (not in code):**

1. Go to https://platform.openai.com/assistants
2. Click "Create"
3. Fill in:
   - **Name:** `Clara - Postpartum Care USA Analytics`
   - **Model:** `gpt-4o`
   - **Instructions:** Copy from below

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

4. Click "Save"
5. **Copy the Assistant ID** (looks like `asst_abc123...`)
6. Keep this ID handy

---

### Step 3: Create Thread (One-Time Setup)

**Option A: Using curl (easiest)**

```bash
curl https://api.openai.com/v1/threads \
  -H "Authorization: Bearer sk-proj-YOUR_OPENAI_KEY_HERE" \
  -H "Content-Type: application/json" \
  -H "OpenAI-Beta: assistants=v2" \
  -d '{}'
```

**Option B: In Make.com**
- Add an OpenAI "Create Thread" module
- Run once
- Copy the Thread ID from output

**Save the Thread ID** (looks like `thread_xyz789...`)

---

### Step 4: Generate CRON_SECRET

**Create a random secret string:**

```bash
# Mac/Linux - run this in terminal:
openssl rand -hex 32

# Or just make up a long random string:
# Example: my-super-secret-webhook-key-2025
```

**Save this secret** - you'll use it in both Make.com and Vercel.

---

### Step 5: Add Environment Variables to Vercel

1. Go to https://vercel.com/dashboard
2. Select your project (mcb-dun)
3. Go to Settings → Environment Variables
4. Add:
   - **Name:** `CRON_SECRET`
   - **Value:** [Your random secret from Step 4]
   - **Environment:** Production, Preview, Development (check all)

5. Click "Save"

**Note:** Don't need to add OpenAI/Resend keys to Vercel if Make.com handles the AI/email.

---

### Step 6: Build Make.com Scenario

**Create new scenario:**

1. **Trigger: Schedule**
   - Schedule type: Every Monday
   - Time: 8:00 AM
   - Timezone: Your timezone

2. **Module 1: HTTP - Make a Request**
   - Method: `GET`
   - URL: `https://mcb-dun.vercel.app/api/reports/weekly-data`
   - Query String:
     - Key: `week_ending`
     - Value: `{{formatDate(now; "YYYY-MM-DD")}}`
   - Headers:
     - Key: `Authorization`
     - Value: `Bearer YOUR_CRON_SECRET_HERE`

3. **Module 2: OpenAI - Create a Message**
   - Connection: [Your OpenAI connection]
   - Thread ID: `thread_xyz789...` (from Step 3)
   - Role: `User`
   - Message Content:
   ```
   Generate this week's report for Eric.

   Week Ending: {{1.week_ending}}

   This Week's Data:
   {{1.data}}
   ```

4. **Module 3: OpenAI - Run an Assistant**
   - Connection: [Your OpenAI connection]
   - Thread ID: `thread_xyz789...` (same as above)
   - Assistant ID: `asst_abc123...` (from Step 2)

5. **Module 4: OpenAI - Retrieve a Run**
   - Connection: [Your OpenAI connection]
   - Thread ID: `thread_xyz789...`
   - Run ID: `{{3.id}}`
   - Wait for completion: `Yes`
   - Max wait time: `60 seconds`

6. **Module 5: OpenAI - List Messages**
   - Connection: [Your OpenAI connection]
   - Thread ID: `thread_xyz789...`
   - Limit: `1`
   - Order: `Descending`

7. **Module 6: Email - Send an Email**
   - To: `connor@columnline.com` (test first)
   - From: `Clara <clara@postpartumcareusa.com>` (or your verified email)
   - Subject: `Weekly Analytics Report - Week Ending {{1.week_ending}}`
   - Content Type: `Text`
   - Content:
   ```
   {{5.data[1].content[1].text.value}}
   ```

8. **Save scenario**
9. **Name it:** "Weekly Analytics Report - Automated"

---

### Step 7: Test the Flow

**In Make.com:**
1. Click "Run once" button
2. Watch each module execute
3. Check for errors
4. Verify email was received

**If it works:**
- ✅ Check your inbox (connor@columnline.com)
- ✅ Review the report content
- ✅ Verify it includes metrics, top ads, insights

**If it fails:**
- Check Make.com execution log
- Verify CRON_SECRET matches in both places
- Verify Assistant ID and Thread ID are correct
- Check Vercel deployment logs

---

### Step 8: Switch to Production

**Once tested successfully:**

1. **Change email recipient** in Make.com Module 6:
   - From: `connor@columnline.com`
   - To: `eric@postpartumcareusa.com`
   - Or CC both: `connor@columnline.com, eric@postpartumcareusa.com`

2. **Activate the schedule:**
   - In Make.com scenario settings
   - Turn ON scheduling
   - Confirm: Every Monday at 8:00 AM

3. **Done!** 🎉

---

## 🧪 Testing the API Endpoint Directly

**Test without Make.com:**

```bash
# Replace YOUR_SECRET with your actual CRON_SECRET
curl -H "Authorization: Bearer YOUR_SECRET" \
  "https://mcb-dun.vercel.app/api/reports/weekly-data?week_ending=2025-11-07"
```

**Expected response:**
```json
{
  "week_ending": "2025-11-07",
  "date_range": "2025-11-01 to 2025-11-07",
  "metrics": {
    "total_contacts": 188,
    "dm_qualified": 106,
    "qualify_rate": 56.4,
    ...
  },
  "top_ads": [ ... ],
  "payments": { ... },
  "comparison": { ... }
}
```

---

## 🔮 What Happens Week-to-Week

**Week 1 (First Run):**
- Make.com fetches data from Vercel API
- OpenAI Assistant sees: "This is the first week!"
- Generates baseline report
- Email sent
- Thread now has Week 1 context stored

**Week 2:**
- Make.com fetches new week's data
- OpenAI Assistant sees previous week in thread
- Generates report: "Last week I recommended X, this week Y happened..."
- Compares metrics automatically (from thread memory)
- Email sent
- Thread now has Week 1 + Week 2 context

**Week 3+:**
- Memory compounds
- Assistant tracks patterns across weeks
- References specific ads from previous weeks
- Tracks if recommendations were followed
- Builds deeper insights over time

---

## 💡 Future Enhancements (Easy Adds in Make.com)

**No code needed - just add modules:**

1. **Slack notification:**
   - Add Slack module after email
   - Post to #analytics channel
   - Include top 3 insights

2. **SMS alert (if ROAS drops):**
   - Add Twilio module
   - Add filter: Only if ROAS < 2.0
   - Send SMS to Eric

3. **Save to Notion:**
   - Add Notion "Create Page" module
   - Store report for easy history review

4. **A/B test tracking:**
   - Query `ab_tests` table in Supabase
   - Include running tests in report
   - Remind when tests are complete

---

## 🐛 Troubleshooting

### Error: "Unauthorized" (401)
**Cause:** CRON_SECRET doesn't match
**Fix:** Verify secret matches in:
- Make.com HTTP module header
- Vercel environment variables

### Error: "Assistant not found"
**Cause:** Wrong Assistant ID
**Fix:** Copy correct ID from OpenAI UI → Assistants

### Error: "Thread not found"
**Cause:** Thread ID is wrong or deleted
**Fix:** Create new thread (Step 3), update Make.com modules

### Report is too generic
**Cause:** First run - no memory yet
**Fix:** Run 2-3 weeks to build context

### No email received
**Cause:** Email module misconfigured
**Fix:** Check Make.com execution log, verify email address

### API returns empty data
**Cause:** No contacts/payments for that week
**Fix:** Normal if testing with old dates - try current week

---

## 📝 Quick Reference

**API Endpoint:**
```
GET https://mcb-dun.vercel.app/api/reports/weekly-data?week_ending=YYYY-MM-DD
Authorization: Bearer YOUR_CRON_SECRET
```

**IDs You'll Need:**
- ✅ OpenAI API Key: `sk-proj-...`
- ✅ Assistant ID: `asst_...`
- ✅ Thread ID: `thread_...`
- ✅ CRON_SECRET: [Your random string]

**Make.com Scenario:**
- 6 modules total
- Runs every Monday 8am
- Fetches data → AI generates report → Email sent

---

## ✅ Final Checklist

- [ ] Get OpenAI API key
- [ ] Create assistant in OpenAI UI
- [ ] Copy Assistant ID
- [ ] Create thread (curl or Make.com)
- [ ] Copy Thread ID
- [ ] Generate CRON_SECRET
- [ ] Add CRON_SECRET to Vercel
- [ ] Build Make.com scenario (6 modules)
- [ ] Test: Run Make.com once
- [ ] Verify email received
- [ ] Review report quality
- [ ] Change email to Eric
- [ ] Activate Monday 8am schedule

---

**Once complete, you'll have:**
- ✅ Fully automated weekly reports
- ✅ AI with persistent memory (tracks recommendations)
- ✅ Week-over-week comparisons
- ✅ Top ad insights with creative analysis
- ✅ Sent to Eric every Monday morning
- ✅ Easy to modify in Make.com UI

**Cost:** ~$0.10-0.20 per week (~$0.80/month)

🎉 **You're all set!**
