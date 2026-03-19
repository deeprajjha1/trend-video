/**
 * Trending Discovery Integration Tests — tests the full trending flow
 * from discovery to pipeline using real YouTube API and real AI.
 *
 * Run:  npm run test:trending
 * Env:  YOUTUBE_API_KEY (required), AI_PROVIDER=ollama or OPENAI_API_KEY
 *
 * Tests:  Categories, trending fetch (multiple regions/categories),
 *         selection → session → transcripts → pipeline step 1
 */
require('dotenv').config();
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const PORT = 9877;
const API_TIMEOUT = 30_000;
const AI_TIMEOUT = 120_000;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

before(async function () {
  if (!process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY.includes('your-')) {
    console.log('\n  ⏭ YOUTUBE_API_KEY not set. Skipping trending tests.\n');
    process.exit(0);
  }

  process.env.PORT = PORT;
  Object.keys(require.cache).forEach(key => {
    if (key.includes('trend-video/') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
  require('../server');
  console.log(`  Server started on port ${PORT}`);
});

describe('Trending: Regions endpoint', () => {
  it('returns list of supported regions', async () => {
    const res = await request('GET', '/api/regions');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 5, 'should have at least 5 regions');
    const codes = res.body.data.map(r => r.code);
    assert.ok(codes.includes('US'), 'should include US');
    assert.ok(codes.includes('IN'), 'should include India');
    console.log(`    Regions: ${res.body.data.map(r => r.code).join(', ')}`);
  });
});

describe('Trending: Categories endpoint', () => {
  it('fetches real YouTube categories for US', { timeout: API_TIMEOUT }, async () => {
    const res = await request('GET', '/api/categories?region=US');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 5, 'US should have many categories');

    const titles = res.body.data.map(c => c.title);
    assert.ok(titles.includes('Music'), 'should include Music');
    assert.ok(titles.includes('Gaming'), 'should include Gaming');
    console.log(`    US categories: ${titles.join(', ')}`);
  });

  it('fetches categories for India', { timeout: API_TIMEOUT }, async () => {
    const res = await request('GET', '/api/categories?region=IN');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.length >= 5);
    console.log(`    IN categories: ${res.body.data.length} found`);
  });
});

describe('Trending: Discover trending videos', () => {
  it('fetches trending videos for US - all categories', { timeout: API_TIMEOUT }, async () => {
    const res = await request('GET', '/api/trending?region=US&maxResults=10');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.videos.length > 0, 'should have trending videos');
    assert.equal(res.body.data.regionCode, 'US');

    const first = res.body.data.videos[0];
    assert.ok(first.id, 'video should have id');
    assert.ok(first.title, 'video should have title');
    assert.ok(first.channelTitle, 'video should have channelTitle');
    assert.ok(first.viewCount > 0, 'video should have view count');
    assert.ok(first.url.includes('youtube.com'), 'video should have URL');
    assert.ok(first.thumbnailUrl, 'video should have thumbnail URL');
    console.log(`    US trending: ${res.body.data.videos.length} videos, top: "${first.title.substring(0, 50)}" (${first.viewCount.toLocaleString()} views)`);
  });

  it('fetches trending for India - Science & Technology', { timeout: API_TIMEOUT }, async () => {
    const res = await request('GET', '/api/trending?region=IN&categoryId=28&maxResults=5');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    if (res.body.data.videos.length > 0) {
      const first = res.body.data.videos[0];
      console.log(`    IN Tech trending: ${res.body.data.videos.length} videos, top: "${first.title.substring(0, 50)}"`);
    } else {
      console.log('    IN Tech trending: 0 videos (category may be empty)');
    }
  });

  it('fetches trending for UK - Entertainment', { timeout: API_TIMEOUT }, async () => {
    const res = await request('GET', '/api/trending?region=GB&categoryId=24&maxResults=5');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.videos.length > 0, 'Entertainment UK should have videos');
    console.log(`    GB Entertainment: ${res.body.data.videos.length} videos`);
  });

  it('fetches trending for US - Gaming', { timeout: API_TIMEOUT }, async () => {
    const res = await request('GET', '/api/trending?region=US&categoryId=20&maxResults=5');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.videos.length > 0, 'Gaming US should have videos');
    console.log(`    US Gaming: ${res.body.data.videos.length} videos`);
  });

  it('returns empty array for nonexistent category gracefully', { timeout: API_TIMEOUT }, async () => {
    const res = await request('GET', '/api/trending?region=US&categoryId=27&maxResults=5');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.videos));
    console.log(`    US Education: ${res.body.data.videos.length} videos (may be empty)`);
  });
});

describe('Trending: Full flow — discover → select → pipeline', () => {
  let sessionId;
  let trendingVideos;

  it('create session', async () => {
    const res = await request('POST', '/api/session');
    assert.equal(res.body.success, true);
    sessionId = res.body.data.id;
    console.log(`    Session: ${sessionId}`);
  });

  it('discover trending videos', { timeout: API_TIMEOUT }, async () => {
    const res = await request('GET', '/api/trending?region=US&maxResults=10');
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.videos.length >= 3, 'need at least 3 trending videos');
    trendingVideos = res.body.data.videos.slice(0, 3);
    console.log(`    Selected ${trendingVideos.length} trending videos for analysis:`);
    trendingVideos.forEach(v => console.log(`      - "${v.title.substring(0, 50)}" (${v.viewCount.toLocaleString()} views)`));
  });

  it('load selected trending videos into session', { timeout: API_TIMEOUT }, async () => {
    const res = await request('POST', '/api/fetch-videos', {
      sessionId,
      trendingVideos,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.videos.length, trendingVideos.length);
    console.log(`    Loaded ${res.body.data.videos.length} videos into session`);
  });

  it('fetch transcripts for trending videos', { timeout: 60_000 }, async () => {
    const res = await request('POST', '/api/fetch-transcripts', { sessionId });
    assert.equal(res.body.success, true);
    const { stats } = res.body.data;
    console.log(`    Transcripts: ${stats.withTranscript}/${stats.total}`);
  });

  it('Step 1: AI analysis of trending videos', { timeout: AI_TIMEOUT }, async () => {
    const res = await request('POST', '/api/pipeline/1', { sessionId });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.result.length > 200, 'analysis should be substantial');
    console.log(`    Analysis: ${res.body.data.result.length} chars`);
    console.log(`    Preview: ${res.body.data.result.substring(0, 150)}...`);
  });

  it('Step 2: channel names from trending analysis', { timeout: AI_TIMEOUT }, async () => {
    const res = await request('POST', '/api/pipeline/2', { sessionId });
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.result.length > 100);
    console.log(`    Channel names: ${res.body.data.result.length} chars`);
  });

  it('Step 3: video ideas from trending analysis', { timeout: AI_TIMEOUT }, async () => {
    const res = await request('POST', '/api/pipeline/3', { sessionId });
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.result.length > 100);
    console.log(`    Video ideas: ${res.body.data.result.length} chars`);
  });

  it('verify session has trending-derived content', async () => {
    const res = await request('GET', `/api/session/${sessionId}`);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.results.analysis);
    assert.ok(res.body.data.results.channelNames);
    assert.ok(res.body.data.results.videoIdeas);
    console.log('    Full trending → pipeline flow verified');
  });
});
