#!/usr/bin/env python3
"""
Import Unified Contacts to Supabase

This script imports the unified_contacts.csv file into Supabase's hist_contacts table.
It maps the columns from the unified file to the Supabase schema.

Usage:
    python scripts/import_unified_to_supabase.py
"""

import os
import sys
import pandas as pd
import uuid
from datetime import datetime

# Third-party imports
try:
    from supabase import create_client, Client
    from dotenv import load_dotenv
except ImportError:
    print("ERROR: Missing required packages.")
    print("Install with: pip install supabase python-dotenv")
    sys.exit(1)

# Load environment variables
load_dotenv()

# Supabase setup
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing Supabase credentials.")
    print("Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# File paths
UNIFIED_FILE = '/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data/unified_contacts.csv'

# =============================================================================
# MAIN IMPORT
# =============================================================================

print("\n" + "="*60)
print("IMPORTING UNIFIED CONTACTS TO SUPABASE")
print("="*60 + "\n")

# Create import batch ID
batch_id = uuid.uuid4()
import_started = datetime.now()

# Read unified contacts
print("📖 Reading unified contacts file...\n")
try:
    df = pd.read_csv(UNIFIED_FILE)
    print(f"✓ Loaded {len(df)} contacts\n")
except Exception as e:
    print(f"❌ ERROR reading file: {e}")
    sys.exit(1)

# Map columns to Supabase schema
print("🗺️  Mapping columns to Supabase schema...\n")

contacts_to_insert = []
payments_to_insert = []
timeline_events = []

for idx, row in df.iterrows():
    email = row.get('email')
    if pd.isna(email) or not email:
        continue

    # Map to hist_contacts schema
    contact = {
        'email': email,
        'first_name': row.get('first_name') if pd.notna(row.get('first_name')) else None,
        'last_name': row.get('last_name') if pd.notna(row.get('last_name')) else None,
        'phone': row.get('phone') if pd.notna(row.get('phone')) else None,

        # Source tracking
        'source': row.get('source') if pd.notna(row.get('source')) else 'unified',
        'import_batch_id': str(batch_id),

        # Attribution
        'ad_type': row.get('paid_vs_organic') if pd.notna(row.get('paid_vs_organic')) else None,
        'trigger_word': row.get('trigger_word') if pd.notna(row.get('trigger_word')) else None,
        'campaign_name': None,  # Not in unified file

        # Funnel stage
        'reached_stage': row.get('stage') if pd.notna(row.get('stage')) else None,
        'has_purchase': bool(row.get('has_purchase')) if pd.notna(row.get('has_purchase')) else False,

        # Timestamps
        'first_seen': pd.to_datetime(row.get('subscription_date')).isoformat() if pd.notna(row.get('subscription_date')) else None,
        'last_seen': pd.to_datetime(row.get('subscription_date')).isoformat() if pd.notna(row.get('subscription_date')) else None,
        'purchase_date': pd.to_datetime(row.get('purchase_date')).isoformat() if pd.notna(row.get('purchase_date')) else None,

        # Data quality
        'data_quality_notes': None,
        'is_suspicious': False,
    }

    contacts_to_insert.append(contact)

    # Create payment records for Stripe
    if pd.notna(row.get('stripe_revenue')) and row.get('stripe_revenue') > 0:
        payment = {
            'email': email,
            'amount': float(row.get('stripe_revenue')),
            'currency': 'USD',
            'payment_date': pd.to_datetime(row.get('stripe_first_payment')).isoformat() if pd.notna(row.get('stripe_first_payment')) else None,
            'source': 'stripe',
            'external_id': None,  # Don't have individual transaction IDs in unified file
            'payment_type': 'buy_in_full',
            'import_batch_id': str(batch_id),
            'is_suspicious': False,
        }
        payments_to_insert.append(payment)

        # Timeline event for Stripe purchase
        if pd.notna(row.get('stripe_first_payment')):
            timeline_events.append({
                'email': email,
                'event_type': 'purchased',
                'event_date': pd.to_datetime(row.get('stripe_first_payment')).isoformat(),
                'source': 'stripe',
                'import_batch_id': str(batch_id),
                'event_details': {'payment_count': int(row.get('stripe_payments', 0))}
            })

    # Create payment records for Denefits
    if pd.notna(row.get('denefits_revenue')) and row.get('denefits_revenue') > 0:
        payment = {
            'email': email,
            'amount': float(row.get('denefits_revenue')),
            'currency': 'USD',
            'payment_date': pd.to_datetime(row.get('denefits_signup_date')).isoformat() if pd.notna(row.get('denefits_signup_date')) else None,
            'source': 'denefits',
            'external_id': None,
            'payment_type': 'buy_now_pay_later',
            'import_batch_id': str(batch_id),
            'is_suspicious': False,
        }
        payments_to_insert.append(payment)

        # Timeline event for Denefits signup
        if pd.notna(row.get('denefits_signup_date')):
            timeline_events.append({
                'email': email,
                'event_type': 'purchased',
                'event_date': pd.to_datetime(row.get('denefits_signup_date')).isoformat(),
                'source': 'denefits',
                'import_batch_id': str(batch_id),
                'event_details': {'contract_count': int(row.get('denefits_contracts', 0))}
            })

    # Timeline event for subscription
    if pd.notna(row.get('subscription_date')):
        timeline_events.append({
            'email': email,
            'event_type': 'contact_created',
            'event_date': pd.to_datetime(row.get('subscription_date')).isoformat(),
            'source': row.get('source', 'unified'),
            'import_batch_id': str(batch_id),
        })

print(f"✓ Mapped {len(contacts_to_insert)} contacts")
print(f"✓ Created {len(payments_to_insert)} payment records")
print(f"✓ Created {len(timeline_events)} timeline events\n")

# Insert contacts into Supabase
print("💾 Inserting contacts into Supabase...\n")

try:
    # Batch insert (Supabase has limits, so we'll do it in chunks)
    BATCH_SIZE = 500
    total_inserted = 0

    for i in range(0, len(contacts_to_insert), BATCH_SIZE):
        batch = contacts_to_insert[i:i+BATCH_SIZE]
        response = supabase.table('hist_contacts').upsert(
            batch,
            on_conflict='email'
        ).execute()
        total_inserted += len(batch)
        print(f"  ✓ Inserted batch {i//BATCH_SIZE + 1}: {len(batch)} contacts")

    print(f"\n✅ Total contacts inserted: {total_inserted}\n")

except Exception as e:
    print(f"❌ ERROR inserting contacts: {e}")
    print(f"Error type: {type(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Insert payments
if payments_to_insert:
    print("💰 Inserting payments into Supabase...\n")

    try:
        for i in range(0, len(payments_to_insert), BATCH_SIZE):
            batch = payments_to_insert[i:i+BATCH_SIZE]
            response = supabase.table('hist_payments').insert(batch).execute()
            print(f"  ✓ Inserted batch {i//BATCH_SIZE + 1}: {len(batch)} payments")

        print(f"\n✅ Total payments inserted: {len(payments_to_insert)}\n")

    except Exception as e:
        print(f"⚠️  Warning: Could not insert payments: {e}")

# Insert timeline events
if timeline_events:
    print("📅 Inserting timeline events into Supabase...\n")

    try:
        for i in range(0, len(timeline_events), BATCH_SIZE):
            batch = timeline_events[i:i+BATCH_SIZE]
            response = supabase.table('hist_timeline').insert(batch).execute()
            print(f"  ✓ Inserted batch {i//BATCH_SIZE + 1}: {len(batch)} events")

        print(f"\n✅ Total timeline events inserted: {len(timeline_events)}\n")

    except Exception as e:
        print(f"⚠️  Warning: Could not insert timeline events: {e}")

# Log the import
print("📝 Logging import...\n")
import_completed = datetime.now()

log_entry = {
    'id': str(batch_id),
    'source_file': 'unified_contacts.csv',
    'source_type': 'unified',
    'rows_processed': len(df),
    'rows_imported': len(contacts_to_insert),
    'rows_skipped': len(df) - len(contacts_to_insert),
    'rows_updated': 0,
    'errors': None,
    'warnings': None,
    'import_started_at': import_started.isoformat(),
    'import_completed_at': import_completed.isoformat(),
    'imported_by': 'import_unified_to_supabase.py',
    'notes': f'Imported {len(contacts_to_insert)} contacts, {len(payments_to_insert)} payments, {len(timeline_events)} timeline events from unified file'
}

try:
    supabase.table('hist_import_logs').insert(log_entry).execute()
    print("✓ Import logged\n")
except Exception as e:
    print(f"⚠️  Warning: Could not log import: {e}\n")

# Print summary
print("="*60)
print("✅ IMPORT COMPLETE")
print("="*60)
print(f"Contacts imported: {len(contacts_to_insert)}")
print(f"Payments created: {len(payments_to_insert)}")
print(f"Timeline events: {len(timeline_events)}")
print(f"\nImport batch ID: {batch_id}")
print("="*60)
print()
print("🎉 You can now query your data in Supabase!")
print()
print("Try these views:")
print("  SELECT * FROM v_funnel_summary;")
print("  SELECT * FROM v_paid_vs_organic;")
print("  SELECT * FROM v_top_trigger_words;")
print()
