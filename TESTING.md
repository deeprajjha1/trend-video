# TESTING.md — TrendVideo Testing Document

## Test Architecture

```
tests/
├── youtube.integration.test.js       # Real YouTube scraping + API calls
├── pipeline.integration.test.js      # Real AI calls through full 7-step pipeline
├── e2e.integration.test.js           # Full HTTP server → Express → Services → Real APIs
├── trending.integration.test.js      # Trending discovery: categories, regions, video fetch, full flow
├── rateLimiter.test.js               # Rate limiter: token bucket, daily limits, refill logic
├── research.integration.test.js      # Google Trends + YouTube search validation
├── instagram.test.js                 # Instagram config, platform switching, publish guard
└── autopilot.integration.test.js     # Autopilot SSE, reel script, batch pipeline
```

All tests use **Node's built-in test runner** (no extra dependencies). Tests that need API keys skip cleanly when keys aren't set.

---

## How to Run

### 1. Add your real API keys

```bash
# Edit .env with real credentials
OPENAI_API_KEY=sk-your-real-key          # Required for pipeline + e2e tests
YOUTUBE_API_KEY=AIza...                  # Required for trending tests; optional for youtube tests
PEXELS_API_KEY=...                       # Optional — enables b-roll tests
INSTAGRAM_ACCESS_TOKEN=...              # Optional — enables Instagram publish tests
INSTAGRAM_ACCOUNT_ID=...               # Optional — needed with access token
```

### 2. Run tests

```bash
# All tests
npm test

# Individual suites
npm run test:youtube      # YouTube transcript scraping, URL parsing, Data API
npm run test:pipeline     # All 7 AI steps with real GPT-4o / Ollama calls
npm run test:e2e          # Boots server, hits HTTP endpoints, real APIs
npm run test:trending     # Trending discovery: categories, regions, fetch + pipeline flow
npm run test:ratelimit    # Rate limiter unit tests (no API keys needed)
npm run test:research     # Google Trends + YouTube search validation
npm run test:instagram    # Instagram config check, platform switching
npm run test:autopilot    # Autopilot SSE stream, reel script generation
```

### Cost & Time

| Suite | Tests | Time | Cost | Needs Keys |
|-------|-------|------|------|------------|
| `test:youtube` | 20 | ~3 sec | $0 | Optional YOUTUBE_API_KEY (2 tests skip without) |
| `test:pipeline` | 12–15 | ~3-5 min | ~$0.10-0.30 | OPENAI_API_KEY or Ollama |
| `test:e2e` | 12–17 | ~4-6 min | ~$0.10-0.30 | OPENAI_API_KEY or Ollama |
| `test:trending` | 17 | ~30-60 sec | $0 | YOUTUBE_API_KEY, AI provider for pipeline steps |
| `test:ratelimit` | 9 | <1 sec | $0 | None |
| `test:research` | 7 | ~5-10 sec | $0 | None (uses Google Trends public API) |
| `test:instagram` | 6 | ~2 sec | $0 | None (tests graceful failure without config) |
| `test:autopilot` | 6 | ~5-60 sec | ~$0.01 | AI provider needed for reel-script test only |

---

## Test Suites Detail

### `tests/youtube.integration.test.js` — 20 tests

**No API key needed** (except 2 that auto-skip):

| Category | Tests | What it hits |
|----------|-------|-------------|
| Video ID Extraction | 7 | Pure logic — all URL formats (watch, youtu.be, embed, raw ID) |
| Channel Identifier Extraction | 5 | Pure logic — @handle, /channel/, /c/, /user/ |
| Transcript Scraping | 3 | **Real HTTP to youtube.com** — fetches pages, parses JSON, extracts captions XML |
| JSON Parser | 3 | `parsePlayerResponseJSON` — nested braces, missing marker, malformed |
| Video Details (API) | 1 | **Real YouTube Data API** — fetches metadata (skips without key) |
| Channel Top Videos (API) | 1 | **Real YouTube Data API** — fetches TED channel's top videos (skips without key) |

### `tests/pipeline.integration.test.js` — 12 tests

**Requires OPENAI_API_KEY or Ollama** (exits cleanly without):

| Test | Real API Call | What it validates |
|------|-------------|-------------------|
| Prompt template loading | No | `.txt` file loads, `{{variables}}` fill correctly |
| Direct AI call | **Yes** | Sends prompt, gets real response, checks length |
| Steps 1-7 | **Yes** | Full chained pipeline with real AI inference |
| Export | No | Validates markdown has all 7 section headers |
| Session state | No | All 7 result fields + selectedVideoIdea + currentStep populated |
| Error handling | No | Step dependency errors fire correctly |

### `tests/e2e.integration.test.js` — 12 tests

**Requires OPENAI_API_KEY or Ollama**:

| Test | What it does |
|------|-------------|
| Health check | `GET /health` — verifies server boots and reports key status |
| Create session | `POST /api/session` — creates real session via HTTP |
| Fetch real videos | `POST /api/fetch-videos` with real YouTube URLs |
| Fetch real transcripts | `POST /api/fetch-transcripts` — scrapes real YouTube pages |
| Steps 1-7 | Each pipeline step via `POST /api/pipeline/:step` — real AI calls |
| Export | `GET /api/export/:sessionId` — downloads full markdown package |
| Session verification | All 7 results populated after full run |
| Error paths | Session-not-found and step-dependency errors over HTTP |

### `tests/trending.integration.test.js` — 17 tests

**Requires YOUTUBE_API_KEY** (exits cleanly without):

