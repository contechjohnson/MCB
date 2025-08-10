# MCB Funnel Analytics Dashboard

A comprehensive dashboard for tracking conversion funnel performance, A/B testing, and customer acquisition metrics.

## Features

### Server-Side Dashboard (`/dashboard`)
- **Funnel Metrics**: Track DM starts, lead capture, bookings, and purchases
- **Conversion Rates**: Calculate conversion rates for each funnel stage
- **Visual Funnel**: Interactive funnel visualization with stage-to-stage conversion rates
- **A/B Testing**: Performance comparison across different A/B test variants
- **Acquisition Sources**: Compare performance between organic and paid traffic
- **Time-based Analysis**: Overall metrics vs. last 30 days performance
- **Server-side Rendering**: Fast initial page load with cached data

### Real-time Dashboard (`/dashboard/realtime`)
- **Live Updates**: Real-time data updates using Supabase subscriptions
- **Date Range Filtering**: Interactive date range selection
- **Animated Visualizations**: Smooth transitions and hover effects
- **Comparative Analysis**: Side-by-side comparison of filtered vs. all-time metrics
- **Client-side Interactivity**: Dynamic filtering without page reloads

## Database Schema

The dashboard queries the `contacts` table with these key fields:

### Timestamp Fields
- `dm_started_at` - When the DM conversation began
- `lead_captured_at` - When contact information was collected
- `booking_shown_at` - When booking link was displayed
- `booking_clicked_at` - When booking link was clicked
- `booked_at` - When appointment was scheduled
- `attended_at` - When appointment was attended
- `purchased_at` - When purchase was completed

### Segmentation Fields
- `ab_variant` - A/B test variant (A, B, etc.)
- `acquisition_source` - Traffic source (organic, paid)
- `name` - Contact name for personalization
- `channel` - Platform (ig, fb)

## Metrics Calculated

### Funnel Metrics
1. **DM Started** - Total conversations initiated
2. **Lead Captured** - Contact information collected
3. **Booking Shown** - Booking opportunities presented
4. **Booking Clicked** - Booking links clicked
5. **Booked** - Appointments scheduled
6. **Attended** - Appointments attended
7. **Purchased** - Successful conversions

### Conversion Rates
1. **DM → Lead** - Lead capture rate from initial contact
2. **Lead → Booking Shown** - Rate of showing booking to leads
3. **Booking Shown → Clicked** - Click-through rate on booking links
4. **Booking Clicked → Booked** - Conversion rate from click to booking
5. **Booked → Attended** - Attendance rate for booked appointments
6. **Attended → Purchased** - Purchase rate from attended appointments
7. **Overall Conversion** - End-to-end conversion rate (DM → Purchase)

## Technical Implementation

### Server Components
- Uses `supabaseAdmin` for secure server-side data fetching
- Implements error handling and fallback states
- Calculates metrics server-side for fast initial load

### Client Components
- Real-time subscriptions using Supabase's `postgres_changes` event
- State management with React hooks
- Smooth animations using CSS transitions

### Design Features
- **Gradient Cards**: Beautiful gradient backgrounds for metrics
- **Responsive Layout**: Works on desktop, tablet, and mobile
- **Loading States**: Skeleton screens during data loading
- **Interactive Elements**: Hover effects and smooth transitions
- **Professional Typography**: Clear hierarchy and readable fonts

## Performance Considerations

1. **Data Filtering**: Efficient date-based filtering in SQL
2. **Caching**: Server-side rendering reduces client load
3. **Real-time Updates**: Only updates when data actually changes
4. **Responsive Design**: Optimized for all device sizes
5. **Error Handling**: Graceful fallbacks for database issues

## Usage Instructions

1. **Access Dashboards**:
   - Server-side: Navigate to `/dashboard`
   - Real-time: Navigate to `/dashboard/realtime`

2. **Date Filtering** (Real-time dashboard):
   - Use the date range picker to filter metrics
   - Click "Reset to Last 30 Days" for quick filtering
   - Metrics update automatically when dates change

3. **Understanding Metrics**:
   - Hover over cards for smooth animations
   - Check the funnel visualization for stage-by-stage performance
   - Compare A/B variants and acquisition sources in dedicated sections

## Future Enhancements

1. **Export Functionality**: CSV/PDF export of metrics
2. **Historical Trends**: Line charts showing performance over time
3. **Alert System**: Notifications for significant metric changes
4. **Custom Date Ranges**: Preset ranges (7 days, 90 days, etc.)
5. **Advanced Filtering**: Filter by multiple dimensions simultaneously
6. **Goal Tracking**: Set and track conversion rate goals

## Security

- Uses `supabaseAdmin` with service role key for secure data access
- Server-side rendering prevents exposure of sensitive data
- Environment variables protect API keys and database credentials

The dashboard provides a comprehensive view of your conversion funnel performance with beautiful visualizations and real-time capabilities.