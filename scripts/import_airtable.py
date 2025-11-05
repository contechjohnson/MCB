#!/usr/bin/env python3
"""
Import Airtable CSV Export to Historical Database

This script imports messy Airtable data (with duplicate columns, ad attribution tracking)
into the hist_contacts table.

It handles:
- Duplicate columns (merges or takes first non-null)
- Ad attribution data (campaign names, ad IDs, trigger words)
- Merging with existing contacts from Google Sheets import
- Data quality issues (missing fields, bad formatting)

Usage:
    python scripts/import_airtable.py path/to/airtable_export.csv

Environment Variables Required:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_SERVICE_KEY - Your Supabase service role key (admin access)

Output:
    - Updates existing contacts in hist_contacts (if email matches)
    - Inserts new contacts not found in previous imports
    - Logs import results to hist_import_logs table
"""

import os
import sys
import csv
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
import uuid

# Third-party imports
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
# UTILITY FUNCTIONS (reused from import_google_sheets.py)
# =============================================================================

def normalize_email(email: Optional[str]) -> Optional[str]:
    """Normalize email to lowercase and trim whitespace."""
    if not email or not isinstance(email, str):
        return None
    email = email.strip().lower()
    if "@" not in email or "." not in email:
        return None
    return email


def normalize_phone(phone: Optional[str]) -> Optional[str]:
    """Extract digits only from phone number."""
    if not phone or not isinstance(phone, str):
        return None
    digits = re.sub(r'\D', '', phone)
    if len(digits) < 10:
        return None
    return digits


