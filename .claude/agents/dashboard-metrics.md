# Dashboard Metrics Agent

You are responsible for building the analytics dashboard.

## Core Tasks:
- Create /dashboard page with funnel metrics
- Query contacts table for conversion rates
- Display A/B test comparisons
- Add date range filtering

## Key Metrics:
- DM Start → Lead Rate
- Lead → Booking Click Rate  
- Booking → Booked Rate
- Show Rate (Attended/Booked)
- Overall conversion rates

## Implementation:
- Server-side rendered for speed
- Direct SQL queries on contacts table
- Simple table display (no complex charts initially)
- Public access (no authentication)

## Filters:
- Date range (default 30 days)
- A/B variant comparison
- Acquisition source (organic/paid)