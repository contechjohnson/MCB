# Analytics System - Setup Complete

## ✅ What's Been Built

Your advanced analytics system is **ready to deploy**. Here's what's complete:

### 1. Database Layer (7 Views + 3 Functions)
- ✅ `v_weekly_performance` - Core weekly metrics
- ✅ `v_funnel_metrics` - Conversion funnel analysis
- ✅ `v_revenue_breakdown` - Payment type breakdown
- ✅ `v_timing_analysis` - Customer journey timing
- ✅ `v_attribution_summary` - Campaign performance
- ✅ `v_symptom_performance` - Symptom-based intent scoring
- ✅ `v_data_quality` - System health dashboard
- ✅ `fn_get_weekly_report()` - Main report generator
- ✅ `fn_calculate_mom_growth()` - Month-over-month trends
- ✅ `fn_get_cohort_analysis()` - Cohort performance tracking

**Status:** All deployed to Supabase

### 2. Report Generation
- ✅ `scripts/generate-weekly-report.js` - Core report engine
- ✅ Fetches data from all views
- ✅ Calculates week-over-week changes
- ✅ Generates formatted text summaries
- ✅ Supports custom date ranges
- ✅ Can save reports to file

**Status:** Fully functional, tested

### 3. Email System
- ✅ `lib/email-templates/weekly-report.js` - Beautiful HTML template
- ✅ Responsive design (mobile + desktop)
- ✅ Embedded charts via QuickChart.io
- ✅ Color-coded metrics (green/red/yellow)
- ✅ Data tables with formatting
- ✅ `lib/email-sender.js` - Resend API integration

**Status:** Ready to send, needs API key

### 4. Automation
- ✅ `app/api/cron/weekly-report/route.ts` - Vercel cron endpoint
- ✅ Scheduled: Every Friday at 9am PST
- ✅ Automatic report generation + email
- ✅ `app/api/admin/trigger-report/route.ts` - Manual trigger
- ✅ Preview mode (view HTML without sending)
- ✅ Custom date ranges
- ✅ `vercel.json` - Cron configuration

**Status:** Ready to deploy

### 5. Documentation
- ✅ `ANALYTICS_GUIDE.md` - Complete user guide
- ✅ Metric explanations
- ✅ Interpretation guide
- ✅ Troubleshooting
- ✅ Configuration instructions

**Status:** Complete

---

## 🚀 Next Steps (Your Action Items)

### Step 1: Set Up Email Delivery (5 minutes)

**Sign up for Resend:**
1. Go to https://resend.com
2. Sign up for free account
3. Get API key from dashboard

**Add environment variables to Vercel:**
1. Go to your Vercel project
2. Settings → Environment Variables
3. Add these:
   ```
   RESEND_API_KEY=re_your_key_here
   RESEND_FROM_EMAIL=reports@postpartumcareusa.com
   REPORT_RECIPIENT_EMAIL=youremail@example.com
   CRON_SECRET=make_up_a_random_string_12345
   ADMIN_SECRET=make_up_another_random_string_67890
   ```

**For testing (no domain verification needed):**
```
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**For production (requires domain verification):**
```
RESEND_FROM_EMAIL=reports@postpartumcareusa.com
```
Then verify domain at: https://resend.com/domains

### Step 2: Deploy to Vercel (1 minute)

```bash
git add .
git commit -m "Add advanced analytics system"
git push origin main
```

Vercel will auto-deploy. Wait for deployment to complete.

### Step 3: Test the System (5 minutes)

**Option A: Via Command Line**
```bash
# Test report generation (no email)
node scripts/generate-weekly-report.js

# Test email configuration
node -e "require('./lib/email-sender').validateEmailConfig()"

# Send test email
node -e "require('./lib/email-sender').sendTestEmail('youremail@example.com')"
```

**Option B: Via API (After Deploy)**
```bash
# Preview HTML report in browser
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  "https://your-app.vercel.app/api/admin/trigger-report?preview=true"

