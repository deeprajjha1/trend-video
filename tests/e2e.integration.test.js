/**
 * End-to-End HTTP Integration Tests — boots the real server, hits real endpoints,
 * calls real YouTube and real OpenAI.
 *
 * This is the closest thing to a user clicking through the UI. It verifies
 * the full request/response cycle: HTTP → Express → Services → Real APIs → Response.
 *
 * Run:  npm test -- tests/e2e.integration.test.js
 * Env:  OPENAI_API_KEY (required), YOUTUBE_API_KEY (optional)
 *
 * Timeout: Full suite takes ~4-6 minutes due to AI calls.
 */
require('dotenv').config();
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const STEP_TIMEOUT = 90_000;
const PORT = 9876; // Use non-standard port to avoid conflicts

let server;

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
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your-')) {
    console.log('\n  ❌ OPENAI_API_KEY not set. Add a real key to .env\n');
    process.exit(0);
  }

  process.env.PORT = PORT;

  // Clear module cache so server binds to our port
  Object.keys(require.cache).forEach(key => {
    if (key.includes('trend-video/') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });

  const app = require('../server');
});

after(() => {
  if (server) server.close();
});

describe('E2E: Health & Session', () => {
  it('GET /health returns healthy status', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.status, 'healthy');
    assert.equal(res.body.hasOpenAI, true);
    console.log(`    ✓ Server healthy, OpenAI key detected`);
  });

  it('POST /api/session creates a real session', async () => {
    const res = await request('POST', '/api/session');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.id, 'should have session ID');
    assert.equal(res.body.data.currentStep, 0);
    console.log(`    ✓ Session created: ${res.body.data.id}`);
  });
});

describe('E2E: Full Pipeline with Real APIs', () => {
  let sid;
  const testVideoUrls = [
    'https://www.youtube.com/watch?v=UF8uR6Z6KLc',  // Steve Jobs Stanford
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',  // Me at the zoo
  ];

  it('Create session', async () => {
    const res = await request('POST', '/api/session');
    sid = res.body.data.id;
    assert.ok(sid);
    console.log(`    ✓ Session: ${sid}`);
  });

  it('Fetch real videos via URLs', { timeout: 30_000 }, async () => {
    const res = await request('POST', '/api/fetch-videos', {
      sessionId: sid,
      videoUrls: testVideoUrls,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.videos.length, 2, 'should have 2 videos');

    for (const v of res.body.data.videos) {
      assert.ok(v.id, 'video should have ID');
      console.log(`    ✓ Video: "${v.title}" (${v.viewCount?.toLocaleString() || 'no API key'} views)`);
    }
  });

  it('Fetch real transcripts from YouTube', { timeout: 60_000 }, async () => {
    const res = await request('POST', '/api/fetch-transcripts', { sessionId: sid });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.stats, 'should have stats');

    const { stats } = res.body.data;
    console.log(`    ✓ Transcripts: ${stats.withTranscript}/${stats.total} fetched`);

    if (stats.withTranscript === 0) {
      console.log('    ⚠ No transcripts available — YouTube may be blocking scraping.');
      console.log('    Pipeline will still work but analysis will be based on titles only.');
    }
  });

  it('Step 1: Run real AI analysis via HTTP', { timeout: STEP_TIMEOUT }, async () => {
    const res = await request('POST', '/api/pipeline/1', { sessionId: sid });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.step, 1);
    assert.ok(res.body.data.result.length > 200, 'analysis should be substantial');
    console.log(`    ✓ Analysis: ${res.body.data.result.length} chars from GPT-4o`);
  });

  it('Step 2: Generate real channel names via HTTP', { timeout: STEP_TIMEOUT }, async () => {
    const res = await request('POST', '/api/pipeline/2', { sessionId: sid });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.result.length > 200);
    console.log(`    ✓ Channel Names: ${res.body.data.result.length} chars`);
  });

  it('Step 3: Generate real video ideas via HTTP', { timeout: STEP_TIMEOUT }, async () => {
    const res = await request('POST', '/api/pipeline/3', { sessionId: sid });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.result.length > 200);
    console.log(`    ✓ Video Ideas: ${res.body.data.result.length} chars`);
  });

  it('Step 4: Write real script via HTTP', { timeout: STEP_TIMEOUT * 1.5 }, async () => {
    const res = await request('POST', '/api/pipeline/4', {
      sessionId: sid,
      videoIdea: 'The Hidden Psychology Behind Why Some YouTube Videos Go Viral',
      additionalInstructions: 'Make it educational and around 6 minutes.',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.result.length > 800, 'script should be long');
    console.log(`    ✓ Script: ${res.body.data.result.length} chars`);
  });

  it('Step 5: Generate real titles via HTTP', { timeout: STEP_TIMEOUT }, async () => {
    const res = await request('POST', '/api/pipeline/5', { sessionId: sid });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.result.length > 200);
    console.log(`    ✓ Titles: ${res.body.data.result.length} chars`);
  });

  it('Step 6: Generate real thumbnail plans via HTTP', { timeout: STEP_TIMEOUT }, async () => {
    const res = await request('POST', '/api/pipeline/6', { sessionId: sid });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.result.length > 200);
    console.log(`    ✓ Thumbnails: ${res.body.data.result.length} chars`);
  });

  it('Step 7: Generate real audio brief via HTTP', { timeout: STEP_TIMEOUT }, async () => {
    const res = await request('POST', '/api/pipeline/7', { sessionId: sid });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.result.length > 200);
    console.log(`    ✓ Audio Brief: ${res.body.data.result.length} chars`);
  });

  it('Export full package as markdown', async () => {
    const res = await request('GET', `/api/export/${sid}`);

    assert.equal(res.status, 200);
    assert.equal(typeof res.body, 'string', 'export should be raw markdown string');
    assert.ok(res.body.includes('# TrendVideo'), 'should have title');
    assert.ok(res.body.includes('## 1. Channel Analysis'), 'should have all sections');
    assert.ok(res.body.includes('## 7. Audio Brief'), 'should include last step');
    console.log(`    ✓ Exported package: ${res.body.length} chars`);
  });

  it('Verify session state after full pipeline', async () => {
    const res = await request('GET', `/api/session/${sid}`);

    assert.equal(res.status, 200);
    const session = res.body.data;

    assert.ok(session.results.analysis, 'analysis populated');
    assert.ok(session.results.channelNames, 'channelNames populated');
    assert.ok(session.results.videoIdeas, 'videoIdeas populated');
    assert.ok(session.results.script, 'script populated');
    assert.ok(session.results.titles, 'titles populated');
    assert.ok(session.results.thumbnails, 'thumbnails populated');
    assert.ok(session.results.audioBrief, 'audioBrief populated');
    assert.ok(session.currentStep >= 7, 'currentStep should be 7');

    const totalAI = Object.values(session.results).reduce((s, v) => s + (v?.length || 0), 0);
    console.log(`    ✓ Full session verified. Total AI content: ${totalAI.toLocaleString()} chars across 7 steps`);
  });
});

describe('E2E: Error Paths via HTTP', () => {
  it('rejects pipeline call with missing session', async () => {
    const res = await request('POST', '/api/pipeline/1', { sessionId: 'nonexistent' });
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('Session not found'));
  });

  it('rejects step 2 when step 1 not done', async () => {
    const create = await request('POST', '/api/session');
    const sid = create.body.data.id;
    // Add fake videos so step 1 dependency check passes, but skip running step 1
    const res = await request('POST', '/api/pipeline/2', { sessionId: sid });
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('Step 1'));
  });
});
