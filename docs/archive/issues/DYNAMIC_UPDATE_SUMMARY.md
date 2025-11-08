# Dynamic Contact Update Function - Quick Summary

## What You Have

I've created a PostgreSQL function that solves your Supabase schema cache issues by allowing dynamic, flexible contact updates.

## Files Created

1. **`migration_update_contact_dynamic.sql`** - The SQL migration to create the function
2. **`test-dynamic-update.js`** - Automated test script to verify it works
3. **`MIGRATION_INSTRUCTIONS.md`** - Detailed usage guide
4. **`DYNAMIC_UPDATE_SUMMARY.md`** - This file (quick reference)

## Quick Start (3 Steps)

### Step 1: Apply the Migration

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Go to **SQL Editor**
3. Copy ALL the SQL from `migration_update_contact_dynamic.sql`
4. Paste it and click **Run**

### Step 2: Test It

```bash
node test-dynamic-update.js
```

Should output: ✅ All tests passed!

### Step 3: Use It in Your Webhooks

```javascript
// In your webhook code (e.g., ManyChat webhook)
const { error } = await supabaseAdmin.rpc('update_contact_dynamic', {
  contact_id: contactId,
  update_data: {
    first_name: 'John',
    subscribed: new Date().toISOString(),
    ig_last_interaction: new Date().toISOString(),
    stage: 'new_lead'
  }
});
```

## Why This Solves Your Problem

**Before (broken):**
```javascript
// Supabase schema cache doesn't know about new columns
await supabase.from('contacts').update({
  subscribed: ...,        // ❌ Column not in schema cache
  ig_last_interaction: ...  // ❌ Column not in schema cache
})
```

**After (works):**
```javascript
// PostgreSQL function bypasses the cache
await supabase.rpc('update_contact_dynamic', {
  contact_id: id,
  update_data: {
    subscribed: ...,         // ✅ Works!
    ig_last_interaction: ... // ✅ Works!
  }
})
```

## What Fields Can You Update?

**All of them!** Including:
- Basic info: first_name, last_name, email_primary, phone
- Social: ig, ig_id, fb
- IDs: mc_id, ghl_id, ad_id, stripe_customer_id
- Timestamps: subscribed, ig_last_interaction, dm_qualified_date, etc.
- Stage: stage (current funnel position)
- Questions: q1_question, q2_question, objections
- AI: thread_id, lead_summary

## Key Features

✅ **Partial updates** - Only update fields you provide
✅ **Safe** - Existing data is preserved
✅ **Bypasses cache** - Works immediately without Supabase schema refresh
✅ **Type-safe** - Automatic type casting (TEXT, TIMESTAMPTZ, BIGINT, etc.)
✅ **Auto-updates** - `updated_at` is automatically set to NOW()

## Common Usage Patterns

### Pattern 1: ManyChat Webhook
```javascript
const { error } = await supabaseAdmin.rpc('update_contact_dynamic', {
  contact_id: contactId,
  update_data: {
    first_name: payload.first_name,
    last_name: payload.last_name,
    phone: payload.phone,
    subscribed: new Date().toISOString(),
    ig: payload.instagram_username,
    ig_id: payload.instagram_id,
    ig_last_interaction: new Date().toISOString(),
    stage: 'new_lead'
  }
});
```

### Pattern 2: Stage Progression
```javascript
const { error } = await supabaseAdmin.rpc('update_contact_dynamic', {
  contact_id: contactId,
  update_data: {
    stage: 'dm_qualified',
    dm_qualified_date: new Date().toISOString(),
    q1_question: answer1,
    q2_question: answer2
  }
});
```

### Pattern 3: Just One Field
```javascript
const { error } = await supabaseAdmin.rpc('update_contact_dynamic', {
  contact_id: contactId,
  update_data: {
    link_click_date: new Date().toISOString()
  }
});
```

## Troubleshooting

**"Function not found"**
→ You haven't applied the migration yet. Copy the SQL to Supabase SQL Editor.

**"Cannot cast type"**
→ Use `.toISOString()` for timestamps: `new Date().toISOString()`

**Updates not showing**
→ Hard refresh Supabase dashboard (Cmd+Shift+R) or query directly with SQL

## Next Steps

1. Apply the migration in Supabase SQL Editor
2. Run `node test-dynamic-update.js` to verify
3. Update your ManyChat webhook to use this function
4. Update any other webhooks that need flexible updates

## File Locations

- Migration SQL: `/Users/connorjohnson/CLAUDE_CODE/MCB/migration_update_contact_dynamic.sql`
- Test Script: `/Users/connorjohnson/CLAUDE_CODE/MCB/test-dynamic-update.js`
- Full Guide: `/Users/connorjohnson/CLAUDE_CODE/MCB/MIGRATION_INSTRUCTIONS.md`
