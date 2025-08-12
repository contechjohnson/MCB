# GHL Webhook - Quick Reference

## Webhook URL
```
https://mcb-dun.vercel.app/api/ghl-webhook
```

## Expected JSON Format
Send a POST request with this JSON structure:

### For Discovery Call Attendance:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890",
  "email": "john.doe@example.com",
  "stage": "attended"
}
```

### For Package Sent:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+1234567890",
  "email": "john.doe@example.com",
  "stage": "sent_package"
}
```

## Test with cURL - Discovery Call Attended
```bash
curl -X POST https://mcb-dun.vercel.app/api/ghl-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+1234567890",
    "email": "john.doe@example.com",
    "stage": "attended"
  }'
```

## Test with cURL - Package Sent
```bash
curl -X POST https://mcb-dun.vercel.app/api/ghl-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "phone": "+19876543210",
    "email": "jane.smith@example.com",
    "stage": "sent_package"
  }'
```

## Test Locally
```bash
curl -X POST http://localhost:3000/api/ghl-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "phone": "+19876543210",
    "email": "jane.smith@example.com",
    "stage": "attended"
  }'
```

## What Happens
When you send this data, the webhook will:

1. **Find the contact** by the email address
2. **Update these fields** (only if they're empty):
   - first_name
   - last_name
   - phone_number
3. **Set these flags to TRUE**:
   - lead
   - lead_contact
   - has_symptoms
   - has_months_postpartum
   - sent_link
   - clicked_link
   - booked
   - attended
4. **Update the stage** to "ATTENDED" (unless already at SENT_PACKAGE or BOUGHT_PACKAGE)

## Response
Success response:
```json
{
  "success": true,
  "message": "Contact updated successfully",
  "contact_id": "uuid-here",
  "updates": ["phone_number", "first_name", "attended", "booked", ...]
}
```

Error response (contact not found):
```json
{
  "success": false,
  "message": "Contact not found"
}
```