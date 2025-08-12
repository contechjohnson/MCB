# CSV Import Instructions

## 1. CONTACTS CSV (contacts.csv)

Format your contacts CSV with these EXACT column headers (copy this line as your header row):

```
user_id,first_name,last_name,email_address,phone_number,instagram_name,facebook_name,lead,lead_contact,sent_link,clicked_link,booked,attended,sent_package,bought_package,subscription_date,tags,notes
```

### Column Details:
- **user_id**: Unique identifier (use ManyChat ID if you have it, or create like "mc_001", "mc_002", etc.)
- **first_name**: First name
- **last_name**: Last name  
- **email_address**: Email (leave blank if none)
- **phone_number**: Phone with country code like +14155551234 (leave blank if none)
- **instagram_name**: Instagram username without @ (leave blank if none)
- **facebook_name**: Facebook name (leave blank if none)
- **lead**: TRUE or FALSE (are they a lead?)
- **lead_contact**: TRUE or FALSE (do you have their contact info?)
- **sent_link**: TRUE or FALSE (sent booking link?)
- **clicked_link**: TRUE or FALSE (clicked the link?)
- **booked**: TRUE or FALSE (booked a call?)
- **attended**: TRUE or FALSE (attended the call?)
- **sent_package**: TRUE or FALSE (sent package offer?)
- **bought_package**: TRUE or FALSE (bought package?)
- **subscription_date**: Date they first contacted you (format: 2024-01-15 or 2024-01-15 10:30:00)
- **tags**: Any tags/labels (optional, can leave blank)
- **notes**: Any notes (optional, can leave blank)

### Example rows:
```
mc_001,John,Smith,john@example.com,+14155551234,johnsmith,John Smith,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,2024-01-15,vip,Great client
mc_002,Sarah,Johnson,sarah@example.com,,sarah_j,,TRUE,TRUE,TRUE,TRUE,TRUE,TRUE,FALSE,FALSE,2024-01-20,warm,Attended but no package
mc_003,Mike,Wilson,,,mike_wilson,Mike Wilson,TRUE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,2024-02-01,cold,Just started conversation
```

## 2. STRIPE PAYMENTS CSV (payments.csv)

Format your Stripe payments CSV with these EXACT column headers:

```
payment_id,customer_email,customer_name,amount,payment_date,payment_type,status
```

### Column Details:
- **payment_id**: Stripe payment ID or any unique identifier (like "stripe_001")
- **customer_email**: Customer's email (MUST match contacts.csv for matching)
- **customer_name**: Customer's full name
- **amount**: Amount in dollars (like 30.00 or 1400.00, NOT in cents)
- **payment_date**: Date of payment (format: 2024-01-20 or 2024-01-20 14:30:00)
- **payment_type**: Type like "discovery_call", "package", "addon", etc.
- **status**: "completed" for successful payments, "failed" or "refunded" for others

### Example rows:
```
stripe_001,john@example.com,John Smith,30.00,2024-01-20,discovery_call,completed
stripe_002,john@example.com,John Smith,1400.00,2024-01-25,package,completed
stripe_003,sarah@example.com,Sarah Johnson,30.00,2024-01-22,discovery_call,completed
stripe_004,bob@example.com,Bob Jones,1400.00,2024-02-01,package,failed
```

## IMPORTANT NOTES:

1. **Email Matching**: The email in payments.csv MUST match the email in contacts.csv for automatic matching
2. **Booleans**: Use TRUE or FALSE (all caps) for boolean fields
3. **Dates**: Use YYYY-MM-DD format (like 2024-01-15)
4. **Amounts**: Use decimal format in dollars (30.00 not 3000)
5. **Phone Numbers**: Include country code (+1 for US)
6. **Empty Fields**: Leave blank if no data (don't use NULL or "none")

## Save files as:
- `/import/contacts.csv`
- `/import/payments.csv`

Then we'll run import scripts to load everything!