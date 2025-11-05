# Analysis Guide - Local CSV Analysis System

**Date:** November 5, 2025
**Data Source:** `historical_data/unified_contacts_v2.csv` (6,386 contacts, 262 customers)

---

## 🚀 Quick Start

### Run All Analyses at Once
```bash
node scripts/analyze-all.js
```

This will run all three analysis scripts and save a complete report to `reports/`.

### Run Individual Analyses
```bash
# Revenue breakdown, top customers, payment methods
node scripts/analyze-revenue.js

# Funnel stages, conversion rates, drop-off points
node scripts/analyze-funnel.js

# Time trends, cohorts, time-to-purchase
node scripts/analyze-cohorts.js
```

---

## 📊 What Each Script Shows

### 1. Revenue Analysis (`analyze-revenue.js`)

**What you'll see:**
- 💰 Total revenue (Stripe + Denefits breakdown)
- 🏆 Top 20 customers by revenue
- 📦 Revenue by data source (google_sheets, airtable, supabase_export, etc.)
- 📈 Revenue distribution (how many customers in each $ bucket)
- 💳 Payment method breakdown (Stripe only, Denefits only, both)
- 🔄 Repeat customers (multiple payments/contracts)

**Example insights:**
- "Which customers spent the most?"
- "What's my average order value?"
- "How much comes from Stripe vs Denefits?"
- "Do I have repeat customers?"

---

### 2. Funnel Analysis (`analyze-funnel.js`)

**What you'll see:**
- 📊 How many contacts at each funnel stage
- 💰 Conversion rate for each stage
- 🎯 Paid vs Organic performance (contacts, conversion, revenue, AOV)
- 🎪 Top trigger words (by revenue and by conversion rate)
- 📉 Drop-off points (where people leave the funnel)

**Example insights:**
- "Which stage has the worst drop-off?"
- "Do paid ads convert better than organic?"
- "Which trigger words bring the most revenue?"
- "What's the conversion rate at each stage?"

**Funnel stages tracked:**
```
LEAD_CONTACT → SHOWED_INTEREST → SENT_LINK → CLICKED_LINK →
DM_QUALIFIED → READY_TO_BOOK → BOOKED → ATTENDED →
BOUGHT_PACKAGE → PAID
```

---

### 3. Cohort Analysis (`analyze-cohorts.js`)

**What you'll see:**
- 📅 Monthly subscription trends (contacts, customers, conversion by month)
- 💰 Monthly purchase trends (revenue by month)
- 📆 Day of week patterns (which days get most subscriptions)
- ⏱️ Time to purchase (average, median, distribution)
- 🕐 Recent activity (last 30 days)

**Example insights:**
- "Which months had the best conversion?"
- "How long does it take from subscription to purchase?"
- "Which day of the week gets the most sign-ups?"
- "Is revenue growing or declining month-over-month?"
- "Who are my most recent customers?"

---

## 🎯 Common Questions & How to Answer Them

### "How much revenue did I make?"
```bash
node scripts/analyze-revenue.js
```
Look for: **TOTAL REVENUE** section at the top

---

### "Which trigger words convert best?"
```bash
node scripts/analyze-funnel.js
```
Look for: **TOP TRIGGER WORDS** section (sorted by conversion rate)

---

### "Where do people drop off in my funnel?"
```bash
node scripts/analyze-funnel.js
```
Look for: **FUNNEL DROP-OFF POINTS** section

---

### "Is my business growing month-over-month?"
```bash
node scripts/analyze-cohorts.js
```
Look for: **MONTHLY PURCHASE TRENDS** section

---

### "How long does it take for someone to buy?"
```bash
node scripts/analyze-cohorts.js
```
Look for: **TIME TO PURCHASE** section

---

### "Do paid ads perform better than organic?"
```bash
node scripts/analyze-funnel.js
```
Look for: **PAID VS ORGANIC PERFORMANCE** section

---

### "Who are my biggest customers?"
```bash
node scripts/analyze-revenue.js
```
Look for: **TOP 20 CUSTOMERS BY REVENUE** section

---

## 📁 File Structure

