const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');

let server;
let BASE;

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  return res.json();
}

describe('Autopilot & Reel Pipeline', () => {
  before(async () => {
    delete require.cache[require.resolve('../server')];
    const app = require('../server');
    await new Promise((resolve, reject) => {
      server = app.listen(0, () => {
        BASE = `http://localhost:${server.address().port}`;
        resolve();
      });
      server.on('error', reject);
    });
  });

  after((_, done) => {
    if (server) server.close(done); else done();
  });

  it('POST /api/autopilot should reject empty selectedVideos', async () => {
    const res = await fetch(`${BASE}/api/autopilot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedVideos: [], voice: 'male-us' }),
    });
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('Select at least one'));
  });

  it('POST /api/autopilot should start SSE stream with valid input', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${BASE}/api/autopilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedVideos: [{
            id: 'test123',
            title: 'Test Video',
            channelTitle: 'TestChannel',
            url: 'https://www.youtube.com/watch?v=test123',
            viewCount: 1000,
          }],
          voice: 'male-us',
          colorScheme: 0,
        }),
        signal: controller.signal,
      });

      assert.strictEqual(res.headers.get('content-type'), 'text/event-stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const { value } = await reader.read();
      const text = decoder.decode(value);

      assert.ok(text.includes('data:'), 'should contain SSE data events');
      const firstEvent = JSON.parse(text.split('data: ')[1].split('\n')[0]);
      assert.strictEqual(firstEvent.status, 'running');
      assert.strictEqual(firstEvent.totalVideos, 1);

      reader.cancel();
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
    } finally {
      clearTimeout(timeout);
    }
  });

  it('GET /api/autopilot/:jobId should return 404 for unknown job', async () => {
    const res = await api('GET', '/api/autopilot/nonexistent-id');
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('not found'));
  });

  it('POST /api/pipeline/reel-script should generate a short-form script', { timeout: 120000 }, async (t) => {
    const sessionRes = await api('POST', '/api/session');
    const sessionId = sessionRes.data.id;

    await api('POST', '/api/fetch-videos', {
      sessionId,
      trendingVideos: [{
        id: 'reel-test',
        title: 'Reel Test Video',
        channelTitle: 'TestChannel',
        url: 'https://www.youtube.com/watch?v=reeltest',
        viewCount: 5000,
      }],
    });
    await api('POST', '/api/fetch-transcripts', { sessionId });
    const step1 = await api('POST', '/api/pipeline/1', { sessionId });
    if (!step1.success) {
      t.skip('AI provider not available (requires Ollama or valid OpenAI key)');
      return;
    }

    const reelScript = await api('POST', '/api/pipeline/reel-script', {
      sessionId,
      videoIdea: 'Top 3 AI tools that will change your life',
    });
    assert.strictEqual(reelScript.success, true);
    assert.ok(reelScript.data.result.length > 20, 'script should have content');
  });

  it('POST /api/pipeline/reel-script should fail without analysis', async () => {
    const sessionRes = await api('POST', '/api/session');
    const res = await api('POST', '/api/pipeline/reel-script', {
      sessionId: sessionRes.data.id,
      videoIdea: 'test idea',
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('must be completed') || res.error.includes('Analysis'));
  });
});
