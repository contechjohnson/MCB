#!/usr/bin/env python3
"""
Create Unified Contacts with Purchase Data

This script matches contacts from multiple sources (Google Sheets, Airtable) and
links them to purchases (Stripe, Denefits). It creates a master contact list showing:
- Who they are (name, email, phone)
- Where they came from (paid/organic, trigger word)
- How far they got in the funnel
- What they purchased (if anything)
- Total revenue per contact

Matching strategy:
1. Email (primary) - normalize and match
2. Create unified record with best data from each source

Output: unified_contacts.csv

Usage:
    python scripts/create_unified_contacts.py
"""

import os
import sys
import pandas as pd
import re
from datetime import datetime
from typing import Dict, List, Optional

# File paths
HISTORICAL_DATA = '/Users/connorjohnson/CLAUDE_CODE/MCB/historical_data'
OUTPUT_FILE = f'{HISTORICAL_DATA}/unified_contacts.csv'

# Input files
GOOGLE_SHEETS_MAIN = f'{HISTORICAL_DATA}/google_sheets_main_contacts.csv'
GOOGLE_SHEETS_SIMPLE = f'{HISTORICAL_DATA}/google_sheets_simplified_contacts.csv'
AIRTABLE_CONTACTS = f'{HISTORICAL_DATA}/airtable_contacts.csv'
STRIPE_PAYMENTS = f'{HISTORICAL_DATA}/unified_payments.csv'
DENEFITS_CONTRACTS = f'{HISTORICAL_DATA}/denefits_contracts.csv'

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def normalize_email(email):
    """Normalize email for matching"""
    if pd.isna(email) or not email:
        return None
    email = str(email).strip().lower()
    if '@' not in email:
        return None
    return email

def normalize_phone(phone):
    """Extract digits only from phone"""
    if pd.isna(phone) or not phone:
        return None
    digits = re.sub(r'\D', '', str(phone))
    if len(digits) < 10:
        return None
    return digits

def parse_date_flexible(date_str):
    """Try to parse dates flexibly"""
    if pd.isna(date_str) or not date_str:
        return None

    try:
        return pd.to_datetime(date_str, errors='coerce')
    except:
        return None

def safe_float(value):
    """Safely convert to float"""
    try:
        if pd.isna(value):
            return 0.0
        return float(value)
    except:
        return 0.0

# =============================================================================
# LOAD DATA
# =============================================================================

print("\n" + "="*60)
print("CREATING UNIFIED CONTACTS WITH PURCHASES")
print("="*60 + "\n")

print("📂 Loading data files...\n")

# Load contacts
print("  Loading Google Sheets main contacts...")
try:
    df_google_main = pd.read_csv(GOOGLE_SHEETS_MAIN, low_memory=False)
    print(f"    ✓ Loaded {len(df_google_main)} contacts")
except Exception as e:
    print(f"    ❌ Error: {e}")
    df_google_main = pd.DataFrame()

print("  Loading Google Sheets simplified contacts...")
try:
    df_google_simple = pd.read_csv(GOOGLE_SHEETS_SIMPLE, low_memory=False)
    print(f"    ✓ Loaded {len(df_google_simple)} contacts")
except Exception as e:
    print(f"    ❌ Error: {e}")
    df_google_simple = pd.DataFrame()

print("  Loading Airtable contacts...")
try:
    df_airtable = pd.read_csv(AIRTABLE_CONTACTS, low_memory=False)
    print(f"    ✓ Loaded {len(df_airtable)} contacts")
except Exception as e:
    print(f"    ❌ Error: {e}")
    df_airtable = pd.DataFrame()

# Load payments
print("  Loading Stripe payments...")
try:
    df_stripe = pd.read_csv(STRIPE_PAYMENTS, low_memory=False)
    # Filter to only successful payments
    df_stripe = df_stripe[df_stripe['Status'] == 'Paid'].copy()
    print(f"    ✓ Loaded {len(df_stripe)} paid transactions")
except Exception as e:
    print(f"    ❌ Error: {e}")
    df_stripe = pd.DataFrame()

print("  Loading Denefits contracts...")
try:
    df_denefits = pd.read_csv(DENEFITS_CONTRACTS, low_memory=False)
    # Filter to active/completed contracts
    df_denefits = df_denefits[df_denefits['Payment Plan Status'].isin(['Active', 'Completed'])].copy()
    print(f"    ✓ Loaded {len(df_denefits)} contracts")
