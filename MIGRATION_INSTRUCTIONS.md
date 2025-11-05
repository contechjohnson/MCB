# Dynamic Contact Update Function - Migration Instructions

## What This Does

This migration creates a PostgreSQL function called `update_contact_dynamic()` that allows you to update contacts with a flexible JSONB object, bypassing Supabase's schema cache.

**Benefits:**
- Update any number of fields without needing to specify all of them
- Bypass Supabase TypeScript schema cache issues
- Safer updates (only provided fields are changed)
- Works with all contact fields including timestamps

## How to Apply This Migration

### Option 1: Supabase SQL Editor (Recommended)

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Click on your project
3. Go to **SQL Editor** in the left sidebar
4. Click **+ New Query**
5. Copy the entire contents of `migration_update_contact_dynamic.sql`
6. Paste it into the SQL editor
7. Click **Run** (or press Cmd+Enter / Ctrl+Enter)
8. You should see "Success. No rows returned"

### Option 2: Supabase CLI (If you have it installed)

```bash
# If you haven't linked your project yet
supabase login
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push migration_update_contact_dynamic.sql
```

## Testing the Function

After applying the migration, run the test script:

```bash
node test-dynamic-update.js
```

This will:
1. Check if the function exists
2. Create a test contact
3. Update it with the dynamic function
4. Verify the updates worked
5. Test partial updates (to ensure existing data isn't overwritten)
6. Clean up test data

## Usage Examples

### From Your Webhook Code

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, serviceRoleKey);

// Example 1: Update just a few fields
const { error } = await supabase.rpc('update_contact_dynamic', {
  contact_id: 'your-contact-uuid',
  update_data: {
    first_name: 'John',
    email_primary: 'john@example.com',
    stage: 'dm_qualified'
  }
});

// Example 2: Update timestamps from webhook
const { error } = await supabase.rpc('update_contact_dynamic', {
  contact_id: contactId,
  update_data: {
    subscribed: new Date().toISOString(),
    ig_last_interaction: new Date().toISOString(),
    stage: 'new_lead'
  }
});

// Example 3: Update social media fields
const { error } = await supabase.rpc('update_contact_dynamic', {
  contact_id: contactId,
  update_data: {
    ig: '@username',
    ig_id: 123456789,
    ig_last_interaction: new Date().toISOString()
  }
});

// Example 4: Bulk update from ManyChat webhook
const webhookData = {
  first_name: payload.first_name,
  last_name: payload.last_name,
  phone: payload.phone,
  subscribed: new Date(payload.subscribed_at).toISOString(),
  ig: payload.instagram_username,
  stage: 'new_lead'
};

const { error } = await supabase.rpc('update_contact_dynamic', {
  contact_id: contactId,
  update_data: webhookData
});
```

### Direct SQL Query (in Supabase SQL Editor)

```sql
-- Update a contact
SELECT update_contact_dynamic(
  'your-contact-uuid-here'::UUID,
  '{"first_name": "John", "stage": "dm_qualified", "dm_qualified_date": "2025-11-05T12:00:00Z"}'::JSONB
);

-- Check the result
SELECT * FROM contacts WHERE id = 'your-contact-uuid-here';
```

## Supported Fields

All contact table fields are supported:

**Contact Info:**
- first_name, last_name
- email_primary, email_booking, email_payment
- phone

**Social Media:**
- ig, ig_id, fb

**External IDs:**
- mc_id, ghl_id, ad_id, stripe_customer_id

**AB Testing:**
- chatbot_ab, misc_ab, trigger_word

**Questions:**
- q1_question, q2_question, objections, lead_summary

**AI Context:**
- thread_id

**Timestamps:**
- subscribed, subscribe_date, followed_date
- ig_last_interaction
- dm_qualified_date, link_send_date, link_click_date
- form_submit_date, meeting_book_date, meeting_held_date
- checkout_started, purchase_date, purchase_amount
- feedback_sent_date, feedback_received_date, feedback_text

**Stage:**
- stage (current funnel position)

## How It Works

The function uses COALESCE to only update fields that are provided:

```sql
-- If first_name is in update_data, use it; otherwise keep current value
first_name = COALESCE((update_data->>'first_name')::TEXT, first_name)
```

This means:
- ✅ Only fields you provide are updated
- ✅ Missing fields keep their current values
- ✅ You can safely do partial updates
- ✅ Bypasses Supabase's TypeScript schema cache

## Troubleshooting

### Function not found error

If you get "Could not find the function update_contact_dynamic":
1. The migration hasn't been applied yet
2. Run the SQL from `migration_update_contact_dynamic.sql` in Supabase SQL Editor

### Type casting errors

If you get type casting errors (e.g., "cannot cast type text to timestamp"):
- Make sure timestamp fields are ISO 8601 strings: `new Date().toISOString()`
- Make sure numeric fields (like ig_id) are numbers, not strings

### Updates not reflected immediately

Supabase caches schema info. If updates don't show immediately:
1. Hard refresh your Supabase dashboard (Cmd+Shift+R / Ctrl+Shift+R)
2. Wait a few seconds for cache to update
3. Query directly with `SELECT * FROM contacts WHERE id = 'xxx'` to verify

## Migration File Location

- **SQL File:** `/Users/connorjohnson/CLAUDE_CODE/MCB/migration_update_contact_dynamic.sql`
- **Test Script:** `/Users/connorjohnson/CLAUDE_CODE/MCB/test-dynamic-update.js`
- **This Guide:** `/Users/connorjohnson/CLAUDE_CODE/MCB/MIGRATION_INSTRUCTIONS.md`
