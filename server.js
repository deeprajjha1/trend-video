require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config');
const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = config.server.port;

app.use(cors());
app.use(express.json({ limit: config.server.jsonBodyLimit }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  const ai = require('./src/services/ai');
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    aiProvider: ai.getProviderInfo(),
    hasYouTubeAPI: !!process.env.YOUTUBE_API_KEY,
    hasPexelsAPI: !!process.env.PEXELS_API_KEY,
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ success: false, error: err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    const ai = require('./src/services/ai');
    const info = ai.getProviderInfo();
    console.log(`\n  🎬 TrendVideo running at http://localhost:${PORT}`);
    console.log(`  📊 Health check:        http://localhost:${PORT}/health`);
    console.log(`  🤖 AI provider:         ${info.provider} (${info.model})`);
    console.log(`  📺 YouTube API key:     ${process.env.YOUTUBE_API_KEY ? 'configured' : 'not set (manual URLs only)'}`);
    console.log(`  🎥 Pexels API key:      ${process.env.PEXELS_API_KEY ? 'configured' : 'not set (b-roll disabled)'}\n`);
  });
}

module.exports = app;
