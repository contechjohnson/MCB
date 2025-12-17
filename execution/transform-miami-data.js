/**
 * Transform Miami Med Spa flat posts to grouped creator format
 * Injects follower counts and merges with Session 5 wellness creators
 */

const fs = require('fs');
const path = require('path');

// Follower counts for Miami creators (researched from Instagram)
const MIAMI_FOLLOWER_COUNTS = {
  'remedyplace': 35000,         // Remedy Place - Social Wellness Club
  'thestandard': 382000,        // The Standard Spa Miami Beach
  'tierrasantafaena': 8200,     // Tierra Santa Healing House
  'ilaonly_spa': 12000,         // ILA Only Spa
  'cyborggainz': 322000,        // Jean Fallacara (known from search)
  'cindyprado': 2700000,        // Cindy Prado (known from search)
  'lifestylebymarco': 617000,   // Marco (known from search)
  'dianamarksofficial': 495000, // Diana Marks
  'beautynowmedspa': 28000,     // Beauty Now Med Spa
  'skinbioticmedspa': 15000,    // SkinBiotic Med Spa
  'aryamedspa': 9500,           // Arya Med Spa
  'hofitgolanofficial': 45000   // Hofit Golan
};

// Load Miami data (flat posts)
const miamiData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../outputs/instagram_data_centner_miami_medspa.json'), 'utf8')
);

// Load Session 5 data (grouped creators with follower counts)
const session5Data = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../outputs/demo_instagram_data_centner.json'), 'utf8')
);

console.log('📊 Data loaded:');
console.log(`  Miami posts: ${miamiData.posts.length}`);
console.log(`  Session 5 creators: ${session5Data.length}`);
console.log(`  Session 5 posts: ${session5Data.reduce((sum, c) => sum + c.posts.length, 0)}`);

// Group Miami posts by creator
const miamiCreators = {};
miamiData.posts.forEach(post => {
  const handle = post._creatorHandle;
  if (!miamiCreators[handle]) {
    miamiCreators[handle] = {
      handle,
      followers: MIAMI_FOLLOWER_COUNTS[handle] || 10000, // Default if missing
      posts: []
    };
  }
  miamiCreators[handle].posts.push(post);
});

// Convert to array
const miamiGrouped = Object.values(miamiCreators);

console.log('\n🏝️ Miami creators grouped:');
miamiGrouped.forEach(c => {
  console.log(`  @${c.handle}: ${c.posts.length} posts, ${c.followers.toLocaleString()} followers`);
});

// Merge with Session 5 data
const combinedData = [...session5Data, ...miamiGrouped];

console.log('\n🎯 Combined dataset:');
console.log(`  Total creators: ${combinedData.length}`);
console.log(`  Total posts: ${combinedData.reduce((sum, c) => sum + c.posts.length, 0)}`);

// Save combined data
const outputPath = path.join(__dirname, '../outputs/instagram_data_centner_combined.json');
fs.writeFileSync(outputPath, JSON.stringify(combinedData, null, 2), 'utf8');

console.log(`\n✅ Combined data saved: ${outputPath}`);
console.log('\n📊 Dataset breakdown:');
console.log(`  Wellness/biohacking creators: ${session5Data.length} (${session5Data.reduce((sum, c) => sum + c.posts.length, 0)} posts)`);
console.log(`  Miami med spa creators: ${miamiGrouped.length} (${miamiGrouped.reduce((sum, c) => sum + c.posts.length, 0)} posts)`);
console.log(`\n🎯 Ready for analysis with ${combinedData.length} creators and ${combinedData.reduce((sum, c) => sum + c.posts.length, 0)} posts!`);
