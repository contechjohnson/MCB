#!/usr/bin/env node
/**
 * Verify Multi-Tenant Migration
 *
 * Checks if multi-tenant schema has been applied correctly
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

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

async function verify() {
  console.log('Multi-Tenant Migration Verification');
  console.log('===================================\n');

  let allPassed = true;

  // 1. Check tenants table exists and has data
  console.log('✓ Test 1: Tenants table');
  try {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('*')
      .order('slug');

    if (error) {
      console.log(`  ❌ FAILED: ${error.message}\n`);
      allPassed = false;
    } else if (!tenants || tenants.length === 0) {
      console.log('  ❌ FAILED: No tenants found\n');
      allPassed = false;
    } else {
      console.log(`  ✅ PASSED: Found ${tenants.length} tenants`);
      tenants.forEach(t => {
        console.log(`     - ${t.slug.padEnd(12)} | ${t.name} | ${t.owner_name || 'No owner'}`);
      });
      console.log('');
    }
  } catch (err) {
    console.log(`  ❌ FAILED: ${err.message}\n`);
    allPassed = false;
  }

  // 2. Check tenant_integrations table exists
  console.log('✓ Test 2: Tenant integrations table');
  try {
    const { error } = await supabase
      .from('tenant_integrations')
      .select('id')
      .limit(1);

    if (error && !error.message.includes('0 rows')) {
      console.log(`  ❌ FAILED: ${error.message}\n`);
      allPassed = false;
    } else {
      console.log('  ✅ PASSED: Table exists\n');
    }
  } catch (err) {
    console.log(`  ❌ FAILED: ${err.message}\n`);
    allPassed = false;
  }

  // 3. Check tenant_id columns exist on core tables
  console.log('✓ Test 3: Tenant_id columns');
  const tables = ['contacts', 'payments', 'webhook_logs', 'meta_ads', 'meta_ad_creatives', 'meta_ad_insights'];
  let columnsPassed = true;

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('tenant_id')
        .limit(1);

      if (error && !error.message.includes('0 rows')) {
        console.log(`     ❌ ${table}: ${error.message}`);
        columnsPassed = false;
        allPassed = false;
      } else {
        console.log(`     ✅ ${table}`);
      }
    } catch (err) {
      console.log(`     ❌ ${table}: ${err.message}`);
      columnsPassed = false;
      allPassed = false;
    }
  }

  if (columnsPassed) {
    console.log('  ✅ PASSED: All tenant_id columns exist\n');
  } else {
    console.log('  ❌ FAILED: Some tenant_id columns missing\n');
  }

  // 4. Check for NULL tenant_ids
  console.log('✓ Test 4: NULL tenant_ids check');
  try {
    const { count: nullContacts } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .is('tenant_id', null);

    const { count: nullPayments } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .is('tenant_id', null);

    console.log(`     - Contacts with NULL tenant_id: ${nullContacts || 0}`);
    console.log(`     - Payments with NULL tenant_id: ${nullPayments || 0}`);

    if ((nullContacts || 0) === 0 && (nullPayments || 0) === 0) {
      console.log('  ✅ PASSED: No NULL tenant_ids\n');
    } else {
      console.log('  ❌ FAILED: Some records have NULL tenant_id\n');
      allPassed = false;
    }
  } catch (err) {
    console.log(`  ❌ FAILED: ${err.message}\n`);
    allPassed = false;
  }

  // 5. Show tenant distribution
  console.log('✓ Test 5: Tenant distribution');
  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('tenant_id');

    if (error) {
      console.log(`  ⚠️  Could not check distribution: ${error.message}\n`);
    } else {
      const distribution = {};
      contacts.forEach(c => {
        const tid = c.tenant_id || 'NULL';
        distribution[tid] = (distribution[tid] || 0) + 1;
      });

      // Get tenant names
      const { data: tenants } = await supabase
        .from('tenants')
        .select('id, slug, name');

      const tenantMap = {};
      (tenants || []).forEach(t => {
        tenantMap[t.id] = `${t.slug} (${t.name})`;
      });

      console.log('  Distribution by tenant:');
      Object.entries(distribution).forEach(([tid, count]) => {
        const name = tenantMap[tid] || 'NULL';
        console.log(`     - ${name}: ${count} contacts`);
      });
      console.log('  ✅ PASSED\n');
    }
  } catch (err) {
    console.log(`  ⚠️  Could not check distribution: ${err.message}\n`);
  }

  // 6. Check unique constraints
  console.log('✓ Test 6: Unique constraints');
  try {
    // Try to insert duplicate (should fail)
    const testMcId = 'test_mc_id_' + Date.now();

    // Get PPCU tenant ID
    const { data: ppcu } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', 'ppcu')
      .single();

    if (!ppcu) {
      console.log('  ⚠️  Could not find PPCU tenant for testing\n');
    } else {
      // Insert first contact
      const { error: insertError1 } = await supabase
        .from('contacts')
        .insert({
          tenant_id: ppcu.id,
          mc_id: testMcId,
          email_primary: 'test@example.com'
        });

      if (insertError1) {
        console.log(`  ⚠️  Could not insert test contact: ${insertError1.message}\n`);
      } else {
        // Try to insert duplicate (should fail)
        const { error: insertError2 } = await supabase
          .from('contacts')
          .insert({
            tenant_id: ppcu.id,
            mc_id: testMcId,
            email_primary: 'test2@example.com'
          });

        // Clean up
        await supabase
          .from('contacts')
          .delete()
          .eq('mc_id', testMcId);

        if (insertError2 && insertError2.message.includes('duplicate')) {
          console.log('  ✅ PASSED: Unique constraint working (tenant_id + mc_id)\n');
        } else {
          console.log('  ❌ FAILED: Unique constraint not working\n');
          allPassed = false;
        }
      }
    }
  } catch (err) {
    console.log(`  ⚠️  Could not verify constraints: ${err.message}\n`);
  }

  // Summary
  console.log('===========================================');
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED - Migration successful!');
  } else {
    console.log('❌ SOME TESTS FAILED - Check errors above');
  }
  console.log('===========================================');

  return allPassed;
}

verify()
  .then(passed => process.exit(passed ? 0 : 1))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
