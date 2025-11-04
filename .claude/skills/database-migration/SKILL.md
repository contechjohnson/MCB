---
name: database-migration
description: Generate SQL database migrations for Supabase/PostgreSQL. Use when creating new tables, modifying schemas, adding indexes, or making any database structure changes. Triggers include "migration", "schema change", "add column", "create table", "add index".
allowed-tools: Read, Write, Grep, Glob
---

# Database Migration Generator

This skill helps you create well-structured SQL migrations for Supabase/PostgreSQL databases following best practices.

## When to Use This Skill

Use this skill when you need to:
- Create new database tables
- Add or modify columns
- Create indexes for performance
- Add database constraints
- Set up triggers or functions
- Modify existing schema
- Add comments to database objects

## Migration Best Practices

### 1. File Naming Convention
```
migrations/
├── 001_initial_schema.sql
├── 002_add_user_fields.sql
├── 003_add_indexes.sql
├── 004_add_timestamps.sql
└── 005_add_triggers.sql
```

Always use sequential numbering and descriptive names.

### 2. Migration Structure

Each migration should:
- Be idempotent (safe to run multiple times)
- Include helpful comments
- Use proper PostgreSQL types
- Set sensible defaults
- Add indexes where needed

### 3. Column Types to Use

```sql
-- Text
name TEXT NOT NULL
email TEXT UNIQUE
description TEXT

-- Numbers
age INTEGER
price DECIMAL(10, 2)
rating REAL

-- Booleans
is_active BOOLEAN DEFAULT TRUE
has_paid BOOLEAN DEFAULT FALSE

-- Dates/Times (ALWAYS use WITH TIME ZONE)
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
event_date TIMESTAMP WITH TIME ZONE

-- JSON
metadata JSONB DEFAULT '{}'::jsonb
settings JSONB

-- Arrays
tags TEXT[]
ids UUID[]

-- UUIDs
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id UUID REFERENCES users(id)
```

### 4. Required Patterns

#### Every Table Should Have:
```sql
CREATE TABLE table_name (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Your columns here
  name TEXT NOT NULL,
  email TEXT UNIQUE,

  -- Timestamps (ALWAYS include these)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add helpful comments
COMMENT ON TABLE table_name IS 'Description of what this table stores';
COMMENT ON COLUMN table_name.name IS 'User full name';
```

#### Auto-Update Timestamp Trigger:
```sql
-- Add this function once (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add this trigger to every table
CREATE TRIGGER update_table_name_updated_at
BEFORE UPDATE ON table_name
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

## Migration Templates

### Create New Table
```sql
-- Migration: Create contacts table
-- Created: 2024-11-02

BEGIN;

