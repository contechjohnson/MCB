# GoHighLevel Webhook Setup for Discovery Call Attendance

## Webhook Endpoint
Your webhook endpoint is: `https://your-domain.com/api/ghl-webhook`

## Setting up in GoHighLevel

1. **Navigate to Settings → Webhooks** in your GHL account
2. **Create a new webhook** with the following settings:
   - URL: `https://your-domain.com/api/ghl-webhook`
   - Method: POST
   - Events: Select events related to appointments/calls:
     - Appointment Status Changed
     - Appointment Completed
     - Call Completed

## Expected Payload Format

The webhook expects a JSON payload with at least one of these structures:

### Option 1: Direct fields
```json
{
  "email": "customer@example.com",
  "phone": "+1234567890",
  "attended_at": "2024-01-15T10:30:00Z",
  "event_type": "discovery_call_attended"
}
```

### Option 2: Nested contact object
```json
{
  "contact": {
    "email": "customer@example.com",
    "phone": "+1234567890"
  },
  "type": "appointment_completed"
}
```

## What the Webhook Does

When a discovery call attendance event is received, the webhook will:

1. **Find the contact** by email address in your database
2. **Update phone number** if it's empty (won't overwrite existing phone numbers)
3. **Set all progression flags to true**:
   - `lead`
   - `lead_contact`
   - `has_symptoms`
   - `has_months_postpartum`
   - `sent_link`
   - `clicked_link`
   - `booked`
   - `attended`
4. **Update the stage** to "ATTENDED" (unless already at SENT_PACKAGE or BOUGHT_PACKAGE)
5. **Preserve higher stages** - won't downgrade if contact already bought or was sent a package

## Testing the Webhook

You can test the webhook with curl:

```bash
curl -X POST https://your-domain.com/api/ghl-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "phone": "+1234567890",
    "event_type": "discovery_call_attended"
  }'
```

## Verification

To verify the webhook is active, visit:
```
GET https://your-domain.com/api/ghl-webhook
```

This should return:
```json
{
  "status": "ok",
  "message": "GHL webhook endpoint is active",
  "endpoint": "/api/ghl-webhook",
  "accepts": ["discovery_call_attended", "appointment_completed", "call_completed"]
}
```

## Security Considerations

For production, consider adding:
1. **Webhook signature verification** - Verify requests are from GHL using a shared secret
2. **IP whitelisting** - Only accept requests from GHL's IP addresses
3. **Rate limiting** - Prevent abuse
4. **Request logging** - Track all webhook events

## Troubleshooting

- Check the server logs for detailed error messages
- Ensure the email address in GHL matches exactly with your database
- Verify the Supabase service role key is set in environment variables
- Test with the GET endpoint first to ensure the webhook is accessible