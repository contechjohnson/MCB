# Meta Conversions API (CAPI) Directive

**Purpose:** Server-side conversion tracking for Meta (Facebook) Ads attribution.

**Status:** Implementation Phase (Week 1)

---

## What is CAPI?

Meta Conversions API (CAPI) allows you to send conversion events directly from your server to Meta, bypassing browser limitations (iOS 14+, ad blockers, etc.).

**Benefits:**
- Better attribution accuracy
- Works when pixel can't fire
- Combines with pixel for redundancy
- Required for full Meta Ads optimization

---

## Events We Track

| Event | Trigger | Webhook Source |
|-------|---------|---------------|
| **Lead** | DM qualifies (intending_to_send_link) | `/chatbot` |
| **AddToCart** | Call/consultation booked | `/ghl` |
| **InitiateCheckout** | Form submitted | `/perspective` |
| **Purchase** | Payment received | `/stripe`, `/denefits` |

---

## Architecture

```
Webhook Event → Queue to DB → Async Send to Meta
                    ↓
         meta_capi_events table
         (with retry tracking)
```

**Design Decisions:**
- Queue events in DB for reliability
- Retry failed sends up to 5 times
- Store hashed user data (SHA256)
- Track Meta response for debugging

---

## Database Table: meta_capi_events

| Column | Type | Purpose |
|--------|------|---------|
| `tenant_id` | UUID | Tenant isolation |
| `contact_id` | UUID | Link to contacts |
| `event_name` | TEXT | 'Lead', 'Purchase', etc. |
| `event_time` | TIMESTAMPTZ | When event occurred |
| `event_id` | TEXT | Dedup ID for Meta |
| `user_email_hash` | TEXT | SHA256 of email |
| `user_phone_hash` | TEXT | SHA256 of phone |
| `user_fbp` | TEXT | _fbp cookie value |
| `user_fbc` | TEXT | _fbc cookie value |
| `ad_id` | TEXT | Meta ad ID for attribution |
| `event_value` | NUMERIC | Purchase value |
| `sent_to_meta` | BOOL | Successfully sent |
| `send_attempts` | INT | Retry count |
| `meta_fbtrace_id` | TEXT | For debugging with Meta |

---

## Key Files

| File | Purpose |
|------|---------|
| `/lib/meta-capi/client.ts` | CAPI client and helpers |
| `/lib/meta-capi/client.ts` | Hash functions, event builders |

---

## Tenant Configuration

Store Meta credentials in `tenant_integrations`:

```sql
INSERT INTO tenant_integrations (tenant_id, provider, credentials)
VALUES (
  'ppcu-uuid',
  'meta',
  '{
    "pixel_id": "123456789",
    "capi_access_token": "EAAxx...",
    "test_event_code": "TEST12345"
  }'
);
```

**Required fields:**
- `pixel_id` - Meta pixel ID
- `capi_access_token` - System user access token with ads_management permission

**Optional fields:**
- `test_event_code` - For testing in Meta Events Manager

---

## User Data Hashing

Meta requires SHA256 hashing of PII. Our client handles this:

```typescript
import { hashEmail, hashPhone, hashName } from '@/lib/meta-capi/client';

// Hashes are lowercase, trimmed, then SHA256'd
hashEmail('User@Example.com')  // sha256('user@example.com')
hashPhone('(555) 123-4567')    // sha256('15551234567')
hashName('John')               // sha256('john')
```

---

## Queueing Events

```typescript
import { queueCAPIEvent, createLeadEvent } from '@/lib/meta-capi/client';

// Create and queue a Lead event
const leadEvent = createLeadEvent(
  {
    email: contact.email,
    phone: contact.phone,
    firstName: contact.first_name,
    lastName: contact.last_name,
    fbp: contact.fbp,
    fbc: contact.fbc,
    externalId: contact.id,
  },
  {
    adId: contact.ad_id,
    contentName: 'DM Qualification',
  }
);

await queueCAPIEvent(tenantId, {
  ...leadEvent,
  contactId: contact.id,
});
```

---

## Facebook Tracking Fields

Contacts table has fields for FB attribution:

| Field | Source | Purpose |
|-------|--------|---------|
| `fbclid` | URL param | Click ID from ad click |
| `fbp` | _fbp cookie | Browser ID (persists) |
| `fbc` | _fbc cookie | Click ID cookie |
| `ad_id` | ManyChat/webhook | Ad that drove the lead |

These are passed to CAPI for attribution matching.

---

## Sending Events to Meta

Events are queued first, then sent:

```typescript
import { MetaCAPIClient, sendQueuedEvent } from '@/lib/meta-capi/client';

const client = MetaCAPIClient.fromTenant(tenant);
await sendQueuedEvent(eventId, client);
```

For bulk processing:
```typescript
import { processUnsentEvents } from '@/lib/meta-capi/client';

const { sent, failed } = await processUnsentEvents(tenantId, client, 100);
```

---

## Testing

### 1. Use Test Event Code
Add `test_event_code` to tenant credentials. Events will appear in Meta Events Manager under Test Events.

### 2. Check Events Manager
https://business.facebook.com/events_manager → Select Pixel → Test Events

### 3. Query Database
```sql
SELECT event_name, event_time, sent_to_meta, send_error, meta_fbtrace_id
FROM meta_capi_events
WHERE tenant_id = 'ppcu-uuid'
ORDER BY created_at DESC
LIMIT 10;
```

### 4. Manual Send Test
```typescript
const client = new MetaCAPIClient({
  pixel_id: '123456789',
  capi_access_token: 'EAAxx...',
  test_event_code: 'TEST12345',
});

const response = await client.sendEvent({
  eventName: 'Lead',
  eventTime: new Date(),
  actionSource: 'chat',
  userData: { email: 'test@example.com' },
});

console.log(response);
// { events_received: 1, fbtrace_id: 'xxx' }
```

---

## Event Deduplication

Meta deduplicates by `event_id`. We generate UUIDs:

```typescript
const eventId = crypto.randomUUID();
```

If same `event_id` is sent twice, Meta ignores the duplicate.

---

## Retry Logic

Failed events are retried up to 5 times:

```sql
-- Find events needing retry
SELECT * FROM meta_capi_events
WHERE sent_to_meta = FALSE
AND send_attempts < 5
ORDER BY created_at;
```

Cron job (future) will process the queue:
```typescript
// /api/cron/process-capi-events
await processUnsentEvents(tenantId, client);
```

---

## Troubleshooting

### Events not appearing in Events Manager
1. Check `test_event_code` is set (for testing)
2. Verify `pixel_id` is correct
3. Check `capi_access_token` has correct permissions
4. Look at `meta_response` column for errors

### Low match rates
1. Ensure `fbp` and `fbc` are being captured
2. Include email AND phone when available
3. Hash values correctly (lowercase, trimmed)

### Permission errors
Access token needs:
- `ads_management` permission
- System user with pixel access

---

## Self-Annealing Log

| Date | Issue | Resolution |
|------|-------|------------|
| 2024-12-07 | Initial implementation | Created client and queue system |

---

## Related Directives

- `chatbot.md` - Lead events from DM qualification
- `webhooks.md` - Webhook handlers that fire events
- `meta-ads-sync.md` - Meta Ads data sync (separate from CAPI)
