# CLAUDE.md — TrendVideo

## Core Purpose
**TrendVideo** is a multi-platform content creation pipeline — an AI-powered web application that discovers trending videos on YouTube, reverse-engineers what makes them successful, validates ideas with real Google Trends + search data, and produces a complete content package **plus production-ready assets** (voiceover MP3, thumbnail PNG, source-frame visuals, and a final assembled MP4 or Instagram Reel) — all in a single guided workflow.

Supports two platforms:
- **YouTube** — Long-form 16:9 videos (5-20 min)
- **Instagram Reels** — Short-form 9:16 vertical videos (30-60s)

---

## Product Design

### Problem
Creating a successful YouTube channel or Instagram presence requires studying top performers, understanding their formula, and replicating it with original content. This process is manual, time-consuming, and scattered across multiple tools. TrendVideo collapses the entire workflow — from research to finished video — into one automated pipeline.

### Target User
Content creators, agency owners, and entrepreneurs who want to launch or scale faceless/niche YouTube channels or Instagram accounts using proven formulas from successful competitors.

### Core Workflow — Discover + 11-Step Pipeline
| Step | Name | Input | Output | Cost |
|------|------|-------|--------|------|
| 0 | **Discover Trends** | Category + Region | Currently trending YouTube videos | YouTube API |
| 1 | **Analyze Channel** | YouTube videos/channel | Blueprint (hooks, pacing, tone, structure) | AI Provider* |
| 2 | **Channel Names** | Analysis | 10 unique channel name ideas | AI Provider* |
| 3 | **Video Ideas** | Analysis | 10 video ideas + **research validation scores** | AI Provider* + Google Trends |
| 4 | **Script Writer** | Selected idea + analysis | Full script (or short-form Reel script) | AI Provider* |
| 5 | **Title Maker** | Script + analysis | 10 high-CTR title options | AI Provider* |
| 6 | **Thumbnail Planner** | Titles + analysis | 5 thumbnail concepts (text, colors, visuals) | AI Provider* |
| 7 | **Audio Brief** | Script | Voiceover brief for narration tools | AI Provider* |
| 8 | **Voiceover** | Script | AI voiceover MP3 file | **Free** (Edge TTS) |
| 9 | **Thumbnail** | Titles | Generated 1280x720 thumbnail PNG | **Free** (Canvas) |
| 10 | **B-Roll / Frames** | Script or source URL | Stock clips (Pexels) or extracted frames (yt-dlp) | **Free** |
| 11 | **Final Video** | Voiceover + visuals | Assembled MP4 (16:9) or Reel (9:16) | **Free** (FFmpeg) |

*\*AI Provider: OpenAI (paid) or Ollama (free/local) — one-line config swap in `.env`*

