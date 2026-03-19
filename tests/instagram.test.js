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

describe('Instagram Service', () => {
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

  it('GET /api/instagram/status should report configured=false when no tokens', async () => {
    const res = await api('GET', '/api/instagram/status');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.configured, false);
  });

  it('POST /api/instagram/publish should fail gracefully without config', async () => {
    const res = await api('POST', '/api/instagram/publish', {
      videoUrl: 'https://example.com/video.mp4',
      caption: 'Test caption',
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('not configured') || res.error.includes('INSTAGRAM'));
  });

  it('POST /api/instagram/publish should require videoUrl or sessionId', async () => {
    const res = await api('POST', '/api/instagram/publish', { caption: 'No video' });
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('videoUrl') || res.error.includes('sessionId'));
  });

  it('POST /api/session/platform should switch to instagram', async () => {
    const sessionRes = await api('POST', '/api/session');
    const res = await api('POST', '/api/session/platform', {
      sessionId: sessionRes.data.id,
      platform: 'instagram',
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.platform, 'instagram');
  });

  it('POST /api/session/platform should reject invalid platform', async () => {
    const sessionRes = await api('POST', '/api/session');
    const res = await api('POST', '/api/session/platform', {
      sessionId: sessionRes.data.id,
      platform: 'tiktok',
    });
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('youtube or instagram'));
  });

  it('POST /api/session/platform should switch back to youtube', async () => {
    const sessionRes = await api('POST', '/api/session');
    await api('POST', '/api/session/platform', { sessionId: sessionRes.data.id, platform: 'instagram' });
    const res = await api('POST', '/api/session/platform', {
      sessionId: sessionRes.data.id,
      platform: 'youtube',
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.data.platform, 'youtube');
  });
});
