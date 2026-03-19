/**
 * AI Pipeline Integration Tests — makes real OpenAI API calls.
 *
 * This runs the full 7-step pipeline with real GPT-4o calls and validates
 * that each step returns meaningful, well-structured content.
 *
 * WARNING: This costs real OpenAI credits (~$0.10-0.30 per full run).
 *
 * Run:  npm test -- tests/pipeline.integration.test.js
 * Env:  OPENAI_API_KEY (required)
 *
 * Timeout: Individual steps can take 15-45 seconds. Full suite ~3-5 minutes.
 */
require('dotenv').config();
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

let pipeline, ai;
let sessionId;

const STEP_TIMEOUT = 60_000;

before(function () {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your-')) {
    console.log('\n  ❌ OPENAI_API_KEY not set or is placeholder. Add a real key to .env\n');
    process.exit(0);
  }
  // Fresh instances
  delete require.cache[require.resolve('../src/services/ai')];
  delete require.cache[require.resolve('../src/services/pipeline')];
  ai = require('../src/services/ai');
  pipeline = require('../src/services/pipeline');
});

describe('AI Service — Direct OpenAI Call', () => {
  it('loads prompt template and fills variables', () => {
    const template = ai.loadPrompt('analyze');
    assert.ok(template.includes('{{channelInfo}}'), 'template should have channelInfo placeholder');
    assert.ok(template.includes('{{videoData}}'), 'template should have videoData placeholder');

    const filled = ai.fillTemplate(template, {
      channelInfo: 'Test Channel',
      videoData: 'Test Video Data',
      transcripts: 'Test Transcript',
    });
    assert.ok(!filled.includes('{{channelInfo}}'), 'placeholder should be replaced');
    assert.ok(filled.includes('Test Channel'), 'variable should be inserted');
  });

  it('makes a real GPT-4o call and gets a response', { timeout: STEP_TIMEOUT }, async () => {
    const result = await ai.generate('channel-names', {
      analysis: 'This is a personal finance YouTube channel targeting millennials. The tone is casual and educational. Top topics include budgeting, investing, and side hustles.',
    });

    assert.equal(typeof result, 'string', 'response should be a string');
    assert.ok(result.length > 200, `response should be substantial, got ${result.length} chars`);
    console.log(`    ✓ Got ${result.length} chars from GPT-4o`);
    console.log(`    Preview: "${result.substring(0, 150)}..."`);
  });
});

