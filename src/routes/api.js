const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const config = require('../config');
const youtube = require('../services/youtube');
const pipeline = require('../services/pipeline');
const ai = require('../services/ai');
const voiceoverService = require('../services/voiceover');
const thumbnailService = require('../services/thumbnail');
const autopilot = require('../services/autopilot');
const research = require('../services/research');
const rateLimiter = require('../services/rateLimiter');
const instagram = require('../services/instagram');

router.post('/session', (req, res) => {
  try {
    const session = pipeline.createSession();
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/session/:id', (req, res) => {
  try {
    const session = pipeline.getSession(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/fetch-videos', async (req, res) => {
  try {
    const { sessionId, channelUrl, videoUrls } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId is required' });

    const session = pipeline.getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found. Please refresh the page.' });

    let videos = [];
    let channelInfo = null;

    const { trendingVideos } = req.body;

    if (trendingVideos && trendingVideos.length > 0) {
      videos = trendingVideos;
    } else if (channelUrl) {
      const result = await youtube.getTopVideos(channelUrl);
      videos = result.videos;
      channelInfo = result.channel;
    } else if (videoUrls && videoUrls.length > 0) {
      videos = await youtube.getVideoDetails(videoUrls);
      if (videos.length === 0) {
        return res.status(400).json({ success: false, error: 'No valid video URLs found. Check the format and try again.' });
      }
    } else {
      return res.status(400).json({ success: false, error: 'Provide either a channel URL, video URLs, or select trending videos' });
    }

    session.input.videos = videos;
    session.input.channelInfo = channelInfo;

    res.json({ success: true, data: { channelInfo, videos } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/fetch-transcripts', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId is required' });

    const session = pipeline.getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found. Please refresh the page.' });

    if (!session.input.videos.length) {
      return res.status(400).json({ success: false, error: 'Fetch videos first' });
    }

    const transcripts = await youtube.getTranscriptsForVideos(session.input.videos);
    session.input.transcripts = transcripts;

    const stats = {
      total: transcripts.length,
      withTranscript: transcripts.filter(t => t.hasTranscript).length,
      withoutTranscript: transcripts.filter(t => !t.hasTranscript).length
    };

    res.json({ success: true, data: { transcripts, stats } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/pipeline/reel-script', async (req, res) => {
  try {
    const { sessionId, videoIdea, additionalInstructions } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId is required' });

    const session = pipeline.getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    session.platform = 'instagram';
    const result = await pipeline.stepReelScript(session, { videoIdea, additionalInstructions });
    res.json({ success: true, data: { step: 'reel-script', result } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/pipeline/research', async (req, res) => {
  try {
    const { sessionId, geo } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId is required' });

    const session = pipeline.getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    const result = await pipeline.stepResearchValidation(session, { geo });
    res.json({ success: true, data: { step: 'research', result } });
  } catch (err) {
    res.status(err.message.includes('rate limit') ? 429 : 500).json({ success: false, error: err.message });
  }
});

router.post('/pipeline/:step', async (req, res) => {
  try {
    const step = parseInt(req.params.step);
    if (isNaN(step) || step < 1 || step > 11) {
      return res.status(400).json({ success: false, error: 'Step must be a number between 1 and 11' });
    }

    const { sessionId, videoIdea, additionalInstructions, voice, rate, pitch, colorScheme, customText } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId is required' });

    const session = pipeline.getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found. Please refresh the page.' });

    const result = await pipeline.runStep(sessionId, step, {
      videoIdea, additionalInstructions,
      voice, rate, pitch,
      colorScheme: colorScheme != null ? parseInt(colorScheme) : undefined,
      customText,
    });

    res.json({ success: true, data: { step, result } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/session/platform', (req, res) => {
  try {
    const { sessionId, platform } = req.body;
    if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId is required' });

    const session = pipeline.getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    if (!['youtube', 'instagram'].includes(platform)) {
      return res.status(400).json({ success: false, error: 'platform must be youtube or instagram' });
    }

    session.platform = platform;
    res.json({ success: true, data: { platform } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/file/:sessionId/:filename', (req, res) => {
  try {
    const outputDir = path.join(__dirname, '..', '..', 'output', req.params.sessionId);
    const filePath = path.join(outputDir, req.params.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', config.mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/trending', async (req, res) => {
  try {
    const { categoryId, region, maxResults } = req.query;
    const result = await youtube.getTrendingVideos({
      categoryId: categoryId || undefined,
      regionCode: region || undefined,
      maxResults: maxResults ? parseInt(maxResults) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.message.includes('API key') ? 403 : 500).json({ success: false, error: err.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const region = req.query.region || undefined;
    const categories = await youtube.getVideoCategories(region);
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(err.message.includes('API key') ? 403 : 500).json({ success: false, error: err.message });
  }
});

router.get('/regions', (req, res) => {
  const config = require('../config');
  res.json({ success: true, data: config.trending.regions });
});

router.get('/provider', (req, res) => {
  res.json({ success: true, data: ai.getProviderInfo() });
});

router.get('/voices', (req, res) => {
  res.json({ success: true, data: voiceoverService.getAvailableVoices() });
});

router.get('/color-schemes', (req, res) => {
  res.json({ success: true, data: thumbnailService.getColorSchemes() });
});

router.post('/autopilot', (req, res) => {
  const { selectedVideos, voice, colorScheme } = req.body;

  if (!selectedVideos || selectedVideos.length === 0) {
    return res.status(400).json({ success: false, error: 'Select at least one video for autopilot' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let closed = false;
  req.on('close', () => { closed = true; });

  autopilot.run(
    { selectedVideos, voice, colorScheme: colorScheme != null ? parseInt(colorScheme) : 0 },
    (job) => {
      if (!closed) send(job);
    }
  ).then(job => {
    if (!closed) {
      send(job);
      res.end();
    }
  }).catch(err => {
    if (!closed) {
      send({ status: 'failed', error: err.message });
      res.end();
    }
  });
});

router.get('/autopilot/:jobId', (req, res) => {
  const job = autopilot.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json({ success: true, data: job });
});

router.post('/research/validate', async (req, res) => {
  try {
    const { topic, geo } = req.body;
    if (!topic) return res.status(400).json({ success: false, error: 'topic is required' });
    const result = await research.validateIdea(topic, geo);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.message.includes('rate limit') ? 429 : 500).json({ success: false, error: err.message });
  }
});

router.post('/research/batch', async (req, res) => {
  try {
    const { ideas, geo } = req.body;
    if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
      return res.status(400).json({ success: false, error: 'ideas array is required' });
    }
    const results = await research.batchValidate(ideas.slice(0, 10), geo);
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(err.message.includes('rate limit') ? 429 : 500).json({ success: false, error: err.message });
  }
});

router.get('/research/trends', async (req, res) => {
  try {
    const { keyword, geo } = req.query;
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword query param is required' });
    const result = await research.getTrendScore(keyword, geo);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.message.includes('rate limit') ? 429 : 500).json({ success: false, error: err.message });
  }
});

router.get('/research/related', async (req, res) => {
  try {
    const { keyword, geo } = req.query;
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword query param is required' });
    const result = await research.getRelatedTopics(keyword, geo);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.message.includes('rate limit') ? 429 : 500).json({ success: false, error: err.message });
  }
});

router.get('/rate-limits', (req, res) => {
  res.json({ success: true, data: rateLimiter.getAllStatus() });
});

router.get('/instagram/status', async (req, res) => {
  try {
    if (!instagram.isConfigured()) {
      return res.json({ success: true, data: { configured: false } });
    }
    const account = await instagram.getAccountInfo();
    res.json({ success: true, data: { configured: true, account } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/instagram/publish', async (req, res) => {
  try {
    const { sessionId, caption, videoUrl } = req.body;

    let publishUrl = videoUrl;
    if (!publishUrl && sessionId) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      publishUrl = `${baseUrl}/api/file/${sessionId}/final-reel.mp4`;
    }

    if (!publishUrl) {
      return res.status(400).json({ success: false, error: 'Provide a videoUrl or sessionId with a generated reel' });
    }

    const result = await instagram.publishReel(publishUrl, caption || '');
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.message.includes('not configured') ? 403 : 500).json({ success: false, error: err.message });
  }
});

router.get('/export/:sessionId', (req, res) => {
  try {
    const markdown = pipeline.exportSession(req.params.sessionId);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename="trendvideo-content-package.md"');
    res.send(markdown);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
