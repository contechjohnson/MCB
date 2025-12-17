/**
 * Generate Realistic Instagram Demo Data for Centner Wellness
 *
 * Creates realistic Instagram post data for top wellness/biohacking creators
 * based on actual influencer research. This simulates what Apify would return.
 *
 * Usage: node execution/generate-wellness-demo-data.js
 */

const fs = require('fs');
const path = require('path');

// Top wellness/biohacking creators from research
const CREATORS = [
  {
    handle: 'kaylabarnes',
    followers: 547300,
    avgER: 3.2, // Typical for health/wellness macro-influencers
    bio: 'Female Health Optimization. Biohacking protocols @longevityoptimizationpod',
  },
  {
    handle: 'davidsinclairphd',
    followers: 746700,
    avgER: 2.8,
    bio: 'Harvard Professor studying aging - Lifespan book & podcast',
  },
  {
    handle: 'drpoonamdesai',
    followers: 319500,
    avgER: 3.5,
    bio: 'Concierge Longevity Doctor. Hormone, Peptides, GLP-1 expert',
  },
  {
    handle: 'nathalieniddam',
    followers: 64100,
    avgER: 4.2,
    bio: 'Biohacker | Nutritionist | Epigenetic Coach | Peptide Guide',
  },
  {
    handle: 'dr.longevity',
    followers: 182700,
    avgER: 3.1,
    bio: 'US-trained Medical Doctor. Longevity Health Optimization',
  },
];

// Realistic caption templates (based on actual wellness influencer content patterns)
const CAPTION_TEMPLATES = [
  {
    hook: 'curiosity',
    templates: [
      '🤯 This shocking {topic} secret nobody tells you about... Can you believe it? #wellness #biohacking #secret',
      'What if I told you {topic} could change everything? 🤔 Most people have NO idea about this... #longevity #health',
      '❓ The {topic} myth that 99% of people believe (it\'s completely wrong) #healthmyth #wellness',
      'WAIT... You\'re still doing {topic} the old way? 😱 This changes everything. #biohack #optimization',
    ],
  },
  {
    hook: 'transformation',
    templates: [
      '✨ Before/after results from {topic} protocol. The difference is INSANE. #transformation #results',
      'My {topic} transformation in 30 days (with proof) 📊 #beforeandafter #wellness',
      'Changed my entire approach to {topic} and here\'s what happened... 💪 #biohacking #optimization',
    ],
  },
  {
    hook: 'money',
    templates: [
      '💰 Stop wasting money on {topic}. Here\'s what actually works (and costs less) #savemoney #wellness',
      'The $15 {topic} hack that works better than the $500 version 🤑 #biohacking #budget',
      'Is {topic} worth the cost? Honest breakdown of what you\'re REALLY paying for 💵 #wellness #truth',
    ],
  },
  {
    hook: 'education',
    templates: [
      '📚 The science behind {topic} explained (in simple terms) #education #wellness',
      'Here\'s how {topic} actually works in your body 🧬 #biohacking #science',
      '5 things you need to know about {topic} before you start #tips #health',
    ],
  },
  {
    hook: 'general',
    templates: [
      'Quick update on my {topic} routine. Loving the results! #wellness #lifestyle',
      'Trying out {topic} this week. Will share updates! #biohacking #journey',
      'Morning routine featuring {topic}. Game changer! ☀️ #morningroutine #wellness',
    ],
  },
];

// Topics relevant to Centner Wellness (red light therapy, float tanks, hyperbaric oxygen, EBOO)
const WELLNESS_TOPICS = [
  'red light therapy',
  'infrared sauna',
  'float tank therapy',
  'hyperbaric oxygen',
  'cold plunge',
  'peptide therapy',
  'NAD+ optimization',
  'hormone balancing',
  'sleep optimization',
  'longevity protocols',
  'biohacking',
  'cellular health',
  'mitochondrial health',
  'recovery protocols',
  'brain optimization',
];

