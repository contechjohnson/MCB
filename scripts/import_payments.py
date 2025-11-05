#!/usr/bin/env python3
"""
Import Stripe & Denefits Payment Data to Historical Database

This script imports payment data from Stripe and Denefits CSV exports
into the hist_payments table and updates hist_contacts with purchase info.

It handles:
- Stripe payment exports (charges, refunds)
- Denefits BNPL financing contracts
- Linking payments to contacts by email
- Multiple payments per customer (upsells, recurring)
- Currency normalization

Usage:
    python scripts/import_payments.py --stripe path/to/stripe_export.csv
    python scripts/import_payments.py --denefits path/to/denefits_export.csv
    python scripts/import_payments.py --stripe stripe.csv --denefits denefits.csv

Environment Variables Required:
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_SERVICE_KEY - Your Supabase service role key (admin access)

Output:
    - Inserts payment records into hist_payments table
    - Updates hist_contacts to mark has_purchase = TRUE
    - Logs import results to hist_import_logs table
"""

import os
import sys
import csv
import re
import argparse
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import uuid
from decimal import Decimal

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
# UTILITY FUNCTIONS
# =============================================================================

def normalize_email(email: Optional[str]) -> Optional[str]:
    """Normalize email to lowercase and trim whitespace."""
    if not email or not isinstance(email, str):
        return None
    email = email.strip().lower()
    if "@" not in email or "." not in email:
        return None
    return email


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
        "%Y-%m-%dT%H:%M:%S.%fZ",  # ISO with milliseconds
        "%Y-%m-%d %H:%M:%S %z",    # With timezone
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


def normalize_amount(amount_str: Optional[str]) -> Optional[Decimal]:
    """
    Parse amount string to Decimal.
    Handles various formats: $1,234.56, 1234.56, 1234, etc.
    """
    if not amount_str:
        return None

    # Convert to string if not already
    amount_str = str(amount_str).strip()

    # Remove currency symbols and commas
    amount_str = re.sub(r'[$,€£¥]', '', amount_str)

    # Try to convert to Decimal
    try:
        amount = Decimal(amount_str)
        return amount
    except:
        return None


def is_suspicious_payment(payment: Dict) -> Tuple[bool, str]:
    """Check if payment data looks suspicious."""
    reasons = []
    now = datetime.now()

    # Check for future dates
    if payment.get('payment_date') and payment['payment_date'] > now:
        reasons.append("future payment date")

    # Check for negative amounts (except refunds)
    if payment.get('amount') and payment['amount'] < 0 and payment.get('payment_type') != 'refund':
        reasons.append("negative amount (not a refund)")

    # Check for unreasonably high amounts (over $50k)
    if payment.get('amount') and payment['amount'] > 50000:
        reasons.append("suspiciously high amount")

    if reasons:
        return True, "; ".join(reasons)
    return False, ""


# =============================================================================
# STRIPE-SPECIFIC FUNCTIONS
# =============================================================================

def map_stripe_row(row: Dict, batch_id: uuid.UUID) -> Optional[Dict]:
    """
    Map a Stripe CSV row to hist_payments schema.
    Returns None if row should be skipped.

    Stripe exports vary, but common column names include:
    - Customer Email, Email
    - Amount, Amount (USD), Gross
    - Created, Date
    - Description, Status, Type
    """
    # Extract email
    email = normalize_email(
        row.get('Customer Email') or
        row.get('customer_email') or
        row.get('Email') or
        row.get('email') or
        row.get('Customer')
    )

    if not email:
        return None  # Skip rows with no email

    # Extract amount
    # Stripe sometimes stores amount in cents, sometimes in dollars
    amount = normalize_amount(
        row.get('Amount') or
        row.get('Amount (USD)') or
        row.get('Gross') or
        row.get('amount') or
        row.get('Total')
    )

    # Check if amount is in cents (Stripe often uses cents)
    # If amount > 10000 and it's not a refund, it's probably in cents
    if amount and amount > 10000:
        # Likely in cents, convert to dollars
        amount = amount / 100

    if not amount or amount == 0:
        return None  # Skip zero-amount rows

    # Extract date
    payment_date = parse_date_flexible(
        row.get('Created') or
        row.get('created') or
        row.get('Date') or
        row.get('Created (UTC)') or
        row.get('Timestamp')
    )

    if not payment_date:
        return None  # Skip if no date

    # Determine payment type
    status = str(row.get('Status') or row.get('status') or '').lower()
    description = str(row.get('Description') or row.get('description') or '').lower()
    payment_type_raw = str(row.get('Type') or row.get('type') or '').lower()

    if 'refund' in status or 'refund' in description or 'refund' in payment_type_raw:
        payment_type = 'refund'
        amount = abs(amount) * -1  # Refunds are negative
    else:
        payment_type = 'buy_in_full'  # Stripe is typically full payment

    # Extract Stripe charge ID
    external_id = (
        row.get('id') or
        row.get('ID') or
        row.get('Charge ID') or
        row.get('charge_id') or
        row.get('Transaction ID')
    )

    # Currency
    currency = (
        row.get('Currency') or
        row.get('currency') or
        'USD'
    ).upper()

    # Build payment record
    payment = {
        'email': email,
        'amount': float(amount),
        'currency': currency,
        'payment_date': payment_date,
        'source': 'stripe',
        'external_id': external_id,
        'payment_type': payment_type,
        'import_batch_id': str(batch_id),
    }

    # Check for suspicious data
    is_bad, reason = is_suspicious_payment(payment)
    if is_bad:
        payment['is_suspicious'] = True

    return payment


