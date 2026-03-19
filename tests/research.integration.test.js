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

describe('Research Service Integration', () => {
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

  it('GET /api/research/trends should return trend score for a keyword', async () => {
    const res = await api('GET', '/api/research/trends?keyword=artificial+intelligence');
    assert.strictEqual(res.success, true);
    assert.ok(typeof res.data.score === 'number');
    assert.ok(res.data.status);
  });

  it('GET /api/research/trends should handle unknown keywords', async () => {
    const res = await api('GET', '/api/research/trends?keyword=xyznonexistent12345');
    assert.strictEqual(res.success, true);
    assert.ok(typeof res.data.score === 'number');
  });

  it('GET /api/research/trends should require keyword', async () => {
    const res = await api('GET', '/api/research/trends');
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('keyword'));
  });

  it('GET /api/research/related should return related queries', async () => {
    const res = await api('GET', '/api/research/related?keyword=python+programming');
    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data.top));
    assert.ok(Array.isArray(res.data.rising));
  });

  it('POST /api/research/validate should score a topic', async () => {
    const res = await api('POST', '/api/research/validate', { topic: 'machine learning tutorial', geo: 'US' });
    assert.strictEqual(res.success, true);
    assert.ok(typeof res.data.overallScore === 'number');
    assert.ok(typeof res.data.viable === 'boolean');
    assert.ok(res.data.recommendation);
    assert.ok(res.data.trends);
    assert.ok(res.data.search);
  });

  it('POST /api/research/validate should require topic', async () => {
    const res = await api('POST', '/api/research/validate', {});
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('topic'));
  });

  it('GET /api/rate-limits should show all API statuses', async () => {
    const res = await api('GET', '/api/rate-limits');
    assert.strictEqual(res.success, true);
    assert.ok(res.data.youtube);
    assert.ok(res.data.googleTrends);
    assert.ok(res.data.instagram);
    assert.ok(typeof res.data.googleTrends.remaining === 'number');
  });
});
