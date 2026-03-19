# TrendVideo — 5-Minute Demo Recording Script

> **Purpose**: Record a 5-minute walkthrough showing TrendVideo end-to-end.
> **Tool**: Loom (free), OBS Studio, or QuickTime (Mac: File > New Screen Recording).
> **Resolution**: 1920x1080 recommended. Dark mode browser preferred (matches the UI).

---

## Pre-Recording Setup (do before you hit Record)

```bash
# 1. Terminal — start the server
cd ~/Downloads/trend-video
npm run dev

# 2. Verify health
curl http://localhost:3000/health
```

- Open **http://localhost:3000** in Chrome/Firefox
- Close other tabs so the browser looks clean
- Make sure the dark-themed UI is visible with the sidebar and "Source Videos" step active
- Have 3 YouTube video URLs ready to paste (pick a niche — fitness, finance, cooking, tech tutorials)

**Suggested URLs** (tech tutorial niche):
```
https://www.youtube.com/watch?v=rfscVS0vtbw
https://www.youtube.com/watch?v=kqtD5dpn9C8
https://www.youtube.com/watch?v=8jLOx1hD3_o
```

---

## Recording Script

### INTRO — 0:00 to 0:30 (30 seconds)

**[Show the landing page]**

> "This is TrendVideo — an open-source tool that reverse-engineers successful YouTube channels and generates a complete video content package, from analysis to a finished MP4 file.
>
> It runs as a local web app. You give it YouTube video URLs, and it runs an 11-step AI pipeline that analyzes the channel's formula, generates original content based on those patterns, and then produces the actual video assets — voiceover, thumbnail, and assembled video.
>
> Let me show you the full pipeline."

**[Point out the sidebar]** — "These are the 11 steps. Steps 1 through 7 use AI for content generation. Steps 8 through 11 are production — all free, no API costs."

**[Point out the provider badge]** — "You can see here it's running on [OpenAI/Ollama]. You can swap between paid and free AI with one line in the config."

---

### STEP 0: Source Videos — 0:30 to 1:00 (30 seconds)

**[Click the "Video URLs" tab]**

> "First, I'll paste some YouTube video URLs from a channel I want to study. You can also paste a channel URL if you have a YouTube API key."

**[Paste 3 URLs into the textarea]**

**[Click "Fetch Videos"]**

> "It fetches the video metadata and transcripts. The transcripts are the key — they let the AI understand exactly how these creators structure their content."

**[Wait for results to load, show the video cards]**

---

### STEP 1: Analyze Channel — 1:00 to 1:45 (45 seconds)

**[Click Step 1 in sidebar]**

**[Click "Analyze Channel" button]**

> "Step 1 analyzes the content patterns. It looks at script structure, hook styles, pacing, tone, engagement tactics, and title/thumbnail patterns."

**[Wait for results — takes 15-30 seconds with OpenAI, 30-60 with Ollama]**

**[Scroll through the analysis]**

> "It identified [mention 1-2 specific things from the analysis, e.g., 'they use question hooks and list-based pacing']. This blueprint drives everything that comes next."

---

### STEP 2: Channel Names — 1:45 to 2:15 (30 seconds)

**[Click Step 2 in sidebar]**

**[Click "Generate Names"]**

> "Based on the analysis, it generates 10 channel name ideas with taglines and reasoning."

**[Wait for results, scroll briefly]**

> "Each name comes with a handle availability hint and an explanation of why it fits the niche."

---

### STEP 3: Video Ideas — 2:15 to 2:45 (30 seconds)

**[Click Step 3, click "Generate Ideas"]**

> "Now it generates 5 video ideas, each with a working title, target emotion, retention strategy, and difficulty rating."

**[Wait, show results]**

> "I'll pick idea number 1 for the next step — [read the title briefly]."

---

### STEP 4: Script Writer — 2:45 to 3:15 (30 seconds)

**[Click Step 4]**

**[Type "1" in the video idea selection or select from dropdown, click "Write Script"]**

> "This is the big one — it writes a full video script with hook, problem setup, value delivery, key points, and call to action."

**[Wait for results — this is the longest step, 30-60 seconds]**

**[Scroll through the script]**

> "The script follows the exact structure it identified in Step 1. Notice it includes visual notes and pacing directions."

---

### STEP 5-7: Titles, Thumbnails, Audio Brief — 3:15 to 3:45 (30 seconds)

**[Click through Steps 5, 6, 7 quickly — click Generate for each]**

> "Steps 5, 6, and 7 generate click-worthy titles with CTR predictions, thumbnail design concepts with color schemes, and a voiceover brief with pacing and emphasis directions."

**[Show each result briefly as it loads]**

---

### STEP 8: Voiceover — 3:45 to 4:15 (30 seconds)

**[Click Step 8]**

> "Now we move to production. Step 8 generates an actual voiceover MP3 from the script using Edge TTS — completely free."

**[Select a voice from the dropdown — e.g., "Male US"]**

**[Click "Generate Voiceover"]**

**[Wait ~10-20 seconds]**

**[Play the audio preview in the browser]**

> "That's an AI-generated voiceover from the script we wrote. Free, no API key needed."

---

### STEP 9: Thumbnail — 4:15 to 4:30 (15 seconds)

**[Click Step 9, pick a color scheme, click "Generate Thumbnail"]**

> "Step 9 generates a 1280x720 YouTube thumbnail. You can pick from different color schemes."

**[Show the generated thumbnail in the preview]**

---

### STEP 10-11: B-Roll & Final Video — 4:30 to 5:00 (30 seconds)

**[Click Step 10]**

> "Step 10 downloads free stock footage from Pexels to use as b-roll. If you don't have a Pexels key, that's fine — Step 11 will use a solid background instead."

**[Click Step 11, click "Assemble Video"]**

> "And Step 11 assembles everything — voiceover audio plus video — into a final MP4 using FFmpeg."

**[Wait for assembly, show the video player preview]**

> "There it is. From three YouTube URLs to a finished video — script, voiceover, thumbnail, and assembled MP4 — all generated automatically."

**[Show the output folder]**

> "Everything is saved locally under the output folder with your session ID."

---

### OUTRO — at 5:00

> "TrendVideo is open source and runs entirely on your machine. You can use it with OpenAI for best quality, or Ollama for completely free local AI.
>
> Star the repo if you found this useful. Link in the description."

---

## Post-Recording Notes

- **Editing**: Trim dead air while waiting for AI responses. Speed up loading spinners to 2-4x.
- **Thumbnail for the demo video**: Use one of the thumbnails generated by the tool itself.
- **Output files location**: `output/<session-id>/` — show this in Finder/terminal for credibility.
- **Total run time**: Steps 1-7 take ~3-5 minutes with OpenAI (longer with Ollama). Steps 8-11 take ~30 seconds. Speed up the waiting parts in editing.
