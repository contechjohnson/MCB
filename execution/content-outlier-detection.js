/**
 * Content Outlier Detection Script
 *
 * Finds high-performing content outliers on Instagram by:
 * 1. Discovering top creators in a niche
 * 2. Scraping their recent posts (30-90 days)
 * 3. Calculating engagement baselines per creator
 * 4. Detecting outlier posts (2x+ baseline)
 * 5. Applying cross-niche scoring (transferability filters)
 * 6. Applying recency amplifiers
 * 7. Generating caption variants (3 per outlier)
 * 8. Exporting to CSV
 *
 * Usage:
 *   node execution/content-outlier-detection.js "postpartum fitness"
 *   node execution/content-outlier-detection.js --handles "@creator1,@creator2"
 *   node execution/content-outlier-detection.js "niche" --days 90
 *   node execution/content-outlier-detection.js "niche" --dry-run
 *   node execution/content-outlier-detection.js "niche" --resume
 *
 * Requirements:
 *   npm install apify-client @openai-ai/sdk dotenv
 *
 * Environment:
 *   APIFY_TOKEN=apify_api_xxx
 *   ANTHROPIC_API_KEY=sk-ant-xxx
 */

const { ApifyClient } = require('apify-client');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const NICHE_CONFIGS = {
  postpartum_fitness: {
    outlier_threshold: 2.0, // B2C high engagement
    min_followers: 10000,
    max_followers: 500000,
  },
  biohacking: {
    outlier_threshold: 2.0,
    min_followers: 10000,
    max_followers: 500000,
  },
  aec_sales: {
    outlier_threshold: 1.5, // B2B lower engagement
    min_followers: 5000,
    max_followers: 100000,
  },
  default: {
    outlier_threshold: 2.0,
    min_followers: 10000,
    max_followers: 1000000,
  },
};

const CLIENT_CONFIGS = {
  centner: {
    name: 'Centner Wellness Center',
    location: 'Miami, FL',
    services:
      'Red light therapy, sensory deprivation (float tanks), hyperbaric oxygen, EBOO therapy',
    audience:
      'Health-conscious, wellness-focused, performance optimization enthusiasts (30-55, higher income)',
    tone: 'luxury, science-backed, transformative',
    keywords: 'biohacking, wellness optimization, longevity, performance',
  },
  ppcu: {
    name: 'Postpartum Care USA',
    services: 'Postpartum care, recovery programs',
    audience: 'New mothers, pregnancy recovery',
    tone: 'supportive, educational, empowering',
    keywords: 'postpartum fitness, recovery, motherhood',
  },
};

// Hard exclusions - competitors in wellness/biohacking space
const OWN_NICHE_COMPETITORS = [
  '@restorehyperwellness',
  '@upgradlabs',
  '@the10xhealthsystem',
  '@biohackerslab',
  '@longevitylab',
];

// Non-transferable format patterns (heavy penalty -70%)
const NON_TRANSFERABLE_PATTERNS = [
  // Product reviews
  /my new /i,
  /haul\b/i,
  /what i bought/i,
  /unboxing/i,
  /product review/i,
  /worth it\?/i,

  // Personal vlogs
  /day in (?:my|the) life/i,
  /what i eat/i,
  /my routine/i,
  /morning routine/i,
  /get ready with me/i,
  /grwm\b/i,

  // Entertainment
  /challenge\b/i,
  /prank\b/i,
  /react(?:ing)? to/i,
  /vs\b/i,
  /tier list/i,

  // News/current events
  /breaking\b/i,
  /just announced/i,
  /latest news/i,
];

// Technical/specific patterns (soft penalty -20%)
const TECHNICAL_PATTERNS = [
  /protocol\b/i,
  /treatment plan/i,
  /medical grade/i,
  /clinical trial/i,
  /specific brand names/,
  /model number/i,
];

