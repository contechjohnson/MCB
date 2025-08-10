-- MCB (ManyChat AI Automation Framework) Database Setup
-- Complete SQL setup for the single table approach
-- Based on MCB_PRD.md specifications

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Drop existing table if exists (for fresh setup)
drop table if exists public.contacts cascade;

-- ========================================
-- MAIN CONTACTS TABLE (Single Table Approach)
-- ========================================
-- This table stores all contact data, conversation history, and funnel metrics
-- in a single record per contact for simplicity and performance

create table public.contacts (
  -- Primary identifier (ManyChat subscriber ID)
  mcid text primary key,
  
  -- Basic contact information
  channel text check (channel in ('ig', 'fb')),
  name text,
  username text,
  email text,
  phone text,
  
  -- Contact stage and classification
  stage text default 'new' check (stage in ('new', 'lead', 'qualified', 'booked', 'attended', 'purchased', 'disqualified', 'archived')),
  tags jsonb default '[]'::jsonb,
  ab_variant text,
  acquisition_source text check (acquisition_source in ('organic', 'paid')),
  trigger_tag text,
  
  -- Conversation data (embedded for single table approach)
  conversation_history jsonb default '[]'::jsonb,
  last_ai_response text,
  total_messages int default 0,
  
  -- Event timestamps for funnel tracking
  -- These drive the funnel metrics and stage transitions
  dm_started_at timestamptz,
  lead_captured_at timestamptz,
  booking_shown_at timestamptz,
  booking_clicked_at timestamptz,
  booked_at timestamptz,
  attended_at timestamptz,
  purchased_at timestamptz,
  
  -- Client-specific fields (current project: postpartum health)
  symptoms text,
  months_postpartum int,
  objections_json jsonb,
  
  -- Interaction tracking
  last_igfb_interaction_at timestamptz,
  last_mc_interaction_at timestamptz,
  
  -- Purchase data
  purchase_amount_cents int,
  currency text default 'USD',
  
  -- Attribution and extensibility
  attribution_json jsonb,
  custom_json jsonb,
  
  -- Record metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  archived_at timestamptz
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================
-- These indexes support the primary query patterns for funnel metrics and filtering

-- Stage filtering (for dashboard queries)
create index idx_contacts_stage on public.contacts(stage);

-- Funnel timestamp indexes (for metrics calculations)
create index idx_contacts_dm_started on public.contacts(dm_started_at);
create index idx_contacts_lead_captured on public.contacts(lead_captured_at);
create index idx_contacts_booking_shown on public.contacts(booking_shown_at);
create index idx_contacts_booking_clicked on public.contacts(booking_clicked_at);
create index idx_contacts_booked on public.contacts(booked_at);
create index idx_contacts_attended on public.contacts(attended_at);
create index idx_contacts_purchased on public.contacts(purchased_at);

-- A/B testing and attribution indexes
create index idx_contacts_ab_variant on public.contacts(ab_variant);
create index idx_contacts_acquisition_source on public.contacts(acquisition_source);

-- Date-based queries for dashboard
create index idx_contacts_created_at on public.contacts(created_at);
create index idx_contacts_updated_at on public.contacts(updated_at);

-- Archival queries
create index idx_contacts_archived on public.contacts(archived_at);
create index idx_contacts_last_interaction on public.contacts(last_igfb_interaction_at);

-- Composite indexes for common dashboard filters
create index idx_contacts_variant_source on public.contacts(ab_variant, acquisition_source);
create index idx_contacts_stage_created on public.contacts(stage, created_at);

-- ========================================
-- FUNNEL METRICS FUNCTION
-- ========================================
-- This function calculates key conversion rates for the dashboard
-- Can be filtered by A/B variant and acquisition source

create or replace function public.calculate_funnel_rates(
  _ab_variant text default null,
  _acq_source text default null,
  _start_date date default null,
  _end_date date default null
) returns table (
  metric_name text,
  value numeric(6,2),
  count_value bigint
) language sql as $$
with counts as (
  select 
    count(*) filter (where dm_started_at is not null) as dm_starts,
    count(*) filter (where lead_captured_at is not null) as leads,
    count(*) filter (where booking_shown_at is not null) as bookings_shown,
    count(*) filter (where booking_clicked_at is not null) as bookings_clicked,
    count(*) filter (where booked_at is not null) as booked,
    count(*) filter (where attended_at is not null) as attended,
    count(*) filter (where purchased_at is not null) as purchased
  from public.contacts
  where (_ab_variant is null or ab_variant = _ab_variant)
    and (_acq_source is null or acquisition_source = _acq_source)
    and (_start_date is null or dm_started_at::date >= _start_date)
    and (_end_date is null or dm_started_at::date <= _end_date)
    and archived_at is null  -- Exclude archived contacts by default
)
select 'DM Starts' as metric_name, 
       dm_starts::numeric(6,2) as value,
       dm_starts as count_value
from counts
union all
select 'Leads Captured',
       leads::numeric(6,2),
       leads
from counts
union all
select 'Bookings Shown',
       bookings_shown::numeric(6,2),
       bookings_shown
from counts
union all
select 'Booking Clicks',
       bookings_clicked::numeric(6,2),
       bookings_clicked
from counts
union all
select 'Booked',
       booked::numeric(6,2),
       booked
from counts
union all
select 'Attended',
       attended::numeric(6,2),
       attended
from counts
union all
select 'Purchased',
       purchased::numeric(6,2),
       purchased
from counts
union all
select 'Lead Capture Rate (%)',
       case when dm_starts > 0 then round(100.0 * leads / dm_starts, 2) else 0 end,
       case when dm_starts > 0 then leads else 0 end
from counts
union all
select 'Booking Click Rate (%)',
       case when leads > 0 then round(100.0 * bookings_clicked / leads, 2) else 0 end,
       case when leads > 0 then bookings_clicked else 0 end
from counts
union all
select 'Booking Conversion Rate (%)',
       case when leads > 0 then round(100.0 * booked / leads, 2) else 0 end,
       case when leads > 0 then booked else 0 end
from counts
union all
select 'Show Rate (%)',
       case when booked > 0 then round(100.0 * attended / booked, 2) else 0 end,
       case when booked > 0 then attended else 0 end
from counts
union all
select 'Purchase Rate (%)',
       case when leads > 0 then round(100.0 * purchased / leads, 2) else 0 end,
       case when leads > 0 then purchased else 0 end
from counts
union all
select 'Overall Conversion Rate (%)',
       case when dm_starts > 0 then round(100.0 * purchased / dm_starts, 2) else 0 end,
       case when dm_starts > 0 then purchased else 0 end
from counts;
$$;

-- ========================================
-- DAILY FUNNEL METRICS VIEW
-- ========================================
-- Pre-aggregated view for dashboard queries by date

create or replace view public.vw_funnel_daily as
select 
  date_trunc('day', dm_started_at) as date,
  ab_variant,
  acquisition_source,
  count(*) filter (where dm_started_at is not null) as dm_starts,
  count(*) filter (where lead_captured_at is not null) as leads,
  count(*) filter (where booking_shown_at is not null) as bookings_shown,
  count(*) filter (where booking_clicked_at is not null) as bookings_clicked,
  count(*) filter (where booked_at is not null) as booked,
  count(*) filter (where attended_at is not null) as attended,
  count(*) filter (where purchased_at is not null) as purchased,
  -- Calculated conversion rates
  case when count(*) filter (where dm_started_at is not null) > 0 
       then round(100.0 * count(*) filter (where lead_captured_at is not null) / count(*) filter (where dm_started_at is not null), 2) 
       else 0 end as lead_capture_rate,
  case when count(*) filter (where lead_captured_at is not null) > 0 
       then round(100.0 * count(*) filter (where booking_clicked_at is not null) / count(*) filter (where lead_captured_at is not null), 2) 
       else 0 end as booking_click_rate,
  case when count(*) filter (where lead_captured_at is not null) > 0 
       then round(100.0 * count(*) filter (where booked_at is not null) / count(*) filter (where lead_captured_at is not null), 2) 
       else 0 end as booking_conversion_rate
from public.contacts
where dm_started_at is not null 
  and archived_at is null
group by 1, 2, 3
order by 1 desc;

-- ========================================
-- STAGE UPDATE FUNCTION
-- ========================================
-- Automatically updates contact stage based on timestamp progression
-- Called by the AI router when timestamps are updated

create or replace function public.update_contact_stage(contact_mcid text)
returns void language plpgsql as $$
begin
  update public.contacts 
  set stage = case
    when purchased_at is not null then 'purchased'
    when attended_at is not null then 'attended'
    when booked_at is not null then 'booked'
    when booking_clicked_at is not null then 'qualified'
    when lead_captured_at is not null then 'lead'
    else 'new'
  end,
  updated_at = now()
  where mcid = contact_mcid;
end;
$$;

-- ========================================
-- ARCHIVAL FUNCTION
-- ========================================
-- Archives contacts with no interaction for 90+ days
-- Should be run on a weekly schedule

create or replace function public.archive_inactive_contacts()
returns int language plpgsql as $$
declare
  archived_count int;
begin
  update public.contacts
  set archived_at = now(),
      stage = 'archived',
      updated_at = now()
  where last_igfb_interaction_at < now() - interval '90 days'
    and stage not in ('booked', 'attended', 'purchased')
    and archived_at is null;
  
  get diagnostics archived_count = row_count;
  return archived_count;
end;
$$;

-- ========================================
-- ROW LEVEL SECURITY (RLS) SETUP
-- ========================================
-- Enable RLS for security - modify policies based on your auth requirements

alter table public.contacts enable row level security;

-- Example policy for service role (full access)
create policy "Service role has full access" on public.contacts
  for all using (auth.role() = 'service_role');

-- Example policy for anonymous dashboard access (read-only)
-- Uncomment and modify based on your dashboard authentication approach
-- create policy "Dashboard read access" on public.contacts
--   for select using (true);

-- ========================================
-- HELPFUL UTILITY FUNCTIONS
-- ========================================

-- Function to get contact summary for debugging
create or replace function public.get_contact_summary(contact_mcid text)
returns json language sql as $$
  select json_build_object(
    'mcid', mcid,
    'name', name,
    'email', email,
    'stage', stage,
    'ab_variant', ab_variant,
    'acquisition_source', acquisition_source,
    'total_messages', total_messages,
    'dm_started_at', dm_started_at,
    'lead_captured_at', lead_captured_at,
    'booking_clicked_at', booking_clicked_at,
    'booked_at', booked_at,
    'last_ai_response', left(last_ai_response, 100) || case when length(last_ai_response) > 100 then '...' else '' end,
    'created_at', created_at,
    'updated_at', updated_at
  )
  from public.contacts 
  where mcid = contact_mcid;
$$;

-- Function to get recent activity summary
create or replace function public.get_recent_activity(hours_back int default 24)
returns table (
  activity_type text,
  count_value bigint,
  latest_timestamp timestamptz
) language sql as $$
  select 'DM Starts' as activity_type, 
         count(*) as count_value,
         max(dm_started_at) as latest_timestamp
  from public.contacts 
  where dm_started_at > now() - interval '1 hour' * hours_back
  union all
  select 'Leads Captured',
         count(*),
         max(lead_captured_at)
  from public.contacts 
  where lead_captured_at > now() - interval '1 hour' * hours_back
  union all
  select 'Bookings Clicked',
         count(*),
         max(booking_clicked_at)
  from public.contacts 
  where booking_clicked_at > now() - interval '1 hour' * hours_back
  order by count_value desc;
$$;

-- ========================================
-- SAMPLE DATA (Optional - for testing)
-- ========================================
-- Uncomment the following to insert sample data for testing

/*
insert into public.contacts (mcid, channel, name, email, stage, ab_variant, acquisition_source, dm_started_at, lead_captured_at, total_messages)
values 
  ('test_001', 'ig', 'Sarah Johnson', 'sarah@example.com', 'lead', 'A', 'organic', now() - interval '2 days', now() - interval '1 day', 5),
  ('test_002', 'fb', 'Maria Garcia', 'maria@example.com', 'qualified', 'B', 'paid', now() - interval '3 days', now() - interval '2 days', 8),
  ('test_003', 'ig', 'Jennifer Smith', 'jen@example.com', 'new', 'A', 'organic', now() - interval '1 day', null, 2);

-- Update stages based on timestamps
select public.update_contact_stage('test_001');
select public.update_contact_stage('test_002');
select public.update_contact_stage('test_003');
*/

-- ========================================
-- SETUP VERIFICATION
-- ========================================
-- Run these queries to verify the setup

-- Check table structure
-- select column_name, data_type, is_nullable, column_default from information_schema.columns where table_name = 'contacts' order by ordinal_position;

-- Check indexes
-- select indexname, indexdef from pg_indexes where tablename = 'contacts';

-- Test funnel function
-- select * from public.calculate_funnel_rates();

-- ========================================
-- SETUP COMPLETE
-- ========================================

-- Grant necessary permissions for the application
-- Adjust these based on your specific auth setup
grant usage on schema public to anon, authenticated;
grant select on public.contacts to anon;
grant select on public.vw_funnel_daily to anon;
grant execute on function public.calculate_funnel_rates to anon;
grant execute on function public.get_contact_summary to anon;
grant execute on function public.get_recent_activity to anon;

-- For the AI router service (full access needed)
grant all privileges on public.contacts to service_role;
grant execute on all functions in schema public to service_role;

-- Success message
do $$
begin
  raise notice 'MCB Database setup completed successfully!';
  raise notice 'Created contacts table with % columns and % indexes', 
    (select count(*) from information_schema.columns where table_name = 'contacts'),
    (select count(*) from pg_indexes where tablename = 'contacts');
  raise notice 'Created % utility functions for dashboard and API use',
    (select count(*) from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname like '%funnel%' or p.proname like '%contact%' or p.proname like '%activity%');
end
$$;