const googleTrends = require('google-trends-api');
const { google } = require('googleapis');
const config = require('../config');
const rateLimiter = require('./rateLimiter');

class ResearchService {
  constructor() {
    this.youtube = process.env.YOUTUBE_API_KEY
      ? google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY })
      : null;
  }

  async validateIdea(topic, geo) {
    const [trends, searchData] = await Promise.allSettled([
      this.getTrendScore(topic, geo),
      this.getSearchVolume(topic),
    ]);

    const trendResult = trends.status === 'fulfilled' ? trends.value : { score: 50, status: 'unavailable' };
    const searchResult = searchData.status === 'fulfilled' ? searchData.value : { volume: 'unknown', competition: 'unknown' };

    const weights = config.research.ideaScoreWeights;
    const overallScore = Math.round(
      (trendResult.score * weights.trendScore) +
      (searchResult.volumeScore || 50) * weights.searchVolume +
      (searchResult.competitionScore || 50) * weights.competition +
      (trendResult.freshness || 50) * weights.freshness
    );

    return {
      topic,
      overallScore,
      viable: overallScore >= config.research.minViableScore,
      trends: trendResult,
      search: searchResult,
      recommendation: this._getRecommendation(overallScore, trendResult, searchResult),
    };
  }

  async getTrendScore(keyword, geo) {
    await rateLimiter.acquire('googleTrends');

    const regionCode = geo || config.research.trendsGeo;

    try {
      const interestData = await googleTrends.interestOverTime({
        keyword,
        startTime: this._monthsAgo(3),
        geo: regionCode,
      });

      const parsed = JSON.parse(interestData);
      const timeline = parsed.default?.timelineData || [];

      if (timeline.length === 0) {
        return { score: 30, trend: 'no_data', freshness: 30, status: 'no_data' };
      }

      const values = timeline.map(t => t.value[0]);
      const recent = values.slice(-4);
      const older = values.slice(0, Math.max(1, values.length - 4));
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

      const score = Math.min(100, Math.round(recentAvg));
      const momentum = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

      let trend = 'stable';
      if (momentum > 20) trend = 'rising';
      else if (momentum > 50) trend = 'surging';
      else if (momentum < -20) trend = 'declining';

      const peak = Math.max(...values);
      const freshness = peak > 0 ? Math.round((recentAvg / peak) * 100) : 50;

      return { score, trend, momentum: Math.round(momentum), freshness, peak, recentAvg: Math.round(recentAvg), status: 'ok' };
    } catch (err) {
      return { score: 50, trend: 'unknown', freshness: 50, status: 'error', error: err.message };
    }
  }

  async getRelatedTopics(keyword, geo) {
    await rateLimiter.acquire('googleTrends');

    try {
      const data = await googleTrends.relatedQueries({
        keyword,
        startTime: this._monthsAgo(3),
        geo: geo || config.research.trendsGeo,
      });

      const parsed = JSON.parse(data);
      const top = (parsed.default?.rankedList?.[0]?.rankedKeyword || [])
        .slice(0, 10)
        .map(k => ({ query: k.query, value: k.value }));
      const rising = (parsed.default?.rankedList?.[1]?.rankedKeyword || [])
        .slice(0, 10)
        .map(k => ({ query: k.query, value: k.formattedValue }));

      return { top, rising };
    } catch {
      return { top: [], rising: [] };
    }
  }

  async getSearchVolume(topic) {
    if (!this.youtube) {
      return { volume: 'unknown', volumeScore: 50, competition: 'unknown', competitionScore: 50 };
    }

    await rateLimiter.acquire('youtube', 100);

    try {
      const response = await this.youtube.search.list({
        part: 'snippet',
        q: topic,
        type: 'video',
        maxResults: config.research.searchMaxResults,
        order: 'viewCount',
      });

      const totalResults = response.data.pageInfo?.totalResults || 0;
      const items = response.data.items || [];

      let volume, volumeScore;
      if (totalResults > 1_000_000) { volume = 'very_high'; volumeScore = 95; }
      else if (totalResults > 100_000) { volume = 'high'; volumeScore = 80; }
      else if (totalResults > 10_000) { volume = 'medium'; volumeScore = 60; }
      else if (totalResults > 1_000) { volume = 'low'; volumeScore = 40; }
      else { volume = 'very_low'; volumeScore = 20; }

      const topVideoAge = items[0]?.snippet?.publishedAt
        ? Math.floor((Date.now() - new Date(items[0].snippet.publishedAt).getTime()) / 86400000)
        : null;

      let competition, competitionScore;
      if (totalResults > 500_000) { competition = 'very_high'; competitionScore = 20; }
      else if (totalResults > 100_000) { competition = 'high'; competitionScore = 35; }
      else if (totalResults > 10_000) { competition = 'medium'; competitionScore = 60; }
      else if (totalResults > 1_000) { competition = 'low'; competitionScore = 80; }
      else { competition = 'very_low'; competitionScore = 95; }

      return {
        volume, volumeScore, competition, competitionScore,
        totalResults, topVideoAge,
        topVideos: items.slice(0, 3).map(v => ({
          title: v.snippet.title,
          channel: v.snippet.channelTitle,
          published: v.snippet.publishedAt,
        })),
      };
    } catch (err) {
      return { volume: 'unknown', volumeScore: 50, competition: 'unknown', competitionScore: 50, error: err.message };
    }
  }

  async batchValidate(ideas, geo) {
    const results = [];
    for (const idea of ideas) {
      const topic = typeof idea === 'string' ? idea : idea.title || idea.topic;
      if (!topic) continue;
      const validation = await this.validateIdea(topic, geo);
      results.push(validation);
      await new Promise(r => setTimeout(r, 1500));
    }
    return results.sort((a, b) => b.overallScore - a.overallScore);
  }

  _getRecommendation(score, trends, search) {
    if (score >= 75) return 'Strong opportunity — high demand, trending topic. Prioritize this idea.';
    if (score >= 60) return 'Good potential — decent interest and manageable competition. Worth pursuing.';
    if (score >= 40) return 'Moderate opportunity — consider refining the angle or niche down.';
    if (trends.trend === 'declining') return 'Declining interest — consider a fresh angle or different topic.';
    if (search.competition === 'very_high') return 'Oversaturated topic — find a unique sub-niche to stand out.';
    return 'Weak opportunity — low demand or high competition. Consider alternative topics.';
  }

  _monthsAgo(n) {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    return d;
  }
}

module.exports = new ResearchService();