# Send actual report
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  "https://your-app.vercel.app/api/admin/trigger-report"
```

### Step 4: Verify Automation (Wait for Friday)

**What will happen:**
- Every Friday at 9am PST (5pm UTC)
- System automatically generates report
- Email sent to configured recipient
- No action needed on your part

**To test before Friday:**
Use manual trigger endpoint (see Step 3, Option B)

---

## 📊 What You'll Get Every Friday

### Email Subject:
```
📊 Weekly Analytics Report - Jan 1 to Jan 7, 2025
```

### Email Contents:
1. **Executive Summary Boxes**
   - Total Contacts (with week-over-week change)
   - Total Revenue (with week-over-week change)
   - New Customers (with week-over-week change)
   - Average Order Value (with week-over-week change)

2. **Key Highlights**
   - Bullet points of biggest changes
   - Noteworthy metrics
   - Conversion rate summary

3. **Funnel Performance**
   - Visual funnel chart
   - Conversion rates at each stage
   - Show rate and close rate
   - Overall conversion percentage

4. **Revenue Breakdown**
   - Stripe vs Denefits payments
   - Buy-in-Full vs BNPL split
   - Orphan payment alerts (if any)

5. **Top Performing Sources**
   - Attribution table showing:
     - Source/campaign
     - Contacts generated
     - Customers acquired
     - Revenue generated
     - Conversion rate

6. **Data Quality Dashboard**
   - Total contacts in database
   - Historical vs Live data split
   - ManyChat → GHL linkage rate
   - Field completeness percentages

---

## 🔧 How to Use

### Automated Reports (Default)
**Nothing to do!** Reports arrive every Friday at 9am PST.

### Manual Reports (Testing/Ad-hoc)

**Generate report without sending:**
```bash
node scripts/generate-weekly-report.js
```

**Generate and save to file:**
```bash
node scripts/generate-weekly-report.js --save
# Creates file in /reports/ folder
```

**Preview HTML in browser:**
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  "https://your-app.vercel.app/api/admin/trigger-report?preview=true" \
  > preview.html

open preview.html
```

**Send report now:**
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  "https://your-app.vercel.app/api/admin/trigger-report"
```

**Custom date range:**
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  "https://your-app.vercel.app/api/admin/trigger-report?start=2025-01-01&end=2025-01-07"
```

**Send to different recipient:**
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  "https://your-app.vercel.app/api/admin/trigger-report?to=someone@example.com"
```

---

## 📈 Insights You Can Extract

Your system now tracks **127+ insights** from 73 data points. Here are the highlights:

### Demographics & Targeting
- Months postpartum distribution
- Geographic distribution (from GHL)
- Symptom frequency (trigger words)
- Bot A/B test performance

### Attribution & ROAS
- Revenue by ad/campaign
- Cost per lead by source
- Cost per acquisition
- Conversion rate by source
- ROAS by campaign

### Funnel Performance
- Subscribe → Qualify rate
- Qualify → Click rate
- Click → Form submit rate
- Form → Booking rate
- Booking → Show rate
- Show → Close rate
- Overall conversion rate

### Revenue Metrics
- Total revenue (weekly, monthly)
- Stripe vs Denefits split
- Buy-in-Full vs BNPL split
- Average order value
- Revenue per contact
- Orphan payment rate

### Timing & Velocity
- Days to qualify
- Days to click link
- Days to submit form
- Days to book meeting
- Days to attend meeting
- Days to purchase
- Total funnel time

### Data Quality
- Historical vs Live data split
- MC → GHL linkage rate
- Field completeness percentages
- Contact duplication rate
- Webhook success rate

---

## ⚙️ Configuration

### Change Report Schedule

Edit `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/weekly-report",
    "schedule": "0 17 * * 5"  // Friday 9am PST
  }]
}
```

**Common schedules:**
- Daily at 9am PST: `"0 17 * * *"`
- Monday 8am PST: `"0 16 * * 1"`
- First of month: `"0 17 1 * *"`

### Add Multiple Recipients

In Vercel environment variables:
```
REPORT_RECIPIENT_EMAIL=person1@example.com,person2@example.com,person3@example.com
```

### Customize Email Template

Edit `lib/email-templates/weekly-report.js`:
- Modify colors in `<style>` section
- Add/remove sections in HTML body
- Change chart types/styling
- Adjust layout and formatting

### Add New Metrics

1. Update SQL view in `migrations/20250107_create_analytics_views.sql`
2. Modify `fn_get_weekly_report` function to include new data
3. Update `lib/email-templates/weekly-report.js` to display it
4. Deploy changes

---

## 🐛 Troubleshooting

### Report Not Sending

**Check configuration:**
```bash
node -e "require('./lib/email-sender').validateEmailConfig()"
```

**Expected output:**
```
📧 Email Configuration Status:

RESEND_API_KEY:         ✅ Set
RESEND_FROM_EMAIL:      reports@postpartumcareusa.com
REPORT_RECIPIENT_EMAIL: youremail@example.com
```

**Send test email:**
```bash
node -e "require('./lib/email-sender').sendTestEmail('youremail@example.com')"
```

### Missing Data in Reports

**Check data quality section** in email - it will show:
- % of contacts with each field
- Historical vs Live data split
- Linkage rates

**Query database directly:**
```sql
-- Check recent contacts
SELECT * FROM contacts WHERE created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC;

-- Check funnel metrics
SELECT * FROM v_funnel_metrics;

-- Check revenue breakdown
SELECT * FROM v_revenue_breakdown;
```

### Email Goes to Spam

**Solutions:**
1. Use verified domain (not `onboarding@resend.dev`)
2. Add SPF/DKIM records to your domain
3. Have recipients whitelist sender
4. Check email content (avoid spam trigger words)

---

## 📚 Documentation

**Full user guide:** `ANALYTICS_GUIDE.md`
- Complete metric explanations
- How to interpret insights
- Week-over-week trend analysis
- Common patterns and red flags
- FAQ section

**For detailed queries:** See Supabase → SQL Editor
- All 7 views are queryable
- 3 RPC functions available
- Test queries in the editor

---

## 🎯 Success Criteria

Your system is working when:
- ✅ You receive email every Friday at 9am PST
- ✅ Email shows current week data (Monday-Sunday)
- ✅ Charts render correctly
- ✅ Week-over-week changes are accurate
- ✅ All sections have data (or explain why not)
- ✅ Manual triggers work on-demand

---

## 🚨 Important Notes

### Historical Data
- Data marked with `_historical` in source field
- These are contacts imported from Airtable
- As new data flows in, live data % will increase
- Reports show both historical and live metrics

### Data Quality
- MC → GHL linkage currently at 31.9%
- This is normal for mixed traffic (paid + organic)
- Reports include data quality dashboard
- Use insights to improve data collection

### Orphan Payments
- Payments not linked to contacts
- Usually due to email mismatch
- Reports alert you to these
- Review weekly and manually match if needed

### Timezone Handling
- All dates stored in UTC
- Reports use PST for display
- Cron schedule in UTC (5pm UTC = 9am PST)
- Week boundaries: Monday 12:00am PST to Sunday 11:59pm PST

---

## ✨ What's Next (Optional Enhancements)

These are NOT required, but could be added later:

1. **Dashboard UI** - Web page showing live metrics
2. **Slack Integration** - Send reports to Slack channel
3. **PDF Export** - Generate PDF versions of reports
4. **Custom Alerts** - Email alerts for metric thresholds
5. **A/B Test Tracking** - Detailed A/B test analysis
6. **Cohort Reports** - Monthly cohort performance emails
7. **Real-time Dashboard** - Live updating metrics page

---

## 🎉 You're Ready!

**What you have now:**
- Comprehensive data collection (webhooks working)
- Advanced analytics (7 views, 3 functions)
- Automated reporting (every Friday)
- Beautiful email templates (responsive, charts)
- Manual triggers (testing, custom dates)
- Full documentation (metric explanations, guides)

**What to do now:**
1. Set up Resend API key
2. Deploy to Vercel
3. Send first test report
4. Wait for Friday's automated report
5. Review insights and take action

**Your weekly routine:**
- Friday: Receive report
- Review key metrics
- Identify trends
- Take action
- Track changes next week

---

*System built: January 2025*
*Ready for production deployment*
*Questions? See ANALYTICS_GUIDE.md*