| Test | What it does |
|------|-------------|
| Regions endpoint | `GET /api/regions` — lists supported regions, checks US and IN |
| US categories | `GET /api/categories?region=US` — validates Music, Gaming present |
| India categories | `GET /api/categories?region=IN` — validates categories exist |
| US trending (all cats) | `GET /api/trending?region=US&maxResults=10` — validates video structure |
| India Science & Tech | `GET /api/trending?region=IN&categoryId=28` — handles empty gracefully |
| UK Entertainment | `GET /api/trending?region=GB&categoryId=24` — validates results |
| US Gaming | `GET /api/trending?region=US&categoryId=20` — validates results |
| Nonexistent category | Verifies graceful empty array response |
| Full flow | discover → select 3 videos → load into session → fetch transcripts → run Steps 1-3 with AI |

### `tests/rateLimiter.test.js` — 9 tests

**No API keys needed** (pure unit tests):

| Test | What it validates |
|------|-------------------|
| Allow within limits | `acquire('ollama')` returns true |
| Track remaining tokens | Remaining decrements after acquire |
| Track daily counts | Daily remaining decrements |
| Unknown service | Throws `No rate limit config` |
| Custom cost | `acquire('youtube', 5)` deducts 5 tokens |
| Daily limit exceeded | Throws `Daily rate limit exceeded` when near cap |
| All service status | `getAllStatus()` returns all 5 services |
| Token refill | Tokens reset after window expires |
| Midnight daily reset | Daily count resets when past midnight boundary |

### `tests/research.integration.test.js` — 7 tests

**No API keys required** (uses Google Trends public API):

| Test | What it validates |
|------|-------------------|
| Trends score | `GET /api/research/trends?keyword=artificial+intelligence` — returns numeric score |
| Unknown keyword | Handles nonexistent keywords gracefully |
| Missing keyword | Returns error asking for keyword param |
| Related queries | `GET /api/research/related?keyword=python+programming` — top + rising arrays |
| Validate topic | `POST /api/research/validate` — returns overallScore, viable, recommendation |
| Missing topic | Returns error asking for topic |
| Rate limits status | `GET /api/rate-limits` — all 5 service statuses returned |

### `tests/instagram.test.js` — 6 tests

**No API keys required** (tests graceful degradation):

| Test | What it validates |
|------|-------------------|
| Status check | `GET /api/instagram/status` — reports `configured: false` when no tokens |
| Publish without config | `POST /api/instagram/publish` — fails gracefully with clear error |
| Missing videoUrl | `POST /api/instagram/publish` — requires videoUrl or sessionId |
| Switch to Instagram | `POST /api/session/platform` — changes session to `instagram` |
| Invalid platform | Rejects platform values other than `youtube`/`instagram` |
| Switch back to YouTube | Round-trip platform switching works |

### `tests/autopilot.integration.test.js` — 6 tests

**AI provider needed for reel-script test** (others work without):

| Test | What it validates |
|------|-------------------|
| Empty input | `POST /api/autopilot` rejects empty `selectedVideos` |
| SSE stream | Valid input starts SSE, first event has `status: running` and `totalVideos` |
| Unknown job | `GET /api/autopilot/:jobId` returns 404 for nonexistent |
| Reel script | `POST /api/pipeline/reel-script` — generates short-form script (skips if no AI) |
| Reel without analysis | Fails with dependency error if Step 1 not done |

---

## Bug Audit Summary

### 14 Bugs Found and Fixed

| # | File | Severity | Bug | Fix |
|---|------|----------|-----|-----|
| 1 | `youtube.js` | **Critical** | Transcript regex `(.+?)};` cuts JSON short at nested `};` | Brace-counting parser `parsePlayerResponseJSON` |
| 2 | `app.js` | **Critical** | Session lost on page refresh (memory only) | `localStorage` persistence + restore on load |
| 3 | `app.js` | **High** | No session check → silent failures | `ensureSession()` guard + auto-reload |
| 4 | `pipeline.js` | **High** | `require('uuid')` inside method | Top-level import |
| 5 | `pipeline.js` | **High** | Transcript context can exceed token limits | 30,000 char cap with truncation |
| 6 | `ai.js` | **High** | OpenAI client created with undefined key | Lazy getter with clear error |
| 7 | `ai.js` | **Medium** | Missing prompt file gives raw ENOENT | Friendly error message |
| 8 | `api.js` | **Medium** | Missing sessionId gives misleading 404 | Explicit 400 validation |
| 9 | `api.js` | **Medium** | NaN step accepted | Range validation (1-11) |
| 10 | `index.html` | **Medium** | Script idea textarea readonly | Removed readonly |
| 11 | `app.js` | **Medium** | Can jump to any step | `canAccessStep()` gating |
| 12 | `app.js` | **Medium** | Export only after step 7 | Enable after any step |
| 13 | `youtube.js` | **Low** | `pageToken: null` on first call | Changed to `undefined` |
| 14 | `youtube.js` | **Low** | No fetch timeout | 15s AbortController timeout |

---

## Known Limitations

1. **In-memory sessions**: Lost on server restart. Future: SQLite.
2. **Transcript scraping**: YouTube may block requests from some IPs/networks. Tests handle this gracefully (inconclusive, not failed).
3. **Token limits**: 30k char transcript cap mitigates but doesn't eliminate the risk for extremely long videos.
4. **Test cost**: Pipeline and E2E tests cost ~$0.10-0.30 per run in OpenAI credits. Free with Ollama.
5. **Instagram publish tests**: Cannot fully test publishing without a real Instagram Business account and valid long-lived token. The test suite validates config detection and error handling.
6. **Google Trends rate limiting**: The `google-trends-api` package hits Google Trends directly without an official API key, so aggressive test runs may trigger temporary blocks.
7. **Autopilot full-pipeline test**: A full autopilot run (with video assembly) takes several minutes and requires ffmpeg + yt-dlp + AI provider. The test suite validates SSE handshake and error paths without running the full pipeline.
