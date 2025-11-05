#!/usr/bin/env python3
"""
Import Google Sheets CSV Export to Historical Database

This script imports messy Google Sheets contact data into the hist_contacts table.
It handles:
- Duplicate contacts (dedupes by email)
- Missing fields (skips rows with no email)
- Inconsistent formatting (normalizes emails, phones, dates)
- Row creation timestamps (if available from Google Sheets metadata)

Usage:
    python scripts/import_google_sheets.py path/to/google_sheets_export.csv

Environment Variables Required:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_SERVICE_KEY - Your Supabase service role key (admin access)

Output:
    - Imports contacts to hist_contacts table
    - Creates timeline events in hist_timeline table
    - Logs import results to hist_import_logs table
"""

import os
import sys
import csv
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import uuid

# Third-party imports (install with: pip install supabase python-dotenv pandas)
try:
    from supabase import create_client, Client
    from dotenv import load_dotenv
    import pandas as pd
except ImportError:
    print("ERROR: Missing required packages.")
    print("Install with: pip install supabase python-dotenv pandas")
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


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def normalize_email(email: Optional[str]) -> Optional[str]:
    """Normalize email to lowercase and trim whitespace."""
    if not email or not isinstance(email, str):
        return None
    email = email.strip().lower()
    # Basic email validation
    if "@" not in email or "." not in email:
        return None
    return email


def normalize_phone(phone: Optional[str]) -> Optional[str]:
    """Extract digits only from phone number."""
    if not phone or not isinstance(phone, str):
        return None
    digits = re.sub(r'\D', '', phone)
    if len(digits) < 10:  # Must be at least 10 digits (US phone)
        return None
    return digits


