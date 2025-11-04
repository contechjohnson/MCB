# 🚀 START HERE - Current Project Status

**Last Updated:** Nov 2, 2025, 10:00 PM
**Current Phase:** Schema v2.0 migration ready, Supabase MCP just installed

---

## 📍 WHERE WE ARE RIGHT NOW

### Just Completed (Before Restart)
1. ✅ Archived all old code to `_archive_2025_11_02/`
2. ✅ Designed clean new schema v2.0 (see `SCHEMA_V2_README.md`)
3. ✅ Created migration SQL (`schema_v2.sql`)
4. ✅ Installed Supabase MCP for easy database access
5. ✅ Updated all documentation (CLAUDE.md, permissions, tools)

### Next Steps (After Restart)
1. **Test Supabase MCP works** - Try: "Show me all tables in my database"
2. **Run the schema migration** - Execute `schema_v2.sql` to create new tables
3. **Verify migration worked** - Check that new `contacts` table exists
4. **Start building webhooks** - Begin implementing data collection endpoints

---

## 🎯 THE MISSION

**What This Project Does:**
- Collects event data from Manychat, GoHighLevel, and Stripe
- Stores it in Supabase for analysis
- Generates automated reports for the client
- **NOT a dashboard** - just clean data collection + email reports

**User's Vibe:**
- "Vibe coding" - understands concepts but not all technical details
- Wants things explained simply
- Focus on what actually works, not over-engineering
- Client will NEVER look at a dashboard, only emails with insights

---

## 📊 THE NEW SCHEMA (v2.0)

**Core Table:** `contacts`

**Primary Identifier:** `MC_ID` (Manychat ID)

**Key Fields:**
- Identifiers: `MC_ID`, `GHL_ID`, `AD_ID`, `email`, `phone`
- Names: `first_name`, `last_name`, `IG`, `FB`
- Testing: `chatbot_AB`, `MISC_AB`, `trigger_word`
- Questions: `Q1_question`, `Q2_question`, `objections`
- **Timestamps** (the heart of it): `subscribe_date`, `DM_qualified_date`, `link_send_date`, `link_click_date`, `form_submit_date`, `meeting_book_date`, `meeting_held_date`, `purchase_date`
- Revenue: `purchase_amount` (cumulative lifetime value)
- Stage: `stage` (descriptive: new_lead, DM_qualified, purchased, etc.)
- AI: `lead_summary`, `thread_ID`

**Philosophy:** Simple timestamps, no complex booleans. If a timestamp exists, that event happened.

**Full Details:** See `SCHEMA_V2_README.md`

---

## 🗄️ DATABASE STATUS

**Current State:**
- Old `contacts` table: Will be renamed to `contacts_archive_20251102`
- Old data: 30,111 contacts safely preserved
- New tables: Ready to create via `schema_v2.sql`

**Migration File:** `schema_v2.sql`
- Archives old tables (safe, still queryable)
- Creates new clean v2.0 schema
- Sets up indexes for performance
- Adds auto-update triggers

---

## 🔧 TOOLS & PERMISSIONS

**Supabase MCP:** ✅ Just installed
- Location: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Project: `fwdqffugobywdmteplpy`
- Access: Full read/write (not read-only)
- **First use:** Will prompt to log in to Supabase via browser

**Permissions:** ✅ Full access
- File: `.claude/settings.local.json` has `"allow": ["*"]`
- Can do anything without prompts

**Primary Web Tool:** 🔥 Firecrawl MCP
- Use for ALL web searches/scraping
- Don't use WebSearch or WebFetch
- See CLAUDE.md for full tool guide

---

## 📁 IMPORTANT FILES

**Read These First:**
- `START_HERE.md` (this file) - Current status
- `CLAUDE.md` - Complete project guide, tool usage, architecture
- `SCHEMA_V2_README.md` - Database schema documentation

**Migration Files:**
- `schema_v2.sql` - Run this to create new database
- `SCHEMA_V2_README.md` - Explains every field

**Reference:**
- `MCP_STATUS.md` - Supabase MCP installation & troubleshooting
- `RESTART_CHECKLIST.md` - What to verify after restart
- `test-supabase.js` - Test database connection

**Archived:**
- `_archive_2025_11_02/` - All old code (don't look here unless needed)

---

## 🎬 IMMEDIATE NEXT ACTIONS

### 1. Test Supabase MCP (After Restart)
```
You: "Show me all tables in my database"
Expected: Lists tables, prompts for Supabase login first time
```

### 2. Run Migration
```
You: "Run the migration in schema_v2.sql"
Or: "Execute the SQL in schema_v2.sql to create new tables"
Expected: Creates new tables, archives old ones
```

### 3. Verify Migration
```
You: "Show me the schema of the contacts table"
Expected: Shows new v2.0 schema with MC_ID, timestamps, etc.
```

### 4. Check Old Data Preserved
```
You: "How many rows in contacts_archive_20251102?"
Expected: ~30,111 rows
```

---

## 💡 CONTEXT FOR ANALYSIS

**What the client needs to know:**
- Which ads perform best (AD_ID tracking)
- Conversion rates at each funnel stage
- Time-to-conversion metrics
- AB test results (chatbot_AB, MISC_AB)
- Lifetime value per customer
- ROAS (return on ad spend)

**Example insights:**
- "Ad XYZ has 15% higher conversion to purchase"
- "Average time from subscribe to purchase: 8.5 days"
- "Chatbot A converts 23% better than B"
- "Contacts with trigger word 'heal' have 2x higher LTV"

**All queryable from timestamps** - no complex calculations needed.

---

## 🚨 IMPORTANT REMINDERS

1. **This is a DEV database** - Not production (that's why full write access is OK)
2. **User wants simplicity** - Don't over-engineer, just make it work
3. **Always use Firecrawl** - For any web research/docs
4. **Check CLAUDE.md** - Has full tool usage guide
5. **Old data is safe** - In archive tables, still queryable

---

## 🤝 WORKING WITH THE USER

**Communication Style:**
- Explain things simply, like teaching a friend
- Show actual commands to run, don't just describe
- If something breaks, explain in plain English
- Don't assume deep technical knowledge

**User's Priorities:**
1. Clean, queryable data (top priority)
2. Automated analysis & reports
3. Actionable insights for client
4. ~~Dashboards~~ (nobody cares)

---

## ✅ READY TO GO

You should now have:
- ✅ Supabase MCP working (test with "Show me tables")
- ✅ Schema migration ready to run
- ✅ All context to continue the project
- ✅ Understanding of what we're building

**First thing to do:** Test Supabase MCP, then run the migration!

---

**Questions?** Check `CLAUDE.md` for comprehensive docs or just ask!
