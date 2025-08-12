# Supabase Setup Notes

## Database Location
- All data is in Supabase (not local PostgreSQL)
- Access via Supabase Dashboard or use environment variables in `.env.local`

## Import Process
1. Use Supabase Dashboard → Table Editor → Import CSV
2. Run SQL updates in Supabase SQL Editor
3. Webhooks write directly to Supabase via API

## Key Tables
- `contacts` - ManyChat contacts with funnel stages
- `stripe_webhook_logs` - Stripe payment events
- Stage flags auto-update via triggers

## Dashboard Access
- Reads from Supabase via `/app/api/contacts/route.ts`
- Updates happen via Stripe webhooks at `/app/api/stripe-webhook/route.ts`