# =============================================================================
# DENEFITS-SPECIFIC FUNCTIONS
# =============================================================================

def map_denefits_row(row: Dict, batch_id: uuid.UUID) -> Optional[Dict]:
    """
    Map a Denefits CSV row to hist_payments schema.
    Returns None if row should be skipped.

    Denefits exports typically include:
    - Customer email, name
    - Financed amount, down payment
    - Contract ID, status
    """
    # Extract email
    email = normalize_email(
        row.get('Customer Email') or
        row.get('customer_email') or
        row.get('Email') or
        row.get('email')
    )

    if not email:
        return None

    # Extract financed amount (total loan value)
    amount = normalize_amount(
        row.get('Financed Amount') or
        row.get('financed_amount') or
        row.get('Amount Financed') or
        row.get('Loan Amount') or
        row.get('Total')
    )

    if not amount or amount == 0:
        return None

    # Extract date
    payment_date = parse_date_flexible(
        row.get('Created') or
        row.get('created') or
        row.get('Contract Date') or
        row.get('Date') or
        row.get('Start Date')
    )

    if not payment_date:
        return None

    # Denefits is always BNPL
    payment_type = 'buy_now_pay_later'

    # Extract contract ID
    external_id = (
        row.get('Contract ID') or
        row.get('contract_id') or
        row.get('ID') or
        row.get('id')
    )

    # Build payment record
    payment = {
        'email': email,
        'amount': float(amount),
        'currency': 'USD',
        'payment_date': payment_date,
        'source': 'denefits',
        'external_id': external_id,
        'payment_type': payment_type,
        'import_batch_id': str(batch_id),
    }

    # Check for suspicious data
    is_bad, reason = is_suspicious_payment(payment)
    if is_bad:
        payment['is_suspicious'] = True

    return payment


# =============================================================================
# MAIN IMPORT LOGIC
# =============================================================================

