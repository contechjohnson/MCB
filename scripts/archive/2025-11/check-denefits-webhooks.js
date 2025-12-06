#!/usr/bin/env node

/**
 * Denefits Webhook Configuration Checker
 *
 * Checks webhook endpoints, events, and logs to diagnose why webhooks aren't arriving.
 *
 * Usage:
 *   node scripts/check-denefits-webhooks.js YOUR_AUTH_TOKEN
 *
 * Or add to .env.local:
 *   DENEFITS_AUTH_TOKEN=your_token_here
 *   node scripts/check-denefits-webhooks.js
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const AUTH_TOKEN = process.argv[2] || process.env.DENEFITS_AUTH_TOKEN;
const BASE_URL = 'endpoint.denefits.com';
const EXPECTED_URL = 'https://mcb-dun.vercel.app/api/denefits-webhook';

if (!AUTH_TOKEN) {
  console.error('❌ ERROR: No auth token provided\n');
  console.log('Usage:');
  console.log('  node scripts/check-denefits-webhooks.js YOUR_AUTH_TOKEN');
  console.log('\nOr add to .env.local:');
  console.log('  DENEFITS_AUTH_TOKEN=your_token_here');
  console.log('\nTo get auth token:');
  console.log('  1. Log into Denefits dashboard');
  console.log('  2. Go to API → Tokens');
  console.log('  3. Create or copy existing token');
  process.exit(1);
}

function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({ status: res.statusCode, data });
        } catch (err) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

async function main() {
  console.log('🔍 Denefits Webhook Configuration Check\n');
  console.log('═'.repeat(60));

  // 1. Check available webhook event types
  console.log('\n📋 STEP 1: Available Webhook Event Types\n');

  try {
    const { status, data } = await makeRequest('/v1/webhook/list?limit=100&skip=0');

    if (status === 200 && data.code === 'success') {
      console.log('✅ Found', data.data.list.length, 'webhook event types:\n');

      const contractEvents = data.data.list.filter(e => e.category === 'Contract');
      const payoutEvents = data.data.list.filter(e => e.category === 'Payout');

      console.log('Contract Events:');
      contractEvents.forEach(e => {
        const check = e.webhook_type === 'contract.created' ? '✅' : '  ';
        console.log(`  ${check} ${e.webhook_type}`);
        console.log(`     ${e.description}`);
      });

      console.log('\nPayout Events:');
      payoutEvents.forEach(e => {
        console.log(`     ${e.webhook_type}`);
        console.log(`     ${e.description}`);
      });
    } else {
      console.error('❌ Failed to get event types:', data.message || data);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // 2. Check webhook endpoints
  console.log('\n═'.repeat(60));
  console.log('\n🔗 STEP 2: Your Webhook Endpoints\n');

  try {
    const { status, data } = await makeRequest('/v1/webhook/endpoint?limit=100&skip=0');

    if (status === 200 && data.code === 'success') {
      if (data.data.list.length === 0) {
        console.log('❌ NO WEBHOOK ENDPOINTS CONFIGURED!');
        console.log('\n⚠️  This is why you\'re not receiving webhooks.');
        console.log('\n📝 You need to create a webhook endpoint:');
        console.log(`   URL: ${EXPECTED_URL}`);
        console.log('   Events: contract.created, contract.payments.recurring_payment');
      } else {
        console.log('Found', data.data.list.length, 'endpoint(s):\n');

        data.data.list.forEach((endpoint, i) => {
          console.log(`Endpoint ${i + 1}:`);
          console.log(`  Endpoint ID: ${endpoint.endpoint_id}`);
          console.log(`  URL: ${endpoint.endpoint_url}`);

          // Check if URL matches
          if (endpoint.endpoint_url === EXPECTED_URL) {
            console.log(`  ✅ URL matches expected endpoint`);
          } else {
            console.log(`  ❌ URL MISMATCH! Expected: ${EXPECTED_URL}`);
          }

          // Check if active
          if (endpoint.is_active === 1) {
            console.log('  ✅ Status: Active');
          } else {
            console.log('  ❌ Status: INACTIVE (this is the problem!)');
          }

          // Check subscribed events
          const events = endpoint.subscribed_webhook_types.split(',');
          console.log(`  📡 Subscribed Events (${events.length}):`);
          events.forEach(event => {
            const check = event === 'contract.created' ? '✅' : '  ';
            console.log(`    ${check} ${event}`);
          });

          // Check if contract.created is subscribed
          if (!events.includes('contract.created')) {
            console.log('  ❌ Missing: contract.created (this is why contracts aren\'t triggering!)');
          }

          console.log(`  🔑 Secret Key: ${endpoint.secret_key}`);
          console.log(`  🔁 Auto-retry: ${endpoint.auto_retry_on_failure === 1 ? 'Enabled' : 'Disabled'}`);
          console.log(`  📝 Description: ${endpoint.description}`);
          console.log();
        });
      }
    } else {
      console.error('❌ Failed to get endpoints:', data.message || data);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // 3. Check recent webhook logs
  console.log('═'.repeat(60));
  console.log('\n📊 STEP 3: Recent Webhook Delivery Logs\n');

  try {
    const { status, data } = await makeRequest('/v1/webhook/logs?limit=20&skip=0');

    if (status === 200 && data.code === 'success') {
      if (data.data.count === 0) {
        console.log('⚠️  No webhook logs found');
        console.log('   This means either:');
        console.log('   1. No webhooks have been sent yet');
        console.log('   2. No webhook endpoint is configured');
      } else {
        console.log(`Found ${data.data.count} recent webhook attempts:\n`);

        // Group by success/failure
        const successful = data.data.list.filter(log => log.is_error === 0);
        const failed = data.data.list.filter(log => log.is_error === 1);

        console.log(`✅ Successful: ${successful.length}`);
        console.log(`❌ Failed: ${failed.length}\n`);

        // Show most recent 5
        console.log('Most recent webhook attempts:\n');
        data.data.list.slice(0, 5).forEach((log, i) => {
          const icon = log.is_error === 0 ? '✅' : '❌';
          console.log(`${i + 1}. ${icon} ${log.webhook_type}`);
          console.log(`   Sent: ${log.sent_at}`);
          console.log(`   URL: ${log.endpoint_url}`);
          console.log(`   Response: ${log.response_code}`);

          if (log.is_error === 1) {
            console.log(`   ⚠️  Error detected`);
            if (log.next_retry_at) {
              console.log(`   Next retry: ${log.next_retry_at} (Retry #${log.retry_number})`);
            }
            console.log(`   Response: ${log.response_body.substring(0, 100)}...`);
          }

          console.log(`   Trigger ID: ${log.trigger_id}`);
          console.log();
        });

        // Check for specific contracts we're looking for
        const missingContracts = ['LVKT9Z139405', 'JESSQL139385', 'SANDJZ139317'];
        console.log('Checking for missing contracts...\n');

        missingContracts.forEach(code => {
          const found = data.data.list.find(log =>
            log.request_body && log.request_body.includes(code)
          );

          if (found) {
            console.log(`✅ ${code}: Found in logs`);
            console.log(`   Sent: ${found.sent_at}`);
            console.log(`   Status: ${found.is_error === 0 ? 'Success' : 'Failed'}`);
          } else {
            console.log(`❌ ${code}: NOT in logs (Denefits never sent it)`);
          }
        });
      }
    } else {
      console.error('❌ Failed to get logs:', data.message || data);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // Summary
  console.log('\n═'.repeat(60));
  console.log('\n📝 SUMMARY & RECOMMENDATIONS\n');
  console.log('1. Check if webhook endpoint exists and is active');
  console.log('2. Verify "contract.created" is in subscribed events');
  console.log(`3. Confirm URL is exactly: ${EXPECTED_URL}`);
  console.log('4. Check webhook logs for error patterns');
  console.log('\nIf issues found:');
  console.log('• Update endpoint using Denefits dashboard');
  console.log('• Or use their API to update webhook configuration');
  console.log('• Contact Denefits support if configuration looks correct');
  console.log('\n═'.repeat(60));
}

main();
