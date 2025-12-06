# Orphan Payment Analysis & Solutions

**Date:** November 19, 2025
**Investigated By:** Claude
**Status:** ✅ RESOLVED (current orphans), 🔨 NEEDS FIX (future prevention)

---

## Summary

Both orphan payments have been **successfully linked** to their contacts:

| Contact | Payment Source | Amount | Status |
|---------|---------------|--------|--------|
| Rachel Barton (rachel.hatton95@gmail.com) | Denefits | $2,475 | ✅ LINKED |
| Irma Vazquez (vazquez.i.irma@gmail.com) | Stripe | $747 | ✅ LINKED |

**Total Revenue Recovered:** $3,222

---

## Root Cause: Webhook Race Condition

### Timeline Analysis

**Rachel Barton (Denefits):**
```
03:15:32  Denefits webhook fires → Contact not found → Saved as orphan
03:15:43  ManyChat webhook fires → Contact created (11 seconds later)
```

**Irma Vazquez (Stripe):**
```
16:42:19  Stripe webhook fires → Contact not found → Saved as orphan
16:42:33  ManyChat webhook fires → Contact created (14 seconds later)
```

### Why This Happens

**Customer Journey:**
1. Customer completes checkout (Stripe/Denefits)
2. Payment webhook fires **immediately**
3. Webhook tries to find contact by email → **doesn't exist yet**
4. Payment saved with `contact_id: null` (orphaned)
5. ~10-15 seconds later: ManyChat webhook fires
6. Contact created in database
7. **Payment remains orphaned** (no retry logic)

**Key Issue:** Payment webhooks arrive **before** ManyChat creates the contact.

---

## Current Webhook Behavior

### Stripe Webhook (`/app/api/stripe-webhook/route.ts:197-223`)

```typescript
// Find contact by email (checks all 3 email fields)
const { data: contactId } = await supabaseAdmin
  .rpc('find_contact_by_email', { search_email: email });

// Log payment (works for both matched and orphan payments)
await supabaseAdmin.from('payments').insert({
  contact_id: contactId || null,  // NULL = orphan ❌
  // ... rest of payment data
});

if (!contactId) {
  console.warn('No contact found for email:', email, '- Payment logged as orphan');
  return;  // ❌ No retry, just gives up
}
```

### Denefits Webhook (`/app/api/denefits-webhook/route.ts:72-74`)

```typescript
// Find contact by email (checks all 3 email fields)
const { data: contactId } = await supabaseAdmin
  .rpc('find_contact_by_email', { search_email: email.toLowerCase().trim() });

// Similar behavior - saves as orphan if not found ❌
```

**Current Limitation:** Both webhooks make **one attempt** to find the contact. If not found, payment is orphaned forever.

---

## Solutions

### Option 1: Add Retry Logic ⭐ RECOMMENDED

**Best for:** Race conditions where contact will exist within seconds.

**Implementation:**
```typescript
async function findContactWithRetry(email: string, maxRetries = 3) {
  const delays = [0, 5000, 15000]; // 0s, 5s, 15s

  for (let i = 0; i < maxRetries; i++) {
    // Wait before retry (skip first attempt)
    if (delays[i] > 0) {
      console.log(`Retrying contact lookup in ${delays[i]/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delays[i]));
    }

    const { data: contactId } = await supabaseAdmin
      .rpc('find_contact_by_email', { search_email: email });

    if (contactId) {
      console.log(`Contact found on attempt ${i + 1}`);
      return contactId;
    }
  }

  console.warn('Contact not found after all retries');
  return null;
}
```

**Usage:**
```typescript
// In handleCheckoutCompleted()
const contactId = await findContactWithRetry(email);

if (!contactId) {
  console.warn('Saving as orphan - contact may be created later');
}
```

**Pros:**
- Simple to implement
- Solves 90%+ of race condition cases
- No additional infrastructure needed

**Cons:**
- Delays webhook response (max 20 seconds with 3 retries)
- Webhooks may timeout if delays too long

---

### Option 2: Background Orphan Resolution

**Best for:** When you want to keep webhooks fast and handle linking later.

**Implementation:**
```typescript
// 1. Create a cron job that runs every 5 minutes
// /app/api/cron/link-orphan-payments/route.ts

