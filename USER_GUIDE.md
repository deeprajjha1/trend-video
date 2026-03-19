# TrendVideo — User Guide

A complete guide to using TrendVideo: from installation to your first finished YouTube video or Instagram Reel.

---

## Table of Contents

1. [Installation](#1-installation)
2. [Configuration](#2-configuration)
3. [Running the App](#3-running-the-app)
4. [The 11-Step Pipeline (Manual Mode)](#4-the-11-step-pipeline-manual-mode)
5. [Autopilot Mode](#5-autopilot-mode)
6. [Research Validation](#6-research-validation)
7. [Instagram Reels](#7-instagram-reels)
8. [Rate Limiting](#8-rate-limiting)
9. [Output Files & Where They're Saved](#9-output-files--where-theyre-saved)
10. [Tips for Best Results](#10-tips-for-best-results)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Installation

### Prerequisites

| Tool | How to Install | Why |
|------|----------------|-----|
| **Node.js 18+** | [nodejs.org](https://nodejs.org/) or `brew install node` | Runs the app |
| **FFmpeg** | `brew install ffmpeg` | Assembles the final video (Step 11) |
| **yt-dlp** | `brew install yt-dlp` | Extracts frames from source videos (Step 10 fallback) |
| **Ollama** (optional) | `brew install ollama` | Free local AI — no API key needed |

### Setup

```bash
cd trend-video
cp .env.example .env      # Create your config file
npm install                # Install all dependencies
```

---

## 2. Configuration

Edit the `.env` file to configure your setup. There are two modes:

### Option A: Completely Free (Ollama)

Use a local AI model. No paid API keys. Everything runs on your machine.

```bash
AI_PROVIDER=ollama
AI_MODEL=qwen2.5:14b        # Recommended for quality (needs ~10 GB RAM)
# AI_MODEL=qwen2.5:7b       # Lighter option (~5 GB RAM)
# AI_MODEL=qwen2.5:32b      # Best quality (~20 GB RAM)
```

Before running TrendVideo, start Ollama and pull your model:

```bash
ollama pull qwen2.5:14b     # Download the model (one-time)
ollama serve                # Start the Ollama server
```

### Option B: OpenAI (Paid, Higher Quality)

Uses OpenAI's GPT-4o for the AI steps. Better quality output, but costs money per request.

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

### Optional Keys

| Key | What it unlocks | How to get it |
|-----|-----------------|---------------|
| `YOUTUBE_API_KEY` | Trending discovery + fetch videos by channel URL (Step 0) | [Google Cloud Console](https://console.cloud.google.com/) — enable YouTube Data API v3 |
| `PEXELS_API_KEY` | Download free b-roll video clips (Step 10) | [pexels.com/api](https://www.pexels.com/api/new/) — instant, free signup |
| `INSTAGRAM_ACCESS_TOKEN` | Publish Reels directly to Instagram | [Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/) |
| `INSTAGRAM_ACCOUNT_ID` | Your Instagram Business/Creator account ID | Same as above |

- Without `YOUTUBE_API_KEY`: no trending discovery, you paste video URLs manually.
- Without `PEXELS_API_KEY`: Step 10 extracts frames from the source video instead of downloading b-roll. If no source video is available either, Step 11 uses a solid-color background.
- Without `INSTAGRAM_*` keys: Instagram Reels mode is available for local video generation, but the "Publish to Instagram" button is disabled.

---

## 3. Running the App

```bash
npm run dev     # Development mode (auto-reloads on code changes)
npm start       # Production mode
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

The terminal will show your active configuration:

```
  🎬 TrendVideo running at http://localhost:3000
  🤖 AI provider:         ollama (qwen2.5:14b)
  📺 YouTube API key:     configured
  🎥 Pexels API key:      not set (frame extraction fallback)
```

---

## 4. The 11-Step Pipeline (Manual Mode)

The app is a wizard. You go through each step in order. The sidebar shows your progress.

### Platform Selector

At the top of the sidebar, you'll see a **YouTube / Instagram** toggle. This controls what kind of video Step 11 produces:
- **YouTube**: 16:9 landscape MP4 (default)
- **Instagram**: 9:16 vertical Reel (30-60 seconds)

Switch platforms at any time — it only affects video assembly and script length.

---

### Step 0: Discover Trends / Source Videos

**What you do:** Provide YouTube content to analyze. Three options:

1. **Discover Trending** (default tab) — Browse what's trending on YouTube right now. Select a category (Tech, Gaming, Music, Education, etc.), a region (US, UK, India, etc.), and how many results to show (5-50). Click "Fetch Trending" to load trending video cards. Select the ones you want to study by clicking on them, then click "Use Selected Videos".

2. **Channel URL** — Paste a channel URL like `https://www.youtube.com/@mkbhd` (requires YouTube API key).

3. **Video URLs** — Paste individual video URLs, one per line (no API key needed).

**What happens:** The app fetches video metadata (titles, views, likes, descriptions) and then scrapes transcripts from each video.

**Tip:** Use 5-15 videos from the same niche for best results. The trending tab is the fastest way to get started.

---

### Step 1: Analyze Channel

**What you do:** Click "Run Analysis"

**What the AI does:** Studies every video title, description, view count, and transcript to extract the exact formula — hook patterns, content structure, tone, topic selection, and audience engagement triggers.

**Output:** A detailed markdown report — the blueprint for your channel.

---

### Step 2: Channel Names

**What you do:** Click "Generate Names"

**What the AI does:** Creates 10 unique channel name ideas tailored to the niche, considering memorability, brand potential, SEO, and handle availability.

**Output:** 10 channel name suggestions with reasoning for each.

---

### Step 3: Video Ideas

**What you do:** Click "Generate Ideas"

**What the AI does:** Generates 10 high-potential video ideas based on proven patterns from the analyzed channel, content gaps, and trending angles.

**Output:** 10 video ideas with titles, one-line descriptions, and estimated potential.

**After this step:** You can optionally click **"Validate with Research"** to score each idea against real Google Trends and YouTube search data (see [Research Validation](#6-research-validation) below).

**Important:** You must **select or type a video idea** in the text box. This idea will be used for the script in Step 4.

---

### Step 4: Script Writer

**What you do:** Review the pre-filled video idea, optionally add instructions (e.g., "make it 8 minutes", "target beginners"), then click "Write Script"

**What the AI does:** Writes a complete, ready-to-record video script including a hook, problem framing, value delivery, call to action, and visual/B-roll notes.

**Output:** A full script in markdown format with section headers.

---

### Step 5: Title Maker

**What you do:** Click "Generate Titles"

**What the AI does:** Creates 10 click-worthy title options optimized for CTR, YouTube search algorithm, emotional triggers, and curiosity gaps.

**Output:** 10 ranked titles with a recommended best pick.

---

### Step 6: Thumbnail Planner

**What you do:** Click "Plan Thumbnails"

**What the AI does:** Designs 5 thumbnail concepts specifying text overlay (2-4 words max), color palette, visual composition, and emotional tone.

**Output:** 5 detailed thumbnail specs ready for Canva or Step 9.

---

### Step 7: Audio Brief

**What you do:** Click "Generate Audio Brief"

**What the AI does:** Transforms the script into a clean narration brief — stripped of visual cues, section headers, and formatting. Optimized for reading aloud or TTS.

**Output:** A narration-ready text brief.

**After Step 7:** You'll see a banner offering to continue to production or export the text package.

---

### Step 8: Voiceover

**What you do:** Pick a voice from the dropdown (10 options), then click "Generate Voiceover"

**What happens:** Microsoft Edge TTS (free, no API key) converts your script into a natural-sounding MP3 audio file. Markdown headers, visual notes, and formatting are stripped automatically.

**Output:** An MP3 file you can preview with the built-in audio player.

**Available voices:**

| Voice | Description |
|-------|-------------|
| Male US (Guy) | Clear American male — default |
| Female US (Jenny) | Natural American female |
| Male UK (Ryan) | British male |
| Female UK (Sonia) | British female |
| Male AU (William) | Australian male |
| Female AU (Natasha) | Australian female |
| Male Indian English (Prabhat) | Indian English male |
| Female Indian English (Neerja) | Indian English female |
| Male Hindi (Madhur) | Hindi male |
| Female Hindi (Swara) | Hindi female |

---

### Step 9: Thumbnail

**What you do:** Pick a color scheme (5 options), optionally type custom text, then click "Generate Thumbnail"

**What happens:** A 1280x720 YouTube thumbnail PNG is generated programmatically with bold text, high-contrast colors, text shadows, and accent elements. Text is auto-extracted from your titles (markdown formatting is cleaned automatically).

**Output:** A PNG image you can preview inline.

**Color schemes:**

| # | Background | Accent |
|---|-----------|--------|
| 1 | Dark navy | Red |
| 2 | Black | Gold |
| 3 | Red | White |
| 4 | Black | Green |
| 5 | Deep purple | Orange |

---

### Step 10: B-Roll / Frame Extraction

**What you do:** Click "Download B-Roll Clips" (or "Extract Frames" if no Pexels key)

**What happens (with `PEXELS_API_KEY`):**
1. Extracts visual keywords from your script
2. Searches Pexels for matching stock video clips
3. Downloads up to 8 clips in SD/HD quality

**What happens (without `PEXELS_API_KEY`):**
1. Downloads the source YouTube video using `yt-dlp`
2. Extracts up to 20 key frames at regular intervals using FFmpeg
3. Frames are scaled to 1280x720 and used as a Ken Burns-style slideshow in Step 11

**Output:** MP4 clips in `broll/` or JPG frames in `frames/`.

---

### Step 11: Final Video

**What you do:** Click "Assemble Video"

**Requires:** FFmpeg installed (`brew install ffmpeg`).

**What happens:** FFmpeg assembles your final video:

- **With b-roll (Pexels):** B-roll clips are concatenated, scaled to 1280x720, and looped to match voiceover duration.
- **With extracted frames:** A Ken Burns-style slideshow (slow zoom/pan) synced to voiceover duration.
- **Without either:** A solid-color background for the full duration.

**If platform is YouTube:** Produces a 16:9 `final-video.mp4`.
**If platform is Instagram:** Produces a 9:16 `final-reel.mp4` (30-60s). You'll also see a **Publish to Instagram** panel if your Instagram tokens are configured.

**Output:** A complete video file you can upload directly.

---

## 5. Autopilot Mode

Autopilot runs the entire 11-step pipeline automatically for multiple videos at once.

### How to use it

1. Go to **Step 0 → Discover Trending** tab
2. Fetch trending videos and select the ones you want
3. Click **"Autopilot"** (lightning bolt button next to "Use Selected Videos")
4. In the Autopilot panel:
   - **Voice**: Choose from 10 TTS voices
   - **Color Scheme**: Choose thumbnail color scheme
5. Click **"Start Autopilot"**

### What happens

For each selected video, the system automatically:
- Creates a new session
- Fetches and scrapes transcripts
- Runs all AI generation steps (1, 3, 4, 5, 6, 7)
- Generates voiceover (Step 8)
- Creates thumbnail (Step 9)
- Extracts frames or downloads b-roll (Step 10)
- Assembles final video (Step 11)

### Real-time progress

The progress panel shows:
- Current video being processed (e.g., "2/5")
- Current step (e.g., "Step 4: Writing Script")
- Live log of completed actions
- Final results with download links for each produced video

Autopilot uses Server-Sent Events (SSE) for real-time streaming — you see progress as it happens, not after.

### Autopilot tips

- Start with 1-2 videos to verify your setup works
- The AI picks the best video idea from Step 3 automatically
- Each video takes 3-8 minutes depending on AI provider speed
- Produced videos are saved to separate session folders in `output/`

---

## 6. Research Validation

After generating video ideas in Step 3, you can validate them against real data.

### How to use it

1. Complete Step 3 (Generate Video Ideas)
2. Click **"Validate with Research"** button below the ideas
3. Wait for scoring (5-15 seconds per idea)

### What you get

Each idea is scored on four dimensions:

| Metric | Weight | Source |
|--------|--------|--------|
| Trend Score | 35% | Google Trends — current interest level (0-100) |
| Search Volume | 30% | YouTube search results — demand signal |
| Competition | 20% | Existing video count — lower is better |
| Freshness | 15% | Trend momentum — rising vs declining |

**Overall Score (0-100):**
- 70+ = Strong pick, high confidence
- 40-69 = Viable, worth considering
- Below 40 = Weak signal, probably skip

Each idea also gets a text recommendation: "Strong pick", "Worth exploring", or "Consider alternatives".

### Research validation tips

- Scores reflect real-time data — they change as trends shift
- A low trend score doesn't mean the topic is bad, just that it's not trending *right now*
- Use research to compare ideas, not as an absolute filter

---

## 7. Instagram Reels

TrendVideo can produce 9:16 vertical Instagram Reels instead of (or in addition to) YouTube videos.

### Switching to Instagram mode

Click the **Instagram** button in the platform selector at the top of the sidebar. The button turns active when selected.

### What changes in Instagram mode

- **Step 4 (Script)**: You can click "Generate Reel Script" for a short-form 30-60 second script optimized for vertical scrolling (hook in first 2 seconds, fast cuts, text overlay cues)
- **Step 11 (Video Assembly)**: Produces a 1080x1920 (9:16) vertical `final-reel.mp4` instead of a landscape MP4
- **Publish panel**: After Step 11, a "Publish to Instagram" panel appears with a caption editor and one-click publishing

### Publishing to Instagram

Requirements:
- `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_ACCOUNT_ID` in `.env`
- An Instagram Business or Creator account
- The video must be publicly accessible via URL (for Meta's servers to fetch it)

To publish:
1. Complete Step 11 in Instagram mode
2. Edit the auto-generated caption
3. Click "Publish to Instagram"
4. The system creates a media container, waits for processing, and publishes

### Getting Instagram API credentials

1. Create a [Meta Developer App](https://developers.facebook.com/)
2. Add the Instagram Graph API product
3. Generate a User Access Token with `instagram_content_publish` and `instagram_basic` permissions
4. Find your Instagram Account ID via the Graph API Explorer

---

## 8. Rate Limiting

TrendVideo has built-in rate limiting to protect your API quotas.

### What's rate-limited

| API | Per-Minute Limit | Daily Limit |
|-----|-----------------|-------------|
| YouTube Data API | 50 requests | 9,500/day |
| Google Trends | 10 requests | 1,000/day |
| Instagram Graph API | 25 requests | 200/day |
| OpenAI | 20 requests | Unlimited |
| Ollama | 100 requests | Unlimited |

### How it works

- The rate limiter uses a token-bucket algorithm with automatic refill
- If you hit a per-minute limit, the system waits automatically and retries
- If you hit a daily limit, you get a clear error message
- Daily counters reset at midnight

### Checking your usage

Visit `GET /api/rate-limits` (or check the browser dev tools) to see remaining tokens and daily usage for each API.

---

## 9. Output Files & Where They're Saved

All generated production files are saved to:

```
trend-video/output/<session-id>/
```

Each session gets a unique UUID folder. Inside you'll find:

```
output/
└── a1b2c3d4-e5f6-7890-abcd-ef1234567890/
    ├── voiceover.mp3          ← Step 8: Narration audio
    ├── thumbnail.png          ← Step 9: YouTube thumbnail (1280x720)
    ├── frames/                ← Step 10: Extracted source video frames
    │   ├── frame-001.jpg
    │   ├── frame-002.jpg
    │   └── ...
    ├── broll/                 ← Step 10: Stock video clips (if Pexels key set)
    │   ├── clip-001.mp4
    │   └── ...
    ├── final-video.mp4        ← Step 11: YouTube video (16:9)
    └── final-reel.mp4         ← Step 11: Instagram Reel (9:16, if Instagram mode)
```

### Finding your session ID

Your session ID is shown in:
- The browser's `localStorage` (key: `trendvideo_session`)
- The `output/` directory — there will be one folder per session
- The server logs when API calls are made

### Text exports

The "Export Package" button (sidebar) downloads a `trendvideo-content-package.md` file containing all text outputs from Steps 1-7 plus metadata from Steps 8-11.

---

## 10. Tips for Best Results

### Choosing source videos

- Pick **10-15 top-performing videos** from a single channel or niche
- Focus on videos with high view-to-subscriber ratios
- Include a mix of recent and evergreen content
- The **Discover Trending** tab is the fastest way to find high-performing content

### Script quality

- Use the "Additional Instructions" field in Step 4 to specify video length, target audience, or style preferences
- After generating, review the script and regenerate if needed — each generation is different
- For Instagram Reels, use the dedicated "Reel Script" generator for properly short content

### Voiceover

- Listen to the preview before assembling the video
- UK voices work well for professional/educational content, US for casual
- Hindi voices are available for Hindi-language content targeting Indian audiences

### Thumbnail

- YouTube thumbnails are viewed at tiny sizes — use 2-4 words maximum
- The auto-extracted text from your titles usually works well
- Use the custom text field only if you want something different from the title

### AI Provider choice

- **Ollama (free):** Use `qwen2.5:14b` or larger for good quality. 7B works but produces shorter, less detailed outputs.
- **OpenAI (paid):** Best output quality, especially for scripts and analysis. Costs roughly $0.01-0.05 per step.

### Autopilot vs Manual

- Use **Manual mode** when you want full control over each step and want to review/edit between steps
- Use **Autopilot** when you want to batch-produce multiple videos quickly — it makes optimal choices automatically

---

## 11. Troubleshooting

### "OPENAI_API_KEY is not set"

You're using `AI_PROVIDER=openai` but haven't set the key. Either add your OpenAI key to `.env` or switch to `AI_PROVIDER=ollama`.

### "FFmpeg is not installed"

Step 11 needs FFmpeg. Install it: `brew install ffmpeg`

### "yt-dlp: command not found"

Frame extraction (Step 10 fallback) needs yt-dlp. Install it: `brew install yt-dlp`

### "PEXELS_API_KEY not set"

Step 10 will fall back to extracting frames from the source YouTube video. If you want stock b-roll instead, get a free key at [pexels.com/api](https://www.pexels.com/api/new/).

### Ollama "connection refused"

Make sure Ollama is running: `ollama serve`. And that your model is downloaded: `ollama pull qwen2.5:14b`.

### Categories dropdown shows only "All Categories"

Your `YOUTUBE_API_KEY` may be invalid or the server was started before the key was added. Verify the key is correct in `.env`, then restart the server (`npm run dev`).

### Session lost after server restart

Sessions are stored in memory. Restarting the server clears all sessions. Your generated files in `output/` are preserved, but you'll need to start a new session in the browser.

### Transcript fetching fails

Some YouTube videos have transcripts disabled. The pipeline will still work — it just analyzes titles, descriptions, and view patterns instead. For best results, choose videos that have captions/subtitles.

### Video assembly is slow

FFmpeg video encoding can take 30-60 seconds for a 5-10 minute video. The loading spinner will keep spinning — wait for it to complete.

### Autopilot shows "Connection error"

Make sure your AI provider is running. If using Ollama, verify with `ollama list` that the model is available and `ollama serve` is active.

### Instagram "not configured"

You need both `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_ACCOUNT_ID` in your `.env` file. See [Instagram Reels](#7-instagram-reels) for setup instructions.

### "Daily rate limit exceeded"

You've exhausted your daily API quota for that service. YouTube Data API v3 has a default daily quota of 10,000 units. Wait until midnight (UTC) for the reset, or use a different API key.

### Black screen / empty video

If your video has audio but no visuals: make sure `yt-dlp` is installed for frame extraction. Without both Pexels b-roll and source frames, the video falls back to a solid-color background.