except Exception as e:
    print(f"    ❌ Error: {e}")
    df_denefits = pd.DataFrame()

print("\n✅ All data loaded\n")

# =============================================================================
# BUILD UNIFIED CONTACTS
# =============================================================================

print("🔨 Building unified contact list...\n")

# Dictionary to store unified contacts (keyed by normalized email)
unified_contacts = {}

# Process Google Sheets Main
print("  Processing Google Sheets main contacts...")
processed = 0
for idx, row in df_google_main.iterrows():
    email = normalize_email(row.get('Email Address'))
    if not email:
        continue

    if email not in unified_contacts:
        unified_contacts[email] = {
            'email': email,
            'first_name': row.get('First Name'),
            'last_name': row.get('Last Name'),
            'phone': normalize_phone(row.get('Phone Number')),
            'instagram': row.get('Instagram Name'),
            'facebook': row.get('Facebook Name'),
            'user_id': row.get('User ID'),
            'subscription_date': parse_date_flexible(row.get('Subscription Date')),
            'stage': row.get('Stage'),
            'symptoms': row.get('Symptoms'),
            'months_pp': row.get('Months PP'),
            'objections': row.get('Objections'),
            'trigger_word': row.get('TRIGGER WORD'),
            'paid_vs_organic': row.get('PAID VS ORGANIC'),
            'platform': row.get('IG or FB'),
            'ab_test': row.get('AB - Testing 1'),
            'total_purchased_google': safe_float(row.get('Total Purchased')),
            'source': 'google_sheets',
            # Additional tracking
            'sent_link': row.get('Sent Link'),
            'clicked_link': row.get('Clicked Link'),
            'booked': row.get('Booked Paid DC') or row.get('Booked Free DC'),
            'attended': row.get('Attended Paid DC') or row.get('Attended Free DC'),
        }
    processed += 1

print(f"    ✓ Processed {processed} contacts")

# Process Airtable Contacts
print("  Processing Airtable contacts...")
merged = 0
new = 0
for idx, row in df_airtable.iterrows():
    # Check both email fields
    email = normalize_email(row.get('EMAIL')) or normalize_email(row.get('Email (Norm)'))
    if not email:
        continue

    if email in unified_contacts:
        # Merge/enrich existing contact
        contact = unified_contacts[email]

        # Add IDs from Airtable
        if pd.notna(row.get('MC_ID')):
            contact['mc_id'] = row.get('MC_ID')
        if pd.notna(row.get('GHL_ID')):
            contact['ghl_id'] = row.get('GHL_ID')
        if pd.notna(row.get('AD_ID')):
            contact['ad_id'] = row.get('AD_ID')
        if pd.notna(row.get('THREAD_ID')):
            contact['thread_id'] = row.get('THREAD_ID')

        # Update if better data
        if not contact.get('trigger_word') and pd.notna(row.get('TRIGGER_WORD')):
            contact['trigger_word'] = row.get('TRIGGER_WORD')
        if not contact.get('paid_vs_organic') and pd.notna(row.get('PAID_VS_ORGANIC')):
            contact['paid_vs_organic'] = row.get('PAID_VS_ORGANIC')

        # Add Airtable-specific dates
        if pd.notna(row.get('DATE_SET_PURCHASE')):
            contact['airtable_purchase_date'] = parse_date_flexible(row.get('DATE_SET_PURCHASE'))

        contact['source'] = 'merged'
        merged += 1
    else:
        # New contact from Airtable
        unified_contacts[email] = {
            'email': email,
            'first_name': row.get('FIRST_NAME'),
            'last_name': row.get('LAST_NAME'),
            'phone': normalize_phone(row.get('PHONE')),
            'instagram': row.get('IG_USERNAME'),
            'mc_id': row.get('MC_ID'),
            'ghl_id': row.get('GHL_ID'),
            'ad_id': row.get('AD_ID'),
            'thread_id': row.get('THREAD_ID'),
            'trigger_word': row.get('TRIGGER_WORD'),
            'paid_vs_organic': row.get('PAID_VS_ORGANIC'),
            'stage': row.get('STAGE'),
            'subscription_date': parse_date_flexible(row.get('SUBSCRIBED_DATE')),
            'airtable_purchase_date': parse_date_flexible(row.get('DATE_SET_PURCHASE')),
            'source': 'airtable',
        }
        new += 1