export async function GET() {
  // Find orphan payments
  const { data: orphans } = await supabaseAdmin
    .from('payments')
    .select('*')
    .is('contact_id', null);

  let linkedCount = 0;

  for (const payment of orphans) {
    // Try to find contact
    const { data: contactId } = await supabaseAdmin
      .rpc('find_contact_by_email', { search_email: payment.customer_email });

    if (contactId) {
      // Link payment to contact
      await supabaseAdmin
        .from('payments')
        .update({ contact_id: contactId })
        .eq('id', payment.id);

      // Update contact with purchase info
      await updateContactWithPurchase(contactId, payment);

      linkedCount++;
    }
  }

  return NextResponse.json({
    success: true,
    orphansFound: orphans.length,
    linked: linkedCount
  });
}
```

**Vercel Cron Configuration** (vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/cron/link-orphan-payments",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Pros:**
- Webhooks stay fast (no delays)
- Handles all orphans, not just race conditions
- Automatic self-healing

**Cons:**
- Payments may be orphaned for up to 5 minutes
- Additional cron job to maintain

---

### Option 3: Webhook Ordering (Ideal but May Not Be Possible)

**Best for:** When you can control webhook timing.

**Requirements:**
1. Configure ManyChat to fire webhook **before** customer goes to checkout
2. Ensures contact exists before payment

**Challenges:**
- May not be possible with current ManyChat setup
- Requires changing customer flow
- Users might abandon between ManyChat and checkout

---

## Recommended Approach

### Hybrid Solution: Retry + Background Cleanup

**Phase 1: Immediate (Add Retry Logic)**
```typescript
// In both Stripe and Denefits webhooks
const contactId = await findContactWithRetry(email, 3);
```

This solves ~90% of race conditions (contacts created within 15 seconds).

**Phase 2: Safety Net (Add Background Job)**
```typescript
// Cron job every 5 minutes
// Catches edge cases where contact created after retry period
```

This handles:
- Contacts created after 15 seconds
- Contacts added manually via CSV import
- Any other edge cases

**Combined Benefits:**
- Fast response for most cases (contact found within 15s)
- Automatic cleanup for edge cases
- Zero orphans after 5 minutes

---

## Implementation Priority

### High Priority (Implement Now)
1. ✅ Fix current orphans (DONE)
2. 🔨 Add retry logic to Stripe webhook
3. 🔨 Add retry logic to Denefits webhook

### Medium Priority (Next Week)
4. 🔨 Create background orphan resolution cron job
5. 🔨 Add monitoring/alerts for orphan rate

### Low Priority (Future)
6. 🔍 Investigate ManyChat webhook timing
7. 🔍 Consider webhook ordering changes

---

## Testing Plan

### Test Retry Logic
```bash
# 1. Create test payment webhook (simulate Stripe)
curl -X POST http://localhost:3000/api/stripe-webhook \
  -H "Content-Type: application/json" \
  -d '{...}'

# 2. Wait 5 seconds, create contact via ManyChat webhook
# 3. Verify payment links after retry
```

### Test Background Job
```bash
# 1. Create orphan payment manually
# 2. Trigger cron job
curl http://localhost:3000/api/cron/link-orphan-payments
# 3. Verify orphan is linked
```

---

## Monitoring

### Key Metrics to Track

**Orphan Rate:**
```sql
SELECT
  COUNT(*) as total_payments,
  COUNT(contact_id) as linked,
  COUNT(*) - COUNT(contact_id) as orphaned,
  ROUND(100.0 * (COUNT(*) - COUNT(contact_id)) / COUNT(*), 1) as orphan_pct
FROM payments;
```

**Target:** < 5% orphan rate

**Alert Threshold:** > 10% orphan rate (something's broken)

---

## Files to Modify

### Add Retry Logic
- `/app/api/stripe-webhook/route.ts` (lines 197-223)
- `/app/api/denefits-webhook/route.ts` (lines 72-74)

### Add Background Job
- `/app/api/cron/link-orphan-payments/route.ts` (new file)
- `/vercel.json` (add cron configuration)

### Add Monitoring
- `/scripts/check-orphan-payments.js` (new script for manual checks)

---

## Next Steps

1. Review this analysis
2. Choose solution approach (recommend Hybrid)
3. Implement retry logic in webhooks
4. Test with simulated race conditions
5. Deploy to production
6. Monitor orphan rate over next week
7. Add background job if needed

---

## Questions?

- Should we alert on orphan payments immediately?
- What's acceptable delay for payment attribution? (15s? 5 min?)
- Do we want to manually review orphans weekly?
