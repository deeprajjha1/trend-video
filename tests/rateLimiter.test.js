const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

const ORIGINAL_ENV = { ...process.env };
process.env.YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'test';

let rateLimiter;

describe('RateLimiter', () => {
  beforeEach(() => {
    delete require.cache[require.resolve('../src/services/rateLimiter')];
    delete require.cache[require.resolve('../src/config')];
    rateLimiter = require('../src/services/rateLimiter');
    rateLimiter.buckets.clear();
  });

  it('should allow requests within limits', async () => {
    const acquired = await rateLimiter.acquire('ollama');
    assert.strictEqual(acquired, true);
  });

  it('should track remaining tokens', async () => {
    await rateLimiter.acquire('ollama');
    const status = rateLimiter.getStatus('ollama');
    assert.strictEqual(status.remaining, 99); // 100 max - 1 used
  });

  it('should track daily counts', async () => {
    await rateLimiter.acquire('googleTrends');
    const status = rateLimiter.getStatus('googleTrends');
    assert.strictEqual(status.dailyRemaining, 999); // 1000 - 1
  });

  it('should throw on unknown service', async () => {
    await assert.rejects(
      () => rateLimiter.acquire('nonexistent'),
      { message: /No rate limit config/ }
    );
  });

  it('should respect custom cost parameter', async () => {
    await rateLimiter.acquire('youtube', 5);
    const status = rateLimiter.getStatus('youtube');
    assert.strictEqual(status.remaining, 45); // 50 - 5
    assert.strictEqual(status.dailyRemaining, 9495); // 9500 - 5
  });

  it('should throw when daily limit exceeded', async () => {
    const bucket = rateLimiter._getBucket('instagram');
    bucket.dailyCount = 199;

    await assert.rejects(
      () => rateLimiter.acquire('instagram', 2),
      { message: /Daily rate limit exceeded/ }
    );
  });

  it('should return status for all services', () => {
    const all = rateLimiter.getAllStatus();
    assert.ok(all.youtube);
    assert.ok(all.googleTrends);
    assert.ok(all.instagram);
    assert.ok(all.openai);
    assert.ok(all.ollama);
    assert.ok(typeof all.youtube.remaining === 'number');
  });

  it('should refill tokens after window expires', async () => {
    await rateLimiter.acquire('ollama');
    const bucket = rateLimiter._getBucket('ollama');
    bucket.lastRefill = Date.now() - 120000; // simulate 2 minutes ago

    rateLimiter._refill(bucket);
    assert.strictEqual(bucket.tokens, 100); // fully refilled
  });

  it('should reset daily count at midnight', () => {
    const bucket = rateLimiter._getBucket('googleTrends');
    bucket.dailyCount = 500;
    bucket.dailyReset = Date.now() - 1000; // simulate past midnight

    rateLimiter._refill(bucket);
    assert.strictEqual(bucket.dailyCount, 0);
  });
});