def parse_date_flexible(date_str: Optional[str]) -> Optional[datetime]:
    """Try to parse dates in multiple formats."""
    if not date_str or not isinstance(date_str, str):
        return None

    date_str = date_str.strip()
    if not date_str:
        return None

    formats = [
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%m/%d/%y",
        "%Y-%m-%d %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    try:
        return pd.to_datetime(date_str, errors='coerce')
    except:
        return None


def is_suspicious_data(contact: Dict) -> Tuple[bool, str]:
    """Check if contact data looks suspicious."""
    reasons = []
    now = datetime.now()

    if contact.get('first_seen') and contact['first_seen'] > now:
        reasons.append("future first_seen date")
    if contact.get('purchase_date') and contact['purchase_date'] > now:
        reasons.append("future purchase date")

    if contact.get('first_seen') and contact.get('purchase_date'):
        if contact['purchase_date'] < contact['first_seen']:
            reasons.append("purchase before first contact")

    email = contact.get('email')
    if email and ('test' in email or 'fake' in email or 'example' in email):
        reasons.append("test/fake email")

    if reasons:
        return True, "; ".join(reasons)
    return False, ""


# =============================================================================
# AIRTABLE-SPECIFIC FUNCTIONS
# =============================================================================

def merge_duplicate_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Airtable exports sometimes have duplicate column names.
    This function merges them by taking the first non-null value.

    Example: If you have two columns named "Email", merge them.
    """
    # Get column names
    columns = df.columns.tolist()

    # Find duplicates
    seen = {}
    duplicates = {}
    for i, col in enumerate(columns):
        if col in seen:
            if col not in duplicates:
                duplicates[col] = [seen[col]]
            duplicates[col].append(i)
        else:
            seen[col] = i

    if not duplicates:
        return df  # No duplicates found

    print(f"  Found duplicate columns: {list(duplicates.keys())}")

    # Merge duplicates
    for col_name, indices in duplicates.items():
        # Get all columns with this name
        cols = [df.iloc[:, i] for i in indices]

        # Merge by taking first non-null value
        merged = pd.concat(cols, axis=1).bfill(axis=1).iloc[:, 0]

        # Keep only first occurrence, drop others
        df[col_name] = merged
        for i in sorted(indices[1:], reverse=True):
            df = df.drop(df.columns[i], axis=1)

    return df


def extract_ad_attribution(row: Dict) -> Dict[str, Any]:
    """
    Extract ad attribution data from Airtable row.
    Looks for common Airtable field names related to ads.
    """
    attribution = {}

    # Ad type (paid vs organic)
    ad_type = (
        row.get('ad_type') or
        row.get('Ad Type') or
        row.get('Traffic Source') or
        row.get('traffic_source') or
        row.get('Source')
    )
    if ad_type:
        ad_type = str(ad_type).lower()
        if 'paid' in ad_type or 'ad' in ad_type or 'facebook' in ad_type or 'meta' in ad_type:
            attribution['ad_type'] = 'paid'
        elif 'organic' in ad_type or 'free' in ad_type or 'direct' in ad_type:
            attribution['ad_type'] = 'organic'

    # Campaign name
    attribution['campaign_name'] = (
        row.get('campaign') or
        row.get('Campaign') or
        row.get('Campaign Name') or
        row.get('campaign_name') or
        row.get('Ad Campaign')
    )

    # Trigger word (ManyChat keyword)
    attribution['trigger_word'] = (
        row.get('trigger_word') or
        row.get('Trigger Word') or
        row.get('Keyword') or
        row.get('keyword') or
        row.get('Bot Keyword')
    )

    # Facebook/Meta Ad ID (if tracked)
    ad_id = (
        row.get('ad_id') or
        row.get('Ad ID') or
        row.get('FB Ad ID') or
        row.get('Meta Ad ID')
    )

    return attribution


def map_airtable_row(row: Dict, batch_id: uuid.UUID) -> Optional[Dict]:
    """
    Map an Airtable CSV row to hist_contacts schema.
    Returns None if row should be skipped (no email).
    """
    # Normalize email (required)
    email = normalize_email(
        row.get('email') or
        row.get('Email') or
        row.get('Email Address') or
        row.get('email_primary') or
        row.get('Primary Email')
    )

    if not email:
        return None

    # Extract basic info
    first_name = (
        row.get('first_name') or
        row.get('First Name') or
        row.get('firstname') or
        row.get('Name (First)')
    )

    last_name = (
        row.get('last_name') or
        row.get('Last Name') or
        row.get('lastname') or
        row.get('Name (Last)')
    )

    phone = normalize_phone(
        row.get('phone') or
        row.get('Phone') or
        row.get('Phone Number') or
        row.get('Mobile')
    )

    # Extract attribution
    attribution = extract_ad_attribution(row)

    # Extract dates
    first_seen = parse_date_flexible(
        row.get('created') or
        row.get('Created') or
        row.get('Created Time') or
        row.get('Date Added') or
        row.get('First Contact')
    )

    purchase_date = parse_date_flexible(
        row.get('purchase_date') or
        row.get('Purchase Date') or
        row.get('Paid Date') or
        row.get('Payment Date')
    )

    has_purchase = bool(
        purchase_date or
        row.get('purchased') or
        row.get('Purchased') or
        row.get('Has Purchased')
    )

    # Build contact record
    contact = {
        'email': email,
        'first_name': first_name,
        'last_name': last_name,
        'phone': phone,
        'source': 'airtable',
        'import_batch_id': str(batch_id),
        'ad_type': attribution.get('ad_type'),
        'trigger_word': attribution.get('trigger_word'),
        'campaign_name': attribution.get('campaign_name'),
        'has_purchase': has_purchase,
        'first_seen': first_seen,
        'last_seen': first_seen,
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

def import_airtable_csv(csv_path: str):
    """Main import function."""

    print(f"\n{'='*60}")
    print(f"IMPORTING AIRTABLE CSV: {csv_path}")
    print(f"{'='*60}\n")

    batch_id = uuid.uuid4()
    import_started = datetime.now()

    # Read CSV
    print("📖 Reading CSV file...")
    try:
        df = pd.read_csv(csv_path)
        print(f"✓ Found {len(df)} rows in CSV")
        print(f"  Columns: {list(df.columns)}\n")
    except Exception as e:
        print(f"❌ ERROR reading CSV: {e}")
        sys.exit(1)

    # Merge duplicate columns if any
    print("🔍 Checking for duplicate columns...")
    df = merge_duplicate_columns(df)
    print()

    # Process rows
    print("🔄 Processing rows...")
    contacts_to_upsert = []
    skipped_rows = []
    errors = []
    warnings = []

    for idx, row in df.iterrows():
        try:
            contact = map_airtable_row(row.to_dict(), batch_id)
            if contact:
                contacts_to_upsert.append(contact)
            else:
                skipped_rows.append(idx)
                warnings.append(f"Row {idx}: No email found")
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")
            skipped_rows.append(idx)

    print(f"✓ Processed {len(df)} rows")
    print(f"  - {len(contacts_to_upsert)} contacts ready to import")
    print(f"  - {len(skipped_rows)} rows skipped\n")

    if not contacts_to_upsert:
        print("❌ No valid contacts to import. Exiting.")
        sys.exit(1)

    # Dedupe by email
    print("🔍 Deduplicating by email...")
    email_to_contact = {}
    for contact in contacts_to_upsert:
        email = contact['email']
        if email not in email_to_contact:
            email_to_contact[email] = contact
        else:
            # Keep most complete record
            existing = email_to_contact[email]
            existing_fields = sum(1 for v in existing.values() if v is not None)
            new_fields = sum(1 for v in contact.values() if v is not None)
            if new_fields > existing_fields:
                email_to_contact[email] = contact

    unique_contacts = list(email_to_contact.values())
    print(f"✓ Deduped to {len(unique_contacts)} unique contacts\n")

    # Check which contacts already exist (from previous imports)
    print("🔗 Checking for existing contacts...")
    emails = [c['email'] for c in unique_contacts]
    try:
        existing_response = supabase.table('hist_contacts').select('email, source').in_('email', emails).execute()
        existing_emails = {row['email']: row['source'] for row in existing_response.data}
        print(f"✓ Found {len(existing_emails)} existing contacts\n")
    except Exception as e:
        print(f"⚠️  Warning: Could not check for existing contacts: {e}")
        existing_emails = {}

    # Merge sources for existing contacts
    for contact in unique_contacts:
        email = contact['email']
        if email in existing_emails:
            # Update source to 'merged' if coming from different source
            existing_source = existing_emails[email]
            if existing_source != 'airtable':
                contact['source'] = 'merged'
                contact['data_quality_notes'] = f"Merged from {existing_source} and airtable"

    # Upsert into Supabase
    print("💾 Upserting into Supabase...")
    new_inserts = 0
    updates = 0

    try:
        # Upsert (insert or update)
        for contact in unique_contacts:
            email = contact['email']
            if email in existing_emails:
                updates += 1
            else:
                new_inserts += 1

        response = supabase.table('hist_contacts').upsert(
            unique_contacts,
            on_conflict='email'
        ).execute()

        print(f"✓ Upserted {len(unique_contacts)} contacts")
        print(f"  - {new_inserts} new inserts")
        print(f"  - {updates} updates to existing records\n")
    except Exception as e:
        print(f"❌ ERROR upserting contacts: {e}")
        errors.append(f"Database upsert failed: {str(e)}")

    # Create timeline events for new purchases
    print("📅 Creating timeline events...")
    timeline_events = []
    for contact in unique_contacts:
        email = contact['email']

        if contact.get('first_seen'):
            timeline_events.append({
                'email': email,
                'event_type': 'contact_created',
                'event_date': contact['first_seen'],
                'source': 'airtable',
                'import_batch_id': str(batch_id)
            })

        if contact.get('purchase_date'):
            timeline_events.append({
                'email': email,
                'event_type': 'purchased',
                'event_date': contact['purchase_date'],
                'source': 'airtable',
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
        'source_type': 'airtable',
        'rows_processed': len(df),
        'rows_imported': new_inserts,
        'rows_skipped': len(skipped_rows),
        'rows_updated': updates,
        'errors': errors if errors else None,
        'warnings': warnings if warnings else None,
        'import_started_at': import_started.isoformat(),
        'import_completed_at': import_completed.isoformat(),
        'imported_by': 'import_airtable.py',
        'notes': f"Imported {new_inserts} new contacts, updated {updates} existing"
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
    print(f"New contacts inserted: {new_inserts}")
    print(f"Existing contacts updated: {updates}")
    print(f"Rows skipped: {len(skipped_rows)}")
    print(f"Errors: {len(errors)}")
    print(f"Warnings: {len(warnings)}")
    print(f"\nImport batch ID: {batch_id}")
    print(f"{'='*60}\n")

    if errors:
        print("\n❌ ERRORS:")
        for error in errors[:10]:
            print(f"  - {error}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more")

    if warnings:
        print("\n⚠️  WARNINGS:")
        for warning in warnings[:10]:
            print(f"  - {warning}")
        if len(warnings) > 10:
            print(f"  ... and {len(warnings) - 10} more")

    print("\n✓ You can now query the merged data:")
    print("  - SELECT * FROM hist_contacts WHERE source = 'merged';")
    print("  - SELECT * FROM v_revenue_attribution;")
    print()


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_airtable.py path/to/airtable_export.csv")
        sys.exit(1)

    csv_path = sys.argv[1]

    if not os.path.exists(csv_path):
        print(f"ERROR: File not found: {csv_path}")
        sys.exit(1)

    import_airtable_csv(csv_path)
