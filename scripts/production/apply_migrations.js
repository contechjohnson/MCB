#!/usr/bin/env node
/**
 * Apply Database Migrations to Supabase
 *
 * This script runs the SQL migrations to create the hist_* tables and views.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runMigration(filePath, name) {
  console.log(`\n📄 Running migration: ${name}...`);

  try {
    const sql = fs.readFileSync(filePath, 'utf8');

    // Supabase JS client doesn't support raw SQL directly
    // We need to use the REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok) {
      console.log(`  ✅ ${name} completed successfully`);
      return true;
    } else {
      console.log(`  ⚠️  ${name} - Using Supabase dashboard instead`);
      console.log(`  Copy SQL from: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.log(`  ⚠️  ${name} - Manual setup required`);
    console.log(`  Copy SQL from: ${filePath}`);
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('APPLYING DATABASE MIGRATIONS');
  console.log('='.repeat(60));

  const migrationsDir = path.join(__dirname, '..', 'migrations');

  console.log('\n⚠️  IMPORTANT:');
  console.log('The Supabase JS client does not support running raw SQL migrations.');
  console.log('You need to manually run these migrations in the Supabase dashboard.\n');

  console.log('📋 Steps to apply migrations:\n');
  console.log('1. Go to your Supabase project dashboard');
  console.log('2. Click "SQL Editor" in the left sidebar');
  console.log('3. Click "New query"');
  console.log('4. Copy and paste the following migration files:\n');

  console.log('   Migration 1: Create Tables');
  console.log('   File: migrations/20250511_create_historical_tables.sql');
  console.log('   Run this first!\n');

  console.log('   Migration 2: Create Views');
  console.log('   File: migrations/20250511_create_historical_views.sql');
  console.log('   Run this second!\n');

  console.log('5. Click "Run" for each migration\n');

  console.log('Once migrations are complete, run:');
  console.log('  python scripts/import_unified_to_supabase.py\n');

  console.log('='.repeat(60) + '\n');
}

main();
