/**
 * Transform flat array of posts into grouped creator structure
 */
const fs = require('fs');

const posts = JSON.parse(fs.readFileSync('outputs/instagram_data_centner_expanded.json', 'utf8'));

// Group by creator
const byCreator = {};
posts.forEach(p => {
  const handle = p._creatorHandle;
  if (!byCreator[handle]) {
    byCreator[handle] = {
      handle: handle,
      followers: p._creatorFollowers || 0,
      posts: []
    };
  }
  byCreator[handle].posts.push(p);
});

const grouped = Object.values(byCreator);
console.log('✅ Grouped', posts.length, 'posts into', grouped.length, 'creators');
grouped.forEach(c => console.log('   -', c.handle, ':', c.posts.length, 'posts'));

fs.writeFileSync('outputs/demo_instagram_data_centner.json', JSON.stringify(grouped, null, 2));
console.log('✅ Saved to demo_instagram_data_centner.json');
