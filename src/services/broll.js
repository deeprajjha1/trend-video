const fs = require('fs');
const path = require('path');
const config = require('../config');

class BRollService {
  constructor() {
    this.apiKey = process.env.PEXELS_API_KEY;
  }

  extractKeywords(script) {
    const strippedScript = script
      .replace(/\[.*?\]/g, '')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*/g, '');

    const visualNotes = script.match(/\[VISUAL[:\s]+(.*?)\]/gi) || [];
    const keywords = visualNotes.map(note =>
      note.replace(/\[VISUAL[:\s]+/i, '').replace(']', '').trim()
    );

    if (keywords.length < config.broll.minKeywords) {
      const lowercaseScript = strippedScript.toLowerCase();
      for (const topic of config.broll.topicKeywords) {
        if (lowercaseScript.includes(topic.split(' ')[0]) && keywords.length < 6) {
          keywords.push(topic);
        }
      }
    }

    if (keywords.length < config.broll.minKeywords) {
      keywords.push(...config.broll.fallbackKeywords);
    }

    return [...new Set(keywords)].slice(0, config.broll.maxKeywords);
  }

  async searchVideos(query, perPage = config.broll.searchResultsPerKeyword) {
    if (!this.apiKey) throw new Error('PEXELS_API_KEY not set. Add a free key from pexels.com/api to .env');

    const url = `${config.broll.pexelsApiUrl}?query=${encodeURIComponent(query)}&per_page=${perPage}&size=medium&orientation=landscape`;
    const response = await fetch(url, { headers: { Authorization: this.apiKey } });

    if (!response.ok) throw new Error(`Pexels API error: ${response.status}`);
    const data = await response.json();

    return (data.videos || []).map(videoResult => {
      const file = videoResult.video_files
        .filter(f => f.quality === 'sd' || f.quality === 'hd')
        .sort((a, b) => (a.width || 0) - (b.width || 0))[0];
      return {
        id: videoResult.id,
        url: file?.link,
        width: file?.width,
        height: file?.height,
        duration: videoResult.duration,
        photographer: videoResult.user?.name,
      };
    }).filter(v => v.url);
  }

  async downloadClip(videoUrl, outputPath) {
    const response = await fetch(videoUrl);
    if (!response.ok) throw new Error(`Failed to download clip: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    return { path: outputPath, size: buffer.length };
  }

  async generate(script, outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    const keywords = this.extractKeywords(script);
    const clips = [];
    const downloadedVideoIds = new Set();

    for (const keyword of keywords) {
      try {
        const results = await this.searchVideos(keyword);
        for (const videoResult of results) {
          if (downloadedVideoIds.has(videoResult.id)) continue;
          downloadedVideoIds.add(videoResult.id);

          const filename = `clip-${String(clips.length + 1).padStart(3, '0')}.mp4`;
          const clipPath = path.join(outputDir, filename);

          await this.downloadClip(videoResult.url, clipPath);
          clips.push({
            path: clipPath,
            keyword,
            duration: videoResult.duration,
            credit: videoResult.photographer,
          });

          if (clips.length >= config.broll.maxClips) break;
        }
      } catch (err) {
        console.warn(`B-roll search for "${keyword}" failed: ${err.message}`);
      }
      if (clips.length >= config.broll.maxClips) break;
    }

    return {
      clips,
      keywords,
      totalClips: clips.length,
      credits: clips.map(c => c.credit).filter(Boolean),
    };
  }
}

module.exports = new BRollService();
