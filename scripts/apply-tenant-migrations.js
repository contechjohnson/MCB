#!/usr/bin/env node
/**
 * Apply tenant migration files to Supabase database
 *
 * Usage:
 *   node scripts/apply-tenant-migrations.js              # Check status only
 *   node scripts/apply-tenant-migrations.js --apply      # Apply via psql (needs DB_PASSWORD)
 *   node scripts/apply-tenant-migrations.js --verify     # Verify migrations applied
 */

const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

// Create admin client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// All migrations combined for simplicity
const combinedMigrationPath = path.join(__dirname, '..', 'combined-tenant-migrations.sql');

async function applyViaPsql() {
  if (!dbPassword) {
    console.error('❌ SUPABASE_DB_PASSWORD not set in .env.local');
    console.log('   Add: SUPABASE_DB_PASSWORD=your-database-password');
    console.log('   Find it in: Supabase Dashboard → Settings → Database → Connection string');
    process.exit(1);
  }

  if (!fs.existsSync(combinedMigrationPath)) {
    console.error(`❌ Migration file not found: ${combinedMigrationPath}`);
    process.exit(1);
  }

  console.log('🚀 Applying migrations via psql...\n');

  // Supabase connection string format
  const dbUrl = `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

  try {
    const result = execSync(`psql "${dbUrl}" -f "${combinedMigrationPath}" 2>&1`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });
    console.log(result);
    console.log('✅ Migrations applied successfully!');
    return true;
  } catch (err) {
    console.error('❌ psql error:', err.message);
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.log(err.stderr);
    return false;
  }
}

// Migration files in order (for reference)
const migrations = [
  '20251205_001_create_tenants.sql',
  '20251205_002_create_tenant_integrations.sql',
  '20251205_003_add_tenant_id_columns.sql',
  '20251205_004_migrate_ppcu_data.sql',
  '20251205_005_update_constraints.sql'
];

async function verifyMigrations() {
  console.log('\n🔍 Verifying migrations...');

  // Check tenants table
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('slug, name, owner_name');

  if (tenantsError) {
    console.error('❌ Error checking tenants:', tenantsError.message);
  } else {
    console.log(`✅ Tenants table exists with ${tenants.length} rows:`);
    tenants.forEach(t => console.log(`   - ${t.slug}: ${t.name}`));
  }

  // Check tenant_integrations table
  const { data: integrations, error: integrationsError } = await supabase
    .from('tenant_integrations')
    .select('id')
    .limit(1);

  if (integrationsError) {
    console.error('❌ Error checking tenant_integrations:', integrationsError.message);
  } else {
    console.log('✅ tenant_integrations table exists');
  }

  // Check contacts has tenant_id
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, tenant_id')
    .limit(1);

  if (contactsError) {
    console.error('❌ Error checking contacts.tenant_id:', contactsError.message);
  } else if (contacts && contacts[0]) {
    console.log('✅ contacts table has tenant_id column');

    // Count contacts by tenant
    const { count, error: countError } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .not('tenant_id', 'is', null);

    if (!countError) {
      console.log(`   ${count} contacts have tenant_id assigned`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');
  const doVerify = args.includes('--verify');

  console.log('🚀 Multi-Tenant Migration Tool');
  console.log(`📊 Project: ${projectRef}`);
  console.log('='.repeat(60));

  if (doApply) {
    // Apply migrations using psql
    const success = await applyViaPsql();
    if (success) {
      await verifyMigrations();
    }
    return;
  }

  if (doVerify) {
    await verifyMigrations();
    return;
  }

  // Default: Check current status
  console.log('\n📋 Checking current migration status...\n');
  await verifyMigrations();

  console.log('\n' + '='.repeat(60));
  console.log('📌 To apply migrations:');
  console.log('='.repeat(60));
  console.log(`
Option 1: Via psql (Recommended)
--------------------------------
1. Add SUPABASE_DB_PASSWORD to .env.local
   (Find it: Supabase Dashboard → Settings → Database → Connection string)

2. Run: node scripts/apply-tenant-migrations.js --apply


Option 2: Via Supabase SQL Editor (Manual)
------------------------------------------
1. Open: https://supabase.com/dashboard/project/${projectRef}/sql

2. Copy contents of: combined-tenant-migrations.sql

3. Paste and click "Run"

4. Verify: node scripts/apply-tenant-migrations.js --verify
`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
