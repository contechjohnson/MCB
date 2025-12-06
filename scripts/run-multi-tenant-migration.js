#!/usr/bin/env node
/**
 * Multi-Tenant Migration Script
 *
 * Applies multi-tenant database schema changes to Supabase
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

async function runMigration(sql, label) {
  console.log(`\n=== ${label} ===`);

  try {
    // Split by semicolon and filter out empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip comments
      if (statement.startsWith('--')) continue;

      console.log(`Running statement ${i + 1}/${statements.length}...`);

      const { error } = await supabase.rpc('exec_sql', { query: statement });

      if (error) {
        console.error(`❌ Failed: ${error.message}`);
        throw error;
      }
    }

    console.log(`✅ ${label} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ ${label} failed:`, error.message);
    return false;
  }
}

async function verify() {
  console.log('\n=== Verification ===');

  // 1. Check tenants table
  console.log('\n1. Checking tenants table...');
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('*');

  if (tenantsError) {
    console.error('❌ Failed to query tenants:', tenantsError.message);
  } else {
    console.log(`✅ Found ${tenants.length} tenants:`);
    tenants.forEach(t => console.log(`   - ${t.slug}: ${t.name} (${t.owner_name || 'No owner'})`));
  }

  // 2. Check tenant_id columns exist
  console.log('\n2. Checking tenant_id columns...');
  const tables = ['contacts', 'payments', 'webhook_logs', 'meta_ads'];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('tenant_id')
      .limit(1);

    if (error) {
      console.error(`❌ ${table}: tenant_id column missing or error: ${error.message}`);
    } else {
      console.log(`✅ ${table}: tenant_id column exists`);
    }
  }

  // 3. Check for NULL tenant_ids on contacts and payments
  console.log('\n3. Checking for NULL tenant_ids...');

  const { count: nullContacts } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .is('tenant_id', null);

  const { count: nullPayments } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .is('tenant_id', null);

  console.log(`   - contacts with NULL tenant_id: ${nullContacts || 0}`);
  console.log(`   - payments with NULL tenant_id: ${nullPayments || 0}`);

  if ((nullContacts || 0) === 0 && (nullPayments || 0) === 0) {
    console.log('✅ No NULL tenant_ids found');
  } else {
    console.log('⚠️  Warning: Some records still have NULL tenant_id');
  }

  // 4. Show tenant_id distribution
  console.log('\n4. Tenant distribution:');

  const { data: contactsByTenant } = await supabase
    .from('contacts')
    .select('tenant_id, tenants(slug, name)', { count: 'exact' })
    .limit(1000);

  if (contactsByTenant) {
    const distribution = {};
    contactsByTenant.forEach(c => {
      const tenant = c.tenants?.slug || 'NULL';
      distribution[tenant] = (distribution[tenant] || 0) + 1;
    });

    Object.entries(distribution).forEach(([tenant, count]) => {
      console.log(`   - ${tenant}: ${count} contacts`);
    });
  }
}

async function main() {
  console.log('Multi-Tenant Migration Script');
  console.log('=============================');
  console.log(`Database: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'migrations', 'multi_tenant_migration.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Split into individual migrations
  const migrations = [
    {
      label: 'Migration 1: Create tenants table',
      start: sql.indexOf('-- Migration 1:'),
      end: sql.indexOf('-- Migration 2:')
    },
    {
      label: 'Migration 2: Create tenant_integrations table',
      start: sql.indexOf('-- Migration 2:'),
      end: sql.indexOf('-- Migration 3:')
    },
    {
      label: 'Migration 3: Add tenant_id to all core tables',
      start: sql.indexOf('-- Migration 3:'),
      end: sql.indexOf('-- Migration 4:')
    },
    {
      label: 'Migration 4: Migrate PPCU data',
      start: sql.indexOf('-- Migration 4:'),
      end: sql.indexOf('-- Migration 5:')
    },
    {
      label: 'Migration 5: Update constraints',
      start: sql.indexOf('-- Migration 5:'),
      end: sql.length
    }
  ];

  // Note: Supabase doesn't have exec_sql RPC by default
  // We'll need to run this manually in the SQL Editor
  console.log('\n⚠️  IMPORTANT: This script requires manual execution in Supabase SQL Editor');
  console.log('   The migration file has been created at:');
  console.log(`   ${migrationPath}`);
  console.log('\nSteps:');
  console.log('1. Go to Supabase Dashboard → SQL Editor');
  console.log('2. Create a new query');
  console.log('3. Copy and paste the contents of multi_tenant_migration.sql');
  console.log('4. Run the query');
  console.log('5. Come back here and run verification');

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('\nHave you run the migration in Supabase SQL Editor? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      await verify();
    } else {
      console.log('\nPlease run the migration first, then re-run this script for verification.');
    }
    readline.close();
    process.exit(0);
  });
}

main().catch(console.error);
