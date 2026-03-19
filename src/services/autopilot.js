const { v4: uuid } = require('uuid');
const youtube = require('./youtube');
const pipeline = require('./pipeline');

class AutopilotService {
  constructor() {
    this.jobs = new Map();
  }

  getJob(id) {
    return this.jobs.get(id) || null;
  }

  async run(options, onProgress) {
    const jobId = uuid();
    const job = {
      id: jobId,
      status: 'running',
      startedAt: new Date().toISOString(),
      config: {
        voice: options.voice || 'male-us',
        colorScheme: options.colorScheme ?? 0,
      },
      selectedVideos: options.selectedVideos || [],
      totalVideos: 0,
      completedVideos: 0,
      currentVideo: null,
      currentStep: null,
      results: [],
      errors: [],
    };
    this.jobs.set(jobId, job);

    const progress = (update) => {
      Object.assign(job, update);
      if (onProgress) onProgress(job);
    };

    try {
      await this._execute(job, progress);
      job.status = 'completed';
      job.finishedAt = new Date().toISOString();
    } catch (err) {
      job.status = 'failed';
      job.error = err.message;
      job.finishedAt = new Date().toISOString();
    }

    if (onProgress) onProgress(job);
    return job;
  }

  async _execute(job, progress) {
    const { voice, colorScheme } = job.config;
    const videos = job.selectedVideos;

    if (videos.length === 0) {
      throw new Error('No videos selected for autopilot.');
    }

    job.totalVideos = videos.length;
    progress({ totalVideos: job.totalVideos, currentStep: `Processing ${job.totalVideos} videos` });

    const STEPS = [
      { num: 1, name: 'Analyzing' },
      { num: 3, name: 'Generating ideas' },
      { num: 4, name: 'Writing script' },
      { num: 5, name: 'Creating titles' },
      { num: 6, name: 'Planning thumbnail' },
      { num: 7, name: 'Audio brief' },
      { num: 8, name: 'Generating voiceover' },
      { num: 9, name: 'Creating thumbnail' },
      { num: 10, name: 'Extracting source visuals' },
      { num: 11, name: 'Assembling video' },
    ];

    for (let i = 0; i < videos.length; i++) {
      const trendingVideo = videos[i];
      const videoLabel = `[${i + 1}/${videos.length}] "${trendingVideo.title.substring(0, 50)}"`;

      try {
        const session = pipeline.createSession();
        session.input.videos = [trendingVideo];

        progress({ currentVideo: videoLabel, currentStep: `${videoLabel} — Fetching transcript` });
        const transcripts = await youtube.getTranscriptsForVideos([trendingVideo]);
        session.input.transcripts = transcripts;

        for (const step of STEPS) {
          progress({ currentStep: `${videoLabel} — ${step.name}` });

          if (step.num === 4) {
            const ideasText = session.results.videoIdeas || '';
            const firstIdea = this._extractFirstIdea(ideasText, trendingVideo.title);
            await pipeline.runStep(session.id, 4, { videoIdea: firstIdea });
          } else if (step.num === 8) {
            await pipeline.runStep(session.id, 8, { voice });
          } else if (step.num === 9) {
            await pipeline.runStep(session.id, 9, { colorScheme });
          } else {
            await pipeline.runStep(session.id, step.num);
          }
        }

        job.completedVideos = i + 1;
        job.results.push({
          index: i + 1,
          sourceVideo: { title: trendingVideo.title, url: trendingVideo.url, viewCount: trendingVideo.viewCount },
          sessionId: session.id,
          files: {
            video: `/api/file/${session.id}/final-video.mp4`,
            thumbnail: `/api/file/${session.id}/thumbnail.png`,
            voiceover: `/api/file/${session.id}/voiceover.mp3`,
          },
        });

        progress({ completedVideos: job.completedVideos, currentStep: `${videoLabel} — Done` });
      } catch (err) {
        job.errors.push({ index: i + 1, video: trendingVideo.title, error: err.message });
        job.completedVideos = i + 1;
        progress({ completedVideos: job.completedVideos, currentStep: `${videoLabel} — Failed: ${err.message}` });
      }
    }
  }

  _extractFirstIdea(ideasText, fallbackTitle) {
    const lines = ideasText.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const match = line.match(/^\s*(?:###?\s*)?(?:Video Idea\s*#?\d+[:\s]*|1[\.\)]\s*)(.+)/i);
      if (match) return match[1].replace(/\*+/g, '').replace(/^["']|["']$/g, '').trim();
    }
    for (const line of lines) {
      const titleMatch = line.match(/(?:title|working title)[:\s]+\*?\*?(.+?)\*?\*?\s*$/i);
      if (titleMatch) return titleMatch[1].replace(/\*+/g, '').replace(/["""]/g, '').trim();
    }
    return `A fresh take on: ${fallbackTitle}`;
  }
}

module.exports = new AutopilotService();
