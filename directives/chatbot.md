# Chatbot Integration Directive

**Purpose:** AI-powered chatbot for Instagram DM conversations, running through ManyChat with MCB as the brain.

**Status:** Implementation Phase (Week 1)

---

## Architecture Overview

```
Instagram DM → ManyChat → MCB /api/webhooks/[tenant]/chatbot → OpenAI
                                        ↓
                              Update ManyChat fields
                              Trigger ManyChat flow → Send response
                              Queue CAPI Lead event
```

**Key Design Decisions:**
- **Prompts stored in MCB** (not OpenAI platform) - easier to edit and version
- **ManyChat handles delivery** - MCB triggers flows, doesn't send messages directly
- **Chat Completions API** (not Assistants) - simpler, prompts in DB
- **A/B testing** via ManyChat `chatbot_AB` custom field

---

## Database Tables

### chatbot_configs
Stores A/B test variants with system prompts:

| Column | Type | Purpose |
|--------|------|---------|
| `tenant_id` | UUID | Tenant isolation |
| `config_name` | TEXT | 'variant_a', 'variant_b', etc. |
| `is_default` | BOOL | Fallback config |
| `system_prompt` | TEXT | Full system prompt |
| `model` | TEXT | OpenAI model (default: gpt-4o) |
| `temperature` | NUMERIC | Model temperature |
| `response_flow_id` | TEXT | ManyChat flow to send response |
| `ab_test_field` | TEXT | ManyChat field for routing |
| `ab_test_value` | TEXT | Value that routes here |

### conversation_threads
Tracks conversation state per subscriber:

| Column | Type | Purpose |
|--------|------|---------|
| `tenant_id` | UUID | Tenant isolation |
| `mc_id` | TEXT | ManyChat subscriber ID |
| `recent_messages` | JSONB | Last N messages for context |
| `extracted_symptoms` | TEXT[] | AI-extracted symptoms |
| `booking_intent` | BOOL | Has expressed booking intent |
| `link_sent` | BOOL | Booking link was sent |

---

## Key Files

| File | Purpose |
|------|---------|
| `/lib/chatbot/openai-client.ts` | OpenAI Chat Completions wrapper |
| `/lib/manychat/client.ts` | ManyChat write operations |
| `/app/api/webhooks/[tenant]/chatbot/route.ts` | Main webhook endpoint |

---

## ManyChat Integration

### Webhook Payload (from ManyChat)
```json
{
  "subscriber_id": "123456789",
  "message": "User's message text",
  "custom_fields": {
    "chatbot_AB": "A",
    "Conversation ID": "...",
    "Symptoms": "..."
  }
}
```

### Field Updates (to ManyChat)
After AI processing, MCB updates these fields:
- `Cody > Response` - AI response text
- `Symptoms` - Extracted symptoms
- `Months Postpartum` - Extracted value
- `Intending to send link` - Boolean
- `Email` - Captured email

### Flow Trigger
After updating fields, MCB triggers the response flow:
```typescript
await manychat.sendFlow(subscriberId, config.response_flow_id);
```

---

## A/B Test Routing

1. ManyChat assigns `chatbot_AB` value ('A' or 'B') to subscriber
2. MCB receives this in webhook payload
3. MCB looks up matching `chatbot_configs` record
4. Uses that config's system prompt for AI call
5. Triggers that config's response flow

```typescript
const config = await getChatbotConfig(tenantId, abTestValue);
```

---

## AI Response Format

System prompt must return JSON:
```json
{
  "response": "The message to send",
  "symptoms": "fatigue, anxiety",
  "months_postpartum": "3 months",
  "handled_objections": "cost, time",
  "intending_to_send_link": true,
  "intend_to_send_pdf": false,
  "intend_to_send_lead_magnet": false,
  "already_booked": false,
  "email": "captured@email.com"
}
```

---

## CAPI Integration

When `intending_to_send_link` is true, a Lead event is queued:
```typescript
if (response.intending_to_send_link) {
  await queueCAPIEvent(tenantId, {
    ...createLeadEvent(userData),
    contactId: contact.id,
  });
}
```

---

## Migration from Make.com

### Current State (Make.com)
1. ManyChat webhook → Make.com
2. Get subscriber info
3. OpenAI Assistants API call
4. Update ManyChat fields
5. Trigger ManyChat flow

### Target State (MCB)
1. ManyChat webhook → MCB
2. Same flow, but all in MCB
3. Prompts in database (not OpenAI)
4. CAPI events fired automatically

### Migration Steps
1. ✅ Create database tables
2. ✅ Build library files
3. ✅ Build webhook endpoint
4. ⬜ Extract CLARA prompt from OpenAI
5. ⬜ Insert prompt into chatbot_configs
6. ⬜ Configure ManyChat webhook URL
7. ⬜ Shadow mode testing
8. ⬜ Gradual cutover

---

## Testing

### Manual Test
```bash
curl -X POST https://mcb-dun.vercel.app/api/webhooks/ppcu/chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "subscriber_id": "test123",
    "message": "Hi, I have been feeling tired",
    "custom_fields": {"chatbot_AB": "A"}
  }'
```

### Verify in Database
```sql
SELECT * FROM conversation_threads
WHERE tenant_id = 'ppcu-uuid' AND mc_id = 'test123';
```

---

## Troubleshooting

### No response from chatbot
1. Check `chatbot_configs` has active config for tenant
2. Verify A/B routing matches
3. Check OpenAI API key in env

### ManyChat fields not updating
1. Verify ManyChat API key in tenant_integrations
2. Check field IDs match your ManyChat account
3. Look at webhook_logs for errors

### CAPI events not firing
1. Verify Meta credentials in tenant_integrations
2. Check meta_capi_events table for queued events
3. Review send_error column for failures

---

## Self-Annealing Log

| Date | Issue | Resolution |
|------|-------|------------|
| 2024-12-07 | Initial implementation | Created tables and endpoints |

---

## Related Directives

- `meta-capi.md` - CAPI event system
- `webhooks.md` - General webhook handling
- `multi-tenancy.md` - Tenant context system
