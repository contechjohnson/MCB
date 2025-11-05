# Dynamic Update Function - Visual Flow

## The Problem (Before)

```
┌─────────────────────────────────────────────────────────────┐
│  Your Webhook Code                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  await supabase.from('contacts').update({                  │
│    subscribed: new Date(),                                 │
│    ig_last_interaction: new Date()                         │
│  }).eq('id', contactId);                                   │
│                                                             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  Supabase TypeScript Client                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  Checks schema cache...                                     │
│  ❌ "subscribed" not found in cached schema                │
│  ❌ "ig_last_interaction" not found in cached schema       │
│                                                             │
│  ERROR: Column does not exist                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## The Solution (After)

```
┌─────────────────────────────────────────────────────────────┐
│  Your Webhook Code                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  await supabase.rpc('update_contact_dynamic', {            │
│    contact_id: contactId,                                  │
│    update_data: {                                          │
│      subscribed: new Date().toISOString(),                 │
│      ig_last_interaction: new Date().toISOString(),        │
│      first_name: 'John',                                   │
│      stage: 'new_lead'                                     │
│    }                                                        │
│  });                                                        │
│                                                             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  Supabase RPC (Remote Procedure Call)                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  Calls PostgreSQL function directly                         │
│  ✅ Bypasses schema cache                                  │
│  ✅ Function exists in database                            │
│                                                             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL Function: update_contact_dynamic()              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  Receives JSONB: {                                          │
│    "subscribed": "2025-11-05T12:00:00Z",                   │
│    "ig_last_interaction": "2025-11-05T12:00:00Z",          │
│    "first_name": "John",                                   │
│    "stage": "new_lead"                                     │
│  }                                                          │
│                                                             │
│  Executes: UPDATE contacts SET                              │
│    subscribed = COALESCE(...),                             │
│    ig_last_interaction = COALESCE(...),                    │
│    first_name = COALESCE(...),                             │
│    stage = COALESCE(...),                                  │
│    updated_at = NOW()                                      │
│  WHERE id = contact_id;                                    │
│                                                             │
│  ✅ All columns exist in actual database                   │
│  ✅ Update succeeds                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Benefits Illustrated

### 1. Flexible Updates

```
Traditional Update (rigid):
──────────────────────────
await supabase.from('contacts').update({
  first_name: 'John',      ← Must specify ALL fields
  last_name: 'Doe',        ← or they become NULL!
  email: 'john@example.com',
  phone: '+1-555-1234',
  // ... 40+ more fields
})

Dynamic Update (flexible):
──────────────────────────
await supabase.rpc('update_contact_dynamic', {
  contact_id: id,
  update_data: {
    first_name: 'John'     ← Only update what you need!
  }                         ← Other fields stay unchanged
})
```

### 2. No Schema Cache Issues

```
┌──────────────────────┐
│  Database (Truth)    │  ← Contains ALL columns including new ones
│  ━━━━━━━━━━━━━━━━━━  │
│  subscribed ✓        │
│  ig_last_interaction ✓│
│  ig_id ✓             │
└──────────────────────┘
         ↑
         │ Function queries directly
         │
┌──────────────────────┐
│  update_contact_     │
│  dynamic()           │
│  ━━━━━━━━━━━━━━━━━━  │
│  Bypasses cache ✓    │
└──────────────────────┘
         ↑
         │
┌──────────────────────┐       ┌──────────────────────┐
│  Your Webhook        │       │  Supabase Client     │
│  Code                │       │  Schema Cache        │
│  ━━━━━━━━━━━━━━━━━━  │       │  ━━━━━━━━━━━━━━━━━━  │
│  Uses RPC ✓          │       │  subscribed ✗        │
│                      │       │  ig_last_interaction ✗│
└──────────────────────┘       │  ig_id ✗             │
                               └──────────────────────┘
                                 ↑ Outdated, but doesn't matter!
```

### 3. Type Safety Built-In

```javascript
// The function handles type casting automatically!

update_data: {
  first_name: 'John',              // → TEXT ✓
  ig_id: 123456789,                // → BIGINT ✓
  subscribed: '2025-11-05T12:00Z', // → TIMESTAMPTZ ✓
  purchase_amount: 99.99           // → DECIMAL(10,2) ✓
}

// PostgreSQL function:
// first_name = COALESCE((update_data->>'first_name')::TEXT, first_name)
//                                                   ^^^^^^
//                                                   Auto-cast!
```

## Real-World Example: ManyChat Webhook

```
┌─────────────────────────────────────────────────────────────┐
│  1. ManyChat sends webhook                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  POST /api/manychat                                        │
│  {                                                          │
│    "subscriber_id": "mc_12345",                            │
│    "first_name": "Sarah",                                  │
│    "instagram_username": "@sarah",                         │
│    "custom_fields": {                                      │
│      "Q1": "3 months",                                     │
│      "trigger_word": "start"                               │
│    }                                                        │
│  }                                                          │
│                                                             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Webhook handler processes data                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  // Find or create contact                                  │
│  contactId = findOrCreate(mc_id)                           │
│                                                             │
│  // Prepare update data                                     │
│  updateData = {                                            │
│    first_name: 'Sarah',                                    │
│    ig: '@sarah',                                           │
│    q1_question: '3 months',                                │
│    trigger_word: 'start',                                  │
│    subscribed: now(),                                      │
│    ig_last_interaction: now(),                             │
│    stage: 'new_lead'                                       │
│  }                                                          │
│                                                             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Call dynamic update function                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  await supabase.rpc('update_contact_dynamic', {            │
│    contact_id: 'uuid-here',                                │
│    update_data: updateData                                 │
│  })                                                         │
│                                                             │
│  ✅ Success!                                                │
│                                                             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Database is updated                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  contacts table:                                            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ id          | uuid-here                               │ │
│  │ mc_id       | mc_12345                                │ │
│  │ first_name  | Sarah                                   │ │
│  │ ig          | @sarah                                  │ │
│  │ q1_question | 3 months                                │ │
│  │ trigger_word| start                                   │ │
│  │ subscribed  | 2025-11-05 12:00:00+00                  │ │
│  │ ig_last_int | 2025-11-05 12:00:00+00                  │ │
│  │ stage       | new_lead                                │ │
│  │ updated_at  | 2025-11-05 12:00:00+00 (auto)           │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Comparison Table

| Feature | Traditional Update | Dynamic Update Function |
|---------|-------------------|------------------------|
| Schema cache issues | ❌ Often fails with new columns | ✅ Bypasses cache entirely |
| Partial updates | ❌ Must specify all fields | ✅ Only update what you need |
| Type safety | ⚠️ Client-side only | ✅ Database-enforced |
| Flexibility | ❌ Rigid schema | ✅ Dynamic JSONB input |
| Code complexity | ⚠️ Verbose | ✅ Simple and clean |
| Performance | ✅ Direct query | ✅ Direct query (same) |
| Debugging | ⚠️ Client-side errors | ✅ Database-side errors |

## Bottom Line

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  OLD WAY (Broken):                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  supabase.from('contacts').update(data)                    │
│                                                             │
│  ❌ Schema cache issues                                     │
│  ❌ Must specify all fields                                 │
│  ❌ Brittle                                                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  NEW WAY (Works):                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                             │
│  supabase.rpc('update_contact_dynamic', {                  │
│    contact_id: id,                                         │
│    update_data: data                                       │
│  })                                                         │
│                                                             │
│  ✅ No schema cache issues                                 │
│  ✅ Update only what you need                              │
│  ✅ Robust and flexible                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
