/**
 * Expanded Centner Content Analysis - 20 Total Creators
 *
 * Scrapes 600 posts from 20 wellness/biohacking creators
 * Then runs full outlier detection analysis
 */

require('dotenv').config({ path: '.env.local' });
const { ApifyClient } = require('apify-client');

// Initialize Apify client
const apifyClient = new ApifyClient({
  token: process.env.APIFY_TOKEN
});

// 20 total creators (5 existing + 15 new)
const CREATORS = [
  // Already scraped (keep for completeness)
  { handle: 'kaylabarnes', name: 'Kayla Barnes' },
  { handle: 'davidsinclairphd', name: 'David Sinclair' },
  { handle: 'drpoonamdesai', name: 'Dr. Poonam Desai' },
  { handle: 'nathalieniddam', name: 'Nathalie Niddam' },
  { handle: 'dr.longevity', name: 'Dr. Longevity' },

  // New creators (15 more)
  { handle: 'bengreenfieldfitness', name: 'Ben Greenfield' },
  { handle: 'hubermanlab', name: 'Andrew Huberman' },
  { handle: 'drmindypelz', name: 'Dr. Mindy Pelz' },
  { handle: 'drgundry', name: 'Steven Gundry' },
  { handle: 'maxlugavere', name: 'Max Lugavere' },
  { handle: 'drmarkhyman', name: 'Mark Hyman' },
  { handle: 'jessichasinwellness', name: 'Jess Ash' },
  { handle: 'drkellyann', name: 'Dr. Kellyann' },
  { handle: 'asprey', name: 'Dave Asprey' },
  { handle: 'thelivingproof_greg', name: 'Greg (Living Proof)' },
  { handle: 'drsarasolomon', name: 'Dr. Sara Solomon' },
  { handle: 'wellnessmama', name: 'Katie Wells' },
  { handle: 'drpompa', name: 'Dr. Pompa' },
  { handle: 'drruscio', name: 'Dr. Ruscio' },
  { handle: 'biohackerbabes', name: 'Biohacker Babes' }
];

async function scrapeAllCreators() {
  console.log(`\n🔍 Starting scrape of ${CREATORS.length} creators (30 posts each = ${CREATORS.length * 30} total posts)\n`);

  const allData = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < CREATORS.length; i++) {
    const creator = CREATORS[i];
    console.log(`\n[${i + 1}/${CREATORS.length}] Scraping @${creator.handle}...`);

    try {
      // Run Apify Instagram Post Scraper
      const run = await apifyClient.actor('apify/instagram-post-scraper').call({
        username: [creator.handle],  // IMPORTANT: "username" not "usernames"
        resultsLimit: 30
      });

      // Fetch results
      const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

      if (items && items.length > 0) {
        console.log(`  ✅ Scraped ${items.length} posts from @${creator.handle}`);

        // Add creator metadata to each post
        items.forEach(post => {
          post._creatorHandle = creator.handle;
          post._creatorName = creator.name;
        });

        allData.push(...items);
        successCount++;
      } else {
        console.log(`  ⚠️  No posts found for @${creator.handle}`);
      }

      // Rate limit: 2 second delay between creators
      if (i < CREATORS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`  ❌ Error scraping @${creator.handle}:`, error.message);
      errorCount++;
    }

    // Save progress after each creator (incremental backup)
    if (allData.length > 0) {
      const fs = require('fs');
      const progressPath = 'outputs/.instagram_data_centner_progress.json';
      fs.writeFileSync(progressPath, JSON.stringify(allData, null, 2));
    }
  }

  console.log(`\n✅ Scraping complete!`);
  console.log(`   Success: ${successCount}/${CREATORS.length} creators`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Total posts: ${allData.length}`);

  // Save final to JSON
  const fs = require('fs');
  const outputPath = 'outputs/instagram_data_centner_expanded.json';
  fs.writeFileSync(outputPath, JSON.stringify(allData, null, 2));
  console.log(`\n💾 Saved to: ${outputPath}`);

  return allData;
}

async function runAnalysis() {
  console.log('\n🎯 Running outlier detection analysis...\n');

  const { execSync } = require('child_process');

  try {
    // Run analysis script on expanded data
    const result = execSync(
      'node execution/content-outlier-detection.js --input-json outputs/instagram_data_centner_expanded.json',
      { encoding: 'utf-8', stdio: 'inherit' }
    );

    console.log('\n✅ Analysis complete!');

  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    throw error;
  }
}

// Main execution
(async () => {
  try {
    const startTime = Date.now();

    // Step 1: Scrape all 20 creators
    await scrapeAllCreators();

    // Step 2: Run outlier analysis
    await runAnalysis();

    const elapsed = Math.round((Date.now() - startTime) / 1000 / 60);
    console.log(`\n⏱️  Total time: ${elapsed} minutes`);

  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  }
})();