```
MCB/
├── historical_data/
│   └── unified_contacts_v2.csv          ← Your data (6,386 contacts)
│
├── scripts/
│   ├── analyze-all.js                   ← Run everything
│   ├── analyze-revenue.js               ← Revenue insights
│   ├── analyze-funnel.js                ← Funnel insights
│   └── analyze-cohorts.js               ← Time-based insights
│
└── reports/
    └── analysis-report-YYYY-MM-DD.txt   ← Saved reports
```

---

## 🔧 Customizing the Analyses

All scripts are JavaScript and easy to modify. Here's how:

### Add a new insight
Open any script and add your own analysis:

```javascript
// Example: Count contacts from Instagram
const instagramContacts = data.filter(c => c.instagram && c.instagram.trim());
console.log(`Instagram contacts: ${instagramContacts.length}`);
```

### Change the date range
In `analyze-cohorts.js`, change this line:

```javascript
// Change from 30 days to 60 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 60); // Changed from -30
```

### Filter to specific months
```javascript
// Only analyze 2025 data
const data2025 = data.filter(row => {
  const date = parseDate(row.subscription_date);
  return date && date.getFullYear() === 2025;
});
```

---

## 💡 Tips & Tricks

### Save output to a file
```bash
node scripts/analyze-revenue.js > revenue-report.txt
```

### Search for specific insights
```bash
node scripts/analyze-funnel.js | grep "PAID"
```

### Run analyses on a schedule
Create a cron job (macOS/Linux):
```bash
# Run daily at 9am
0 9 * * * cd /path/to/MCB && node scripts/analyze-all.js
```

---

## 📊 Data Fields Available

Your `unified_contacts_v2.csv` has these columns:

**Contact Info:**
- email, first_name, last_name, phone, instagram, facebook

**Attribution:**
- source, paid_vs_organic, trigger_word, ad_id, ad_name, campaign

**Funnel:**
- stage, subscription_date

**Purchase:**
- has_purchase, purchase_date, purchase_amount

**Stripe:**
- stripe_revenue, stripe_payments, stripe_first_payment

**Denefits:**
- denefits_revenue, denefits_contracts, denefits_signup_date

**Totals:**
- total_revenue

**Meta:**
- notes

---

## 🚨 Troubleshooting

### "Cannot find module"
Make sure you're in the MCB directory:
```bash
cd /Users/connorjohnson/CLAUDE_CODE/MCB
```

### "No such file or directory"
Make sure unified_contacts_v2.csv exists:
```bash
ls historical_data/unified_contacts_v2.csv
```

### Numbers look wrong
- Check for `NaN` values in output (means data is missing/corrupted)
- Revenue should be ~$170k total (70 new customers from Supabase)
- If it's way off, the CSV might have been modified

### Want to analyze the OLD unified_contacts.csv (4,162 contacts)?
Edit any script and change:
```javascript
// From:
'unified_contacts_v2.csv'

// To:
'unified_contacts.csv'
```

---

## 🎉 Next Steps

Now that you have these analysis scripts, you can:

1. **Run them regularly** to track trends over time
2. **Ask me to create custom analyses** for specific questions
3. **Modify the scripts** to add your own insights
4. **Export results** to share with your team
5. **Build on this foundation** to create more complex queries

---

## 🤖 Need More Insights?

Just ask! Some ideas:

- "Show me conversion rate by specific trigger words"
- "Which stage has the longest time delay?"
- "Compare Q1 vs Q2 performance"
- "Show me customers who took more than 30 days to buy"
- "Which Instagram handles converted best?"
- "Breakdown by Facebook vs Instagram"
- Anything else you can think of!

I can modify the existing scripts or create new ones for any question you have about your data.

---

## 📝 Summary

✅ **No Supabase needed** - Everything runs locally from CSV
✅ **Three main scripts** - Revenue, Funnel, Cohorts
✅ **One master script** - Runs all three at once
✅ **Customizable** - Easy to modify and extend
✅ **Fast** - Analyzes 6,386 contacts in seconds

**To get started:**
```bash
cd /Users/connorjohnson/CLAUDE_CODE/MCB
node scripts/analyze-all.js
```

That's it! Your complete historical data analysis system is ready to go.
