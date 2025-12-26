---
description: Generate SQL database migrations for Supabase/PostgreSQL. Use when creating new tables, modifying schemas, adding indexes, or making any database structure changes. Triggers include "migration", "schema change", "add column", "create table", "add index".
---

Generate a SQL database migration for: $ARGUMENTS

**Migration Guidelines:**

1. **File Naming:** `migrations/YYYYMMDD_NNN_description.sql`
   - Example: `migrations/20251225_001_add_user_preferences.sql`

2. **Migration Structure:**
```sql
-- Migration: [Description]
-- Purpose: [Why this change is needed]
-- Date: [YYYY-MM-DD]
-- Status: PENDING

-- ============================================
-- STEP 1: [Description of first change]
-- ============================================

[SQL statements]

-- ============================================
-- STEP 2: [Description of second change]
-- ============================================

[SQL statements]

-- ============================================
-- VERIFICATION: Confirm changes applied
-- ============================================

[Verification queries]
```

3. **Safety Rules:**
   - Use `IF EXISTS` / `IF NOT EXISTS` for idempotency
   - Drop dependent views before modifying columns
   - Add comments documenting the change
   - Never hardcode UUIDs for data migrations

4. **Events-First Architecture (Dec 2025):**
   - `funnel_events` is source of truth - don't add date columns to contacts
   - Use `tags` JSONB for flexible metadata
   - Contact table is identity + current state only

**Application:**
```bash
# Apply via Supabase MCP
mcp__supabase__apply_migration with project_id: succdcwblbzikenhhlrz
```

**Supabase Project ID:** `succdcwblbzikenhhlrz`
