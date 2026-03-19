module.exports = {
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    jsonBodyLimit: '10mb',
  },

  ai: {
    providers: {
      openai: {
        baseURL: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o',
        apiKeyEnv: 'OPENAI_API_KEY',
      },
      ollama: {
        baseURL: 'http://localhost:11434/v1',
        defaultModel: 'qwen2.5:7b',
        apiKeyEnv: null,
      },
    },
    defaultTemperature: 0.8,
    defaultMaxTokens: 4096,
    scriptMaxTokens: 6000,
    systemPrompt:
      'You are an expert YouTube content strategist and scriptwriter. You analyze successful channels and create high-performing content blueprints. Always provide detailed, actionable, and specific outputs. Use markdown formatting for readability.',
  },

  youtube: {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    fetchTimeoutMs: 15000,
    descriptionMaxChars: 300,
    channelDescriptionMaxChars: 500,
    maxPlaylistPages: 100,
    playlistPageSize: 50,
    defaultTranscriptLanguage: 'en',
    maxTranscriptsPerBatch: 10,
    maxTopVideos: 15,
  },

  trending: {
    defaultRegion: 'US',
    defaultMaxResults: 20,
    maxAllowed: 50,
    regions: [
      { code: 'US', name: 'United States' },
      { code: 'GB', name: 'United Kingdom' },
      { code: 'IN', name: 'India' },
      { code: 'CA', name: 'Canada' },
      { code: 'AU', name: 'Australia' },
      { code: 'DE', name: 'Germany' },
      { code: 'FR', name: 'France' },
      { code: 'JP', name: 'Japan' },
      { code: 'BR', name: 'Brazil' },
      { code: 'KR', name: 'South Korea' },
    ],
  },

  pipeline: {
    maxTranscriptChars: 30000,
    sessionStorageKey: 'trendvideo_session',
  },

  voiceover: {
    voices: {
      'male-us': 'en-US-GuyNeural',
      'female-us': 'en-US-JennyNeural',
      'male-uk': 'en-GB-RyanNeural',
      'female-uk': 'en-GB-SoniaNeural',
      'male-in-en': 'en-IN-PrabhatNeural',
      'female-in-en': 'en-IN-NeerjaNeural',
      'male-in-hi': 'hi-IN-MadhurNeural',
      'female-in-hi': 'hi-IN-SwaraNeural',
      'male-au': 'en-AU-WilliamNeural',
      'female-au': 'en-AU-NatashaNeural',
    },
    defaultVoice: 'en-US-GuyNeural',
    defaultRate: '+0%',
    defaultPitch: '+0Hz',
    minScriptLength: 20,
    minAudioBytes: 1000,
  },

  thumbnail: {
    width: 1280,
    height: 720,
    maxWordsPerLine: 4,
    fallbackText: 'WATCH THIS',
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontWeight: '900',
    titleMinLength: 5,
    titleMaxLength: 60,
    colorSchemes: [
      { bg: '#1a1a2e', text: '#FFFFFF', accent: '#e94560' },
      { bg: '#0f0f0f', text: '#FFFFFF', accent: '#FFD700' },
      { bg: '#FF0000', text: '#FFFFFF', accent: '#000000' },
      { bg: '#000000', text: '#FFFFFF', accent: '#00FF88' },
      { bg: '#1B0A3C', text: '#FFFFFF', accent: '#FF6B35' },
    ],
  },

  broll: {
    pexelsApiUrl: 'https://api.pexels.com/videos/search',
    maxClips: 8,
    searchResultsPerKeyword: 2,
    minKeywords: 3,
    maxKeywords: 8,
    fallbackKeywords: ['abstract background', 'technology', 'cinematic'],
    topicKeywords: [
      'technology', 'business', 'money', 'success', 'laptop computer',
      'office work', 'city aerial', 'nature landscape', 'people talking',
      'writing notebook', 'smartphone', 'graph chart', 'creative work',
    ],
  },

  frames: {
    maxFrames: 20,
    width: 1280,
    height: 720,
    downloadTimeoutMs: 120000,
    extractTimeoutMs: 60000,
    frameDurationSec: 4,
    zoomFactor: 1.05,
  },

  video: {
    ffmpegTimeoutMs: 300000,
    defaultBgColor: '0x1a1a2e',
    outputWidth: 1280,
    outputHeight: 720,
    frameRate: 24,
    audioBitrate: '192k',
    crf: '23',
    preset: 'fast',
    brollDurationBufferSec: 5,
    fallbackClipDurationSec: 10,
  },

  rateLimits: {
    youtube: { maxRequests: 50, windowMs: 60_000, dailyMax: 9_500 },
    googleTrends: { maxRequests: 10, windowMs: 60_000, dailyMax: 1_000 },
    instagram: { maxRequests: 25, windowMs: 3_600_000, dailyMax: 200 },
    openai: { maxRequests: 20, windowMs: 60_000 },
    ollama: { maxRequests: 100, windowMs: 60_000 },
  },

  research: {
    trendsGeo: 'US',
    trendsTimeRange: 'today 3-m',
    searchMaxResults: 10,
    ideaScoreWeights: { trendScore: 0.35, searchVolume: 0.30, competition: 0.20, freshness: 0.15 },
    minViableScore: 40,
  },

  instagram: {
    graphApiBase: 'https://graph.facebook.com/v21.0',
    reelMaxDurationSec: 90,
    reelMinDurationSec: 15,
    reelWidth: 1080,
    reelHeight: 1920,
    reelFrameRate: 30,
    publishCheckIntervalMs: 5000,
    publishMaxWaitMs: 120000,
  },

  mimeTypes: {
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.png': 'image/png',
  },
};