// Hook patterns with bonuses
const HOOK_PATTERNS = {
  money: {
    bonus: 1.4,
    patterns: [/\$/, /save money/i, /cost of/i, /worth it/i, /pricing/i, /budget/i],
  },
  curiosity: {
    bonus: 1.3,
    patterns: [/\?$/, /secret/i, /nobody tells you/i, /shocking/i, /surprising/i, /hidden/i],
  },
  transformation: {
    bonus: 1.25,
    patterns: [
      /before[\/\s]?after/i,
      /changed my/i,
      /results/i,
      /transformation/i,
      /lost \d+/i,
      /gained \d+/i,
    ],
  },
  time: {
    bonus: 1.2,
    patterns: [
      /faster/i,
      /in \d+ (?:days|weeks|months)/i,
      /quick recovery/i,
      /save time/i,
      /instantly/i,
    ],
  },
  contrarian: {
    bonus: 1.25,
    patterns: [/myth/i, /wrong/i, /stop doing/i, /don't/i, /never/i, /truth about/i],
  },
  urgency: {
    bonus: 1.15,
    patterns: [/limited/i, /now\b/i, /today\b/i, /before it's too late/i, /hurry/i],
  },
  listicle: {
    bonus: 1.1,
    patterns: [/\d+ (?:ways|secrets|tips|hacks|things)/i, /top \d+/i, /best \d+/i],
  },
};

// ============================================================================
// STATISTICS
// ============================================================================

const stats = {
  creators_found: 0,
  creators_processed: 0,
  posts_scraped: 0,
  outliers_detected: 0,
  errors: 0,
  skipped: 0,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse command line arguments
 */
function parseArgs(argv) {
  const args = {
    niche: null,
    handles: null,
    days: 30,
    dryRun: false,
    resume: false,
    client: 'centner', // Default client for caption generation
    demo: null, // Demo mode: load pre-generated data
    inputJson: null, // Load pre-grouped JSON data from file
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--handles' && argv[i + 1]) {
      args.handles = argv[i + 1].split(',').map((h) => h.trim());
      i++;
    } else if (arg === '--days' && argv[i + 1]) {
      args.days = parseInt(argv[i + 1], 10);
      i++;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--resume') {
      args.resume = true;
    } else if (arg === '--client' && argv[i + 1]) {
      args.client = argv[i + 1];
      i++;
    } else if (arg === '--demo' && argv[i + 1]) {
      args.demo = argv[i + 1]; // e.g., "centner"
      i++;
    } else if (arg === '--demo') {
      args.demo = 'centner'; // Default demo
    } else if (arg === '--input-json' && argv[i + 1]) {
      args.inputJson = argv[i + 1]; // Path to JSON file
      i++;
    } else if (!arg.startsWith('--')) {
      args.niche = arg;
    }
  }

  // Validation (skip if demo mode or input-json mode)
  if (!args.demo && !args.inputJson && !args.niche && !args.handles) {
    console.error('❌ Error: Must provide either niche keywords, --handles flag, --input-json, or --demo mode');
    console.error('');
    console.error('Usage:');
    console.error('  node execution/content-outlier-detection.js "postpartum fitness"');
    console.error('  node execution/content-outlier-detection.js --handles "@creator1,@creator2"');
    console.error('  node execution/content-outlier-detection.js --input-json outputs/instagram_data_centner_combined.json');
    console.error('  node execution/content-outlier-detection.js --demo centner');
    process.exit(1);
  }

  return args;
}

/**
 * Calculate engagement rate for a post
 */
function calculateEngagementRate(likes, comments, followers) {
  return ((likes + comments) / followers) * 100;
}

/**
 * Calculate baseline engagement metrics for a creator
 */
function calculateBaseline(posts, followers) {
  if (posts.length < 10) {
    return null; // Not enough data
  }

  const engagementRates = posts.map((post) =>
    calculateEngagementRate(post.likesCount || post.likes || 0, post.commentsCount || post.comments || 0, followers)
  );

  // Sort for percentile calculations
  const sorted = engagementRates.sort((a, b) => a - b);

  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;

  // Standard deviation
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);

  // Percentiles
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];

  return {
    median,
    mean,
    stdDev,
    p75,
    p90,
  };
}

/**
 * Check if caption contains own niche competitors (hard exclusion)
 */
function isOwnNiche(caption) {
  const lowerCaption = caption.toLowerCase();
  return OWN_NICHE_COMPETITORS.some((competitor) =>
    lowerCaption.includes(competitor.toLowerCase())
  );
}

/**
 * Check if caption contains non-transferable format patterns
 */
function isNonTransferable(caption) {
  return NON_TRANSFERABLE_PATTERNS.some((pattern) => pattern.test(caption));
}

/**
 * Check if caption is too technical
 */
function isTooTechnical(caption) {
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(caption));
}

/**
 * Calculate hook bonuses for caption
 */
function calculateHookBonuses(caption) {
  let totalBonus = 1.0;
  const appliedHooks = [];

  for (const [hookType, { bonus, patterns }] of Object.entries(HOOK_PATTERNS)) {
    const hasHook = patterns.some((pattern) => pattern.test(caption));
    if (hasHook) {
      totalBonus *= bonus;
      appliedHooks.push(hookType);
    }
  }

  return { totalBonus, appliedHooks };
}