print(f"    ✓ Merged {merged} contacts, added {new} new contacts")

# Process Google Sheets Simplified (mainly for Thread IDs)
print("  Processing Google Sheets simplified...")
enriched = 0
for idx, row in df_google_simple.iterrows():
    email = normalize_email(row.get('Email Address'))
    if not email or email not in unified_contacts:
        continue

    contact = unified_contacts[email]

    # Add Thread ID if missing
    if not contact.get('thread_id') and pd.notna(row.get('Thread ID')):
        contact['thread_id'] = row.get('Thread ID')
        enriched += 1

    # Add Ad ID if missing
    if not contact.get('ad_id') and pd.notna(row.get('Ad_Id')):
        contact['ad_id'] = row.get('Ad_Id')

print(f"    ✓ Enriched {enriched} contacts with Thread IDs\n")

print(f"📊 Total unique contacts: {len(unified_contacts)}\n")

# =============================================================================
# LINK PURCHASES
# =============================================================================

print("💰 Linking purchase data...\n")

# Link Stripe payments
print("  Linking Stripe payments...")
stripe_matched = 0
stripe_revenue = 0

for idx, row in df_stripe.iterrows():
    # Try email from metadata first, then Customer Email
    email = normalize_email(row.get('email (metadata)')) or normalize_email(row.get('Customer Email'))
    if not email or email not in unified_contacts:
        continue

    contact = unified_contacts[email]
    amount = safe_float(row.get('Amount'))

    # Add to purchase tracking
    if 'stripe_payments' not in contact:
        contact['stripe_payments'] = 0
        contact['stripe_revenue'] = 0.0
        contact['stripe_first_payment'] = None
        contact['stripe_last_payment'] = None

    contact['stripe_payments'] += 1
    contact['stripe_revenue'] += amount

    payment_date = parse_date_flexible(row.get('Created date (UTC)'))
    if payment_date:
        if not contact['stripe_first_payment'] or payment_date < contact['stripe_first_payment']:
            contact['stripe_first_payment'] = payment_date
        if not contact['stripe_last_payment'] or payment_date > contact['stripe_last_payment']:
            contact['stripe_last_payment'] = payment_date

    # Store package info
    if pd.notna(row.get('package_name (metadata)')) and not contact.get('stripe_package'):
        contact['stripe_package'] = row.get('package_name (metadata)')

    stripe_matched += 1
    stripe_revenue += amount

print(f"    ✓ Linked {stripe_matched} Stripe payments")
print(f"    ✓ Total Stripe revenue: ${stripe_revenue:,.2f}\n")

# Link Denefits contracts
print("  Linking Denefits contracts...")
denefits_matched = 0
denefits_revenue = 0

for idx, row in df_denefits.iterrows():
    email = normalize_email(row.get('Customer Email'))
    if not email or email not in unified_contacts:
        continue

    contact = unified_contacts[email]
    amount = safe_float(row.get('Payment Plan Amount'))

    # Add to purchase tracking
    if 'denefits_contracts' not in contact:
        contact['denefits_contracts'] = 0
        contact['denefits_revenue'] = 0.0
        contact['denefits_signup_date'] = None

    contact['denefits_contracts'] += 1
    contact['denefits_revenue'] += amount

    signup_date = parse_date_flexible(row.get('Payment Plan Sign Up Date'))
    if signup_date:
        if not contact['denefits_signup_date'] or signup_date < contact['denefits_signup_date']:
            contact['denefits_signup_date'] = signup_date

    contact['denefits_status'] = row.get('Payment Plan Status')

    denefits_matched += 1
    denefits_revenue += amount

print(f"    ✓ Linked {denefits_matched} Denefits contracts")
print(f"    ✓ Total Denefits revenue: ${denefits_revenue:,.2f}\n")

# =============================================================================
# CALCULATE UNIFIED METRICS
# =============================================================================

print("📈 Calculating unified metrics...\n")

