const { google } = require('googleapis');
const config = require('../config');

class YouTubeService {
  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY;
    this.youtube = this.apiKey
      ? google.youtube({ version: 'v3', auth: this.apiKey })
      : null;
  }

  fetchWithTimeout(url, options = {}, timeoutMs = config.youtube.fetchTimeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }

  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  extractChannelIdentifier(url) {
    const patterns = [
      { regex: /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/, type: 'id' },
      { regex: /youtube\.com\/@([a-zA-Z0-9_.-]+)/, type: 'handle' },
      { regex: /youtube\.com\/c\/([a-zA-Z0-9_.-]+)/, type: 'custom' },
      { regex: /youtube\.com\/user\/([a-zA-Z0-9_.-]+)/, type: 'user' },
    ];
    for (const { regex, type } of patterns) {
      const match = url.match(regex);
      if (match) return { value: match[1], type };
    }
    return null;
  }

  async resolveChannelId(identifier) {
    if (!this.youtube) throw new Error('YouTube API key not configured. Use the "Video URLs" tab instead.');
    if (identifier.type === 'id') return identifier.value;

    try {
      if (identifier.type === 'handle') {
        const response = await this.youtube.channels.list({ part: 'id,snippet', forHandle: identifier.value });
        if (response.data.items?.length > 0) return response.data.items[0].id;
      } else if (identifier.type === 'user') {
        const response = await this.youtube.channels.list({ part: 'id,snippet', forUsername: identifier.value });
        if (response.data.items?.length > 0) return response.data.items[0].id;
      }

      const searchResponse = await this.youtube.search.list({ part: 'snippet', q: identifier.value, type: 'channel', maxResults: 1 });
      if (searchResponse.data.items?.length > 0) return searchResponse.data.items[0].snippet.channelId;

      throw new Error(`Could not resolve channel: ${identifier.value}`);
    } catch (err) {
      if (err.message.includes('Could not resolve')) throw err;
      throw new Error(`YouTube API error: ${err.message}`);
    }
  }

  async getTopVideos(channelUrl, maxVideos = config.youtube.maxTopVideos) {
    const identifier = this.extractChannelIdentifier(channelUrl);
    if (!identifier) throw new Error('Invalid channel URL format. Use formats like youtube.com/@handle or youtube.com/channel/ID');

    const channelId = await this.resolveChannelId(identifier);
    const channelResponse = await this.youtube.channels.list({ part: 'snippet,contentDetails', id: channelId });
    const channel = channelResponse.data.items?.[0];
    if (!channel) throw new Error('Channel not found');

    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;
    let allVideos = [];
    let nextPageToken = undefined;

    do {
      const params = { part: 'snippet,contentDetails', playlistId: uploadsPlaylistId, maxResults: config.youtube.playlistPageSize };
      if (nextPageToken) params.pageToken = nextPageToken;

      const playlistResponse = await this.youtube.playlistItems.list(params);
      const videoIds = playlistResponse.data.items.map(item => item.contentDetails.videoId);
      const statsResponse = await this.youtube.videos.list({ part: 'statistics,snippet,contentDetails', id: videoIds.join(',') });

      const videos = statsResponse.data.items.map(video => ({
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description?.substring(0, config.youtube.descriptionMaxChars),
        publishedAt: video.snippet.publishedAt,
        viewCount: parseInt(video.statistics.viewCount || '0'),
        likeCount: parseInt(video.statistics.likeCount || '0'),
        commentCount: parseInt(video.statistics.commentCount || '0'),
        duration: video.contentDetails.duration,
        url: `https://www.youtube.com/watch?v=${video.id}`,
      }));

      allVideos.push(...videos);
      nextPageToken = playlistResponse.data.nextPageToken;
    } while (nextPageToken && allVideos.length < config.youtube.maxPlaylistPages);

    allVideos.sort((a, b) => b.viewCount - a.viewCount);

    return {
      channel: {
        name: channel.snippet.title,
        description: channel.snippet.description?.substring(0, config.youtube.channelDescriptionMaxChars),
        id: channelId,
      },
      videos: allVideos.slice(0, maxVideos),
    };
  }

  async getVideoDetails(videoUrls) {
    const videos = [];
    for (const url of videoUrls) {
      const videoId = this.extractVideoId(url.trim());
      if (!videoId) continue;

      let details = { id: videoId, url: url.trim(), title: '', description: '' };

      if (this.youtube) {
        try {
          const response = await this.youtube.videos.list({ part: 'snippet,statistics,contentDetails', id: videoId });
          const video = response.data.items?.[0];
          if (video) {
            details = {
              ...details,
              title: video.snippet.title,
              description: video.snippet.description?.substring(0, config.youtube.descriptionMaxChars),
              viewCount: parseInt(video.statistics.viewCount || '0'),
              likeCount: parseInt(video.statistics.likeCount || '0'),
              duration: video.contentDetails.duration,
            };
          }
        } catch (err) {
          console.warn(`Could not fetch details for ${videoId}:`, err.message);
        }
      }

      if (!details.title) details.title = `Video ${videoId}`;
      videos.push(details);
    }
    return videos;
  }

  parsePlayerResponseJSON(html) {
    const marker = 'var ytInitialPlayerResponse = ';
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) return null;

    const jsonStart = startIdx + marker.length;
    let depth = 0;
    let i = jsonStart;

    for (; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }

    if (depth !== 0) return null;

    try {
      return JSON.parse(html.slice(jsonStart, i + 1));
    } catch {
      return null;
    }
  }

  async getTranscript(videoId) {
    try {
      const pageResponse = await this.fetchWithTimeout(
        `https://www.youtube.com/watch?v=${videoId}`,
        { headers: { 'User-Agent': config.youtube.userAgent } }
      );
      const html = await pageResponse.text();
      const playerData = this.parsePlayerResponseJSON(html);
      if (!playerData) return null;

      const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!Array.isArray(tracks) || tracks.length === 0) return null;

      const track = tracks.find(t => t.languageCode === config.youtube.defaultTranscriptLanguage) || tracks[0];
      const captionResponse = await this.fetchWithTimeout(track.baseUrl, { headers: { 'User-Agent': config.youtube.userAgent } });
      const xml = await captionResponse.text();

      const textRegex = /<text[^>]*>([^<]*)<\/text>/g;
      const segments = [];
      let match;
      while ((match = textRegex.exec(xml)) !== null) {
        const text = match[1]
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
          .trim();
        if (text) segments.push(text);
      }

      return segments.length > 0 ? segments.join(' ') : null;
    } catch (err) {
      const reason = err.name === 'AbortError' ? 'timed out' : err.message;
      console.warn(`Transcript unavailable for ${videoId}: ${reason}`);
      return null;
    }
  }

  async getVideoCategories(regionCode = config.trending.defaultRegion) {
    if (!this.youtube) throw new Error('YouTube API key required for trending. Add YOUTUBE_API_KEY to your .env file.');

    const response = await this.youtube.videoCategories.list({
      part: 'snippet',
      regionCode,
    });

    return (response.data.items || [])
      .filter(cat => cat.snippet.assignable)
      .map(cat => ({ id: cat.id, title: cat.snippet.title }));
  }

  async getTrendingVideos(options = {}) {
    if (!this.youtube) throw new Error('YouTube API key required for trending. Add YOUTUBE_API_KEY to your .env file.');

    const regionCode = options.regionCode || config.trending.defaultRegion;
    const maxResults = Math.min(options.maxResults || config.trending.defaultMaxResults, config.trending.maxAllowed);

    const params = {
      part: 'snippet,statistics,contentDetails',
      chart: 'mostPopular',
      regionCode,
      maxResults,
    };
    if (options.categoryId) params.videoCategoryId = options.categoryId;

    let response;
    try {
      response = await this.youtube.videos.list(params);
    } catch (err) {
      if (err.message.includes('not found') || err.code === 404) {
        return { videos: [], regionCode, categoryId: options.categoryId || null, total: 0 };
      }
      throw new Error(`YouTube API error: ${err.message}`);
    }
    const videos = (response.data.items || []).map(video => ({
      id: video.id,
      title: video.snippet.title,
      channelTitle: video.snippet.channelTitle,
      description: video.snippet.description?.substring(0, config.youtube.descriptionMaxChars),
      publishedAt: video.snippet.publishedAt,
      viewCount: parseInt(video.statistics.viewCount || '0'),
      likeCount: parseInt(video.statistics.likeCount || '0'),
      commentCount: parseInt(video.statistics.commentCount || '0'),
      duration: video.contentDetails.duration,
      thumbnailUrl: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
      url: `https://www.youtube.com/watch?v=${video.id}`,
    }));

    return { videos, regionCode, categoryId: options.categoryId || null, total: videos.length };
  }

  async getTranscriptsForVideos(videos, maxTranscripts = config.youtube.maxTranscriptsPerBatch) {
    const results = [];
    const batch = videos.slice(0, maxTranscripts);

    for (const video of batch) {
      const transcript = await this.getTranscript(video.id);
      results.push({ videoId: video.id, title: video.title, transcript, hasTranscript: !!transcript });
    }

    return results;
  }
}

module.exports = new YouTubeService();
