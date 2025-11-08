# AI Weekly Reports - Setup Guide

**Status:** Ready to deploy
**Tech:** OpenAI Assistants API + Resend Email
**Cost:** ~$0.10-0.20 per report (GPT-4o)

---

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
npm install openai resend
```

### Step 2: Get API Keys

**OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Create new key (name it "Clara - Weekly Reports")
3. Copy the key (starts with `sk-proj-...`)

**Resend API Key:**
1. Go to https://resend.com/api-keys
2. Create new key (name it "Weekly Reports")
3. Copy the key (starts with `re_...`)

**Verify domain (for Resend):**
1. Go to https://resend.com/domains
2. Add domain: `updates.columnline.com` (or use `onboarding@resend.dev` for testing)
3. Follow DNS setup instructions

### Step 3: Add to .env.local

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# Resend
RESEND_API_KEY=re_YOUR_KEY_HERE

# These will be auto-generated on first run:
# OPENAI_ASSISTANT_ID=asst_...
# OPENAI_THREAD_ID=thread_...
```

### Step 4: Apply Database Migration

```bash
# Apply the reporting memory tables
node scripts/apply-migration.js migrations/20250107_create_reporting_memory_tables.sql
```

Or manually in Supabase SQL Editor:
- Copy contents of `migrations/20250107_create_reporting_memory_tables.sql`
- Paste into SQL Editor
- Run

### Step 5: Run Your First Report

```bash
# Generate report for last week (auto-detects last Sunday)
node scripts/weekly-report-ai.js

# Or specify a week ending date
node scripts/weekly-report-ai.js 2025-11-07
```

**First run will:**
1. Create OpenAI Assistant ("Clara")
2. Create conversation thread (for memory)
3. Print assistant ID and thread ID
4. Generate the report
5. Email it to connor@columnline.com

**Important:** Copy the assistant ID and thread ID to your `.env.local`:
```bash
OPENAI_ASSISTANT_ID=asst_abc123...
OPENAI_THREAD_ID=thread_xyz789...
```

---

## 📧 How It Works

### Architecture

```
Weekly Script Runs
  ↓
Fetch data from Supabase
  ↓
Send to OpenAI Assistant (Clara)
  ↓
Clara generates report (with memory from thread)
  ↓
Email via Resend
  ↓
Done!
```

### The AI Assistant

**Name:** Clara - Postpartum Care USA Analytics

**Instructions:** (see `scripts/weekly-report-ai.js` for full prompt)
- Tone: Friendly but professional
- Structure: 7-section report
- Memory: Persistent via thread (remembers previous reports)
- Context: Knows Phase 1/2/3, 30-day holding pattern, "Overwhelm to Relief" wins

**Model:** GPT-4o (fast, high quality, $0.01/1K tokens)

### Persistent Memory

**How it works:**
- Each run adds to the same thread
- Thread stores all previous reports
- Clara can reference "last week I recommended X"
- Clara knows if recommendations were followed

**Example conversation:**
```
Week 1:
User: [Week 1 data]
Clara: "Ad ...200652 is winning. Recommendation: Scale this ad."

Week 2:
User: [Week 2 data, includes note about scaling Ad ...200652]
Clara: "Last week I recommended scaling Ad ...200652. You did - here's
       what happened: Volume +107%, qualify rate dropped 5.6% (expected).
       Continue scaling."

Week 3:
User: [Week 3 data]
Clara: "Ad ...200652 continues to perform well after scaling. New insight:
       Ad ...450652 launched with even better quality (91.7%)..."
```

---

## 🔧 Customization

### Change Email Recipient

Edit `scripts/weekly-report-ai.js`:
```javascript
to: ['connor@columnline.com'], // Change this
```

To email Eric directly:
```javascript
to: ['eric@postpartumcareusa.com'],
```

Or email both:
```javascript
to: ['connor@columnline.com', 'eric@postpartumcareusa.com'],
```

### Change Email From Address

Edit `scripts/weekly-report-ai.js`:
```javascript
from: 'Clara <clara@updates.columnline.com>', // Change this
```

**Note:** Must use verified domain in Resend, or use `onboarding@resend.dev` for testing.

### Adjust Report Tone

Edit the assistant instructions in `scripts/weekly-report-ai.js`:
```javascript
instructions: `You are Clara...

TONE & STYLE:
- Friendly but professional  // ← Change this
- Data-driven, not fluffy
- ...`
```

### Add Weekly Snapshot Saving

After report is generated, save to database:
```javascript
// At end of main() function
const { saveWeeklySnapshot } = require('./save-weekly-snapshot');

await saveWeeklySnapshot(weekEnding, {
  contacts: weekData.metrics.totalContacts,
  qualified: weekData.metrics.dmQualified,
  qualifyRate: weekData.metrics.qualifyRate,
  revenue: weekData.metrics.totalRevenue,
  spend: weekData.metrics.totalSpend,
  roas: weekData.metrics.roas,
  topAdByVolume: weekData.topAds[0]?.adId,
  topAdByQuality: weekData.topAds.sort((a,b) => b.qualifyRate - a.qualifyRate)[0]?.adId
}, [
  'Scale top performing ad',
  'Test new "Overwhelm to Relief" variant',
  // ... extracted from report
]);
```