// Generate realistic engagement for a post
function generateEngagement(followers, avgER, isOutlier = false) {
  const baseER = avgER / 100;
  const multiplier = isOutlier ? (2.5 + Math.random() * 2) : (0.8 + Math.random() * 0.4);
  const totalEngagement = Math.floor(followers * baseER * multiplier);

  // Split between likes and comments (typically 95-98% likes, 2-5% comments)
  const commentRatio = 0.02 + Math.random() * 0.03;
  const comments = Math.floor(totalEngagement * commentRatio);
  const likes = totalEngagement - comments;

  return { likes, comments };
}

// Generate posts for a creator
function generatePostsForCreator(creator, numPosts = 30, outlierCount = 2) {
  const posts = [];
  const now = Date.now();

  // Determine which posts will be outliers (random selection)
  const outlierIndices = [];
  while (outlierIndices.length < outlierCount) {
    const idx = Math.floor(Math.random() * numPosts);
    if (!outlierIndices.includes(idx)) {
      outlierIndices.push(idx);
    }
  }

  for (let i = 0; i < numPosts; i++) {
    const isOutlier = outlierIndices.includes(i);
    const daysAgo = i; // Spread posts over last 30 days
    const timestamp = new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString();

    // Pick caption template (outliers get high-value hooks)
    let hookType;
    if (isOutlier) {
      const highValueHooks = ['curiosity', 'transformation', 'money'];
      hookType = highValueHooks[Math.floor(Math.random() * highValueHooks.length)];
    } else {
      hookType = ['education', 'general'][Math.floor(Math.random() * 2)];
    }

    const templateGroup = CAPTION_TEMPLATES.find(t => t.hook === hookType);
    const template = templateGroup.templates[Math.floor(Math.random() * templateGroup.templates.length)];
    const topic = WELLNESS_TOPICS[Math.floor(Math.random() * WELLNESS_TOPICS.length)];
    const caption = template.replace('{topic}', topic);

    const { likes, comments } = generateEngagement(creator.followers, creator.avgER, isOutlier);

    posts.push({
      url: `https://instagram.com/p/demo${creator.handle}${i}`,
      caption,
      likes,
      comments,
      timestamp,
      type: Math.random() > 0.3 ? 'Photo' : 'Video',
      thumbnail_url: `https://example.com/thumbnail_${creator.handle}_${i}.jpg`,
      _isOutlier: isOutlier, // For debugging
    });
  }

  return posts;
}

// Generate full dataset
function generateDemoDataset() {
  const dataset = CREATORS.map(creator => ({
    handle: creator.handle,
    followers: creator.followers,
    bio: creator.bio,
    posts: generatePostsForCreator(creator, 30, 2), // 30 posts, 2-3 outliers
  }));

  return dataset;
}

// Main
function main() {
  console.log('🎬 Generating realistic Instagram demo data for Centner Wellness...\n');

  const dataset = generateDemoDataset();

  // Calculate stats
  const totalPosts = dataset.reduce((sum, c) => sum + c.posts.length, 0);
  const totalOutliers = dataset.reduce((sum, c) =>
    sum + c.posts.filter(p => p._isOutlier).length, 0
  );

  console.log(`✅ Generated data for ${dataset.length} creators:`);
  dataset.forEach(c => {
    const outliers = c.posts.filter(p => p._isOutlier).length;
    console.log(`   - @${c.handle} (${c.followers.toLocaleString()} followers, ${c.posts.length} posts, ${outliers} outliers)`);
  });
  console.log(`\n📊 Total: ${totalPosts} posts, ${totalOutliers} outliers\n`);

  // Save to file
  const outputPath = path.join(__dirname, '../outputs/demo_instagram_data_centner.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));

  console.log(`💾 Saved to: ${outputPath}\n`);
  console.log('🚀 Next: Run content outlier detection on this data\n');
  console.log('   node execution/content-outlier-detection.js --demo centner\n');

  return dataset;
}

if (require.main === module) {
  main();
}

module.exports = { generateDemoDataset };
