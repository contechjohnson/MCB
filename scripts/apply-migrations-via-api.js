#!/usr/bin/env node
/**
 * Apply tenant migrations via Supabase REST API
 * Uses the PostgREST API to execute SQL
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)[1];

// Migration files in order
const migrations = [
  '20251205_001_create_tenants.sql',
  '20251205_002_create_tenant_integrations.sql',
  '20251205_003_add_tenant_id_columns.sql',
  '20251205_004_migrate_ppcu_data.sql',
  '20251205_005_update_constraints.sql'
];

/**
 * Execute SQL via Supabase SQL API
 */
function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: `${projectRef}.supabase.co`,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve({ success: true, data: JSON.parse(data || '{}') });
        } else {
          reject({
            success: false,
            error: `HTTP ${res.statusCode}: ${data}`,
            statusCode: res.statusCode
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({ success: false, error: error.message });
    });

    req.write(JSON.stringify({ sql_query: sql }));
    req.end();
  });
}

/**
 * Query data from Supabase
 */
function query(table, select = '*', filters = {}) {
  return new Promise((resolve, reject) => {
    let path = `/rest/v1/${table}?select=${select}`;

    // Add filters
    Object.entries(filters).forEach(([key, value]) => {
      path += `&${key}=${value}`;
    });

    const options = {
      hostname: `${projectRef}.supabase.co`,
      path: path,
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true, data: JSON.parse(data) });
        } else {
          resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });

    req.end();
  });
}

async function runMigration(filename) {
  console.log(`\n📄 Running migration: ${filename}`);

  const filepath = path.join(__dirname, '..', 'migrations', filename);

  if (!fs.existsSync(filepath)) {
    console.error(`❌ File not found: ${filepath}`);
    return { success: false, error: 'File not found' };
  }

  const sql = fs.readFileSync(filepath, 'utf8');

  try {
    const result = await executeSql(sql);
    console.log('✅ Migration completed successfully');
    return { success: true, ...result };
  } catch (err) {
    console.error('❌ Error:', err.error || err.message);
    return { success: false, error: err.error || err.message, sql, statusCode: err.statusCode };
  }
}

async function verifyMigrations() {
  console.log('\n🔍 Verifying migrations...');

  // Check tenants table
  const tenantsResult = await query('tenants', 'slug,name,owner_name');

  if (tenantsResult.success) {
    console.log(`✅ Tenants table exists with ${tenantsResult.data.length} rows:`);
    tenantsResult.data.forEach(t => console.log(`   - ${t.slug}: ${t.name}`));
  } else {
    console.error('❌ Error checking tenants:', tenantsResult.error);
  }

  // Check tenant_integrations table
  const integrationsResult = await query('tenant_integrations', 'id', { limit: '1' });

  if (integrationsResult.success) {
    console.log('✅ tenant_integrations table exists');
  } else {
    console.error('❌ Error checking tenant_integrations:', integrationsResult.error);
  }

  // Check contacts has tenant_id
  const contactsResult = await query('contacts', 'id,tenant_id', { limit: '1' });

  if (contactsResult.success && contactsResult.data.length > 0) {
    console.log('✅ contacts table has tenant_id column');

    // Count contacts with tenant_id
    const countResult = await query('contacts', 'count', { 'tenant_id': 'not.is.null' });
    if (countResult.success) {
      console.log(`   Found contacts with tenant_id assigned`);
    }
  } else {
    console.error('❌ Error checking contacts.tenant_id:', contactsResult.error);
  }
}

async function main() {
  console.log('🚀 Starting tenant migration...');
  console.log(`📊 Project: ${projectRef}`);

  const results = [];

  for (const migration of migrations) {
    const result = await runMigration(migration);
    results.push({ migration, ...result });

    // If RPC not found (404), we need to use different method
    if (result.statusCode === 404) {
      console.log('\n⚠️  exec_sql RPC function not found');
      console.log('   Creating combined migration file for manual execution...');

      // Write all migrations to a single file
      const allSql = migrations.map(m => {
        const filepath = path.join(__dirname, '..', 'migrations', m);
        const sql = fs.readFileSync(filepath, 'utf8');
        return `-- ${m}\n${sql}\n\n`;
      }).join('');

      fs.writeFileSync(
        path.join(__dirname, '..', 'combined-tenant-migrations.sql'),
        allSql
      );

      console.log('✅ Created: combined-tenant-migrations.sql');
      console.log('   Please run this file manually using Supabase SQL Editor');
      break;
    }

    if (!result.success) {
      console.log('❌ Migration failed, stopping...');
      break;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));

  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${r.migration}`);
    if (r.error) console.log(`   Error: ${r.error}`);
  });

  // If all successful, verify
  if (results.every(r => r.success)) {
    await verifyMigrations();
  }

  console.log('\n✅ Migration script complete');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