for email, contact in unified_contacts.items():
    # Total revenue
    stripe_rev = contact.get('stripe_revenue', 0.0)
    denefits_rev = contact.get('denefits_revenue', 0.0)
    google_rev = contact.get('total_purchased_google', 0.0)

    # Use max of actual payments vs Google Sheets estimate
    contact['total_revenue'] = max(stripe_rev + denefits_rev, google_rev)

    # Has purchase flag
    contact['has_purchase'] = (stripe_rev > 0 or denefits_rev > 0 or google_rev > 0)

    # Purchase date (earliest from any source)
    purchase_dates = [
        contact.get('stripe_first_payment'),
        contact.get('denefits_signup_date'),
        contact.get('airtable_purchase_date')
    ]
    purchase_dates = [d for d in purchase_dates if d is not None]
    contact['purchase_date'] = min(purchase_dates) if purchase_dates else None

    # Payment method
    if stripe_rev > 0 and denefits_rev > 0:
        contact['payment_method'] = 'Both'
    elif stripe_rev > 0:
        contact['payment_method'] = 'Stripe'
    elif denefits_rev > 0:
        contact['payment_method'] = 'Denefits'
    else:
        contact['payment_method'] = None

    # Time to purchase (if we have both dates)
    if contact.get('subscription_date') and contact.get('purchase_date'):
        try:
            delta = contact['purchase_date'] - contact['subscription_date']
            contact['days_to_purchase'] = delta.days
        except:
            contact['days_to_purchase'] = None
    else:
        contact['days_to_purchase'] = None

# =============================================================================
# CREATE OUTPUT DATAFRAME
# =============================================================================

print("💾 Creating output file...\n")

# Convert to DataFrame
df_unified = pd.DataFrame.from_dict(unified_contacts, orient='index')

# Select and order columns
columns_order = [
    'email',
    'first_name',
    'last_name',
    'phone',
    'instagram',
    'facebook',
    'mc_id',
    'ghl_id',
    'user_id',
    'thread_id',
    'ad_id',
    'subscription_date',
    'trigger_word',
    'paid_vs_organic',
    'platform',
    'stage',
    'symptoms',
    'months_pp',
    'objections',
    'ab_test',
    'sent_link',
    'clicked_link',
    'booked',
    'attended',
    'has_purchase',
    'purchase_date',
    'payment_method',
    'total_revenue',
    'stripe_payments',
    'stripe_revenue',
    'stripe_first_payment',
    'stripe_last_payment',
    'stripe_package',
    'denefits_contracts',
    'denefits_revenue',
    'denefits_signup_date',
    'denefits_status',
    'days_to_purchase',
    'source',
]

# Ensure all columns exist
for col in columns_order:
    if col not in df_unified.columns:
        df_unified[col] = None

df_unified = df_unified[columns_order]

# Sort by total revenue descending
df_unified = df_unified.sort_values('total_revenue', ascending=False)

# Save to CSV
df_unified.to_csv(OUTPUT_FILE, index=False)

print(f"✅ Saved to: {OUTPUT_FILE}\n")

# =============================================================================
# PRINT SUMMARY STATS
# =============================================================================

print("="*60)
print("SUMMARY STATISTICS")
print("="*60 + "\n")

print(f"Total unique contacts: {len(df_unified)}")
print(f"Contacts with purchases: {df_unified['has_purchase'].sum()}")
print(f"Conversion rate: {(df_unified['has_purchase'].sum() / len(df_unified) * 100):.2f}%")
print()

print("Revenue breakdown:")
print(f"  Total revenue: ${df_unified['total_revenue'].sum():,.2f}")
print(f"  From Stripe: ${df_unified['stripe_revenue'].sum():,.2f}")
print(f"  From Denefits: ${df_unified['denefits_revenue'].sum():,.2f}")
print(f"  Average per customer: ${df_unified[df_unified['has_purchase']]['total_revenue'].mean():,.2f}")
print()

print("Payment method breakdown:")
print(f"  Stripe only: {(df_unified['payment_method'] == 'Stripe').sum()}")
print(f"  Denefits only: {(df_unified['payment_method'] == 'Denefits').sum()}")
print(f"  Both: {(df_unified['payment_method'] == 'Both').sum()}")
print()

print("Source breakdown:")
print(df_unified['source'].value_counts())
print()

print("Paid vs Organic:")
print(df_unified['paid_vs_organic'].value_counts())
print()

print("="*60)
print("✅ UNIFIED CONTACTS CREATED SUCCESSFULLY!")
print("="*60)
print()
print(f"Open the file: {OUTPUT_FILE}")
print("Or import into Supabase for analysis")
print()