def parse_date_flexible(date_str: Optional[str]) -> Optional[datetime]:
    """
    Try to parse dates in multiple formats.
    Returns datetime object or None if unparseable.
    """
    if not date_str or not isinstance(date_str, str):
        return None

    date_str = date_str.strip()
    if not date_str:
        return None

    # Try multiple date formats
    formats = [
        "%Y-%m-%d",           # 2024-03-15
        "%m/%d/%Y",           # 03/15/2024
        "%m/%d/%y",           # 03/15/24
        "%Y-%m-%d %H:%M:%S", # 2024-03-15 14:30:00
        "%m/%d/%Y %H:%M:%S", # 03/15/2024 14:30:00
        "%Y-%m-%dT%H:%M:%S", # ISO format
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    # If all formats fail, try pandas (it's more flexible)
    try:
        return pd.to_datetime(date_str, errors='coerce')
    except:
        return None


def is_suspicious_data(contact: Dict) -> Tuple[bool, str]:
    """
    Check if contact data looks suspicious.
    Returns (is_suspicious, reason).
    """
    reasons = []

    # Check for future dates
    now = datetime.now()
    if contact.get('first_seen') and contact['first_seen'] > now:
        reasons.append("future first_seen date")
    if contact.get('purchase_date') and contact['purchase_date'] > now:
        reasons.append("future purchase date")

    # Check for purchase before first contact
    if contact.get('first_seen') and contact.get('purchase_date'):
        if contact['purchase_date'] < contact['first_seen']:
            reasons.append("purchase before first contact")

    # Check for obviously wrong email formats
    email = contact.get('email')
    if email and ('test' in email or 'fake' in email or 'example' in email):
        reasons.append("test/fake email")

    if reasons:
        return True, "; ".join(reasons)
    return False, ""


def infer_reached_stage(row: Dict) -> str:
    """
    Infer the furthest stage reached based on available data.
    This is a best guess based on what fields are populated.
    """
    # Check for purchase (highest stage)
    if row.get('purchase_date') or row.get('has_purchase'):
        return 'purchased'

    # Check for meeting attended (check common column names)
    attended_fields = ['meeting_held', 'attended', 'showed_up', 'attended_date']
    if any(row.get(field) for field in attended_fields):
        return 'attended'

    # Check for meeting booked
    booked_fields = ['meeting_booked', 'booked', 'booking_date', 'appointment_date']
    if any(row.get(field) for field in booked_fields):
        return 'booked'

    # Check for qualified (answered questions, engaged with bot)
    qualified_fields = ['qualified', 'dm_qualified', 'q1', 'q2', 'symptoms']
    if any(row.get(field) for field in qualified_fields):
        return 'qualified'

    # Default: just contacted
    return 'contacted'


def map_google_sheets_row(row: Dict, batch_id: uuid.UUID) -> Optional[Dict]:
    """
    Map a Google Sheets CSV row to hist_contacts schema.
    Returns None if row should be skipped (no email).

    This function tries to intelligently map columns even if they have
    different names in your export. Adjust the column name mappings as needed.
    """
    # Normalize email (required field)
    email = normalize_email(
        row.get('email') or
        row.get('Email') or
        row.get('email_primary') or
        row.get('Email Address')
    )

    if not email:
        return None  # Skip rows with no email

    # Extract basic contact info (try multiple possible column names)
    first_name = (
        row.get('first_name') or
        row.get('First Name') or
        row.get('firstname') or
        row.get('FirstName')
    )

    last_name = (
        row.get('last_name') or
        row.get('Last Name') or
        row.get('lastname') or
        row.get('LastName')
    )

    phone = normalize_phone(
        row.get('phone') or
        row.get('Phone') or
        row.get('phone_number') or
        row.get('Phone Number')
    )

    # Extract attribution data
    ad_type = (
        row.get('ad_type') or
        row.get('Ad Type') or
        row.get('traffic_source')
    )
    if ad_type:
        ad_type = ad_type.lower()
        # Normalize to 'paid' or 'organic'
        if 'paid' in ad_type or 'ad' in ad_type:
            ad_type = 'paid'
        elif 'organic' in ad_type or 'free' in ad_type:
            ad_type = 'organic'

    trigger_word = (
        row.get('trigger_word') or
        row.get('Trigger Word') or
        row.get('keyword') or
        row.get('Keyword')
    )

    campaign_name = (
        row.get('campaign') or
        row.get('Campaign') or
        row.get('campaign_name')
    )

    # Extract dates (try to find row creation timestamp)
    # Google Sheets might export with column names like 'Timestamp', 'Created', etc.
    first_seen = parse_date_flexible(
        row.get('timestamp') or
        row.get('Timestamp') or
        row.get('created') or
        row.get('Created') or
        row.get('date_added') or
        row.get('Date Added')
    )

    purchase_date = parse_date_flexible(
        row.get('purchase_date') or
        row.get('Purchase Date') or
        row.get('paid_date') or
        row.get('payment_date')
    )

    # Determine if they purchased
    has_purchase = bool(
        purchase_date or
        row.get('purchased') or
        row.get('has_purchased') or
        row.get('paid')
    )

    # Infer reached stage
    reached_stage = infer_reached_stage(row)

    # Build contact record
    contact = {
        'email': email,
        'first_name': first_name,
        'last_name': last_name,
        'phone': phone,
        'source': 'google_sheets',
        'import_batch_id': str(batch_id),
        'ad_type': ad_type,
        'trigger_word': trigger_word,
        'campaign_name': campaign_name,
        'reached_stage': reached_stage,
        'has_purchase': has_purchase,
        'first_seen': first_seen,
        'last_seen': first_seen,  # For Google Sheets, we only have one timestamp
        'purchase_date': purchase_date,
    }

    # Check for suspicious data
    is_bad, reason = is_suspicious_data(contact)
    if is_bad:
        contact['is_suspicious'] = True
        contact['data_quality_notes'] = reason

    return contact


# =============================================================================
# MAIN IMPORT LOGIC
# =============================================================================

def import_google_sheets_csv(csv_path: str):
    """Main import function."""

    print(f"\n{'='*60}")
    print(f"IMPORTING GOOGLE SHEETS CSV: {csv_path}")
    print(f"{'='*60}\n")

    # Create import batch ID
    batch_id = uuid.uuid4()
    import_started = datetime.now()

    # Read CSV
    print("📖 Reading CSV file...")
    try:
        df = pd.read_csv(csv_path)
        print(f"✓ Found {len(df)} rows in CSV\n")
    except Exception as e:
        print(f"❌ ERROR reading CSV: {e}")
        sys.exit(1)

    # Process rows
    print("🔄 Processing rows...")
    contacts_to_insert = []
    skipped_rows = []
    errors = []
    warnings = []

    for idx, row in df.iterrows():
        try:
            contact = map_google_sheets_row(row.to_dict(), batch_id)
            if contact:
                contacts_to_insert.append(contact)
            else:
                skipped_rows.append(idx)
                warnings.append(f"Row {idx}: No email found")
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")
            skipped_rows.append(idx)

    print(f"✓ Processed {len(df)} rows")
    print(f"  - {len(contacts_to_insert)} contacts ready to import")
    print(f"  - {len(skipped_rows)} rows skipped (no email or errors)\n")

    if not contacts_to_insert:
        print("❌ No valid contacts to import. Exiting.")
        sys.exit(1)

    # Dedupe by email (keep most complete record)
    print("🔍 Deduplicating by email...")
    email_to_contact = {}
    for contact in contacts_to_insert:
        email = contact['email']
        if email not in email_to_contact:
            email_to_contact[email] = contact
        else:
            # Keep record with more non-null fields
            existing = email_to_contact[email]
            existing_fields = sum(1 for v in existing.values() if v is not None)
            new_fields = sum(1 for v in contact.values() if v is not None)
            if new_fields > existing_fields:
                email_to_contact[email] = contact
                warnings.append(f"Duplicate email {email}: kept more complete record")

    unique_contacts = list(email_to_contact.values())
    print(f"✓ Deduped to {len(unique_contacts)} unique contacts\n")

    # Insert into Supabase (using upsert to handle conflicts)
    print("💾 Inserting into Supabase...")
    try:
        # Upsert contacts (insert or update if email already exists)
        response = supabase.table('hist_contacts').upsert(
            unique_contacts,
            on_conflict='email'  # Update existing records with same email
        ).execute()

        print(f"✓ Inserted {len(unique_contacts)} contacts into hist_contacts\n")
    except Exception as e:
        print(f"❌ ERROR inserting contacts: {e}")
        errors.append(f"Database insert failed: {str(e)}")

    # Create timeline events
    print("📅 Creating timeline events...")
    timeline_events = []
    for contact in unique_contacts:
        email = contact['email']

        # Add "contact_created" event if we have first_seen
        if contact.get('first_seen'):
            timeline_events.append({
                'email': email,
                'event_type': 'contact_created',
                'event_date': contact['first_seen'],
                'source': 'google_sheets',
                'import_batch_id': str(batch_id)
            })

        # Add "purchased" event if we have purchase_date
        if contact.get('purchase_date'):
            timeline_events.append({
                'email': email,
                'event_type': 'purchased',
                'event_date': contact['purchase_date'],
                'source': 'google_sheets',
                'import_batch_id': str(batch_id)
            })

    if timeline_events:
        try:
            supabase.table('hist_timeline').insert(timeline_events).execute()
            print(f"✓ Created {len(timeline_events)} timeline events\n")
        except Exception as e:
            print(f"⚠️  Warning: Could not create timeline events: {e}")
            warnings.append(f"Timeline insert failed: {str(e)}")

    # Log the import
    print("📝 Logging import...")
    import_completed = datetime.now()
    log_entry = {
        'id': str(batch_id),
        'source_file': os.path.basename(csv_path),
        'source_type': 'google_sheets',
        'rows_processed': len(df),
        'rows_imported': len(unique_contacts),
        'rows_skipped': len(skipped_rows),
        'rows_updated': 0,  # We don't track updates separately in this version
        'errors': errors if errors else None,
        'warnings': warnings if warnings else None,
        'import_started_at': import_started.isoformat(),
        'import_completed_at': import_completed.isoformat(),
        'imported_by': 'import_google_sheets.py',
        'notes': f"Imported {len(unique_contacts)} unique contacts from Google Sheets export"
    }

    try:
        supabase.table('hist_import_logs').insert(log_entry).execute()
        print("✓ Import logged\n")
    except Exception as e:
        print(f"⚠️  Warning: Could not log import: {e}\n")

    # Print summary
    print(f"{'='*60}")
    print(f"✅ IMPORT COMPLETE")
    print(f"{'='*60}")
    print(f"Total rows processed: {len(df)}")
    print(f"Contacts imported: {len(unique_contacts)}")
    print(f"Rows skipped: {len(skipped_rows)}")
    print(f"Errors: {len(errors)}")
    print(f"Warnings: {len(warnings)}")
    print(f"Timeline events: {len(timeline_events)}")
    print(f"\nImport batch ID: {batch_id}")
    print(f"{'='*60}\n")

    # Print errors/warnings if any
    if errors:
        print("\n❌ ERRORS:")
        for error in errors[:10]:  # Show first 10
            print(f"  - {error}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more")

    if warnings:
        print("\n⚠️  WARNINGS:")
        for warning in warnings[:10]:  # Show first 10
            print(f"  - {warning}")
        if len(warnings) > 10:
            print(f"  ... and {len(warnings) - 10} more")

    print("\n✓ You can now query the data in Supabase:")
    print("  - SELECT * FROM hist_contacts;")
    print("  - SELECT * FROM v_funnel_summary;")
    print("  - SELECT * FROM v_data_quality_report;")
    print()


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_google_sheets.py path/to/google_sheets_export.csv")
        sys.exit(1)

    csv_path = sys.argv[1]

    if not os.path.exists(csv_path):
        print(f"ERROR: File not found: {csv_path}")
        sys.exit(1)

    import_google_sheets_csv(csv_path)
