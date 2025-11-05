# Apply Fresh Contacts Table Schema

## Quick Instructions

The contacts table needs to be dropped and recreated fresh with all columns including:
- `subscribed` (TIMESTAMPTZ)
- `ig_last_interaction` (TIMESTAMPTZ)
- `ig_id` (BIGINT)

## Steps

1. Go to your Supabase SQL Editor:
   **https://supabase.com/dashboard/project/jllwlymufzzflhkxuhlg/editor**

2. Click **"New Query"**

3. Copy and paste the ENTIRE contents of this file:
   **`supabase/migrations/20250105000003_fresh_contacts_table_with_new_columns.sql`**

4. Click **"Run"** (or press Cmd/Ctrl + Enter)

5. You should see success messages for:
   - DROP TABLE (if it existed)
   - CREATE TABLE contacts
   - Multiple CREATE INDEX statements
   - Multiple CREATE FUNCTION statements
   - CREATE TRIGGER statement

6. Verify it worked by running this query:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'contacts'
   ORDER BY ordinal_position;
   ```

   You should see **41 columns** including:
   - subscribed (timestamp with time zone)
   - ig_last_interaction (timestamp with time zone)
   - ig_id (bigint)

## What This Does

1. **Drops** the old contacts table completely (CASCADE removes dependencies)
2. **Recreates** it with ALL columns in the schema
3. **Creates indexes** for fast lookups
4. **Creates helper functions** for finding contacts by ID, email, phone
5. **Creates trigger** for auto-updating `updated_at` timestamp

## After Running

Test that the new columns work:

```sql
-- Insert a test contact with new columns
INSERT INTO contacts (
  MC_ID,
  email_primary,
  subscribed,
  ig_id,
  ig_last_interaction
) VALUES (
  'test_mc_123',
  'test@example.com',
  NOW(),
  1234567890,
  NOW()
);

-- Query it back
SELECT
  MC_ID,
  email_primary,
  subscribed,
  ig_id,
  ig_last_interaction
FROM contacts
WHERE MC_ID = 'test_mc_123';

-- Clean up test data
DELETE FROM contacts WHERE MC_ID = 'test_mc_123';
```

## Troubleshooting

If you get errors:

1. **"permission denied"** - Make sure you're logged into the correct project
2. **"table does not exist"** - That's fine, it will create it fresh
3. **"function already exists"** - That's also fine, OR REPLACE will update them

## Done!

Once this runs successfully, your schema cache issues will be resolved because it's a completely fresh table with all columns defined.
