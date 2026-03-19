# TrendVideo

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

An AI-powered multi-platform content creation pipeline that discovers trending YouTube videos, validates ideas with real Google Trends data, reverse-engineers what makes them successful, and produces ready-to-upload videos — for YouTube (16:9) and Instagram Reels (9:16).

## What it does

TrendVideo fetches what's currently trending on YouTube, lets you pick videos to study, and runs an 11-step automated pipeline:

**Trend Discovery (Step 0)** — Browse what's trending on YouTube right now by category (Tech, Gaming, Education, etc.) and region (US, UK, India, etc.). Select the videos you want to study. Or paste your own channel/video URLs.

**Content Generation (Steps 1-7)** — AI analyzes the selected videos' formula and generates a channel name, video ideas, a full script, click-worthy titles, thumbnail concepts, and a voiceover brief.

**Research Validation (Step 3+)** — After generating video ideas, validate them against real Google Trends data and YouTube search volume. Each idea gets scored on trend momentum, search demand, and competition — so you pick data-backed winners, not guesses.

**Video Production (Steps 8-11)** — Generates a voiceover MP3 (10 voices including Indian English and Hindi), a 1280x720 thumbnail PNG, extracts frames from the source video (or downloads b-roll from Pexels), and assembles everything into a final video.

**Autopilot Mode** — Select trending videos, choose a voice and thumbnail style, and the system runs the entire pipeline for each video automatically — producing ready-to-upload videos with real-time SSE progress streaming. Or use manual mode for full step-by-step control.

**Instagram Reels** — Switch to Instagram mode to generate short-form 9:16 vertical Reels (30-60s) instead of YouTube long-form. Publish directly to Instagram via Meta Graph API.

**Rate Limiting** — Built-in rate limiter tracks API usage across YouTube, Google Trends, Instagram, and AI providers. Prevents quota exhaustion and handles daily limits.

The AI engine is **swappable** — use OpenAI (paid, best quality) or Ollama (free, runs locally) with a one-line config change.

## Quick Start

```bash
git clone <repo-url> trend-video && cd trend-video
cp .env.example .env          # Configure your AI provider
npm install                    # Install dependencies
brew install ffmpeg yt-dlp     # Required system tools
npm run dev                    # Start at http://localhost:3000
```

## Configuration

Edit `.env` to choose your AI provider:

```bash
# Option A: Free (local Ollama)
AI_PROVIDER=ollama
AI_MODEL=qwen2.5:14b           # pull with: ollama pull qwen2.5:14b

# Option B: Paid (OpenAI)
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Optional keys:

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `YOUTUBE_API_KEY` | Trending discovery + channel URL input | [Google Cloud Console](https://console.cloud.google.com/) |
| `PEXELS_API_KEY` | Download free b-roll clips | [pexels.com/api](https://www.pexels.com/api/new/) |
| `INSTAGRAM_ACCESS_TOKEN` | Publish Reels to Instagram | [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/) |
| `INSTAGRAM_ACCOUNT_ID` | Instagram Business account ID | Same as above |

## Folder Structure

```
trend-video/
├── server.js                  # Express entry point
├── src/
│   ├── config.js              # All constants and defaults
│   ├── services/
│   │   ├── ai.js              # Swappable AI provider (OpenAI / Ollama)
│   │   ├── youtube.js         # YouTube API + transcript scraper
│   │   ├── pipeline.js        # 11-step orchestration + sessions
│   │   ├── autopilot.js       # Batch autopilot production (SSE)
│   │   ├── research.js        # Google Trends + YouTube search validation
│   │   ├── rateLimiter.js     # Generic rate limiter for all APIs
│   │   ├── instagram.js       # Meta Graph API: Reel publishing
│   │   ├── frames.js          # yt-dlp: extract frames from source video
│   │   ├── voiceover.js       # Edge TTS → MP3
│   │   ├── thumbnail.js       # Canvas → PNG
│   │   ├── broll.js           # Pexels → video clips
│   │   └── video.js           # FFmpeg → MP4 (16:9) or Reel (9:16)
│   ├── routes/
│   │   └── api.js             # REST endpoints
│   └── prompts/               # AI prompt templates (*.txt) incl. reel-script.txt
├── public/                    # Frontend (vanilla HTML/CSS/JS)
├── output/                    # Generated files per session
└── tests/                     # 8 test suites (27+ tests)
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AI_PROVIDER` | No | `openai` | `openai` or `ollama` |
| `AI_MODEL` | No | Provider default | Model name override |
| `AI_BASE_URL` | No | Provider default | API base URL override |
| `OPENAI_API_KEY` | If openai | — | OpenAI API key |
| `YOUTUBE_API_KEY` | No | — | Enables trending discovery + channel URL input |
| `PEXELS_API_KEY` | No | — | Enables b-roll download (Step 10) |
| `INSTAGRAM_ACCESS_TOKEN` | No | — | Meta Graph API token for Reel publishing |
| `INSTAGRAM_ACCOUNT_ID` | No | — | Instagram Business/Creator account ID |
| `PORT` | No | `3000` | Server port |

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/session` | POST | Create session |
| `/api/session/:id` | GET | Get session state |
| `/api/session/platform` | POST | Set platform (youtube / instagram) |
| `/api/trending` | GET | Fetch trending videos by category/region |
| `/api/categories` | GET | YouTube video categories |
| `/api/regions` | GET | Supported region codes |
| `/api/fetch-videos` | POST | Fetch YouTube videos |
| `/api/fetch-transcripts` | POST | Scrape transcripts |
| `/api/pipeline/:step` | POST | Run step 1-11 |
| `/api/pipeline/reel-script` | POST | Generate short-form Reel script |
| `/api/pipeline/research` | POST | Validate ideas with Google Trends |
| `/api/file/:sessionId/:file` | GET | Serve generated media |
| `/api/provider` | GET | Current AI provider info |
| `/api/voices` | GET | Available TTS voices |
| `/api/color-schemes` | GET | Thumbnail color options |
| `/api/autopilot` | POST | Start autopilot batch production (SSE) |
| `/api/autopilot/:jobId` | GET | Get autopilot job status |
| `/api/research/validate` | POST | Validate topic with Google Trends + YouTube |
| `/api/research/batch` | POST | Batch validate multiple ideas |
| `/api/research/trends` | GET | Google Trends score for keyword |
| `/api/research/related` | GET | Related/rising queries |
| `/api/instagram/status` | GET | Check Instagram connection |
| `/api/instagram/publish` | POST | Publish Reel to Instagram |
| `/api/rate-limits` | GET | API rate limit status |
| `/api/export/:sessionId` | GET | Download content package |
| `/health` | GET | Health check |

## Output

Generated files are saved to `output/<session-id>/`:

```
output/<session-id>/
├── voiceover.mp3        # Step 8
├── thumbnail.png        # Step 9
├── frames/              # Step 10 (extracted from source video)
│   ├── frame-001.jpg
│   └── ...
├── broll/               # Step 10 (if Pexels key set)
│   ├── clip-001.mp4
│   └── ...
├── final-video.mp4      # Step 11 (YouTube 16:9)
└── final-reel.mp4       # Step 11 (Instagram 9:16, if platform=instagram)
```

## Scripts

```bash
npm run dev              # Development (auto-reload)
npm start                # Production
npm test                 # Run all tests
npm run test:youtube     # YouTube integration tests
npm run test:pipeline    # AI pipeline tests
npm run test:e2e         # End-to-end tests
npm run test:trending    # Trending feature tests
npm run test:ratelimit   # Rate limiter unit tests
npm run test:research    # Research validation tests
npm run test:instagram   # Instagram service tests
npm run test:autopilot   # Autopilot pipeline tests
```

## License

MIT