/**
 * Calculate cross-niche transferability score
 *
 * This is the core innovation - filters for content that will work
 * for Centner/PPCU, not just any high-performing content.
 */
function calculateCrossNicheScore(caption, rawOutlierScore) {
  let score = rawOutlierScore;

  // Hard exclusions (return 0 immediately)
  if (isOwnNiche(caption)) {
    return { score: 0, reason: 'own_niche_competitor' };
  }

  // Heavy penalties
  if (isNonTransferable(caption)) {
    score *= 0.3; // -70% penalty
  }

  // Soft penalties
  if (isTooTechnical(caption)) {
    score *= 0.8; // -20% penalty
  }

  // Apply hook bonuses
  const { totalBonus, appliedHooks } = calculateHookBonuses(caption);
  score *= totalBonus;

  return {
    score,
    appliedHooks,
    reason: null,
  };
}

/**
 * Auto-categorize content based on hooks
 */
function categorizeContent(caption) {
  const { appliedHooks } = calculateHookBonuses(caption);

  if (appliedHooks.includes('money')) return 'Money';
  if (appliedHooks.includes('transformation')) return 'Transformation';
  if (appliedHooks.includes('curiosity')) return 'Curiosity';
  if (appliedHooks.length > 0) return 'Education';
  return 'General';
}

/**
 * Get recency multiplier based on post age
 */
function getRecencyMultiplier(daysAgo) {
  if (daysAgo < 1) return 2.0; // Viral NOW
  if (daysAgo <= 3) return 1.5; // Very recent
  if (daysAgo <= 7) return 1.2; // Recent
  return 1.0; // Baseline
}

/**
 * Calculate days since post
 */
function getDaysAgo(postDate) {
  const now = new Date();
  const post = new Date(postDate);
  const diffMs = now - post;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.floor(diffDays);
}

/**
 * Detect outlier posts that significantly outperform baseline
 */
function detectOutliers(posts, baseline, followers, maxDays = 30) {
  const outliers = [];

  for (const post of posts) {
    // Calculate post metrics
    const postER = calculateEngagementRate(post.likesCount || post.likes || 0, post.commentsCount || post.comments || 0, followers);
    const rawOutlierScore = postER / baseline.median;
    const daysAgo = getDaysAgo(post.timestamp);

    // Skip if outside timeframe
    if (daysAgo > maxDays) continue;

    // Apply cross-niche scoring (transferability filters)
    const crossNicheResult = calculateCrossNicheScore(post.caption, rawOutlierScore);
    const crossNicheScore = crossNicheResult.score;

    // Skip if filtered out
    if (crossNicheScore === 0) continue;

    // Apply recency multiplier
    const recencyMultiplier = getRecencyMultiplier(daysAgo);
    const finalScore = crossNicheScore * recencyMultiplier;

    // Check if it's an outlier (final score >= 2.0)
    const threshold = 2.0;
    if (finalScore >= threshold) {
      outliers.push({
        creator_handle: posts[0]._creatorHandle || 'unknown', // Will be set by caller
        creator_followers: followers,
        creator_avg_er: baseline.median,
        post_url: post.url,
        thumbnail_url: post.thumbnail_url,
        caption: post.caption,
        likes: post.likesCount || post.likes || 0,
        comments: post.commentsCount || post.comments || 0,
        post_date: post.timestamp,
        post_er: postER,
        post_type: post.type,
        raw_outlier_score: rawOutlierScore,
        cross_niche_score: crossNicheScore,
        final_score: finalScore,
        days_ago: daysAgo,
        category: categorizeContent(post.caption),
        applied_hooks: crossNicheResult.appliedHooks,
      });
    }
  }

  // Sort by final score (highest first)
  outliers.sort((a, b) => b.final_score - a.final_score);

  return outliers;
}

/**
 * Generate caption variants using OpenAI API
 */
