#!/usr/bin/env node
/**
 * Apply migrations using Supabase's execute_sql function
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const migrations = [
  '20251205_001_create_tenants.sql',
  '20251205_002_create_tenant_integrations.sql',
  '20251205_003_add_tenant_id_columns.sql',
  '20251205_004_migrate_ppcu_data.sql',
  '20251205_005_update_constraints.sql'
];

async function runMigration(filename) {
  console.log(`\n📄 ${filename}`);

  const filepath = path.join(__dirname, '..', 'migrations', filename);
  const sql = fs.readFileSync(filepath, 'utf8');

  try {
    // Try execute_sql (suggested by error)
    const { data, error } = await supabase.rpc('execute_sql', { query: sql });

    if (error) {
      console.error('❌', error.message);
      return { success: false, error };
    }

    console.log('✅ Success');
    return { success: true, data };
  } catch (err) {
    console.error('❌', err.message);
    return { success: false, error: err };
  }
}

async function verify() {
  console.log('\n🔍 Verifying...\n');

  // Check tenants
  const { data: tenants, error: e1 } = await supabase
    .from('tenants')
    .select('slug, name');

  if (e1) {
    console.log('❌ tenants:', e1.message);
  } else {
    console.log(`✅ tenants: ${tenants.length} rows`);
    tenants.forEach(t => console.log(`   - ${t.slug}: ${t.name}`));
  }

  // Check tenant_integrations
  const { error: e2 } = await supabase
    .from('tenant_integrations')
    .select('id')
    .limit(1);

  console.log(e2 ? `❌ tenant_integrations: ${e2.message}` : '✅ tenant_integrations exists');

  // Check contacts.tenant_id
  const { data: contacts, error: e3 } = await supabase
    .from('contacts')
    .select('tenant_id')
    .limit(1);

  if (e3) {
    console.log(`❌ contacts.tenant_id: ${e3.message}`);
  } else {
    console.log(`✅ contacts.tenant_id column exists`);

    // Count with tenant_id
    const { count } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .not('tenant_id', 'is', null);

    console.log(`   ${count || 0} contacts with tenant_id`);
  }
}

async function main() {
  console.log('🚀 Tenant Migrations\n');

  for (const migration of migrations) {
    const result = await runMigration(migration);
    if (!result.success) {
      console.log('\n⚠️  Stopped at first error');
      console.log('   Use combined-tenant-migrations.sql in Supabase SQL Editor');
      break;
    }
  }

  await verify();
}

main();