def import_payments_csv(csv_path: str, source: str):
    """
    Import payments from CSV.
    source: 'stripe' or 'denefits'
    """
    print(f"\n{'='*60}")
    print(f"IMPORTING {source.upper()} PAYMENTS: {csv_path}")
    print(f"{'='*60}\n")

    batch_id = uuid.uuid4()
    import_started = datetime.now()

    # Read CSV
    print("📖 Reading CSV file...")
    try:
        df = pd.read_csv(csv_path)
        print(f"✓ Found {len(df)} rows in CSV")
        print(f"  Columns: {list(df.columns)[:10]}...")  # Show first 10 columns
        print()
    except Exception as e:
        print(f"❌ ERROR reading CSV: {e}")
        sys.exit(1)

    # Process rows
    print("🔄 Processing rows...")
    payments_to_insert = []
    skipped_rows = []
    errors = []
    warnings = []

    # Choose mapping function based on source
    map_func = map_stripe_row if source == 'stripe' else map_denefits_row

    for idx, row in df.iterrows():
        try:
            payment = map_func(row.to_dict(), batch_id)
            if payment:
                payments_to_insert.append(payment)
            else:
                skipped_rows.append(idx)
                warnings.append(f"Row {idx}: Missing required fields (email, amount, or date)")
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")
            skipped_rows.append(idx)

    print(f"✓ Processed {len(df)} rows")
    print(f"  - {len(payments_to_insert)} payments ready to import")
    print(f"  - {len(skipped_rows)} rows skipped\n")

    if not payments_to_insert:
        print("❌ No valid payments to import. Exiting.")
        sys.exit(1)

    # Insert payments into Supabase
    print("💾 Inserting payments into Supabase...")
    try:
        response = supabase.table('hist_payments').insert(payments_to_insert).execute()
        print(f"✓ Inserted {len(payments_to_insert)} payments into hist_payments\n")
    except Exception as e:
        print(f"❌ ERROR inserting payments: {e}")
        errors.append(f"Database insert failed: {str(e)}")
        return

    # Update hist_contacts to mark purchases
    print("🔗 Updating contacts with purchase info...")
    unique_emails = list(set([p['email'] for p in payments_to_insert if p['payment_type'] != 'refund']))

    updated_count = 0
    for email in unique_emails:
        try:
            # Get all payments for this email (excluding refunds)
            email_payments = [p for p in payments_to_insert if p['email'] == email and p['payment_type'] != 'refund']
            if not email_payments:
                continue

            # Calculate total purchase amount
            total_amount = sum(p['amount'] for p in email_payments)

            # Get earliest purchase date
            purchase_date = min(p['payment_date'] for p in email_payments)

            # Update contact
            update_data = {
                'has_purchase': True,
                'purchase_date': purchase_date.isoformat(),
                'purchase_amount': float(total_amount),
                'reached_stage': 'purchased'
            }

            supabase.table('hist_contacts').update(update_data).eq('email', email).execute()
            updated_count += 1

        except Exception as e:
            warnings.append(f"Could not update contact {email}: {str(e)}")

    print(f"✓ Updated {updated_count} contacts with purchase info\n")

    # Create timeline events
    print("📅 Creating timeline events...")
    timeline_events = []
    for payment in payments_to_insert:
        if payment['payment_type'] != 'refund':  # Don't create events for refunds
            timeline_events.append({
                'email': payment['email'],
                'event_type': 'purchased',
                'event_date': payment['payment_date'],
                'source': source,
                'import_batch_id': str(batch_id),
                'event_details': {
                    'amount': payment['amount'],
                    'payment_type': payment['payment_type']
                }
            })

    if timeline_events:
        try:
            supabase.table('hist_timeline').insert(timeline_events).execute()
            print(f"✓ Created {len(timeline_events)} timeline events\n")
        except Exception as e:
            print(f"⚠️  Warning: Could not create timeline events: {e}")

    # Log the import
    print("📝 Logging import...")
    import_completed = datetime.now()
    log_entry = {
        'id': str(batch_id),
        'source_file': os.path.basename(csv_path),
        'source_type': source,
        'rows_processed': len(df),
        'rows_imported': len(payments_to_insert),
        'rows_skipped': len(skipped_rows),
        'rows_updated': updated_count,
        'errors': errors if errors else None,
        'warnings': warnings if warnings else None,
        'import_started_at': import_started.isoformat(),
        'import_completed_at': import_completed.isoformat(),
        'imported_by': 'import_payments.py',
        'notes': f"Imported {len(payments_to_insert)} {source} payments, updated {updated_count} contacts"
    }

    try:
        supabase.table('hist_import_logs').insert(log_entry).execute()
        print("✓ Import logged\n")
    except Exception as e:
        print(f"⚠️  Warning: Could not log import: {e}\n")

    # Calculate revenue stats
    total_revenue = sum(p['amount'] for p in payments_to_insert if p['payment_type'] != 'refund')
    refund_amount = sum(abs(p['amount']) for p in payments_to_insert if p['payment_type'] == 'refund')
    net_revenue = total_revenue - refund_amount

    # Print summary
    print(f"{'='*60}")
    print(f"✅ IMPORT COMPLETE")
    print(f"{'='*60}")
    print(f"Total rows processed: {len(df)}")
    print(f"Payments imported: {len(payments_to_insert)}")
    print(f"Contacts updated: {updated_count}")
    print(f"Rows skipped: {len(skipped_rows)}")
    print(f"Errors: {len(errors)}")
    print(f"Warnings: {len(warnings)}")
    print(f"\nRevenue Stats:")
    print(f"  Total revenue: ${total_revenue:,.2f}")
    print(f"  Refunds: ${refund_amount:,.2f}")
    print(f"  Net revenue: ${net_revenue:,.2f}")
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

    print("\n✓ You can now query payment data:")
    print("  - SELECT * FROM hist_payments;")
    print("  - SELECT * FROM v_payment_breakdown;")
    print("  - SELECT * FROM v_revenue_attribution;")
    print()


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Import Stripe or Denefits payment data')
    parser.add_argument('--stripe', type=str, help='Path to Stripe CSV export')
    parser.add_argument('--denefits', type=str, help='Path to Denefits CSV export')

    args = parser.parse_args()

    if not args.stripe and not args.denefits:
        print("ERROR: You must specify at least one CSV file with --stripe or --denefits")
        print("\nUsage:")
        print("  python import_payments.py --stripe path/to/stripe_export.csv")
        print("  python import_payments.py --denefits path/to/denefits_export.csv")
        print("  python import_payments.py --stripe stripe.csv --denefits denefits.csv")
        sys.exit(1)

    # Import Stripe if provided
    if args.stripe:
        if not os.path.exists(args.stripe):
            print(f"ERROR: Stripe file not found: {args.stripe}")
            sys.exit(1)
        import_payments_csv(args.stripe, 'stripe')

    # Import Denefits if provided
    if args.denefits:
        if not os.path.exists(args.denefits):
            print(f"ERROR: Denefits file not found: {args.denefits}")
            sys.exit(1)
        import_payments_csv(args.denefits, 'denefits')
