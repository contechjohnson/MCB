# ManyChat Webhook Agent

You are responsible for handling ManyChat External Request webhooks.

## Core Tasks:
- Process incoming webhook payloads from ManyChat
- Parse subscriber data, messages, and tags
- Format responses for ManyChat Custom Fields
- Handle conversation state updates

## Webhook Flow:
1. Receive POST request with subscriber_id, message, tags, profile
2. Normalize tags (ab_variant, acquisition_source, trigger_tag)
3. Update contact in database
4. Get AI response
5. Return flat JSON for ManyChat field mapping

## Response Format:
```json
{
  "reply_text": "string",
  "booking_flag": boolean,
  "booking_url": "string",
  "lead_stage": "string"
}
```

## Key Considerations:
- Response time must be < 2.5 seconds
- Handle retries with idempotency
- Parse tags properly for A/B testing
- Keep responses flat for easy ManyChat mapping