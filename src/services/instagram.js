const config = require('../config');
const rateLimiter = require('./rateLimiter');

class InstagramService {
  constructor() {
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    this.accountId = process.env.INSTAGRAM_ACCOUNT_ID;
    this.baseUrl = config.instagram.graphApiBase;
  }

  isConfigured() {
    return !!(this.accessToken && this.accountId);
  }

  async publishReel(videoUrl, caption, options = {}) {
    if (!this.isConfigured()) {
      throw new Error(
        'Instagram not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID in .env. ' +
        'Get these from https://developers.facebook.com → Meta Graph API Explorer.'
      );
    }

    await rateLimiter.acquire('instagram');

    const containerId = await this._createMediaContainer(videoUrl, caption, options);
    await this._waitForProcessing(containerId);
    const publishedId = await this._publishContainer(containerId);

    return {
      id: publishedId,
      status: 'published',
      url: `https://www.instagram.com/reel/${publishedId}/`,
      caption: caption.substring(0, 100) + (caption.length > 100 ? '...' : ''),
    };
  }

  async _createMediaContainer(videoUrl, caption, options = {}) {
    await rateLimiter.acquire('instagram');

    const params = new URLSearchParams({
      media_type: 'REELS',
      video_url: videoUrl,
      caption,
      access_token: this.accessToken,
    });

    if (options.coverUrl) params.set('cover_url', options.coverUrl);
    if (options.thumbOffset != null) params.set('thumb_offset', String(options.thumbOffset));
    if (options.shareToFeed !== false) params.set('share_to_feed', 'true');

    const res = await fetch(`${this.baseUrl}/${this.accountId}/media`, {
      method: 'POST',
      body: params,
    });

    const data = await res.json();
    if (data.error) throw new Error(`Instagram API: ${data.error.message}`);
    return data.id;
  }

  async _waitForProcessing(containerId) {
    const { publishCheckIntervalMs, publishMaxWaitMs } = config.instagram;
    const start = Date.now();

    while (Date.now() - start < publishMaxWaitMs) {
      await rateLimiter.acquire('instagram');

      const res = await fetch(
        `${this.baseUrl}/${containerId}?fields=status_code,status&access_token=${this.accessToken}`
      );
      const data = await res.json();

      if (data.status_code === 'FINISHED') return;
      if (data.status_code === 'ERROR') {
        throw new Error(`Instagram processing failed: ${data.status || 'Unknown error'}`);
      }

      await new Promise(r => setTimeout(r, publishCheckIntervalMs));
    }

    throw new Error('Instagram Reel processing timed out. The video may still be processing — check Instagram manually.');
  }

  async _publishContainer(containerId) {
    await rateLimiter.acquire('instagram');

    const params = new URLSearchParams({
      creation_id: containerId,
      access_token: this.accessToken,
    });

    const res = await fetch(`${this.baseUrl}/${this.accountId}/media_publish`, {
      method: 'POST',
      body: params,
    });

    const data = await res.json();
    if (data.error) throw new Error(`Instagram publish failed: ${data.error.message}`);
    return data.id;
  }

  async getAccountInfo() {
    if (!this.isConfigured()) return null;

    await rateLimiter.acquire('instagram');

    const res = await fetch(
      `${this.baseUrl}/${this.accountId}?fields=username,name,media_count,followers_count&access_token=${this.accessToken}`
    );
    const data = await res.json();
    if (data.error) throw new Error(`Instagram API: ${data.error.message}`);
    return data;
  }

  async getRecentMedia(limit = 10) {
    if (!this.isConfigured()) return [];

    await rateLimiter.acquire('instagram');

    const res = await fetch(
      `${this.baseUrl}/${this.accountId}/media?fields=id,caption,media_type,media_url,timestamp,like_count,comments_count&limit=${limit}&access_token=${this.accessToken}`
    );
    const data = await res.json();
    if (data.error) throw new Error(`Instagram API: ${data.error.message}`);
    return data.data || [];
  }
}

module.exports = new InstagramService();
