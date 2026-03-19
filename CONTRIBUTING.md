# Contributing to TrendVideo

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/trend-video.git`
3. Install dependencies: `npm install`
4. Install system tools: `brew install ffmpeg yt-dlp`
5. Copy the env file: `cp .env.example .env`
6. Configure your AI provider (see [README](README.md#configuration))
7. Start the dev server: `npm run dev`

## Development Workflow

1. Create a branch from `main`: `git checkout -b feature/your-feature`
2. Make your changes
3. Run the relevant tests (see below)
4. Commit with a clear message
5. Push and open a Pull Request

## Running Tests

```bash
npm test                 # All tests
npm run test:youtube     # YouTube scraping (free, no keys needed)
npm run test:ratelimit   # Rate limiter unit tests (free, no keys needed)
npm run test:research    # Google Trends validation (free, no keys needed)
npm run test:instagram   # Instagram service tests (free, no keys needed)
npm run test:pipeline    # AI pipeline (requires AI provider)
npm run test:e2e         # End-to-end (requires AI provider)
npm run test:trending    # Trending discovery (requires YOUTUBE_API_KEY)
npm run test:autopilot   # Autopilot pipeline (requires AI provider)
```

Tests that need API keys skip cleanly when keys aren't set — you don't need every key to contribute.

## Project Structure

```
src/
├── config.js              # All constants — add new config values here
├── services/              # Business logic (one file per concern)
├── routes/api.js          # Express route definitions
└── prompts/               # AI prompt templates (*.txt)
public/                    # Frontend (vanilla HTML/CSS/JS)
tests/                     # Integration + unit tests
```

## Code Style

- **No frameworks** on the frontend — vanilla HTML/CSS/JS only
- **Node.js built-in test runner** — no Mocha/Jest
- **Standard Express patterns** on the backend
- Keep `server.js` thin — logic goes in `src/services/`
- All magic numbers and defaults go in `src/config.js`
- AI prompts are stored as `.txt` files in `src/prompts/`
- Environment variables for secrets, `config.js` for everything else

## Adding a New Pipeline Step

1. Add the prompt template in `src/prompts/your-step.txt`
2. Add the step method in `src/services/pipeline.js`
3. Wire up the route in `src/routes/api.js`
4. Add the UI step in `public/index.html` and `public/js/app.js`
5. Add config values to `src/config.js`
6. Write a test in `tests/`

## Adding a New Service

1. Create `src/services/your-service.js`
2. Export a singleton instance
3. Add rate limit config in `src/config.js` if it calls an external API
4. Wire up routes in `src/routes/api.js`
5. Write tests

## What to Contribute

Check the [Issues](https://github.com/YOUR_USERNAME/trend-video/issues) tab for open tasks. Good areas:

- **New AI prompts** — better prompt engineering for any step
- **New voices** — add more Edge TTS voice options
- **New regions** — add countries to the trending regions list
- **Bug fixes** — especially around transcript scraping edge cases
- **Tests** — more coverage is always welcome
- **Documentation** — improve the user guide, add examples

## Reporting Bugs

Use the [Bug Report](https://github.com/YOUR_USERNAME/trend-video/issues/new?template=bug_report.md) template. Include:

- Steps to reproduce
- Expected vs actual behavior
- Your AI provider (OpenAI/Ollama) and model
- Node.js version (`node --version`)
- OS

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Update tests if you change behavior
- Update documentation if you change user-facing features
- Don't commit `.env` files or API keys
- Run `npm test` before submitting (at minimum `test:youtube` and `test:ratelimit` which need no keys)

## Questions?

Open a [Discussion](https://github.com/YOUR_USERNAME/trend-video/discussions) or file an issue. We're happy to help.