describe('Full 7-Step Pipeline — Real AI Calls', () => {
  const seedVideos = [
    { id: 'test1', title: 'How I Saved $50,000 in One Year', url: 'https://youtube.com/watch?v=test1', viewCount: 2500000, likeCount: 85000, description: 'In this video I share my exact savings strategy...' },
    { id: 'test2', title: '5 Side Hustles That Actually Pay $1000/Month', url: 'https://youtube.com/watch?v=test2', viewCount: 1800000, likeCount: 62000, description: 'These are real side hustles I tested myself...' },
    { id: 'test3', title: 'Why You Should NOT Buy a House in 2025', url: 'https://youtube.com/watch?v=test3', viewCount: 3200000, likeCount: 120000, description: 'The housing market is tricky right now...' },
  ];

  const seedTranscripts = [
    { videoId: 'test1', title: 'How I Saved $50,000 in One Year', hasTranscript: true, transcript: 'Hey everyone welcome back to the channel. Today I want to talk about how I saved fifty thousand dollars in just twelve months. Now before you click away thinking this is impossible, let me tell you — I was making a pretty average salary. The key was a system I built around three pillars: automated savings, eliminating subscriptions I did not use, and a spending freeze challenge every other month. Let me break each one down for you.' },
    { videoId: 'test2', title: '5 Side Hustles That Actually Pay', hasTranscript: true, transcript: 'What is going on guys. So I have been testing side hustles for the past two years and I want to share the five that consistently bring in over a thousand dollars a month. Number one is freelance writing on Upwork. Number two is selling digital templates on Etsy. Number three is tutoring online. Number four is reselling on eBay. And number five might surprise you — it is managing social media for local businesses.' },
  ];

  before(() => {
    const session = pipeline.createSession();
    sessionId = session.id;

    session.input.videos = seedVideos;
    session.input.channelInfo = { name: 'FinanceFreak', description: 'Personal finance tips for millennials' };
    session.input.transcripts = seedTranscripts;
  });

  it('Step 1: Analyze — extracts channel blueprint from real data', { timeout: STEP_TIMEOUT }, async () => {
    const result = await pipeline.runStep(sessionId, 1);

    assert.equal(typeof result, 'string');
    assert.ok(result.length > 500, `analysis should be detailed, got ${result.length} chars`);

    const session = pipeline.getSession(sessionId);
    assert.equal(session.results.analysis, result, 'result should be stored in session');
    assert.ok(session.currentStep >= 1, 'currentStep should advance');

    // Check that the AI actually analyzed the content (not generic filler)
    const lower = result.toLowerCase();
    const hasRelevantContent = ['hook', 'tone', 'topic', 'structure', 'pacing', 'engagement', 'title', 'content'].some(word => lower.includes(word));
    assert.ok(hasRelevantContent, 'analysis should contain relevant strategy terms');

    console.log(`    ✓ Analysis: ${result.length} chars`);
    console.log(`    Preview: "${result.substring(0, 120)}..."`);
  });

  it('Step 2: Channel Names — generates real name suggestions', { timeout: STEP_TIMEOUT }, async () => {
    const result = await pipeline.runStep(sessionId, 2);

    assert.equal(typeof result, 'string');
    assert.ok(result.length > 300, `names output should be substantial, got ${result.length} chars`);

    const session = pipeline.getSession(sessionId);
    assert.equal(session.results.channelNames, result);

    console.log(`    ✓ Channel Names: ${result.length} chars`);
    console.log(`    Preview: "${result.substring(0, 120)}..."`);
  });

  it('Step 3: Video Ideas — generates real content ideas', { timeout: STEP_TIMEOUT }, async () => {
    const result = await pipeline.runStep(sessionId, 3);

    assert.equal(typeof result, 'string');
    assert.ok(result.length > 400, `ideas should be detailed, got ${result.length} chars`);

    const session = pipeline.getSession(sessionId);
    assert.equal(session.results.videoIdeas, result);

    console.log(`    ✓ Video Ideas: ${result.length} chars`);
    console.log(`    Preview: "${result.substring(0, 120)}..."`);
  });

  it('Step 4: Script — writes a complete video script', { timeout: STEP_TIMEOUT * 1.5 }, async () => {
    const result = await pipeline.runStep(sessionId, 4, {
      videoIdea: 'How to Build a 3-Month Emergency Fund Even If You Live Paycheck to Paycheck',
      additionalInstructions: 'Target audience is people aged 22-30. Keep it under 8 minutes.',
    });

    assert.equal(typeof result, 'string');
    assert.ok(result.length > 1000, `script should be long, got ${result.length} chars`);

    const session = pipeline.getSession(sessionId);
    assert.equal(session.results.script, result);
    assert.equal(session.selectedVideoIdea, 'How to Build a 3-Month Emergency Fund Even If You Live Paycheck to Paycheck');

    // A real script should have structural markers
    const lower = result.toLowerCase();
    const hasStructure = ['hook', 'intro', 'call to action', 'cta', 'subscribe'].some(word => lower.includes(word));
    assert.ok(hasStructure, 'script should contain structural elements like hook/CTA');

    console.log(`    ✓ Script: ${result.length} chars`);
    console.log(`    Preview: "${result.substring(0, 120)}..."`);
  });

  it('Step 5: Titles — generates CTR-optimized titles', { timeout: STEP_TIMEOUT }, async () => {
    const result = await pipeline.runStep(sessionId, 5);

    assert.equal(typeof result, 'string');
    assert.ok(result.length > 300, `titles should be detailed, got ${result.length} chars`);

    const session = pipeline.getSession(sessionId);
    assert.equal(session.results.titles, result);

    console.log(`    ✓ Titles: ${result.length} chars`);
    console.log(`    Preview: "${result.substring(0, 120)}..."`);
  });

  it('Step 6: Thumbnails — generates actionable thumbnail concepts', { timeout: STEP_TIMEOUT }, async () => {
    const result = await pipeline.runStep(sessionId, 6);

    assert.equal(typeof result, 'string');
    assert.ok(result.length > 300, `thumbnails should be detailed, got ${result.length} chars`);

    // Thumbnail descriptions should mention visual elements
    const lower = result.toLowerCase();
    const hasVisuals = ['color', 'text', 'font', 'background', 'thumbnail'].some(word => lower.includes(word));
    assert.ok(hasVisuals, 'thumbnail plan should mention visual elements');

    const session = pipeline.getSession(sessionId);
    assert.equal(session.results.thumbnails, result);

    console.log(`    ✓ Thumbnails: ${result.length} chars`);
    console.log(`    Preview: "${result.substring(0, 120)}..."`);
  });

  it('Step 7: Audio Brief — generates voiceover-ready brief', { timeout: STEP_TIMEOUT }, async () => {
    const result = await pipeline.runStep(sessionId, 7);

    assert.equal(typeof result, 'string');
    assert.ok(result.length > 300, `audio brief should be detailed, got ${result.length} chars`);

    const lower = result.toLowerCase();
    const hasAudioTerms = ['tone', 'pacing', 'voice', 'energy', 'script', 'narration'].some(word => lower.includes(word));
    assert.ok(hasAudioTerms, 'audio brief should mention narration-related terms');

    const session = pipeline.getSession(sessionId);
    assert.equal(session.results.audioBrief, result);

    console.log(`    ✓ Audio Brief: ${result.length} chars`);
    console.log(`    Preview: "${result.substring(0, 120)}..."`);
  });

  it('Export — produces a complete markdown document', () => {
    const markdown = pipeline.exportSession(sessionId);

    assert.equal(typeof markdown, 'string');
    assert.ok(markdown.includes('# TrendVideo'), 'should have main heading');
    assert.ok(markdown.includes('## 1. Channel Analysis'), 'should have analysis section');
    assert.ok(markdown.includes('## 2. Channel Name Ideas'), 'should have names section');
    assert.ok(markdown.includes('## 3. Video Ideas'), 'should have ideas section');
    assert.ok(markdown.includes('## 4. Video Script'), 'should have script section');
    assert.ok(markdown.includes('## 5. Title Options'), 'should have titles section');
    assert.ok(markdown.includes('## 6. Thumbnail Concepts'), 'should have thumbnails section');
    assert.ok(markdown.includes('## 7. Audio Brief'), 'should have audio brief section');

    console.log(`    ✓ Exported ${markdown.length} chars of markdown with all 7 sections`);
  });

  it('Session state is fully populated after all steps', () => {
    const session = pipeline.getSession(sessionId);

    assert.ok(session.results.analysis, 'analysis should be set');
    assert.ok(session.results.channelNames, 'channelNames should be set');
    assert.ok(session.results.videoIdeas, 'videoIdeas should be set');
    assert.ok(session.results.script, 'script should be set');
    assert.ok(session.results.titles, 'titles should be set');
    assert.ok(session.results.thumbnails, 'thumbnails should be set');
    assert.ok(session.results.audioBrief, 'audioBrief should be set');
    assert.ok(session.selectedVideoIdea, 'selectedVideoIdea should be set');
    assert.ok(session.currentStep >= 7, 'currentStep should be 7');

    const totalChars = Object.values(session.results).reduce((sum, v) => sum + (v?.length || 0), 0);
    console.log(`    ✓ All 7 results populated. Total AI output: ${totalChars.toLocaleString()} chars`);
  });
});

describe('Pipeline Error Handling with Real AI Service', () => {
  it('Step 2 fails without Step 1', async () => {
    const session = pipeline.createSession();
    session.input.videos = [{ id: 'x', title: 'X', url: 'http://y' }];
    await assert.rejects(
      () => pipeline.runStep(session.id, 2),
      { message: 'Step 1 (Analysis) must be completed first' }
    );
  });

  it('Step 4 fails without video idea', async () => {
    const session = pipeline.createSession();
    session.input.videos = [{ id: 'x', title: 'X', url: 'http://y' }];
    session.results.analysis = 'fake analysis';
    await assert.rejects(
      () => pipeline.runStep(session.id, 4),
      { message: 'Please select a video idea first' }
    );
  });

  it('Step 5 fails without script', async () => {
    const session = pipeline.createSession();
    session.results.analysis = 'fake';
    await assert.rejects(
      () => pipeline.runStep(session.id, 5),
      { message: 'Step 4 (Script) must be completed first' }
    );
  });
});
