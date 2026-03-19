const config = require('../config');

class RateLimiter {
  constructor() {
    this.buckets = new Map();
  }

  _getBucket(service) {
    if (!this.buckets.has(service)) {
      const limits = config.rateLimits[service];
      if (!limits) throw new Error(`No rate limit config for service: ${service}`);
      this.buckets.set(service, {
        tokens: limits.maxRequests,
        maxTokens: limits.maxRequests,
        windowMs: limits.windowMs,
        lastRefill: Date.now(),
        queue: [],
        dailyCount: 0,
        dailyMax: limits.dailyMax || Infinity,
        dailyReset: this._startOfNextDay(),
      });
    }
    return this.buckets.get(service);
  }

  _startOfNextDay() {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }

  _refill(bucket) {
    const now = Date.now();
    if (now >= bucket.dailyReset) {
      bucket.dailyCount = 0;
      bucket.dailyReset = this._startOfNextDay();
    }
    const elapsed = now - bucket.lastRefill;
    if (elapsed >= bucket.windowMs) {
      bucket.tokens = bucket.maxTokens;
      bucket.lastRefill = now;
    }
  }

  async acquire(service, cost = 1) {
    const bucket = this._getBucket(service);
    this._refill(bucket);

    if (bucket.dailyCount + cost > bucket.dailyMax) {
      throw new Error(`Daily rate limit exceeded for ${service}. Resets at midnight.`);
    }

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      bucket.dailyCount += cost;
      return true;
    }

    const waitMs = bucket.windowMs - (Date.now() - bucket.lastRefill);
    await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 60000)));
    this._refill(bucket);

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      bucket.dailyCount += cost;
      return true;
    }

    throw new Error(`Rate limit exceeded for ${service}. Try again in ${Math.ceil(waitMs / 1000)}s.`);
  }

  getStatus(service) {
    if (!this.buckets.has(service)) {
      const limits = config.rateLimits[service];
      if (!limits) return null;
      return { remaining: limits.maxRequests, dailyRemaining: limits.dailyMax || Infinity };
    }
    const bucket = this._getBucket(service);
    this._refill(bucket);
    return {
      remaining: bucket.tokens,
      dailyRemaining: bucket.dailyMax - bucket.dailyCount,
      resetsIn: Math.max(0, bucket.windowMs - (Date.now() - bucket.lastRefill)),
    };
  }

  getAllStatus() {
    const result = {};
    for (const service of Object.keys(config.rateLimits)) {
      result[service] = this.getStatus(service);
    }
    return result;
  }
}

module.exports = new RateLimiter();
