# Current System Status

**Last Updated:** November 8, 2025
**System Version:** v2.2
**Next Review:** November 15, 2025

---

## 🟢 System State: DEPLOYED & ACTIVE

**Production URL:** https://mcb-dun.vercel.app/
**Database:** Supabase (mcb_ppcu - succdcwblbzikenhhlrz)
**Deployment:** Auto-deploy from GitHub main branch

---

## 📊 Feature Status

| Feature | Status | Details | Last Updated |
|---------|--------|---------|--------------|
| **Stripe Webhooks** | 🟢 LIVE | Payments, refunds, checkout events | Nov 8 |
| **GoHighLevel Webhooks** | 🟢 LIVE | Bookings, meetings, package shipments | Nov 8 |
| **ManyChat Webhooks** | 🟢 LIVE | DM conversations, qualification tracking | Nov 8 |
| **Denefits Webhooks** | 🟢 LIVE | BNPL financing payments via Make.com | Nov 8 |
| **Perspective Webhooks** | 🟢 LIVE | Checkout abandonment tracking | Nov 8 |
| **Meta Ads Integration** | 🟢 LIVE | 38 ads synced, creative tracking | Nov 8 |
| **AI Weekly Reports** | 🟢 LIVE | OpenAI Assistant, Fridays 5:17 PM UTC | Nov 8 |
| **Database Schema** | 🟢 v2.2 | UUID keys, payments table, all fields | Nov 3 |
| **Historical Data** | 🟢 COMPLETE | 537 contacts imported from Airtable | Jan 6 |

---

## 🔴 Known Issues (Active Investigation)

### Critical Issues

| Issue | Severity | Impact | Status |
|-------|----------|--------|--------|
| **MC→GHL Linkage: 7.9%** | 🔴 CRITICAL | Can't track DM → Booking funnel | Investigating |
| **Orphan Payments: 100%** | 🔴 CRITICAL | 2 payments ($5.5K) unlinked | Investigating |

### Medium Issues

| Issue | Severity | Impact | Status |
|-------|----------|--------|--------|
| **AD_ID Capture: 35%** | 🟡 MEDIUM | Limited attribution data | Monitoring |

**For detailed troubleshooting:** See `CURRENT_STATUS_REPORT.md`

---

## 📈 Current Data Snapshot

**As of November 8, 2025:**

### Contacts
- **Total:** 160 contacts
- **With MC_ID:** 139 (86.9%) - ManyChat webhook working
- **With GHL_ID:** 32 (20.0%) - Low, investigating
- **With AD_ID:** 56 (35.0%) - Partial attribution
- **MC + GHL Linked:** 11 (6.9%) - Critical linkage issue

### Payments
- **Total:** 2 payments ($5,546.00)
- **Stripe:** 1 payment ($2,250.00)
- **Denefits:** 1 payment ($3,296.00)
- **Orphaned:** 2 (100%) - All payments currently unlinked

### Sources
- **Instagram:** 147 contacts (91.9%)
- **Website:** 6 contacts (3.8%)
- **Other:** 7 contacts (4.4%)

---

## 🏗️ System Architecture

### API Endpoints (All Live)
```
Production: https://mcb-dun.vercel.app/

Webhooks:
├── /api/stripe-webhook         # Stripe events
├── /api/ghl-webhook            # GoHighLevel events
├── /api/manychat               # ManyChat conversations
├── /api/denefits-webhook       # Denefits BNPL payments
└── /api/perspective-webhook    # Perspective checkout abandonment

Reports:
├── /api/reports/weekly-data    # Weekly analytics JSON (for Make.com)
└── /api/cron/generate-report   # AI report generation (Fridays 5:17 PM)

Meta Ads:
└── Script: scripts/sync-meta-ads.js  # Manual sync when needed
```

### Database Tables (Supabase)
```
Core:
├── contacts               # Main contact records (UUID primary key)
├── payments               # Payment transactions
├── webhook_logs           # All webhook events
└── stripe_webhook_logs    # Stripe-specific events

Meta Ads:
├── meta_ads               # Ad performance data
├── meta_ad_creatives      # Creative content (themes, symptoms)
└── meta_ad_insights       # Daily spend and metrics

Reporting:
├── weekly_snapshots       # Weekly summary data
├── ab_tests               # A/B test tracking
├── ad_performance_weekly  # Ad history by week
└── theme_performance_weekly # Theme rollups
```

---

## 🚀 Recent Changes (Last 5 Commits)

```
1becc7c - Fix package_sent_date not being set for PackageSent events
d98d723 - Fix GHL webhook to use lowercase ghl_id column name
67a942d - Fix payment logging to capture ALL payments regardless of email
ce5a025 - Fix GHL event type detection - check customData.pipeline_stage first
d8c902a - Add update_data to webhook logs for debugging
```

---

## 💻 Development Quick Start

### Local Development
```bash
# Clone and setup
git clone [repo]
cd MCB
npm install

# Environment (copy .env.local from secure location)
# Required: SUPABASE keys, STRIPE keys, META token, OPENAI key

# Start dev server
npm run dev        # Runs on http://localhost:3000

# Other commands
npm run build      # Production build
npm run lint       # Check for errors
npm run type-check # TypeScript validation
```

