/**
 * Scrape Miami Med Spa & Luxury Wellness Instagram Creators
 *
 * Targets actual Miami med spa brands and luxury wellness influencers
 * instead of generic biohacking creators. These accounts have the exact
 * aesthetic and vibe that Centner Wellness can emulate.
 *
 * Created: 12/11/2025
 *
 * Usage: node execution/scrape-miami-medspa-creators.js
 */

require('dotenv').config({ path: '.env.local' });
const { ApifyClient } = require('apify-client');
const fs = require('fs');
const path = require('path');

const APIFY_TOKEN = process.env.APIFY_TOKEN;

if (!APIFY_TOKEN) {
  console.error('❌ APIFY_TOKEN not found in environment');
  process.exit(1);
}

const client = new ApifyClient({ token: APIFY_TOKEN });

// Miami med spa brands & luxury wellness influencers (MUCH better match for Centner)
const MIAMI_MEDSPA_CREATORS = [
  // Miami Med Spa Brands (Perfect aesthetic match)
  { handle: 'remedyplace', name: 'Remedy Place', category: 'Social Wellness Club' },
  { handle: 'thestandard', name: 'The Standard Spa Miami', category: 'Luxury Hotel/Spa' },
  { handle: 'tierrasantafaena', name: 'Tierra Santa Healing House', category: 'Miami Holistic Wellness' },
  { handle: 'ilaonly_spa', name: 'ILA Only Spa', category: 'Longevity Therapies' },

  // Miami Luxury Wellness Influencers
  { handle: 'cyborggainz', name: 'Jean Fallacara', category: 'Miami Longevity Expert (322K)' },
  { handle: 'cindyprado', name: 'Cindy Prado', category: 'Miami Luxury Lifestyle (2.7M)' },
  { handle: 'lifestylebymarco', name: 'Marco Arrieta', category: 'Luxury Hotels/Restaurants (617K)' },
  { handle: 'dianamarksofficial', name: 'Diana Marks', category: 'Luxury Lifestyle (495K)' },

  // High-Performing Med Spa Accounts
  { handle: 'beautynowmedspa', name: 'BeautyNow Med Spa', category: 'Premium Med Spa' },
  { handle: 'skinbioticmedspa', name: 'Skinbiotic Med Spa', category: 'Medical Grade Skincare' },
  { handle: 'aryamedspa', name: 'Arya Med Spa', category: 'Red Light Therapy' },

  // Additional Miami Wellness (if we need more)
  { handle: 'hofitgolanofficial', name: 'Hofit Golan', category: 'Miami Wellness Influencer' },
];

console.log('\n🏝️ Miami Med Spa & Luxury Wellness Instagram Scraper\n');
console.log(`📋 Target Creators: ${MIAMI_MEDSPA_CREATORS.length}`);
console.log(`📊 Posts per creator: 30 (last 30 days)`);
console.log(`💰 Estimated cost: ~$${(MIAMI_MEDSPA_CREATORS.length * 0.003 * 30).toFixed(2)}\n`);

const OUTPUT_FILE = path.join(__dirname, '../outputs/instagram_data_centner_miami_medspa.json');
const PROGRESS_FILE = path.join(__dirname, '../outputs/.instagram_data_centner_miami_progress.json');

async function scrapeCreatorPosts(handle, name, category) {
  console.log(`\n📦 Scraping @${handle} (${name} - ${category})...`);

  try {
    const run = await client.actor('apify/instagram-post-scraper').call({
      username: [handle], // Apify expects array
      resultsLimit: 30,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`   ✅ Scraped ${items.length} posts from @${handle}`);

    // Add creator handle to each post
    items.forEach(post => {
      post._creatorHandle = handle;
      post._creatorName = name;
      post._creatorCategory = category;
    });

    return items;

  } catch (error) {
    console.error(`   ❌ Error scraping @${handle}:`, error.message);
    return [];
  }
}

async function main() {
  const allPosts = [];
  let successCount = 0;
  let failCount = 0;

  // Load progress if resuming
  let startIndex = 0;
  if (fs.existsSync(PROGRESS_FILE)) {
    const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    allPosts.push(...progress.posts);
    startIndex = progress.completedCreators;
    console.log(`\n🔄 Resuming from creator ${startIndex + 1}/${MIAMI_MEDSPA_CREATORS.length}`);
  }

  for (let i = startIndex; i < MIAMI_MEDSPA_CREATORS.length; i++) {
    const creator = MIAMI_MEDSPA_CREATORS[i];
    console.log(`\n[${i + 1}/${MIAMI_MEDSPA_CREATORS.length}] Processing @${creator.handle}...`);

    const posts = await scrapeCreatorPosts(creator.handle, creator.name, creator.category);

    if (posts.length > 0) {
      allPosts.push(...posts);
      successCount++;
    } else {
      failCount++;
    }

    // Save progress after each creator (incremental save)
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
      posts: allPosts,
      completedCreators: i + 1,
      timestamp: new Date().toISOString()
    }, null, 2));

    // Rate limiting: 2 second delay between creators
    if (i < MIAMI_MEDSPA_CREATORS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Save final output
  const output = {
    metadata: {
      totalCreators: MIAMI_MEDSPA_CREATORS.length,
      successfulCreators: successCount,
      failedCreators: failCount,
      totalPosts: allPosts.length,
      scrapedAt: new Date().toISOString(),
      source: 'Miami Med Spa & Luxury Wellness Creators'
    },
    posts: allPosts
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log('\n\n✅ Scraping Complete!\n');
  console.log(`📊 Stats:`);
  console.log(`   - Creators processed: ${MIAMI_MEDSPA_CREATORS.length}`);
  console.log(`   - Successful: ${successCount}`);
  console.log(`   - Failed: ${failCount}`);
  console.log(`   - Total posts scraped: ${allPosts.length}`);
  console.log(`   - Average posts per creator: ${(allPosts.length / successCount).toFixed(1)}`);
  console.log(`\n📁 Output: ${OUTPUT_FILE}`);

  // Delete progress file on success
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
    console.log(`🗑️  Deleted progress file`);
  }

  console.log('\n🚀 Next step: Run analysis on this data');
  console.log(`   node execution/content-outlier-detection.js --input-json outputs/instagram_data_centner_miami_medspa.json`);
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