---

## 🤖 Automation Options

### Option 1: Manual (Current)

```bash
# Run every Monday morning
node scripts/weekly-report-ai.js
```

**Pros:** Simple, full control
**Cons:** Have to remember to run it

### Option 2: Cron Job (Mac/Linux)

```bash
# Edit crontab
crontab -e

# Add line (runs every Monday at 8am)
0 8 * * 1 cd /Users/connorjohnson/CLAUDE_CODE/MCB && node scripts/weekly-report-ai.js
```

**Pros:** Fully automated
**Cons:** Computer must be on

### Option 3: Vercel Cron (Recommended)

Create `/app/api/cron/weekly-report/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run the script
    const { stdout, stderr } = await execAsync('node scripts/weekly-report-ai.js');

    return NextResponse.json({
      success: true,
      output: stdout
    });

  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}
```

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 8 * * 1"
    }
  ]
}
```

**Pros:** No computer needed, runs in cloud
**Cons:** Requires Vercel Pro ($20/month)

### Option 4: Make.com (Easiest)

1. Create new scenario in Make.com
2. **Trigger:** Schedule (every Monday 8am)
3. **Module:** HTTP Request
   - URL: `https://mcb-dun.vercel.app/api/cron/weekly-report`
   - Method: GET
   - Headers: `Authorization: Bearer YOUR_CRON_SECRET`
4. Save & activate

**Pros:** Visual, easy to modify, reliable
**Cons:** Need Make.com account (free tier works)

---

## 📊 Testing

### Test with Sample Data

```bash
# Generate report for Nov 7 (week we have data for)
node scripts/weekly-report-ai.js 2025-11-07
```

**Expected output:**
```
🚀 Weekly Report AI - Starting...

🤖 Setting up Clara (OpenAI Assistant)...
✅ Found existing assistant: Clara - Postpartum Care USA Analytics

🧵 Setting up conversation thread...
✅ Found existing thread: thread_abc123

📊 Fetching analytics for week ending 2025-11-07...
✅ Data fetched

✍️  Generating report with Clara...
✅ Report generated

📧 Sending email...
✅ Email sent: re_xyz789

✅ COMPLETE - Report generated and sent!

📄 REPORT PREVIEW:
────────────────────────────────────────────────────────────────
[Report content here]
────────────────────────────────────────────────────────────────
```

### Verify Email

Check your inbox at connor@columnline.com:
- Subject: "Weekly Analytics Report - Week Ending 2025-11-07"
- From: "Clara <clara@updates.columnline.com>"
- Content: Full report in plain text + HTML

---

## 💰 Cost Breakdown

**Per Report:**
- OpenAI API: ~$0.10-0.20 (GPT-4o, ~10K tokens)
- Resend: Free (up to 3,000 emails/month)
- Total: **~$0.10-0.20 per week**

**Monthly cost:** ~$0.40-0.80 (4 reports)
**Annual cost:** ~$5-10

**Extremely cheap** for automated, context-aware reporting.

---

## 🐛 Troubleshooting

### Error: "OPENAI_API_KEY not found"
Add to `.env.local`:
```bash
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
```

### Error: "RESEND_API_KEY not found"
Add to `.env.local`:
```bash
RESEND_API_KEY=re_YOUR_KEY_HERE
```

### Error: "Failed to send email"
**Cause:** Domain not verified in Resend
**Fix:** Use `onboarding@resend.dev` as from address for testing, or verify domain

### Error: "Assistant not found"
**Cause:** Assistant ID in .env.local doesn't exist
**Fix:** Remove `OPENAI_ASSISTANT_ID` from .env.local, let script create new one

### Report is too generic / missing context
**Cause:** First run - thread has no memory yet
**Fix:** Run 2-3 weeks, memory will build up

### Report doesn't compare to last week
**Cause:** No `weekly_snapshots` record from previous week
**Fix:** Manually save previous week's snapshot using `save-weekly-snapshot.js`

---

## 🚀 Next Steps

1. ✅ Install dependencies (`npm install openai resend`)
2. ✅ Add API keys to `.env.local`
3. ✅ Run first report (`node scripts/weekly-report-ai.js 2025-11-07`)
4. ✅ Check email
5. ✅ Add assistant ID & thread ID to `.env.local`
6. ✅ Set up automation (cron, Vercel, or Make.com)
7. ✅ Run weekly for 4 weeks to build memory
8. ✅ Adjust tone/style as needed

**You're done! Clara will now write weekly reports with persistent memory.**
