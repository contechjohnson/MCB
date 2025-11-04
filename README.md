# MCB - Data Collection System

**Status:** Schema v2.0 ready to deploy (Nov 2, 2025)

## Quick Start for New Claude Instances

👉 **Read `START_HERE.md` first** - Complete current status and context

## What This Is

A data collection system that captures events from:
- Manychat (chatbot conversations)
- GoHighLevel (bookings, attendance)
- Stripe (payments)

Stores everything in Supabase for automated analysis and email reporting.

**Not a dashboard app** - Just clean data + automated insights.

## Key Files

- `START_HERE.md` - Current project status (READ THIS FIRST)
- `CLAUDE.md` - Complete development guide
- `SCHEMA_V2_README.md` - Database schema documentation
- `schema_v2.sql` - Migration to run
- `MCP_STATUS.md` - Supabase MCP setup

## Current Schema (v2.0)

Simple timestamp-based tracking:
- Primary ID: `MC_ID` (Manychat ID)
- Key timestamps: subscribe, qualified, link sent/clicked, form submit, meeting booked/held, purchase
- Revenue tracking: Cumulative `purchase_amount`
- AB testing: `chatbot_AB`, `MISC_AB`
- Attribution: `AD_ID` for ROAS calculations

If a timestamp exists, that event happened. No complex booleans.

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
