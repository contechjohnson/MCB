# Analytics System Guide

**Postpartum Care USA - Advanced Analytics System**

This guide explains how to use, interpret, and maintain the automated weekly analytics reporting system.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Understanding Your Weekly Report](#understanding-your-weekly-report)
3. [Key Metrics Explained](#key-metrics-explained)
4. [How to Use the System](#how-to-use-the-system)
5. [Interpreting Insights](#interpreting-insights)
6. [Troubleshooting](#troubleshooting)
7. [Configuration](#configuration)

---

## Quick Start

### What This System Does

The analytics system automatically:
- ✅ Collects data from ManyChat, GoHighLevel, Stripe, and Denefits
- ✅ Analyzes customer journey performance every week
- ✅ Generates comprehensive reports with charts
- ✅ Emails reports every Friday at 9am PST
- ✅ Tracks week-over-week changes

### Your Weekly Report Contains:

1. **Executive Summary** - High-level numbers at a glance
2. **Funnel Performance** - Where contacts drop off
3. **Revenue Breakdown** - Stripe vs Denefits, Buy-in-Full vs BNPL
4. **Attribution** - Which sources perform best
5. **Data Quality** - System health and data completeness
6. **Week-over-Week Trends** - How you're performing vs last week

---

## Understanding Your Weekly Report

### 📊 Executive Summary

**What you see:**
```
Total Contacts: 42 ↑ 8 (23.5% vs last week)
Total Revenue: $12,450.00 ↑ $3,200.00 (34.6% vs last week)
New Customers: 6 ↑ 2 (50.0% vs last week)
Avg Order Value: $2,075.00 ↓ $125.00 (-5.7% vs last week)
```

**What it means:**
- **Arrows**: ↑ (up/good), ↓ (down/needs attention), → (flat/stable)
- **Numbers in parentheses**: Percentage change from last week
- **Green numbers**: Positive changes
- **Red numbers**: Negative changes
- **Yellow numbers**: Flat/no change

**Key questions to ask:**
- Are contacts growing week-over-week?
- Is revenue trending upward?
- Is AOV stable or improving?
- Do customer numbers match expectations?

---

### 🔄 Funnel Performance

**The Customer Journey Stages:**

```
1. Entered Funnel → Someone subscribed to ManyChat
2. Qualified → Bot conversation completed successfully
3. Form Submitted → Clicked link and filled out form
4. Meeting Booked → Scheduled appointment in GHL
5. Meeting Held → Actually attended the call
6. Purchased → Completed checkout (Stripe or Denefits)
```

**Example Funnel:**
```
Entered Funnel: 100
→ Qualified: 75 (75.0%)
→ Form Submitted: 50 (66.7% of qualified)
→ Meeting Booked: 35 (70.0% of forms)
→ Meeting Held: 28 (80.0% show rate)
→ Purchased: 7 (25.0% close rate)

Overall Conversion: 7.0%
```

**How to interpret:**
- **Qualify Rate (75%)**: Bot conversation effectiveness
  - Low (<60%): Bot may be too aggressive or unclear
  - High (>80%): Good qualification, bot flow working

- **Form Submit Rate (66.7%)**: Link click to form completion
  - Low (<50%): Link not compelling, form too long, or trust issue
  - High (>70%): Strong call-to-action and simple form

- **Booking Rate (70%)**: Form to appointment booked
  - Low (<60%): Calendar integration issue, unclear next steps
  - High (>75%): Smooth scheduling process

- **Show Rate (80%)**: Booked to attended
  - Low (<60%): Poor reminder system, low commitment
  - High (>75%): Good reminders, qualified leads

- **Close Rate (25%)**: Attended to purchased
  - Low (<15%): Sales process needs work, pricing issues
  - High (>30%): Strong sales process, good product-market fit

- **Overall Conversion (7%)**: Entered funnel to purchase
  - Industry benchmark: 3-10% for high-ticket telehealth
  - Goal: Above 5% consistently

**Red flags:**
- Big drops between any two stages (>40% drop-off)
- Show rate below 60% (unqualified leads)
- Close rate below 15% (sales process issue)
- Overall conversion below 3% (systemic problem)

---

### 💰 Revenue Breakdown

**What you see:**
```
Stripe Payments: 4 × $8,300.00
Denefits Payments (BNPL): 2 × $4,150.00

Buy-in-Full: 3 × $6,225.00
BNPL (Financing): 3 × $6,225.00
```

**Key insights:**

1. **Stripe vs Denefits**
   - Stripe = Buy-in-full credit card payments
   - Denefits = Buy Now Pay Later financing
   - Ideal mix: 60-70% Stripe, 30-40% Denefits
   - If Denefits >50%: May signal price sensitivity

2. **Buy-in-Full vs BNPL**
   - Buy-in-Full = Paid entire amount upfront
   - BNPL = Chose payment plan
   - High BNPL %: Price is a barrier (consider pricing strategy)
   - Low BNPL %: Customers can afford it (strong market fit)

3. **Orphan Payments**
   ```
   ⚠️ 2 orphan payments (15%) - payments not linked to contacts
   ```
   - These are payments in Stripe/Denefits but not matched to contacts
   - Causes: Different email used, manual entry, webhook timing
   - Action: Review unmatched payments weekly

**Pricing insights:**
- If AOV is decreasing → More BNPL, or discounts being used
- If AOV is increasing → More buy-in-full, upsells working
- Stable AOV → Consistent package pricing

---

### 📈 Top Performing Sources

**Example table:**
```
Source              Contacts  Customers  Revenue      Conv Rate
ig_story_ad_123     45        8          $16,600.00   17.8%
fb_lead_gen_456     32        3          $6,225.00    9.4%
organic_referral    18        4          $8,300.00    22.2%
```

**How to interpret:**

1. **High Contact, Low Conv Rate**
   - Source brings volume but low quality
   - Action: Adjust targeting, improve ad copy

2. **Low Contact, High Conv Rate**
   - Source brings high-quality leads
   - Action: Scale this source, increase budget

3. **High Contact, High Conv Rate**
   - Winning source - your goldmine
   - Action: Pour more money here, protect this source

4. **Low Contact, Low Conv Rate**
   - Turn off this source
   - Action: Reallocate budget elsewhere

**Attribution notes:**
- `ad_id` comes from URL parameters (`?ad_id=xxx`)
- `source` field shows campaign/channel
- `trigger_word` shows which symptom/keyword they searched
- Organic sources have no `ad_id`

---

### 📊 Data Quality Dashboard

**What you see:**
```
Total Contacts in Database: 746
Historical (Pre-Webhook): 536 (71.8%)
Live (Post-Webhook): 210

ManyChat → GHL Linkage: 31.9%
Contacts with ManyChat ID: 45.2%
Contacts with GHL ID: 78.1%
Contacts with Ad ID: 62.4%
Symptom Data Captured: 38.7%
```

**What it means:**

1. **Historical vs Live**
   - Historical: Old data imported from Airtable (marked with `_historical`)
   - Live: New data from webhooks (clean, real-time)
   - As time goes on, Live % should increase

2. **MC→GHL Linkage (31.9%)**
   - Percentage of contacts that exist in both ManyChat AND GoHighLevel
   - Low linkage means:
     - People qualify in bot but don't book
     - Or, they book directly without bot (referrals)
   - Goal: >50% linkage for paid traffic

3. **Field Completeness**
   - ManyChat ID (45.2%): How many went through bot
   - GHL ID (78.1%): How many are in CRM
   - Ad ID (62.4%): How many came from paid ads
   - Symptom Data (38.7%): How many shared symptoms in bot

4. **Using this data:**
   - Low MC ID but high GHL ID → People booking without bot
   - High MC ID but low GHL ID → Bot working, but not converting to bookings
   - Low Ad ID → Mostly organic traffic (good or bad depending on goals)

---

## Key Metrics Explained

### Revenue Metrics

**Total Revenue**
- All successful payments (Stripe + Denefits)
- Includes buy-in-full and BNPL
- Excludes refunds and failed payments
- Used for: Overall performance tracking

**Average Order Value (AOV)**
- Total revenue ÷ Number of customers
- Industry benchmark: $1,500 - $3,000 for postpartum care
- Tracks: Pricing effectiveness, upsell success
- Watch for: Sudden drops (discounting) or spikes (package changes)

**Revenue by Payment Type**
- Stripe: Credit card payments (usually buy-in-full)
- Denefits: BNPL financing
- Mix indicates: Price sensitivity and affordability

### Conversion Metrics

**Overall Conversion Rate**
- Entered funnel → Purchased
- Your goal: >5%
- Industry average: 3-7% for high-ticket
- Calculated: (Customers ÷ Total Contacts) × 100

**Show Rate**
- Booked meetings → Attended meetings
- Your goal: >70%
- Low show rate means: Unqualified leads or poor reminders
- Calculated: (Attended ÷ Booked) × 100

**Close Rate**
- Attended meetings → Purchased
- Your goal: >20%
- Indicates: Sales effectiveness, price objections
- Calculated: (Purchased ÷ Attended) × 100

### Traffic Metrics

**Total Contacts**
- Everyone who subscribed to ManyChat
- Includes: All sources (paid, organic, referral)
- Growth rate: Should trend upward weekly

**Qualified Contacts**
- Completed bot conversation successfully
- Indicates: Bot effectiveness and lead quality
- Target qualification rate: >70%

**Paid vs Organic**
- Paid: Has `ad_id` field
- Organic: No `ad_id` (referrals, social, search)
- Healthy mix: 70-80% paid, 20-30% organic

---

## How to Use the System

### Automated Reports (Default)

**What happens:**
- Every Friday at 9am PST
- System generates report for previous week (Monday-Sunday)
- Automatically emails to configured recipient
- No action needed on your part

**To change the schedule:**
1. Open `vercel.json`
2. Find the `crons` section
3. Modify the schedule (uses cron format)
   - Current: `"0 17 * * 5"` (5pm UTC = 9am PST on Friday)
   - Daily at 9am: `"0 17 * * *"`
   - Mondays at 8am: `"0 16 * * 1"`

### Manual Reports (Testing)

**Generate report without sending:**
```bash
# From terminal
node scripts/generate-weekly-report.js

# View in terminal output
```

**Generate and save to file:**
```bash
node scripts/generate-weekly-report.js --save

# Creates file in /reports/ folder
```

**Preview HTML email in browser:**
```bash
# Visit this URL (requires authentication)
https://your-app.vercel.app/api/admin/trigger-report?preview=true

# Add this header:
Authorization: Bearer YOUR_ADMIN_SECRET
```

**Send report manually:**
```bash
# Via API (requires authentication)
curl -X GET "https://your-app.vercel.app/api/admin/trigger-report" \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"

# With custom date range
curl -X GET "https://your-app.vercel.app/api/admin/trigger-report?start=2025-01-01&end=2025-01-07" \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"

# Send to different recipient
curl -X GET "https://your-app.vercel.app/api/admin/trigger-report?to=someone@example.com" \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

### Custom Date Ranges

**Via command line:**
```bash
node scripts/generate-weekly-report.js --start 2025-01-01 --end 2025-01-07
```

**Via API:**
```bash
curl -X GET "https://your-app.vercel.app/api/admin/trigger-report?start=2025-01-01&end=2025-01-07" \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

---

## Interpreting Insights

### Week-over-Week Trends

**Green (Up) Indicators:**
- ✅ Contacts increasing → Marketing working
- ✅ Revenue increasing → More sales, higher prices, or both
- ✅ Conversion rate up → Funnel optimization working
- ✅ Show rate improving → Better qualification or reminders

**Red (Down) Indicators:**
- ⚠️ Contacts decreasing → Check ad spend, seasonality, competition
- ⚠️ Revenue decreasing → Fewer customers or lower AOV
- ⚠️ Conversion rate down → Funnel issue, poor leads, or offer change
- ⚠️ Show rate dropping → Unqualified leads or reminder system broken

**Yellow (Flat) Indicators:**
- ⚠️ Contacts flat → Need more volume, scale campaigns
- ⚠️ Revenue flat → Growth stagnation, need optimization
- ✅ Conversion flat → Stable process (good if already high)

### Common Patterns

**1. High Traffic, Low Conversion**
```
Contacts: 200 ↑ 50 (33%)
Revenue: $8,300 → 0 (0%)
Customers: 4 ↓ 2 (-33%)
Overall Conv: 2%
```
**Diagnosis:** Wrong targeting, poor ad quality, or broken funnel
**Action:** Review ad copy, check form/calendar, improve qualification

**2. Low Traffic, High Conversion**
```
Contacts: 25 ↓ 15 (-38%)
Revenue: $10,375 ↑ $2,075 (25%)
Customers: 5 ↑ 1 (25%)
Overall Conv: 20%
```
**Diagnosis:** High-quality traffic, but volume issue
**Action:** Scale winning campaigns, increase ad spend

**3. Flat Revenue, Growing Contacts**
```
Contacts: 150 ↑ 40 (36%)
Revenue: $12,450 → 0 (0%)
Customers: 6 → 0 (0%)
Overall Conv: 4%
```
**Diagnosis:** Quality declining as you scale
**Action:** Tighten targeting, improve qualification, or raise prices

**4. Declining Show Rate**
```
Show Rate: 55% ↓ 25%
Close Rate: 28% (stable)
```
**Diagnosis:** Unqualified leads booking calls
**Action:** Improve bot qualification, add friction to booking

---

## Troubleshooting

### Report Not Sending

**Check email configuration:**
```bash
node -e "require('./lib/email-sender').validateEmailConfig()"
```

**Send test email:**
```bash
node -e "require('./lib/email-sender').sendTestEmail('your-email@example.com')"
```

**Common issues:**
1. **RESEND_API_KEY not set**
   - Add to Vercel environment variables
   - Get from https://resend.com/api-keys

2. **Domain not verified**
   - Use `onboarding@resend.dev` for testing
   - Verify your domain at https://resend.com/domains

3. **REPORT_RECIPIENT_EMAIL not set**
   - Add to `.env.local` and Vercel

### Missing Data in Reports

**Check data quality section:**
- Low MC→GHL linkage → Contacts not flowing through funnel
- Low field completeness → Webhooks not firing correctly
- High orphan payments → Email matching issue

**Verify webhooks are working:**
1. Check webhook logs in Supabase:
   ```sql
   SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 20;
   ```

2. Check recent contact creation:
   ```sql
   SELECT * FROM contacts WHERE created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC;
   ```

3. Test webhook endpoints:
   ```bash
   curl https://your-app.vercel.app/api/manychat
   curl https://your-app.vercel.app/api/ghl-webhook
   curl https://your-app.vercel.app/api/stripe-webhook
   ```

### Incorrect Metrics

**Week calculation issue:**
- Reports use Monday-Sunday weeks
- Check that `subscribe_date` is being set correctly
- Verify timezone handling (PST vs UTC)

**Revenue not matching Stripe:**
- Check for orphan payments in report
- Verify refunds are excluded
- Check payment status (should be 'paid' or 'active')

**Funnel stages not flowing:**
- Verify date fields are set correctly
- Check that contacts are being updated (not just inserted)
- Review GHL webhook data

---

## Configuration

### Environment Variables

**Required for production:**
```bash
# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Email (required for reports)
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=reports@postpartumcareusa.com
REPORT_RECIPIENT_EMAIL=recipient@example.com

# Security (required for automation)
CRON_SECRET=your-random-secret-string
ADMIN_SECRET=your-admin-secret-string

# Optional: Multiple recipients
REPORT_RECIPIENT_EMAIL=person1@example.com,person2@example.com
```

**How to set in Vercel:**
1. Go to your project dashboard
2. Click "Settings" → "Environment Variables"
3. Add each variable
4. Redeploy for changes to take effect

### Report Recipients

**Single recipient:**
```bash
REPORT_RECIPIENT_EMAIL=yourname@example.com
```

**Multiple recipients:**
```bash
REPORT_RECIPIENT_EMAIL=person1@example.com,person2@example.com,person3@example.com
```

**CC and BCC:**
Modify in `lib/email-sender.js`:
```javascript
await sendWeeklyReport({
  to: process.env.REPORT_RECIPIENT_EMAIL,
  cc: ['cc@example.com'],
  bcc: ['bcc@example.com'],
  subject,
  html: htmlEmail
});
```

### Customizing the Report

**Change report frequency:**
1. Edit `vercel.json`
2. Modify `crons[0].schedule`
3. Deploy changes

**Add new sections:**
1. Update SQL views in `migrations/20250107_create_analytics_views.sql`
2. Add data to `fn_get_weekly_report` function
3. Update `lib/email-templates/weekly-report.js`
4. Redeploy

**Customize email styling:**
- Edit `lib/email-templates/weekly-report.js`
- Modify CSS in `<style>` block
- Test with `?preview=true`

---

## FAQ

**Q: Can I get daily reports instead of weekly?**
A: Yes, change the cron schedule in `vercel.json` and adjust date range logic in `scripts/generate-weekly-report.js`.

**Q: Why are some metrics showing 0%?**
A: Division by zero. Means no contacts in that category. Check data quality section.

**Q: How do I export raw data?**
A: Query Supabase directly or use the views:
```sql
SELECT * FROM v_weekly_performance;
SELECT * FROM v_funnel_metrics;
```

**Q: Can I get reports for specific campaigns?**
A: Yes, filter by `ad_id` or `source` in the SQL views.

**Q: What's the difference between historical and live data?**
A: Historical data has `_historical` in the source field (imported from Airtable). Live data comes from webhooks.

**Q: How do I add more recipients?**
A: Update `REPORT_RECIPIENT_EMAIL` with comma-separated list.

**Q: Can I customize the charts?**
A: Yes, edit chart generation functions in `lib/email-templates/weekly-report.js`.

**Q: Why is my show rate so low?**
A: Either leads are unqualified, or reminders aren't working. Check bot flow and GHL automation.

---

## Need Help?

**For technical issues:**
1. Check Vercel deployment logs
2. Review Supabase logs (Database → Logs)
3. Test webhook endpoints manually

**For metric interpretation:**
- Refer to "Key Metrics Explained" section
- Compare to industry benchmarks
- Look for sudden changes week-over-week

**For customization:**
- See "Customizing the Report" section
- All code is in the repository
- SQL views are in `/migrations/`
- Email template is in `/lib/email-templates/`

---

## Next Steps

1. ✅ Set up email delivery (Resend API key)
2. ✅ Configure recipient emails
3. ✅ Test manual report generation
4. ✅ Review first automated report
5. ✅ Customize sections as needed
6. ✅ Set up additional recipients (optional)
7. ✅ Schedule weekly review meeting

**Your weekly routine:**
1. Friday morning: Receive automated report
2. Review key metrics and trends
3. Identify areas for improvement
4. Take action on insights
5. Track changes in next week's report

---

*Last updated: January 2025*
*System version: 1.0*
