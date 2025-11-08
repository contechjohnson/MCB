# AI Weekly Reports - Quick Start Card

**Goal:** Automate weekly analytics reports with AI memory

**Time to Setup:** ~30 minutes
**Cost:** ~$0.15/week (~$8/year)

---

## ✅ What You Need

1. OpenAI API key (https://platform.openai.com/api-keys)
2. Make.com account (free tier works)
3. CRON_SECRET (random string for security)

---

## 🚀 5-Step Setup

### Step 1: Create OpenAI Assistant (5 min)
1. Go to https://platform.openai.com/assistants
2. Click "Create"
3. Name: `Clara - Postpartum Care USA Analytics`
4. Model: `gpt-4o`
5. Instructions: Copy from `WEEKLY_REPORT_DEPLOYMENT.md` line 93-151
6. Save → **Copy Assistant ID** (starts with `asst_`)

### Step 2: Create Thread (1 min)
```bash
curl https://api.openai.com/v1/threads \
  -H "Authorization: Bearer sk-proj-YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "OpenAI-Beta: assistants=v2" \
  -d '{}'
```
**Copy Thread ID** (starts with `thread_`)

### Step 3: Generate Secret (1 min)
```bash
openssl rand -hex 32
```
**Copy this secret** - use in both Make.com and Vercel

### Step 4: Add to Vercel (2 min)
1. Go to https://vercel.com/dashboard
2. Project → Settings → Environment Variables
3. Add: `CRON_SECRET` = [your secret from Step 3]

### Step 5: Build Make.com Scenario (20 min)
Create 6 modules:
1. **Schedule:** Every Monday 8am
2. **HTTP Request:** GET `/api/reports/weekly-data`
3. **OpenAI - Create Message**
4. **OpenAI - Run Assistant**
5. **OpenAI - Wait for Completion**
6. **OpenAI - Get Messages**
7. **Email:** Send report

**Full details:** See `WEEKLY_REPORT_DEPLOYMENT.md` lines 158-199

---

## 🧪 Test It

**In Make.com:**
1. Click "Run once"
2. Check each module for errors
3. Verify email received

**If it works:**
- ✅ Change recipient to Eric
- ✅ Activate Monday schedule
- ✅ Done!

---

## 📖 Full Documentation

**Quick Setup:** `WEEKLY_REPORT_DEPLOYMENT.md`
**System Overview:** `AI_REPORTING_SYSTEM_OVERVIEW.md`
**Architecture Details:** `WEBHOOK_REPORT_FLOW.md`

---

## 🎯 What You Get

Every Monday at 8am:
- ✅ Week-over-week metrics comparison
- ✅ Top performing ads with creative insights
- ✅ Specific recommendations (not generic advice)
- ✅ AI remembers previous weeks and tracks if you followed advice
- ✅ Pattern recognition across weeks
- ✅ Actionable insights (2-5 items max)

**Memory compounds week after week!**

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Unauthorized" 401 | CRON_SECRET mismatch - check Vercel & Make.com |
| No email | Check Make.com logs, verify email address |
| Report too generic | First run - memory builds after 2-3 weeks |
| Missing creative data | Run `node scripts/sync-meta-ads.js` |

---

## 💰 Cost

- OpenAI: $0.10-0.20/week
- Make.com: Free (under 1,000 ops/month)
- Vercel: Free
- **Total: ~$8/year**

---

## 🔑 IDs You'll Need

Save these after setup:

```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_ASSISTANT_ID=asst_...
OPENAI_THREAD_ID=thread_...
CRON_SECRET=[random string]
```

---

**Ready? Start with `WEEKLY_REPORT_DEPLOYMENT.md`**
