#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const API_VERSION = process.env.META_API_VERSION || 'v20.0';

const mysteryAdIds = [
  '120236928026440652',
  '120236942069970652',
  '120236927208710652',
  '120233842485330652'
];

async function lookupAdOrAdSet(id) {
  try {
    // Try as ad first
    let params = new URLSearchParams({
      access_token: ACCESS_TOKEN,
      fields: 'id,name,status,effective_status,created_time,updated_time,campaign_id,adset_id'
    });

    let url = `https://graph.facebook.com/${API_VERSION}/${id}?${params.toString()}`;
    let response = await fetch(url);
    let data = await response.json();

    // If error indicates it's an ad set, query as ad set
    if (data.error && data.error.message.includes('AdSet')) {
      params = new URLSearchParams({
        access_token: ACCESS_TOKEN,
        fields: 'id,name,status,effective_status,created_time,updated_time,campaign_id'
      });

      url = `https://graph.facebook.com/${API_VERSION}/${id}?${params.toString()}`;
      response = await fetch(url);
      data = await response.json();

      if (!data.error) {
        data.type = 'AdSet';

        // Get ads in this ad set
        const adsParams = new URLSearchParams({
          access_token: ACCESS_TOKEN,
          fields: 'id,name,status,effective_status'
        });
        const adsUrl = `https://graph.facebook.com/${API_VERSION}/${id}/ads?${adsParams.toString()}`;
        const adsResponse = await fetch(adsUrl);
        const adsData = await adsResponse.json();

        if (adsData.data) {
          data.ads = adsData.data;
        }
      }
    } else if (!data.error) {
      data.type = 'Ad';
    }

    if (data.error) {
      return { error: data.error.message, id };
    }

    return data;
  } catch (error) {
    return { error: error.message, id };
  }
}

async function main() {
  console.log('🔍 LOOKING UP MYSTERY IDs FROM META API\n');
  console.log('═'.repeat(70));

  for (const id of mysteryAdIds) {
    console.log(`\nID: ${id}`);

    const data = await lookupAdOrAdSet(id);

    if (data.error) {
      console.log(`  ❌ ERROR: ${data.error}`);
    } else {
      console.log(`  ✅ Type: ${data.type}`);
      console.log(`  Name: ${data.name}`);
      console.log(`  Status: ${data.status}`);
      console.log(`  Effective Status: ${data.effective_status}`);
      console.log(`  Created: ${data.created_time}`);
      console.log(`  Last Updated: ${data.updated_time}`);
      console.log(`  Campaign ID: ${data.campaign_id}`);

      if (data.type === 'AdSet' && data.ads) {
        console.log(`  \n  Contains ${data.ads.length} ads:`);
        data.ads.forEach(ad => {
          console.log(`    - ${ad.name} (${ad.effective_status})`);
        });
      }
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '═'.repeat(70));
}

main().catch(console.error);