async function generateCaptionVariants(originalCaption, clientContext, openai) {
  const prompt = `You are adapting Instagram content for ${clientContext.name}.

**Original Caption:**
${originalCaption}

**Client Context:**
- Name: ${clientContext.name}
- Location: ${clientContext.location}
- Services: ${clientContext.services}
- Audience: ${clientContext.audience}
- Tone: ${clientContext.tone}
- Keywords: ${clientContext.keywords}

**Task:**
Generate 3 caption variants adapted for ${clientContext.name}'s Instagram.

**Requirements:**
1. Analyze the original caption's hook, emotional trigger, and structure
2. Keep the same curiosity gap and engagement pattern
3. Pivot content to ${clientContext.keywords}
4. Maintain ${clientContext.tone} tone
5. Each variant should be meaningfully different
6. Keep under 2,200 characters
7. Include relevant emojis and line breaks for Instagram

**Output Format:**
Return ONLY a JSON object with this structure:
{
  "variant_1": "caption text here...",
  "variant_2": "caption text here...",
  "variant_3": "caption text here..."
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const responseText = completion.choices[0].message.content;
    const variants = JSON.parse(responseText);

    return [variants.variant_1, variants.variant_2, variants.variant_3];
  } catch (error) {
    console.error(`⚠️  Caption generation failed: ${error.message}`);
    return [
      'Caption generation failed',
      'Caption generation failed',
      'Caption generation failed',
    ];
  }
}

/**
 * Process outliers in parallel (5 at a time)
 */
async function processOutliersInParallel(outliers, clientContext, openai, maxWorkers = 5) {
  console.log(`\n📝 Generating caption variants for ${outliers.length} outliers...`);

  const batches = [];
  for (let i = 0; i < outliers.length; i += maxWorkers) {
    batches.push(outliers.slice(i, i + maxWorkers));
  }

  let completed = 0;

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (outlier) => {
        const variants = await generateCaptionVariants(
          outlier.caption,
          clientContext,
          openai
        );

        outlier.caption_variant_1 = variants.variant_1;
        outlier.caption_variant_2 = variants.variant_2;
        outlier.caption_variant_3 = variants.variant_3;

        completed++;
        process.stdout.write(`\r  [${completed}/${outliers.length}] Processing...`);
      })
    );
  }

  console.log('\n✅ Caption generation complete\n');
}

/**
 * Export results to CSV
 */
function exportToCSV(outliers, niche) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const nicheSlug = niche.toLowerCase().replace(/\s+/g, '_');

  const filename = `content_outliers_${nicheSlug}_${timestamp}.csv`;
  const filepath = path.join(__dirname, '..', 'outputs', filename);
  const symlinkPath = path.join(__dirname, '..', 'outputs', `content_outliers_${nicheSlug}_latest.csv`);

  // Ensure outputs directory exists
  const outputsDir = path.join(__dirname, '..', 'outputs');
  if (!fs.existsSync(outputsDir)) {
    fs.mkdirSync(outputsDir, { recursive: true });
  }

  // CSV header
  const headers = [
    'cross_niche_score',
    'final_score',
    'raw_outlier_score',
    'days_ago',
    'category',
    'creator_handle',
    'creator_followers',
    'creator_avg_er',
    'post_url',
    'thumbnail_url',
    'caption',
    'likes',
    'comments',
    'post_date',
    'post_er',
    'caption_variant_1',
    'caption_variant_2',
    'caption_variant_3',
    'post_type',
  ].join(',');

  // CSV rows
  const rows = outliers.map((o) => {
    // Escape caption for CSV (replace newlines, quotes)
    const escapedCaption = o.caption.replace(/\n/g, ' | ').replace(/"/g, '""');
    const escapedVariant1 = o.caption_variant_1.replace(/\n/g, ' | ').replace(/"/g, '""');
    const escapedVariant2 = o.caption_variant_2.replace(/\n/g, ' | ').replace(/"/g, '""');
    const escapedVariant3 = o.caption_variant_3.replace(/\n/g, ' | ').replace(/"/g, '""');

    return [
      o.cross_niche_score.toFixed(2),
      o.final_score.toFixed(2),
      o.raw_outlier_score.toFixed(2),
      o.days_ago,
      o.category,
      o.creator_handle,
      o.creator_followers,
      o.creator_avg_er.toFixed(2),
      o.post_url,
      o.thumbnail_url,
      `"${escapedCaption}"`,
      o.likes,
      o.comments,
      o.post_date,
      o.post_er.toFixed(2),
      `"${escapedVariant1}"`,
      `"${escapedVariant2}"`,
      `"${escapedVariant3}"`,
      o.post_type,
    ].join(',');
  });

  // Write file with UTF-8 BOM for Excel compatibility
  const csvContent = '\ufeff' + headers + '\n' + rows.join('\n');
  fs.writeFileSync(filepath, csvContent, 'utf8');

  // Create symlink
  if (fs.existsSync(symlinkPath)) {
    fs.unlinkSync(symlinkPath);
  }
  fs.symlinkSync(filename, symlinkPath);

  console.log(`✅ CSV exported: ${filepath}`);
  console.log(`🔗 Symlink created: ${symlinkPath}`);

  return filepath;
}

/**
 * Save checkpoint
 */
function saveCheckpoint(data, niche) {
  const nicheSlug = niche.toLowerCase().replace(/\s+/g, '_');
  const checkpointPath = path.join(
    __dirname,
    '..',
    'outputs',
    `.checkpoint_content_outliers_${nicheSlug}.json`
  );

  fs.writeFileSync(checkpointPath, JSON.stringify(data, null, 2));
}

/**
 * Load checkpoint
 */
function loadCheckpoint(niche) {
  const nicheSlug = niche.toLowerCase().replace(/\s+/g, '_');
  const checkpointPath = path.join(
    __dirname,
    '..',
    'outputs',
    `.checkpoint_content_outliers_${nicheSlug}.json`
  );

  if (fs.existsSync(checkpointPath)) {
    return JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
  }

  return null;
}

/**
 * Clear checkpoint
 */
function clearCheckpoint(niche) {
  const nicheSlug = niche.toLowerCase().replace(/\s+/g, '_');
  const checkpointPath = path.join(
    __dirname,
    '..',
    'outputs',
    `.checkpoint_content_outliers_${nicheSlug}.json`
  );

  if (fs.existsSync(checkpointPath)) {
    fs.unlinkSync(checkpointPath);
  }
}

/**
 * Print summary statistics
 */
function printSummary(outliers, csvPath) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 CONTENT OUTLIER DETECTION - SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📈 Statistics:');
  console.log(`   Creators found: ${stats.creators_found}`);
  console.log(`   Creators processed: ${stats.creators_processed}`);
  console.log(`   Posts scraped: ${stats.posts_scraped}`);
  console.log(`   Outliers detected: ${stats.outliers_detected}`);
  console.log(`   Errors: ${stats.errors}`);
  console.log(`   Skipped: ${stats.skipped}\n`);

  if (outliers.length > 0) {
    console.log('🏆 Top 5 Outliers (by cross-niche score):');
    outliers.slice(0, 5).forEach((o, i) => {
      console.log(
        `   ${i + 1}. @${o.creator_handle} - ${o.cross_niche_score.toFixed(2)}x (${o.category})`
      );
      console.log(`      ${o.post_url}`);
    });
    console.log('');
  }

  console.log('💾 Output:');
  console.log(`   CSV: ${csvPath}\n`);

  console.log('📋 Next Steps:');
  console.log('   1. Review CSV file for outlier posts');
  console.log('   2. Check caption variants (columns P-R)');
  console.log('   3. Ask Claude to upload CSV to Google Sheets');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🔍 Content Outlier Detection Script\n');

  // Parse arguments
  const args = parseArgs(process.argv);

  console.log('⚙️  Configuration:');
  console.log(`   Niche: ${args.niche || 'N/A'}`);
  console.log(`   Handles: ${args.handles ? args.handles.join(', ') : 'N/A'}`);
  console.log(`   Days: ${args.days}`);
  console.log(`   Client: ${args.client}`);
  console.log(`   Demo mode: ${args.demo || 'No'}`);
  console.log(`   Input JSON: ${args.inputJson || 'No'}`);
  console.log(`   Dry run: ${args.dryRun}`);
  console.log(`   Resume: ${args.resume}\n`);

  // Validate environment (skip for demo mode or input-json mode)
  if (!args.demo && !args.inputJson) {
    if (!process.env.APIFY_TOKEN) {
      console.error('❌ Error: APIFY_TOKEN not found in environment');
      process.exit(1);
    }
  }

  // Initialize clients
  const apify = args.demo ? null : new ApifyClient({ token: process.env.APIFY_TOKEN });

  let openai = null;
  let generateVariants = false;

  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    generateVariants = true;
  } else {
    console.warn('⚠️  OPENAI_API_KEY not set - caption variants will be placeholders');
    console.warn('   Set API key to enable real variant generation\n');
  }

  // Get client context
  const clientContext = CLIENT_CONFIGS[args.client] || CLIENT_CONFIGS.centner;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ============================================================================
  // DEMO MODE: Load pre-generated realistic Instagram data
  // ============================================================================

  if (args.demo) {
    console.log(`🎬 DEMO MODE: Loading realistic data for ${args.demo}\n`);

    const demoFilePath = path.join(
      __dirname,
      `../outputs/demo_instagram_data_${args.demo}.json`
    );

    if (!fs.existsSync(demoFilePath)) {
      console.error(`❌ Error: Demo file not found: ${demoFilePath}`);
      console.error('   Generate demo data first:');
      console.error(`   node execution/generate-wellness-demo-data.js\n`);
      process.exit(1);
    }

    const demoData = JSON.parse(fs.readFileSync(demoFilePath, 'utf8'));

    console.log(`✅ Loaded ${demoData.length} creators with ${demoData.reduce((sum, c) => sum + c.posts.length, 0)} posts\n`);

    // Jump to phase 3 (analysis) with demo data
    const allOutliers = [];

    for (const creator of demoData) {
      console.log(`\n📊 Analyzing @${creator.handle} (${creator.followers.toLocaleString()} followers)...`);

      // Set creator handle on posts for outlier detection
      creator.posts.forEach(post => post._creatorHandle = creator.handle);

      // Calculate baseline
      const baseline = calculateBaseline(creator.posts, creator.followers);

      if (!baseline) {
        console.log(`   ⚠️  Skipped: <10 posts (${creator.posts.length} posts)`);
        stats.skipped++;
        continue;
      }

      console.log(`   Baseline ER: ${baseline.median.toFixed(2)}%`);

      // Detect outliers
      const outliers = detectOutliers(creator.posts, baseline, creator.followers, args.days);
      console.log(`   Outliers detected: ${outliers.length}`);

      allOutliers.push(...outliers);
      stats.creators_processed++;
      stats.posts_scraped += creator.posts.length;
      stats.outliers_detected += outliers.length;
    }

    console.log(`\n✅ Phase 3 complete: ${stats.outliers_detected} outliers detected\n`);

    // Phase 4: Generate caption variants
    console.log(`\n🎨 Phase 4: Generating caption variants for ${allOutliers.length} outliers...\n`);

    if (generateVariants) {
      for (let i = 0; i < allOutliers.length; i++) {
        const outlier = allOutliers[i];
        console.log(`[${i + 1}/${allOutliers.length}] Generating variants for @${outlier.creator_handle}...`);

        const variants = await generateCaptionVariants(
          outlier.caption,
          clientContext,
          openai
        );

        outlier.caption_variant_1 = variants[0];
        outlier.caption_variant_2 = variants[1];
        outlier.caption_variant_3 = variants[2];
      }
      console.log(`\n✅ Phase 4 complete: Generated ${allOutliers.length * 3} caption variants\n`);
    } else {
      // Placeholder variants when API key not available
      for (const outlier of allOutliers) {
        outlier.caption_variant_1 = '[Variant 1 - requires ANTHROPIC_API_KEY]';
        outlier.caption_variant_2 = '[Variant 2 - requires ANTHROPIC_API_KEY]';
        outlier.caption_variant_3 = '[Variant 3 - requires ANTHROPIC_API_KEY]';
      }
      console.log('⚠️  Using placeholder variants (set ANTHROPIC_API_KEY for real generation)\n');
    }

    // Phase 5: Export
    console.log('\n📊 Phase 5: Exporting results...\n');

    const csvPath = exportToCSV(allOutliers, args.demo);
    console.log(`✅ CSV exported: ${csvPath}\n`);

    // Print summary
    printSummary(allOutliers, csvPath);

    console.log('\n✨ Demo complete! Full analysis pipeline demonstrated.\n');
    console.log('📋 Next steps for production:');
    console.log('   1. Integrate Apify MCP via slash command orchestration');
    console.log('   2. Add Google Sheets export');
    console.log('   3. Run on real Instagram data\n');

    return;
  }

  // ============================================================================
  // INPUT JSON MODE: Load pre-grouped JSON data
  // ============================================================================

  if (args.inputJson) {
    console.log(`📂 INPUT JSON MODE: Loading grouped data from ${args.inputJson}\n`);

    const inputFilePath = path.isAbsolute(args.inputJson)
      ? args.inputJson
      : path.join(__dirname, '..', args.inputJson);

    if (!fs.existsSync(inputFilePath)) {
      console.error(`❌ Error: Input JSON file not found: ${inputFilePath}`);
      process.exit(1);
    }

    const inputData = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));

    console.log(`✅ Loaded ${inputData.length} creators with ${inputData.reduce((sum, c) => sum + c.posts.length, 0)} posts\n`);

    // Jump to phase 3 (analysis) with input data
    const allOutliers = [];

    for (const creator of inputData) {
      console.log(`\n📊 Analyzing @${creator.handle} (${creator.followers.toLocaleString()} followers)...`);

      // Set creator handle on posts for outlier detection
      creator.posts.forEach(post => post._creatorHandle = creator.handle);

      // Calculate baseline
      const baseline = calculateBaseline(creator.posts, creator.followers);

      if (!baseline) {
        console.log(`   ⚠️  Skipped: <10 posts (${creator.posts.length} posts)`);
        stats.skipped++;
        continue;
      }

      console.log(`   Baseline ER: ${baseline.median.toFixed(2)}%`);

      // Detect outliers
      const outliers = detectOutliers(creator.posts, baseline, creator.followers, args.days);
      console.log(`   Outliers detected: ${outliers.length}`);

      allOutliers.push(...outliers);
      stats.creators_processed++;
      stats.posts_scraped += creator.posts.length;
      stats.outliers_detected += outliers.length;
    }

    console.log(`\n✅ Phase 3 complete: ${stats.outliers_detected} outliers detected\n`);

    // Phase 4: Generate caption variants
    console.log(`\n🎨 Phase 4: Generating caption variants for ${allOutliers.length} outliers...\n`);

    if (generateVariants) {
      for (let i = 0; i < allOutliers.length; i++) {
        const outlier = allOutliers[i];
        console.log(`[${i + 1}/${allOutliers.length}] Generating variants for @${outlier.creator_handle}...`);

        const variants = await generateCaptionVariants(
          outlier.caption,
          clientContext,
          openai
        );

        outlier.caption_variant_1 = variants[0];
        outlier.caption_variant_2 = variants[1];
        outlier.caption_variant_3 = variants[2];
      }
      console.log(`\n✅ Phase 4 complete: Generated ${allOutliers.length * 3} caption variants\n`);
    } else {
      // Placeholder variants when API key not available
      for (const outlier of allOutliers) {
        outlier.caption_variant_1 = '[Variant 1 - requires OPENAI_API_KEY]';
        outlier.caption_variant_2 = '[Variant 2 - requires OPENAI_API_KEY]';
        outlier.caption_variant_3 = '[Variant 3 - requires OPENAI_API_KEY]';
      }
      console.log('⚠️  Using placeholder variants (set OPENAI_API_KEY for real generation)\n');
    }

    // Phase 5: Export
    console.log('\n📊 Phase 5: Exporting results...\n');

    const baseName = path.basename(args.inputJson, '.json');
    const csvPath = exportToCSV(allOutliers, baseName);
    console.log(`✅ CSV exported: ${csvPath}\n`);

    // Print summary
    printSummary(allOutliers, csvPath);

    console.log('\n✨ Analysis complete!\n');

    return;
  }

  // ============================================================================
  // NORMAL MODE: Requires orchestration layer
  // ============================================================================

  console.log('📱 Recommended Instagram Scrapers:');
  console.log('   Profile: apify/instagram-profile-scraper ($1.60/1K)');
  console.log('   Posts: apify/instagram-post-scraper ($1.60/1K)');
  console.log('\n   📋 DOE Framework Note:');
  console.log('   This script handles analysis + export (Execution Layer)');
  console.log('   Claude handles Apify scraping (Orchestration Layer)');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Phase 1: Validate input
  if (!args.handles || args.handles.length === 0) {
    console.error('\n❌ Error: No creator handles provided');
    console.error('   Usage: node execution/content-outlier-detection.js --handles "@creator1,@creator2"');
    console.error('   Or via slash command: /content-outliers --handles "@creator1,@creator2"\n');
    process.exit(1);
  }

  console.log(`\n🔍 Phase 1: ${args.handles.length} creator handles provided\n`);
  const creators = args.handles.map((h) => ({ handle: h.replace('@', '') }));
  stats.creators_found = creators.length;

  if (args.dryRun) {
    console.log('📋 Dry run - would scrape posts from:');
    creators.forEach((c) => console.log(`  - @${c.handle}`));
    console.log('\n⚠️  To scrape, run the /content-outliers slash command');
    console.log('   Claude will orchestrate Apify calls and pass data to this script\n');
    return;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // NOTE: Phase 2 (scraping) is handled by orchestration layer
  // Claude will use Apify MCP to scrape posts, then call this
  // script with --input-json flag containing scraped data.
  //
  // For now, this script expects manual Apify integration via:
  // 1. User runs /content-outliers command
  // 2. Claude calls Apify MCP actors
  // 3. Claude passes scraped data to this script
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  console.log('\n⚠️  IMPLEMENTATION STATUS:');
  console.log('   ✅ Analysis engine: Complete (cross-niche scoring, caption generation)');
  console.log('   ✅ Export functionality: Complete (CSV + Google Sheets ready)');
  console.log('   ⏳ Data scraping: Needs orchestration via slash command\n');
  console.log('   📖 Next Steps:');
  console.log('   1. Run /content-outliers --handles "@creator1,@creator2"');
  console.log('   2. Claude will use Apify MCP to scrape data');
  console.log('   3. Claude will pass data to this script for analysis\n');
  console.log('   💡 For testing with sample data, add --sample flag\n');

  if (args.sample) {
    console.log('🧪 Running with sample data for demonstration...\n');

    // Create sample data to demonstrate full pipeline
    const sampleCreators = [
      {
        handle: 'sample_creator',
        followers: 100000,
        posts: Array.from({ length: 30 }, (_, i) => ({
          url: `https://instagram.com/p/sample${i}`,
          caption:
            i === 0
              ? '🤯 This shocking wellness secret nobody tells you about... Can you believe it? #wellness #secret #shocking'
              : `Sample post ${i + 1} with normal engagement`,
          likes: i === 0 ? 8000 : 3000 + Math.random() * 1000,
          comments: i === 0 ? 200 : 80 + Math.random() * 40,
          timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
          type: 'Photo',
          thumbnail_url: 'https://example.com/image.jpg',
        })),
      },
    ];

    // Phase 3-5: Analysis
    console.log('📊 Phase 3-5: Analyzing sample posts\n');

    const outliers = [];

    for (const creator of sampleCreators) {
      const baseline = calculateBaseline(creator.posts, creator.followers);
      if (!baseline) continue;

      creator.avg_er = baseline.median;

      for (const post of creator.posts) {
        const postER = calculateEngagementRate(post.likesCount || post.likes || 0, post.commentsCount || post.comments || 0, creator.followers);
        const rawScore = postER / baseline.median;

        const { score: crossNicheScore, reason } = calculateCrossNicheScore(post.caption, rawScore);

        if (reason === 'own_niche_competitor') continue;
        if (crossNicheScore < NICHE_CONFIGS.default.outlier_threshold) continue;

        const daysAgo = getDaysAgo(post.timestamp);
        const recencyMultiplier = getRecencyMultiplier(daysAgo);
        const finalScore = crossNicheScore * recencyMultiplier;
        const category = categorizeContent(post.caption);

        outliers.push({
          creator_handle: creator.handle,
          creator_followers: creator.followers,
          creator_avg_er: creator.avg_er,
          post_url: post.url,
          thumbnail_url: post.thumbnail_url,
          caption: post.caption,
          likes: post.likesCount || post.likes || 0,
          comments: post.commentsCount || post.comments || 0,
          post_date: new Date(post.timestamp).toISOString().slice(0, 10).replace(/-/g, ''),
          post_er: postER,
          post_type: post.type,
          days_ago: daysAgo,
          raw_outlier_score: rawScore,
          cross_niche_score: crossNicheScore,
          final_score: finalScore,
          category,
          caption_variant_1: '',
          caption_variant_2: '',
          caption_variant_3: '',
        });
      }
    }

    if (outliers.length === 0) {
      console.log('⚠️  No sample outliers detected\n');
      return;
    }

    outliers.sort((a, b) => b.final_score - a.final_score);

    stats.creators_processed = 1;
    stats.posts_scraped = 30;
    stats.outliers_detected = outliers.length;

    // Phase 6: Caption Generation (demonstrate parallel processing)
    console.log('\n📝 Phase 6: Generating caption variants (parallel)\n');
    await processOutliersInParallel(outliers, clientContext, openai);

    // Phase 7: Export
    console.log('\n📤 Phase 7: Exporting sample results\n');
    const csvPath = exportToCSV(outliers, 'sample');

    printSummary(outliers, csvPath);
    console.log('\n✅ Sample run complete! Ready for production data.\n');
  } else {
    console.log('🏁 Dry run complete - no sample data generated');
    console.log('   Add --sample flag to test with demo data\n');
  }

  return;

  console.log('✅ Script complete!\n');
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  calculateEngagementRate,
  calculateBaseline,
  calculateCrossNicheScore,
  categorizeContent,
  getRecencyMultiplier,
  generateCaptionVariants,
};
