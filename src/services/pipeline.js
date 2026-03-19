const { v4: uuid } = require('uuid');
const path = require('path');
const fs = require('fs');
const ai = require('./ai');
const voiceover = require('./voiceover');
const thumbnail = require('./thumbnail');
const broll = require('./broll');
const frames = require('./frames');
const video = require('./video');
const research = require('./research');

const config = require('../config');
const OUTPUT_BASE = path.join(__dirname, '..', '..', 'output');

class PipelineService {
  constructor() {
    this.sessions = new Map();
  }

  getOutputDir(sessionId) {
    const dir = path.join(OUTPUT_BASE, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  createSession() {
    const id = uuid();
    const session = {
      id,
      createdAt: new Date().toISOString(),
      currentStep: 0,
      input: { channelInfo: null, videos: [], transcripts: [] },
      results: {
        analysis: null,
        channelNames: null,
        videoIdeas: null,
        script: null,
        titles: null,
        thumbnails: null,
        audioBrief: null
      },
      production: {
        voiceover: null,
        thumbnail: null,
        broll: null,
        frames: null,
        video: null,
        reel: null,
      },
      selectedVideoIdea: null,
      platform: 'youtube',
      research: null
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id) {
    return this.sessions.get(id) || null;
  }

  buildSourceContext(session) {
    const { channelInfo, videos, transcripts } = session.input;

    const channelStr = channelInfo
      ? `Channel: ${channelInfo.name}\nDescription: ${channelInfo.description || 'N/A'}`
      : 'Channel info not available';

    const videoStr = videos.map((v, i) =>
      `${i + 1}. "${v.title}" — ${v.viewCount?.toLocaleString() || '?'} views | ${v.likeCount?.toLocaleString() || '?'} likes\n   URL: ${v.url}\n   Description: ${v.description || 'N/A'}`
    ).join('\n\n');

    let transcriptStr = '';
    let totalChars = 0;
    const available = transcripts.filter(t => t.hasTranscript);
    for (const t of available) {
      const block = `--- Transcript: "${t.title}" ---\n${t.transcript}`;
      if (totalChars + block.length > config.pipeline.maxTranscriptChars) {
        const remaining = config.pipeline.maxTranscriptChars - totalChars;
        if (remaining > 500) {
          transcriptStr += `\n\n${block.substring(0, remaining)}\n[...truncated for length]`;
        }
        break;
      }
      transcriptStr += (transcriptStr ? '\n\n' : '') + block;
      totalChars += block.length;
    }

    return { channelStr, videoStr, transcriptStr };
  }

  async runStep(sessionId, step, options = {}) {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const stepHandlers = {
      1: () => this.stepAnalyze(session),
      2: () => this.stepChannelNames(session),
      3: () => this.stepVideoIdeas(session),
      4: () => this.stepScriptWriter(session, options),
      5: () => this.stepTitleMaker(session),
      6: () => this.stepThumbnailPlanner(session),
      7: () => this.stepAudioBrief(session),
      8: () => this.stepVoiceover(session, options),
      9: () => this.stepThumbnailImage(session, options),
      10: () => this.stepBRoll(session),
      11: () => this.stepVideoAssembly(session, options),
    };

    const handler = stepHandlers[step];
    if (!handler) throw new Error(`Invalid step: ${step}. Must be 1-11.`);

    const result = await handler();
    session.currentStep = Math.max(session.currentStep, step);
    return result;
  }

  async stepAnalyze(session) {
    if (!session.input.videos.length) {
      throw new Error('No videos loaded. Go back to Step 0 and fetch videos first.');
    }

    const { channelStr, videoStr, transcriptStr } = this.buildSourceContext(session);

    const result = await ai.generate('analyze', {
      channelInfo: channelStr,
      videoData: videoStr,
      transcripts: transcriptStr || 'No transcripts available — analyze based on titles, descriptions, and view patterns.'
    });

    session.results.analysis = result;
    return result;
  }

  async stepChannelNames(session) {
    if (!session.results.analysis) throw new Error('Step 1 (Analysis) must be completed first');
    const result = await ai.generate('channel-names', { analysis: session.results.analysis });
    session.results.channelNames = result;
    return result;
  }

  async stepVideoIdeas(session) {
    if (!session.results.analysis) throw new Error('Step 1 (Analysis) must be completed first');
    const result = await ai.generate('video-ideas', { analysis: session.results.analysis });
    session.results.videoIdeas = result;
    return result;
  }

  async stepScriptWriter(session, options = {}) {
    if (!session.results.analysis) throw new Error('Step 1 (Analysis) must be completed first');
    const videoIdea = options.videoIdea || session.selectedVideoIdea;
    if (!videoIdea) throw new Error('Please select a video idea first');
    session.selectedVideoIdea = videoIdea;

    const result = await ai.generate('script-writer', {
      analysis: session.results.analysis,
      videoIdea: videoIdea,
      additionalInstructions: options.additionalInstructions
        ? `**Additional Instructions:** ${options.additionalInstructions}`
        : ''
    }, { maxTokens: config.ai.scriptMaxTokens });

    session.results.script = result;
    return result;
  }

  async stepTitleMaker(session) {
    if (!session.results.script) throw new Error('Step 4 (Script) must be completed first');
    const result = await ai.generate('title-maker', { analysis: session.results.analysis, script: session.results.script });
    session.results.titles = result;
    return result;
  }

  async stepThumbnailPlanner(session) {
    if (!session.results.titles) throw new Error('Step 5 (Titles) must be completed first');
    const result = await ai.generate('thumbnail-planner', { analysis: session.results.analysis, titles: session.results.titles });
    session.results.thumbnails = result;
    return result;
  }

  async stepAudioBrief(session) {
    if (!session.results.script) throw new Error('Step 4 (Script) must be completed first');
    const result = await ai.generate('audio-brief', { script: session.results.script });
    session.results.audioBrief = result;
    return result;
  }

  async stepVoiceover(session, options = {}) {
    if (!session.results.script) throw new Error('Step 4 (Script) must be completed first');
    const outputDir = this.getOutputDir(session.id);
    const result = await voiceover.generate(session.results.script, outputDir, {
      voice: options.voice,
      rate: options.rate,
      pitch: options.pitch,
    });
    session.production.voiceover = result;
    return { type: 'file', ...result, message: `Voiceover generated: ${(result.size / 1024).toFixed(0)} KB` };
  }

  async stepThumbnailImage(session, options = {}) {
    if (!session.results.titles) throw new Error('Step 5 (Titles) must be completed first');
    const outputDir = this.getOutputDir(session.id);
    const result = await thumbnail.generate(session.results.titles, outputDir, {
      colorScheme: options.colorScheme,
      customText: options.customText,
    });
    session.production.thumbnail = result;
    return { type: 'file', ...result, message: `Thumbnail generated: ${result.dimensions}` };
  }

  async stepBRoll(session) {
    if (!session.results.script) throw new Error('Step 4 (Script) must be completed first');

    const outputDir = this.getOutputDir(session.id);

    if (process.env.PEXELS_API_KEY) {
      const brollDir = path.join(outputDir, 'broll');
      const result = await broll.generate(session.results.script, brollDir);
      session.production.broll = result;
      return { type: 'files', ...result, message: `Downloaded ${result.totalClips} b-roll clips` };
    }

    const sourceUrl = session.input.videos?.[0]?.url;
    if (sourceUrl) {
      const result = await frames.extractFrames(sourceUrl, outputDir);
      session.production.frames = result;
      return { type: 'files', ...result, message: `Extracted ${result.count} frames from source video` };
    }

    throw new Error('No PEXELS_API_KEY and no source video URL available. Set a Pexels key in .env or use a YouTube video URL.');
  }

  async stepVideoAssembly(session) {
    if (!session.production.voiceover) throw new Error('Step 8 (Voiceover) must be completed first');
    const outputDir = this.getOutputDir(session.id);

    if (session.platform === 'instagram') {
      const result = await video.assembleReel(outputDir);
      session.production.reel = result;
      return { type: 'file', ...result, message: `Reel rendered: ${(result.size / (1024 * 1024)).toFixed(1)} MB, ${result.duration.toFixed(0)}s (${result.dimensions})` };
    }

    const result = await video.assembleVideo(outputDir);
    session.production.video = result;
    return { type: 'file', ...result, message: `Video rendered: ${(result.size / (1024 * 1024)).toFixed(1)} MB, ${result.duration.toFixed(0)}s` };
  }

  async stepReelScript(session, options = {}) {
    if (!session.results.analysis) throw new Error('Step 1 (Analysis) must be completed first');
    const videoIdea = options.videoIdea || session.selectedVideoIdea;
    if (!videoIdea) throw new Error('Please select a video idea first');
    session.selectedVideoIdea = videoIdea;

    const result = await ai.generate('reel-script', {
      analysis: session.results.analysis,
      videoIdea,
      additionalInstructions: options.additionalInstructions
        ? `**Additional Instructions:** ${options.additionalInstructions}`
        : '',
    }, { maxTokens: 1000 });

    session.results.script = result;
    return result;
  }

  async stepResearchValidation(session, options = {}) {
    if (!session.results.videoIdeas) throw new Error('Step 3 (Video Ideas) must be completed first');

    const ideasText = session.results.videoIdeas;
    const ideas = this._extractIdeasList(ideasText);
    const geo = options.geo || config.trending.defaultRegion;

    const results = await research.batchValidate(ideas.slice(0, 5), geo);
    session.research = results;
    return results;
  }

  _extractIdeasList(ideasText) {
    const lines = ideasText.split('\n').filter(l => l.trim());
    const ideas = [];
    for (const line of lines) {
      const match = line.match(/^\s*(?:###?\s*)?(?:Video Idea\s*#?\d+[:\s]*|\d+[\.\)]\s*)(.+)/i);
      if (match) {
        const title = match[1].replace(/\*+/g, '').replace(/^["']|["']$/g, '').trim();
        if (title.length > 5) ideas.push(title);
      }
    }
    if (ideas.length === 0) {
      for (const line of lines) {
        const titleMatch = line.match(/(?:title|working title)[:\s]+\*?\*?(.+?)\*?\*?\s*$/i);
        if (titleMatch) {
          const t = titleMatch[1].replace(/\*+/g, '').replace(/["""]/g, '').trim();
          if (t.length > 5) ideas.push(t);
        }
      }
    }
    return ideas;
  }

  exportSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const sections = [
      '# TrendVideo — Content Package',
      `Generated: ${new Date().toISOString()}\n`,
      '---\n',
      session.results.analysis ? `## 1. Channel Analysis\n\n${session.results.analysis}\n\n---\n` : '',
      session.results.channelNames ? `## 2. Channel Name Ideas\n\n${session.results.channelNames}\n\n---\n` : '',
      session.results.videoIdeas ? `## 3. Video Ideas\n\n${session.results.videoIdeas}\n\n---\n` : '',
      session.selectedVideoIdea ? `## Selected Video Idea\n\n${session.selectedVideoIdea}\n\n---\n` : '',
      session.results.script ? `## 4. Video Script\n\n${session.results.script}\n\n---\n` : '',
      session.results.titles ? `## 5. Title Options\n\n${session.results.titles}\n\n---\n` : '',
      session.results.thumbnails ? `## 6. Thumbnail Concepts\n\n${session.results.thumbnails}\n\n---\n` : '',
      session.results.audioBrief ? `## 7. Audio Brief\n\n${session.results.audioBrief}\n\n---\n` : '',
      session.production.voiceover ? `## 8. Voiceover\n\nGenerated: ${session.production.voiceover.voice}\nSize: ${(session.production.voiceover.size / 1024).toFixed(0)} KB\n\n---\n` : '',
      session.production.thumbnail ? `## 9. Thumbnail\n\nText: ${session.production.thumbnail.text}\nDimensions: ${session.production.thumbnail.dimensions}\n\n---\n` : '',
      session.production.broll ? `## 10. B-Roll\n\nClips: ${session.production.broll.totalClips}\nCredits: ${session.production.broll.credits.join(', ')}\n\n---\n` : '',
      session.production.video ? `## 11. Final Video\n\nDuration: ${session.production.video.duration.toFixed(0)}s\nSize: ${(session.production.video.size / (1024 * 1024)).toFixed(1)} MB\n` : '',
    ];

    return sections.filter(Boolean).join('\n');
  }
}

module.exports = new PipelineService();
