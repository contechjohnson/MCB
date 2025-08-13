# GHL Webhook - Complete Guide

## Webhook URL
```
https://mcb-dun.vercel.app/api/ghl-webhook
```

## Key Features
- **Auto-creates contacts** if they don't exist (no more 404 errors!)
- **Case-insensitive email matching** - handles any email case variations
- **E.164 phone number formatting** - automatically normalizes phone numbers
- **Always updates phone numbers** when provided from GHL
- **Tracks booking dates** for appointment scheduling
- **Respects stage hierarchy** - never downgrades a contact's progress
- **Returns 200 status** even on errors to prevent GHL retries
- **Logs all webhooks** to webhook_logs table for debugging
- **A2P compliance ready** - supports country field for US/Canada requirements

## Stage Hierarchy
The webhook respects this progression hierarchy and will never downgrade a contact:
```
BOOKED → ATTENDED → SENT_PACKAGE → BOUGHT_PACKAGE
```

## Phone Number Handling

GoHighLevel sends phone numbers in **E.164 format** (e.g., `+15551234567`). Our webhook automatically handles:
- **E.164 format**: `+15551234567` → Stored as-is
- **10-digit US**: `5551234567` → Converted to `+15551234567`
- **11-digit US**: `15551234567` → Converted to `+15551234567`
- **Formatted numbers**: `(555) 123-4567` → Converted to `+15551234567`
- **International**: Numbers with country codes are preserved

## Webhook Scenarios

### 1. Appointment Booked
When someone books an appointment in GHL:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+15551234567",
  "email": "john.doe@example.com",
  "stage": "booked",
  "booking_date": "2024-01-20T14:30:00Z",
  "country": "US"
}
```

**What happens:**
- Sets flags: lead, lead_contact, sent_link, clicked_link, booked
- Updates stage to BOOKED (if currently lower)
- Stores the booking date/time

### 2. Discovery Call Attended
When someone attends their appointment:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+15551234567",
  "email": "john.doe@example.com",
  "stage": "attended",
  "country": "US"
}
```

**What happens:**
- Sets flags: lead, lead_contact, has_symptoms, has_months_postpartum, sent_link, clicked_link, booked, attended
- Updates stage to ATTENDED (if currently lower)

### 3. Package Sent
After the call, when the package/offer is sent:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+15551234567",
  "email": "john.doe@example.com",
  "stage": "sent_package",
  "country": "US"
}
```

**What happens:**
- Sets all progression flags including sent_package
- Updates stage to SENT_PACKAGE (if not already BOUGHT_PACKAGE)

## Test Commands

### Test Appointment Booked
```bash
curl -X POST https://mcb-dun.vercel.app/api/ghl-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "phone": "+15551234567",
    "email": "jane.smith@example.com",
    "stage": "booked",
    "booking_date": "2024-01-25T10:00:00Z"
  }'
```

### Test Discovery Call Attended
```bash
curl -X POST https://mcb-dun.vercel.app/api/ghl-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "phone": "+15551234567",
    "email": "jane.smith@example.com",
    "stage": "attended"
  }'
```

### Test Package Sent
```bash
curl -X POST https://mcb-dun.vercel.app/api/ghl-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "phone": "+15551234567",
    "email": "jane.smith@example.com",
    "stage": "sent_package"
  }'
```

## Case Sensitivity Handling
The webhook handles email case variations automatically:
- `John.Doe@Example.com` 
- `john.doe@example.com`
- `JOHN.DOE@EXAMPLE.COM`

All will match the same contact! Emails are normalized to lowercase for searching.

## Supported Field Names
The webhook flexibly accepts multiple field name formats:

### Email
- `email`, `Email`, `EMAIL`
- `contact.email`

### Phone
- `phone`, `Phone`, `PHONE`
- `phone_number`, `phoneNumber`
- `contact.phone`

### Names
- `first_name`, `firstName`, `FirstName`, `FIRST_NAME`
- `last_name`, `lastName`, `LastName`, `LAST_NAME`
- `contact.first_name`, `contact.last_name`

### Stage
- `stage`, `Stage`, `STAGE`

### Country (for A2P compliance)
- `country`, `Country`, `COUNTRY`

### Booking Date
- `booking_date`, `bookingDate`
- `booking_datetime`, `appointment_date`
- `appointmentDate`, `scheduled_date`

## Response Examples

### Success - Contact Updated
```json
{
  "success": true,
  "message": "Contact updated successfully",
  "contact_id": "12345",
  "email": "john.doe@example.com",
  "updates": ["phone_number", "first_name", "booking_date", "booked"],
  "was_created": false
}
```

### Success - New Contact Created
```json
{
  "success": true,
  "message": "Contact updated successfully",
  "contact_id": "ghl_1234567890_abc123",
  "email": "new.contact@example.com",
  "updates": ["phone_number", "first_name", "lead_contact", "booking_date"],
  "was_created": true
}
```

### Error - Missing Email
```json
{
  "success": false,
  "message": "Email is required",
  "debug": "No email found in payload"
}
```

## Database Migration
Run this SQL to add the booking_date field:
```sql
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS booking_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_booking_date 
ON public.contacts(booking_date);
```

## Verify Webhook Status
```bash
curl https://mcb-dun.vercel.app/api/ghl-webhook
```

Returns:
```json
{
  "status": "ok",
  "message": "GHL webhook endpoint is active",
  "endpoint": "/api/ghl-webhook",
  "accepts": ["discovery_call_attended", "appointment_completed", "call_completed", "sent_package"],
  "expectedFields": {
    "required": ["email"],
    "optional": ["first_name", "last_name", "phone", "stage", "booking_date"]
  },
  "notes": [
    "Contact will be created if not found",
    "Email matching is case-insensitive",
    "Phone numbers will be updated if provided",
    "Returns 200 status to prevent retries"
  ]
}
```

## GoHighLevel Setup Tips

1. **Create separate webhooks** for each event:
   - Appointment Scheduled → Send `stage: "booked"` with `booking_date`
   - Appointment Completed → Send `stage: "attended"`
   - Package/Offer Sent → Send `stage: "sent_package"`

2. **Map your GHL fields** to our expected format:
   - Contact Email → `email`
   - Contact Phone → `phone` (E.164 format: +15551234567)
   - Contact First Name → `first_name`
   - Contact Last Name → `last_name`
   - Contact Country → `country` (US or CA for A2P compliance)
   - Appointment Date/Time → `booking_date`

3. **Phone Number Format**:
   - GoHighLevel should send phones in E.164 format: `+15551234567`
   - Our webhook will auto-convert US numbers if needed
   - Include country field for US/Canada numbers (A2P compliance)

4. **Test each webhook** individually using the curl commands above

5. **Monitor the logs** - All webhooks are logged to the database for debugging