### UX Design
- **Platform selector**: Toggle between YouTube (16:9) and Instagram Reels (9:16) at the top of the sidebar
- **Trend discovery**: Step 0 has three tabs — "Discover Trending" (auto-fetch popular videos by category/region), "Channel URL", and "Video URLs"
- **Two modes**: Manual step-by-step control **or** one-click Autopilot that produces ready-to-upload videos automatically
- **Research validation**: After generating ideas in Step 3, click "Validate with Research" to score each idea against Google Trends momentum and YouTube search volume — pick data-backed winners instead of guessing
- **Wizard-style interface**: Left sidebar shows all 11 steps split into Content (1-7) and Production (8-11)
- **Dark theme**: Professional dark UI with purple accent (#7C3AED)
- **Step-by-step flow**: Each step must complete before unlocking the next
- **Editable outputs**: Users can regenerate any step independently
- **Autopilot mode**: Select trending videos → choose voice/style → system runs all pipeline steps per video and produces downloadable MP4s, thumbnails, and voiceovers with real-time SSE progress
- **Instagram publishing**: After generating a Reel, publish directly to Instagram via Meta Graph API
- **Media previews**: Audio player, image preview, and video player built into the UI
- **Export**: Download the entire content package as a formatted document
- **Responsive**: Works on desktop and tablet

---

## Technical Architecture

### Tech Stack
| Layer | Technology | Cost |
|-------|------------|------|
| Runtime | Node.js 18+ | Free |
| Server | Express.js | Free |
| AI Engine | **Swappable**: OpenAI (paid) or Ollama (free/local) | Configurable |
| YouTube Data | YouTube Data API v3 + custom transcript scraper | Free |
| Research | Google Trends API (`google-trends-api` npm) + YouTube Search | Free |
| Voiceover | Edge TTS (Microsoft) via `edge-tts-universal` | Free |
| Thumbnails | `@napi-rs/canvas` (prebuilt, no system deps) | Free |
| B-Roll | Pexels API via `pexels` npm package | Free |
| Frame Extraction | yt-dlp + FFmpeg | Free |
| Video Assembly | FFmpeg (system binary) — supports 16:9 and 9:16 | Free |
| Instagram | Meta Graph API (Reel publishing) | Free |
| Rate Limiting | In-memory token bucket (per-API) | Free |
| Frontend | Vanilla HTML/CSS/JS | Free |
| Markdown | `marked` via CDN | Free |
| State | In-memory session store (Map) | Free |

### System Dependencies (must be installed)
```bash
brew install ffmpeg     # Video assembly (Step 11)
brew install yt-dlp     # Frame extraction from source videos (Step 10)
```

### AI Provider Config (one-line swap)
Change `AI_PROVIDER` in `.env` to switch the entire AI layer:
```bash
AI_PROVIDER=openai    # Paid: uses GPT-4o, needs OPENAI_API_KEY
AI_PROVIDER=ollama    # Free: uses local Ollama, no API key needed
```
Override the model with `AI_MODEL=qwen2.5:14b` (or any model name).
Override the URL with `AI_BASE_URL=http://...` for custom endpoints.

### Project Structure
```
trend-video/
├── CLAUDE.md
├── TESTING.md
├── package.json
├── .env.example
├── .gitignore
├── server.js                    # Express app entry point
├── output/                      # Generated files per session
├── src/
│   ├── config.js                # All constants, limits, defaults
│   ├── services/
│   │   ├── youtube.js           # YouTube Data API + transcript scraping
│   │   ├── ai.js                # Swappable AI provider (OpenAI / Ollama)
│   │   ├── pipeline.js          # 11-step pipeline orchestration + sessions
│   │   ├── autopilot.js         # Autopilot: batch video production via SSE
│   │   ├── research.js          # Google Trends + YouTube search validation
│   │   ├── rateLimiter.js       # Generic token-bucket rate limiter
│   │   ├── instagram.js         # Meta Graph API: Reel publishing
│   │   ├── frames.js            # yt-dlp: extract frames from source video
│   │   ├── voiceover.js         # Edge TTS: script → MP3
│   │   ├── thumbnail.js         # Canvas: title → PNG
│   │   ├── broll.js             # Pexels API: keywords → video clips
│   │   └── video.js             # FFmpeg: assemble MP4 (16:9) or Reel (9:16)
│   ├── routes/
│   │   └── api.js               # All REST API endpoints
│   └── prompts/
│       ├── analyze.txt
│       ├── channel-names.txt
│       ├── video-ideas.txt
│       ├── script-writer.txt
│       ├── reel-script.txt      # Short-form Instagram Reel script
│       ├── title-maker.txt
│       ├── thumbnail-planner.txt
│       └── audio-brief.txt
├── public/
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
└── tests/
    ├── rateLimiter.test.js
    ├── research.integration.test.js
    ├── instagram.test.js
    ├── autopilot.integration.test.js
    ├── youtube.integration.test.js
    ├── pipeline.integration.test.js
    ├── trending.integration.test.js
    └── e2e.integration.test.js
```

### API Reference
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/session` | POST | Create a new pipeline session |
| `/api/session/:id` | GET | Get session state and all results |
| `/api/session/platform` | POST | Set session platform (youtube / instagram) |
| `/api/trending` | GET | Fetch currently trending videos (category, region, count) |
| `/api/categories` | GET | List YouTube video categories for a region |
| `/api/regions` | GET | List supported region codes |
| `/api/fetch-videos` | POST | Fetch top videos from channel URL or trending selection |
| `/api/fetch-transcripts` | POST | Fetch transcripts for loaded videos |
| `/api/pipeline/:step` | POST | Execute a pipeline step (1-11) |
| `/api/pipeline/reel-script` | POST | Generate short-form Reel script (30-60s) |
| `/api/pipeline/research` | POST | Validate session's generated ideas with Google Trends |
| `/api/file/:sessionId/:filename` | GET | Serve generated files (MP3, PNG, MP4) |
| `/api/voices` | GET | List available TTS voices |
| `/api/color-schemes` | GET | List available thumbnail color schemes |
| `/api/autopilot` | POST | Start autopilot batch production (SSE stream) |
| `/api/autopilot/:jobId` | GET | Get autopilot job status and results |
| `/api/research/validate` | POST | Validate a single topic (Trends + YouTube search) |
| `/api/research/batch` | POST | Batch validate multiple ideas with scores |
| `/api/research/trends` | GET | Get Google Trends score for a keyword |
| `/api/research/related` | GET | Get related/rising queries from Google Trends |
| `/api/instagram/status` | GET | Check Instagram account connection status |
| `/api/instagram/publish` | POST | Publish a generated Reel to Instagram |
| `/api/rate-limits` | GET | View current rate limit status for all APIs |
| `/api/export/:sessionId` | GET | Export full content package as markdown |
| `/health` | GET | Health check |

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `AI_PROVIDER` | No | `openai` (default) or `ollama` |
| `AI_MODEL` | No | Override model (e.g. `qwen2.5:14b`, `gpt-4o`) |
| `AI_BASE_URL` | No | Override API base URL |
| `OPENAI_API_KEY` | If openai | OpenAI API key for GPT-4o |
| `YOUTUBE_API_KEY` | No | YouTube Data API v3 key (enables trending + channel input) |
| `PEXELS_API_KEY` | No | Free Pexels API key for b-roll (optional — step 10 only) |
| `INSTAGRAM_ACCESS_TOKEN` | No | Meta Graph API token for Reel publishing |
| `INSTAGRAM_ACCOUNT_ID` | No | Instagram Business/Creator account ID |
| `PORT` | No | Server port (default: 3000) |

### Rate Limits (built-in)
| API | Per-Window | Daily Max |
|-----|-----------|-----------|
| YouTube Data API | 50 req/min | 9,500 units |
| Google Trends | 10 req/min | 1,000 |
| Instagram Graph API | 25 req/hour | 200 |
| OpenAI | 20 req/min | — |
| Ollama | 100 req/min | — |

---

## Build & Run Commands

### Quick Start
```bash
cd trend-video
cp .env.example .env        # Add your API keys
npm install                  # Install dependencies
brew install ffmpeg yt-dlp   # System dependencies
npm run dev                  # Start dev server with auto-reload
```

### Production
```bash
npm start                    # Start production server
```

### Tests
```bash
npm test                     # All integration tests
npm run test:trending        # Trending feature tests
npm run test:research        # Research validation tests
npm run test:ratelimit       # Rate limiter unit tests
npm run test:instagram       # Instagram service tests
npm run test:autopilot       # Autopilot pipeline tests
```

### Access
- **Web App**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

---

## Implementation Status

### Completed
- [x] Express server with static file serving + session management
- [x] YouTube Data API integration (channels, videos, transcripts)
- [x] Swappable AI engine (OpenAI / Ollama)
- [x] 11-step content pipeline with 7 AI prompt templates
- [x] Trend discovery (categories, regions, trending videos)
- [x] Autopilot mode with SSE real-time progress streaming
- [x] Research validation (Google Trends + YouTube search volume)
- [x] Dark-themed wizard UI with platform selector (YT / IG)
- [x] Voiceover generation (Edge TTS, 10 voices incl. Hindi)
- [x] Thumbnail generation (Canvas, 5 color schemes)
- [x] B-roll downloading (Pexels API) or frame extraction (yt-dlp)
- [x] Video assembly — 16:9 (YouTube) and 9:16 (Instagram Reels)
- [x] Instagram Reel publishing via Meta Graph API
- [x] Rate limiter for all external APIs
- [x] Short-form Reel script prompt
- [x] Export content package as markdown

### Future
- [ ] Persistent storage (SQLite or PostgreSQL)
- [ ] User authentication
- [ ] Saved projects / history
- [ ] YouTube auto-upload via YouTube Data API
- [ ] A/B test title variants with real CTR data

---

## Coding Guidelines
- **Prompts**: Stored as `.txt` files in `src/prompts/`. Each prompt uses `{{variable}}` placeholders.
- **Config**: All hardcoded values live in `src/config.js`. No magic numbers in service files.
- **Environment**: Use `.env` for secrets. NEVER hardcode API keys.
- **Error Handling**: All API endpoints return `{ success: boolean, data?, error? }`.
- **Rate Limiting**: All external API calls should go through `rateLimiter.acquire(service)`.
- **State**: Session data stored in-memory Map keyed by UUID session IDs.
- **Output Files**: Generated per-session in `output/<sessionId>/` directory.
- **Style**: Standard Node.js/Express patterns. Services are modular and testable.
- **Frontend**: No build step. Vanilla JS with modern ES6+ features. CSS custom properties for theming.