CREATE TABLE IF NOT EXISTS contacts (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiers
  mcid TEXT UNIQUE NOT NULL,
  email TEXT,
  phone TEXT,

  -- Personal Info
  first_name TEXT,
  last_name TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Status
  stage TEXT NOT NULL DEFAULT 'new',
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contacts_email ON contacts (email);
CREATE INDEX idx_contacts_stage ON contacts (stage);
CREATE INDEX idx_contacts_created_at ON contacts (created_at DESC);

-- Comments
COMMENT ON TABLE contacts IS 'Central table for all contact data';
COMMENT ON COLUMN contacts.mcid IS 'ManyChat unique identifier';
COMMENT ON COLUMN contacts.metadata IS 'Flexible JSONB storage for additional data';

-- Trigger for auto-updating updated_at
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMIT;
```

### Add Column to Existing Table
```sql
-- Migration: Add purchase tracking to contacts
-- Created: 2024-11-02

BEGIN;

-- Add new columns
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS purchase_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS purchase_currency TEXT DEFAULT 'USD';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_contacts_purchased_at
ON contacts (purchased_at DESC)
WHERE purchased_at IS NOT NULL; -- Partial index for efficiency

-- Add comments
COMMENT ON COLUMN contacts.purchased_at IS 'Timestamp when purchase was completed';
COMMENT ON COLUMN contacts.purchase_amount IS 'Purchase amount in specified currency';

COMMIT;
```

### Add Index
```sql
-- Migration: Add performance indexes
-- Created: 2024-11-02

BEGIN;

-- Single column indexes
CREATE INDEX IF NOT EXISTS idx_contacts_stage
ON contacts (stage);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_contacts_stage_created
ON contacts (stage, created_at DESC);

-- Partial indexes for specific queries
CREATE INDEX IF NOT EXISTS idx_active_leads
ON contacts (created_at DESC)
WHERE stage = 'lead' AND is_active = TRUE;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_contacts_metadata
ON contacts USING GIN (metadata);

COMMIT;
```

### Add Constraint
```sql
-- Migration: Add email validation constraint
-- Created: 2024-11-02

BEGIN;

-- Add check constraint
ALTER TABLE contacts
ADD CONSTRAINT email_format_check
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add foreign key constraint
ALTER TABLE orders
ADD CONSTRAINT fk_orders_contact
FOREIGN KEY (contact_id) REFERENCES contacts(id)
ON DELETE CASCADE;

COMMIT;
```

### Add Database Function
```sql
-- Migration: Add stage calculation function
-- Created: 2024-11-02

BEGIN;

CREATE OR REPLACE FUNCTION calculate_contact_stage()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate stage based on progression
  IF NEW.purchased_at IS NOT NULL THEN
    NEW.stage = 'purchased';
  ELSIF NEW.attended_at IS NOT NULL THEN
    NEW.stage = 'attended';
  ELSIF NEW.booked_at IS NOT NULL THEN
    NEW.stage = 'booked';
  ELSIF NEW.lead_captured_at IS NOT NULL THEN
    NEW.stage = 'lead';
  ELSE
    NEW.stage = 'new';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER set_contact_stage
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION calculate_contact_stage();

COMMIT;
```

## Safety Checks

Before running any migration:

1. **Back up your database** (Supabase has automatic backups)
2. **Test on staging first** if you have a staging environment
3. **Use transactions** (BEGIN...COMMIT) to allow rollback
4. **Use IF NOT EXISTS** to make migrations idempotent
5. **Check for dependencies** before dropping anything

## Common Pitfalls to Avoid

❌ **Don't do this:**
```sql
-- Missing IF NOT EXISTS (fails if run twice)
CREATE TABLE contacts (...);

-- No default timezone
created_at TIMESTAMP

-- Nullable when it shouldn't be
email TEXT

-- No indexes on foreign keys
user_id UUID REFERENCES users(id)
```

✅ **Do this instead:**
```sql
-- Safe to run multiple times
CREATE TABLE IF NOT EXISTS contacts (...);

-- Always use WITH TIME ZONE
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

-- Set NOT NULL appropriately
email TEXT NOT NULL

-- Index foreign keys
user_id UUID REFERENCES users(id)
CREATE INDEX idx_table_user_id ON table_name (user_id);
```

## Instructions for Claude

When asked to create a migration:

1. **Understand the requirement**
   - What needs to be changed?
   - What are the implications?
   - What indexes are needed?

2. **Create the migration file**
   - Use sequential numbering
   - Add descriptive name
   - Include helpful comments

3. **Write the SQL**
   - Use proper column types
   - Add indexes where needed
   - Include constraints
   - Add comments for clarity

4. **Wrap in transaction**
   - Use BEGIN...COMMIT
   - Use IF NOT EXISTS where appropriate

5. **Test the migration**
   - Verify it's idempotent
   - Check it doesn't break existing data
   - Ensure indexes are used

## Example Usage

**User asks:** "Add a booking_url column to contacts"

**You respond with:**
```sql
-- Migration: Add booking URL tracking
-- Created: 2024-11-02

BEGIN;

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS booking_url TEXT,
ADD COLUMN IF NOT EXISTS booking_clicked_at TIMESTAMP WITH TIME ZONE;

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_contacts_booking_clicked
ON contacts (booking_clicked_at DESC)
WHERE booking_clicked_at IS NOT NULL;

-- Comments
COMMENT ON COLUMN contacts.booking_url IS 'Cal.com or other booking link sent to contact';
COMMENT ON COLUMN contacts.booking_clicked_at IS 'When contact clicked the booking link';

COMMIT;
```

## Reference

For more details on PostgreSQL types and syntax:
- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)
- [Supabase SQL Guide](https://supabase.com/docs/guides/database/overview)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)

Remember: Good migrations are idempotent, well-commented, and include appropriate indexes!
