# Manual Denefits Webhook Processing Guide

**Problem:** Denefits isn't reliably sending webhooks to your endpoint.

**Solution:** Manually process missing Denefits contracts using this script.

---

## Quick Start

### Method 1: Paste JSON Directly

```bash
node scripts/manual-denefits-webhook.js
# Then paste the JSON and press Ctrl+D (Mac/Linux) or Ctrl+Z (Windows)
```

### Method 2: From File

```bash
# Save JSON to a file
echo '[{ "webhook_type": "contract.created", ... }]' > denefits-payload.json

# Process it
node scripts/manual-denefits-webhook.js denefits-payload.json
```

---

## Step-by-Step Example

### 1. Get the JSON from Denefits

Go to Denefits dashboard and copy the webhook JSON. It should look like:

```json
[
    {
        "webhook_type": "contract.created",
        "data": {
            "contract": {
                "contract_id": 139405,
                "contract_code": "LVKT9Z139405",
                "customer_first_name": "Oghogho",
                "customer_last_name": "Okojie",
                "customer_email": "oghowoodson@gmail.com",
                "customer_mobile": "9294445021",
                "financed_amount": 2250,
                "recurring_amount": 125,
                "number_of_payments": 18,
                "date_added": "2025-11-13T17:16:15.000Z",
                "contract_status": "Active"
            }
        },
        "secret_key": "key_x9nnpj3cw4103ed"
    }
]
```

### 2. Run the Script

```bash
cd /Users/connorjohnson/CLAUDE_CODE/MCB
node scripts/manual-denefits-webhook.js
```

### 3. Paste the JSON

Paste the entire JSON payload (including the outer brackets `[]`)

### 4. Press Ctrl+D (Mac/Linux) or Ctrl+Z (Windows)

This tells the script you're done entering input.

### 5. Check the Output

You'll see:
```
✅ SUCCESS

   Contact ID: abc-123-def
   Event Type: contract.created
```

Or if contact not found:
```
✅ SUCCESS

   Contact ID: orphan
   Event Type: contract.created

⚠️  Payment logged as ORPHAN (no matching contact found)
   Search for contact with email: oghowoodson@gmail.com
```

---

## What It Does

1. ✅ Validates the JSON structure
2. ✅ Sends to your production webhook endpoint
3. ✅ Creates payment record in database
4. ✅ Updates contact to "purchased" stage
5. ✅ Links payment to contact (if email matches)

---

## Troubleshooting

### "Invalid JSON"
- Make sure you copied the ENTIRE JSON (including outer brackets)
- Check for trailing commas
- Use a JSON validator: https://jsonlint.com

### "Invalid payload structure"
- Missing `contract_code` or `customer_email`
- Check that JSON has this structure: `[{ "data": { "contract": { ... } } }]`

### "Payment logged as ORPHAN"
- Contact doesn't exist in your system yet
- Email from Denefits doesn't match any contact emails
- Contact might need to be created via ManyChat/GHL first

### Script hangs after pasting
- Press Ctrl+D (Mac/Linux) or Ctrl+Z (Windows) to signal end of input

---

## Batch Processing

If you have multiple contracts to process:

```bash
# Create a file with all payloads (one per line or in an array)
cat > batch.json << 'EOF'
[
  { "webhook_type": "contract.created", "data": { "contract": { ... } } },
  { "webhook_type": "contract.created", "data": { "contract": { ... } } }
]
EOF

# Process each one
node scripts/manual-denefits-webhook.js batch.json
```

Or process them individually:
```bash
# Process contract 1
echo '[{ ... }]' | node scripts/manual-denefits-webhook.js

# Process contract 2
echo '[{ ... }]' | node scripts/manual-denefits-webhook.js
```

---

## Finding Missing Contracts

### Option 1: Compare Denefits Export to Database

```bash
# Export contracts from Denefits dashboard
# Then run this query in Supabase:

SELECT
  denefits_contract_code
FROM payments
WHERE payment_source = 'denefits';

# Compare to your Denefits export
# Process any missing contracts
```

### Option 2: Check Recent Contracts

In Denefits dashboard:
1. Filter by "Last 7 days"
2. Sort by "Date Added"
3. Check each contract against your database
4. Process any missing ones

---

## Why This Is Needed

**Problem:** Denefits webhooks are unreliable:
- Only 8 webhooks received out of 103+ contracts
- Nov 5 was the last automatic webhook
- Nov 11, Nov 13 contracts didn't trigger webhooks

**Root Cause:** Unknown - could be:
- Webhook URL got disabled in Denefits
- Denefits webhook system is broken
- Authentication/secret key issues
- Rate limiting or IP blocking

**Long-term Fix:** Contact Denefits support and fix webhook configuration.

**Short-term Fix:** Use this script to manually process contracts.

---

## Quick Reference

```bash
# Interactive mode
node scripts/manual-denefits-webhook.js

# From file
node scripts/manual-denefits-webhook.js payload.json

# Check if payment was created
node -e "
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await supabase.from('payments').select('*').eq('denefits_contract_code', 'CONTRACT_CODE_HERE');
  console.log(data);
})();
"
```

---

## Update Scripts/README.md

Add this to your scripts index:
```
manual-denefits-webhook.js - Process Denefits webhooks manually when Denefits fails to send them
```
