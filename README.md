# MCB - Data Collection System

**Status:** 🟢 DEPLOYED & ACTIVE (as of Jan 7, 2025)
**Production:** https://mcb-dun.vercel.app/

## Quick Start for New AI Agents

👉 **Read these files in order:**
1. **`CURRENT_STATUS.md`** (5 min) - System state, features, issues
2. **`CLAUDE.md`** (10 min) - Complete project guide
3. **Task-specific docs** as needed

**Total onboarding: ~20 minutes**

## What This Is

A data collection system that captures events from:
- Manychat (chatbot conversations)
- GoHighLevel (bookings, attendance)
- Stripe (payments)

Stores everything in Supabase for automated analysis and email reporting.

**Not a dashboard app** - Just clean data + automated insights.

## Key Documentation

- **`CURRENT_STATUS.md`** - System state (features, issues, data)
- **`CLAUDE.md`** - Complete development guide
- **`WEBHOOK_GUIDE.md`** - Webhook endpoints documentation
- **`WEEKLY_REPORT_DEPLOYMENT.md`** - AI reporting system
- **`HISTORICAL_DATA_MAPPING.md`** - Data migration guide

## Current System (v2.2)

**Live Features:**
- 5 webhook endpoints (Stripe, GHL, ManyChat, Denefits, Perspective)
- Meta Ads integration (38 ads tracked)
- AI weekly reports (automated via OpenAI)
- Historical data (537 contacts imported)

**Database:**
- UUID primary keys
- Flexible contact matching (MC_ID, GHL_ID, email)
- Payment tracking with attribution
- Meta ad creative analysis

## Development

```bash
npm run dev        # Start dev server
npm run build      # Production build
node test-supabase.js  # Test DB connection
```

## Environment

Requires `.env.local` with:
- Supabase credentials
- Stripe keys
- Other API keys (see `.env.local.example`)

## Archive

Old code from previous version is in `_archive_2025_11_02/` - preserved but not maintained.
