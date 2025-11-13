#!/usr/bin/env node

/**
 * Manual Denefits Webhook Processor
 *
 * Usage: node scripts/manual-denefits-webhook.js <payload.json>
 *
 * Or paste JSON directly when prompted.
 */

const https = require('https');
const fs = require('fs');

const WEBHOOK_URL = 'https://mcb-dun.vercel.app/api/denefits-webhook';

async function sendWebhook(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(WEBHOOK_URL, options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ status: res.statusCode, result });
        } catch (err) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔧 Manual Denefits Webhook Processor\n');

  let payload;

  // Check if file path provided
  if (process.argv[2]) {
    const filePath = process.argv[2];
    console.log(`📄 Reading from file: ${filePath}`);

    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      payload = JSON.parse(fileContent);
    } catch (err) {
      console.error('❌ Error reading file:', err.message);
      process.exit(1);
    }
  } else {
    // Read from stdin
    console.log('📋 Paste your Denefits webhook JSON below, then press Ctrl+D (Mac/Linux) or Ctrl+Z (Windows):\n');

    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }

    const input = Buffer.concat(chunks).toString('utf8').trim();

    if (!input) {
      console.error('❌ No input provided');
      process.exit(1);
    }

    try {
      payload = JSON.parse(input);
    } catch (err) {
      console.error('❌ Invalid JSON:', err.message);
      process.exit(1);
    }
  }

  // Validate payload structure
  const contractCode = payload?.[0]?.data?.contract?.contract_code ||
                       payload?.data?.contract?.contract_code;
  const customerEmail = payload?.[0]?.data?.contract?.customer_email ||
                        payload?.data?.contract?.customer_email;
  const customerName = payload?.[0]?.data?.contract?.customer_first_name ||
                       payload?.data?.contract?.customer_first_name;

  if (!contractCode || !customerEmail) {
    console.error('❌ Invalid payload structure. Missing contract_code or customer_email');
    console.log('\nExpected format:');
    console.log('[{ "webhook_type": "contract.created", "data": { "contract": { ... } } }]');
    process.exit(1);
  }

  console.log(`\n📝 Processing contract:`);
  console.log(`   Contract: ${contractCode}`);
  console.log(`   Customer: ${customerName}`);
  console.log(`   Email: ${customerEmail}`);
  console.log();

  // Send to webhook endpoint
  console.log('🚀 Sending to webhook endpoint...');

  try {
    const { status, result } = await sendWebhook(payload);

    if (status === 200 && result?.success) {
      console.log('✅ SUCCESS\n');
      console.log('   Contact ID:', result.contact_id || 'orphan');
      console.log('   Event Type:', result.event_type);

      if (!result.contact_id) {
        console.log('\n⚠️  Payment logged as ORPHAN (no matching contact found)');
        console.log(`   Search for contact with email: ${customerEmail}`);
      }
    } else {
      console.log('❌ FAILED\n');
      console.log('   Status:', status);
      console.log('   Response:', JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error('❌ Error sending webhook:', err.message);
    process.exit(1);
  }
}

main();
