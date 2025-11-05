# Function: create_contact_with_mc_id

## Purpose
Creates a new contact in the database and returns its UUID. This bypasses the Supabase JS client's schema cache, which can cause issues when the client's cached schema doesn't match the actual database schema.

## Signature
```sql
create_contact_with_mc_id(
  mc_id TEXT,
  sub_date TIMESTAMPTZ,
  contact_stage TEXT
)
RETURNS UUID
```

## Parameters
- `mc_id` - The ManyChat subscriber ID (must be unique)
- `sub_date` - The subscription date (when they opted in)
- `contact_stage` - The funnel stage (e.g., 'new_lead', 'DM_qualified')

## Returns
The UUID of the newly created contact.

## Usage in API Routes

Instead of using the Supabase client's `.insert()`:

```typescript
// ❌ OLD WAY (can fail due to schema cache)
const { data, error } = await supabaseAdmin
  .from('contacts')
  .insert({
    MC_ID: mcId,
    subscribe_date: new Date().toISOString(),
    stage: 'new_lead'
  })
  .select('id')
  .single();
```

Use the SQL function via `.rpc()`:

```typescript
// ✅ NEW WAY (reliable, bypasses cache)
const { data, error } = await supabaseAdmin
  .rpc('create_contact_with_mc_id', {
    mc_id: mcId,
    sub_date: new Date().toISOString(),
    contact_stage: 'new_lead'
  });

const contactId = data; // This is the UUID
```

## Full Example

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// In your webhook handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Create new contact using the function
    const { data: contactId, error } = await supabaseAdmin
      .rpc('create_contact_with_mc_id', {
        mc_id: body.subscriber_id,
        sub_date: new Date().toISOString(),
        contact_stage: 'new_lead'
      });

    if (error) {
      console.error('Error creating contact:', error);
      throw error;
    }

    console.log('Created contact with ID:', contactId);

    // Now you can update additional fields if needed
    await supabaseAdmin
      .from('contacts')
      .update({
        first_name: body.first_name,
        email_primary: body.email
      })
      .eq('id', contactId);

    return NextResponse.json({ success: true, contactId });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 200 });
  }
}
```

## Testing

```sql
-- Test the function directly in SQL
SELECT create_contact_with_mc_id(
  'test_mc_12345',
  NOW(),
  'new_lead'
);
-- Returns: UUID (e.g., '453eda29-698e-464c-88ca-8a7adb95f46e')

-- Verify it was created
SELECT * FROM contacts WHERE MC_ID = 'test_mc_12345';
```

## Migration Applied
- **Date:** Nov 5, 2025
- **File:** `/Users/connorjohnson/CLAUDE_CODE/MCB/migrations/create_contact_insert_function.sql`
- **Status:** ✅ Applied to MCB_PPCU project

## Notes
- The function automatically sets `created_at` and `updated_at` to NOW()
- The function will fail if `mc_id` already exists (UNIQUE constraint)
- Permissions are granted to both `authenticated` and `service_role` roles
- This is more reliable than using the Supabase JS client's `.insert()` method
