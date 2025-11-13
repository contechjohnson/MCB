#!/usr/bin/env node

/**
 * Find Missing Denefits Webhooks
 *
 * Searches Denefits webhook logs for specific contracts
 * and identifies which ones were never sent
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const AUTH_TOKEN = process.argv[2] || process.env.DENEFITS_AUTH_TOKEN || 'c0b21789bb74c9e8534762e3c43bd382';
const BASE_URL = 'endpoint.denefits.com';

// Contracts we know are missing
const MISSING_CONTRACTS = [
  { code: 'LVKT9Z139405', email: 'oghowoodson@gmail.com', date: '2025-11-13T17:16:15.000Z' },
  { code: 'JESSQL139385', email: 'jcmoshier97@gmail.com', date: '2025-11-13T01:57:40.000Z' },
  { code: 'SANDJZ139317', email: 'sashhawk15@gmail.com', date: '2025-11-11T20:45:06.000Z' }
];

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (err) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function getAllWebhookLogs() {
  console.log('🔍 Fetching ALL webhook logs (paginated)...\n');

  let allLogs = [];
  let skip = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const { status, data } = await makeRequest(`/v1/webhook/logs?limit=${limit}&skip=${skip}`);

    if (status === 200 && data.code === 'success') {
      const logs = data.data.list;
      allLogs = allLogs.concat(logs);

      console.log(`  Fetched ${logs.length} logs (total: ${allLogs.length})`);

      if (logs.length < limit) {
        hasMore = false;
      } else {
        skip += limit;
      }
    } else {
      console.error('  ❌ Error fetching logs:', data.message || data);
      hasMore = false;
    }
  }

  console.log(`\n✅ Total webhook logs found: ${allLogs.length}\n`);
  return allLogs;
}

async function searchForContract(logs, contractCode) {
  return logs.filter(log => {
    if (!log.request_body) return false;
    return log.request_body.includes(contractCode);
  });
}

async function analyzeEndpoints() {
  console.log('📊 Analyzing Webhook Endpoints...\n');

  const { status, data } = await makeRequest('/v1/webhook/endpoint?limit=100&skip=0&is_active=0');

  if (status === 200 && data.code === 'success') {
    const inactive = data.data.list.filter(e => e.is_active === 0);

    if (inactive.length > 0) {
      console.log(`⚠️  Found ${inactive.length} INACTIVE endpoint(s):\n`);
      inactive.forEach(e => {
        console.log(`  Endpoint ID: ${e.endpoint_id}`);
        console.log(`  URL: ${e.endpoint_url}`);
        console.log(`  Secret Key: ${e.secret_key}`);
        console.log(`  Events: ${e.subscribed_webhook_types}`);
        console.log();
      });
    } else {
      console.log('  No inactive endpoints found\n');
    }
  }
}

async function main() {
  console.log('═'.repeat(70));
  console.log('🔎 DENEFITS WEBHOOK INVESTIGATION');
  console.log('═'.repeat(70));
  console.log();

  // 1. Get ALL webhook logs
  const allLogs = await getAllWebhookLogs();

  if (allLogs.length === 0) {
    console.log('❌ CRITICAL: No webhook logs found AT ALL!');
    console.log('\nThis means:');
    console.log('  1. Denefits webhook system is completely broken');
    console.log('  2. Or webhooks were never properly configured');
    console.log('  3. Or this auth token doesn\'t have access to logs');
    console.log('\n💡 Action: Contact Denefits support immediately!\n');

    // Check for inactive endpoints
    await analyzeEndpoints();
    return;
  }

  console.log('═'.repeat(70));
  console.log('\n📅 Webhook Activity Timeline:\n');

  // Group logs by date
  const byDate = {};
  allLogs.forEach(log => {
    const date = log.sent_at.split('T')[0];
    byDate[date] = (byDate[date] || 0) + 1;
  });

  Object.keys(byDate).sort().forEach(date => {
    console.log(`  ${date}: ${byDate[date]} webhooks`);
  });

  console.log('\n═'.repeat(70));
  console.log('\n🔍 Searching for Missing Contracts:\n');

  for (const contract of MISSING_CONTRACTS) {
    const found = await searchForContract(allLogs, contract.code);

    if (found.length > 0) {
      console.log(`✅ ${contract.code} (${contract.email})`);
      console.log(`   Found ${found.length} webhook attempt(s)`);
      found.forEach(log => {
        const status = log.is_error === 0 ? '✅ Success' : '❌ Failed';
        console.log(`   - ${log.sent_at}: ${status}`);
        console.log(`     Endpoint: ${log.endpoint_url}`);
        console.log(`     Response: ${log.response_code}`);
        if (log.is_error === 1) {
          console.log(`     Error: ${log.response_body.substring(0, 100)}`);
        }
      });
    } else {
      console.log(`❌ ${contract.code} (${contract.email})`);
      console.log(`   Created: ${contract.date}`);
      console.log(`   Status: WEBHOOK NEVER SENT`);
    }
    console.log();
  }

  console.log('═'.repeat(70));
  console.log('\n📈 Webhook Success/Failure Analysis:\n');

  const byType = {};
  const byStatus = { success: 0, failed: 0 };
  const byEndpoint = {};

  allLogs.forEach(log => {
    // By type
    byType[log.webhook_type] = (byType[log.webhook_type] || 0) + 1;

    // By status
    if (log.is_error === 0) {
      byStatus.success++;
    } else {
      byStatus.failed++;
    }

    // By endpoint
    const url = log.endpoint_url || 'unknown';
    byEndpoint[url] = (byEndpoint[url] || 0) + 1;
  });

  console.log('By Event Type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log('\nBy Status:');
  console.log(`  ✅ Success: ${byStatus.success} (${Math.round(byStatus.success/allLogs.length*100)}%)`);
  console.log(`  ❌ Failed: ${byStatus.failed} (${Math.round(byStatus.failed/allLogs.length*100)}%)`);

  console.log('\nBy Endpoint:');
  Object.entries(byEndpoint).forEach(([url, count]) => {
    console.log(`  ${url}: ${count}`);
  });

  // Check for the mystery secret key
  console.log('\n═'.repeat(70));
  console.log('\n🔑 Secret Key Investigation:\n');

  const secretKeys = new Set();
  allLogs.forEach(log => {
    if (log.request_body) {
      try {
        const match = log.request_body.match(/"secret_key":"([^"]+)"/);
        if (match) secretKeys.add(match[1]);
      } catch (err) {}
    }
  });

  console.log('Secret keys found in webhook logs:');
  secretKeys.forEach(key => {
    console.log(`  ${key}`);
  });

  const mysteryKey = 'key_x9nnpj3cw4103ed';
  if (secretKeys.has(mysteryKey)) {
    console.log(`\n✅ Mystery key ${mysteryKey} found in logs!`);
  } else {
    console.log(`\n❌ Mystery key ${mysteryKey} NOT found in logs`);
    console.log('   This key appears in the manual webhook payloads but not in any logs');
  }

  // Final recommendations
  console.log('\n═'.repeat(70));
  console.log('\n📝 FINDINGS & RECOMMENDATIONS:\n');

  if (allLogs.length > 0) {
    const lastLog = allLogs[0];
    console.log(`✅ Webhooks ARE being sent (${allLogs.length} total)`);
    console.log(`   Last webhook: ${lastLog.sent_at}`);
    console.log(`   Success rate: ${Math.round(byStatus.success/allLogs.length*100)}%`);
  }

  const missingCount = MISSING_CONTRACTS.filter(c =>
    allLogs.every(log => !log.request_body || !log.request_body.includes(c.code))
  ).length;

  if (missingCount > 0) {
    console.log(`\n❌ ${missingCount} contracts never triggered webhooks`);
    console.log('\nPossible causes:');
    console.log('  1. Contracts created before webhook was configured');
    console.log('  2. Denefits webhook queue is backed up/broken');
    console.log('  3. Contracts created in test mode vs live mode');
    console.log('  4. Webhook trigger conditions not met');
  }

  console.log('\n💡 Actions:');
  console.log('  1. Contact Denefits support with contract codes');
  console.log('  2. Ask them to manually resend webhooks for missing contracts');
  console.log('  3. Use manual webhook processor for now');
  console.log('\n═'.repeat(70));
}

main();