### Testing Webhooks Locally
```bash
# Test each endpoint
curl http://localhost:3000/api/stripe-webhook
curl http://localhost:3000/api/ghl-webhook
curl http://localhost:3000/api/manychat

# All should return {"status": "ok"}
```

### Database Access
```bash
# Supabase SQL Editor
SELECT * FROM contacts LIMIT 10;
SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 5;
SELECT * FROM payments;

# Check linkage rates
SELECT
  COUNT(*) as total,
  COUNT(mc_id) as has_mc,
  COUNT(ghl_id) as has_ghl,
  COUNT(CASE WHEN mc_id IS NOT NULL AND ghl_id IS NOT NULL THEN 1 END) as linked
FROM contacts;
```

---

## 📚 Documentation Navigation

**For New AI Agents (Start Here):**
1. **This file** - Current system state (5 min)
2. **CLAUDE.md** - Comprehensive project guide (10 min)
3. **SYSTEM_ARCHITECTURE.md** - System design overview (5 min) *[Create if missing]*
4. **DATABASE_SCHEMA.md** - Schema details (5 min) *[Create if missing]*

**For Specific Tasks:**
- Webhooks: `WEBHOOK_GUIDE.md`
- Historical Data: `HISTORICAL_DATA_MAPPING.md`
- Weekly Reports: `WEEKLY_REPORT_DEPLOYMENT.md`
- Meta Ads: `META_ADS_INTEGRATION_GUIDE.md`
- Current Issues: `CURRENT_STATUS_REPORT.md`

**Total Onboarding: ~20 minutes** (vs. 2+ hours with scattered docs)

---

## 🔧 Common Operations

### Sync Meta Ads
```bash
# Run when needed (respects rate limits)
node scripts/sync-meta-ads.js
```

### Generate Weekly Report (Manual)
```bash
# For specific week
node scripts/weekly-report-ai.js 2025-11-07

# Auto-detects last Sunday
node scripts/weekly-report-ai.js
```

### Test API Endpoint
```bash
# Test weekly data API
node scripts/test-weekly-api.js 2025-11-07
```

### Check Database Status
```bash
# Run status script
node scripts/check-database-status.js
```

---

## 📅 Maintenance Schedule

### Weekly (Monday)
- [ ] Review CURRENT_STATUS_REPORT.md for new issues
- [ ] Check weekly report was sent Friday
- [ ] Review payment orphan rate
- [ ] Update this file if major changes

### Monthly (1st of month)
- [ ] Run Meta Ads sync
- [ ] Review A/B test results
- [ ] Check database growth metrics
- [ ] Review and archive old webhook logs

### As Needed
- [ ] Sync Meta Ads after campaign changes
- [ ] Deploy schema migrations
- [ ] Update webhook endpoints

---

## 🎯 Next Steps / Roadmap

### Immediate (This Week)
- 🔴 **Fix MC→GHL linkage** - Critical for funnel tracking
- 🔴 **Investigate orphan payments** - $5.5K unlinked

### Short Term (This Month)
- 🟡 Run first A/B test (Overwhelm to Relief variants)
- 🟡 Improve AD_ID capture rate
- 🟡 Create SYSTEM_ARCHITECTURE.md
- 🟡 Create DATABASE_SCHEMA.md

### Medium Term (Next 3 Months)
- 🟢 Dashboard for Eric (view reports)
- 🟢 Automated A/B test tracking
- 🟢 Slack/SMS alerts for critical issues

---

## 🆘 Emergency Contacts & Resources

**Production Issues:**
- Vercel Dashboard: https://vercel.com/dashboard
- Supabase Dashboard: https://supabase.com/dashboard
- Check deployment logs in Vercel
- Check database logs in Supabase

**Webhook Issues:**
- Check `webhook_logs` table for recent events
- Check `stripe_webhook_logs` for Stripe-specific
- Verify webhook URLs in each platform
- Test endpoints with curl

**For Help:**
- Documentation: This directory
- Git History: Recent fixes in commits
- Audit Report: `DOCUMENTATION_AUDIT_REPORT.md`

---

## 📝 Update Log

| Date | Change | Updated By |
|------|--------|------------|
| Nov 8, 2025 | Date corrections across all docs, added date check reminder | Claude |
| Nov 8, 2025 | Documentation audit complete, slash commands fixed | Claude |
| Nov 6, 2025 | System status analyzed, issues identified | Claude |
| Nov 3, 2025 | Schema v2.1 deployed, webhooks live | Connor |

---

**When to Update This File:**
- After resolving critical issues
- After deploying new features
- After schema changes
- After significant data imports
- Weekly on Mondays (recommended)

**How to Update:**
```bash
# Update these sections:
- Last Updated: [Current Date]
- Next Review: [Date + 7 days]
- Feature Status table (if changed)
- Known Issues (if resolved/new)
- Current Data Snapshot (weekly)
- Recent Changes (git log)
```

---

## 🔗 Related Documentation

- **Detailed Issues:** `CURRENT_STATUS_REPORT.md` (daily status checks)
- **System Design:** `SYSTEM_ARCHITECTURE.md` (create if missing)
- **Database Schema:** `DATABASE_SCHEMA.md` (create if missing)
- **Project Guide:** `CLAUDE.md` (comprehensive overview)
- **Audit Report:** `DOCUMENTATION_AUDIT_REPORT.md` (doc health)

**This file is the single source of truth for system state.**
