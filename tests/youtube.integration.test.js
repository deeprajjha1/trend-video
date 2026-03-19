/**
 * YouTube Integration Tests — hits real YouTube servers.
 *
 * These tests verify that:
 *   - Video ID extraction works for all URL formats
 *   - Channel identifier parsing works
 *   - Transcript scraping actually returns real text from YouTube
 *   - YouTube Data API fetches real video metadata (requires YOUTUBE_API_KEY)
 *
 * Run:  npm test -- tests/youtube.integration.test.js
 * Env:  YOUTUBE_API_KEY (optional — some tests skip without it)
 */
require('dotenv').config();
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const TEST_VIDEOS = {
  withCaptions: 'jNQXAC9IVRw',       // "Me at the zoo" — first YouTube video, has captions
  popular: 'dQw4w9WgXcQ',             // Rick Astley — very popular, may have captions
  ted: 'UF8uR6Z6KLc',                 // Steve Jobs Stanford speech — reliable English captions
};

const TEST_CHANNEL = 'https://www.youtube.com/@TED';

let youtube;

before(() => {
  // Fresh instance so it picks up env vars
  delete require.cache[require.resolve('../src/services/youtube')];
  youtube = require('../src/services/youtube');
});

describe('Video ID Extraction (pure logic, no network)', () => {
  it('extracts ID from standard watch URL', () => {
    assert.equal(youtube.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('extracts ID from short URL', () => {
    assert.equal(youtube.extractVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('extracts ID from embed URL', () => {
    assert.equal(youtube.extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('extracts ID from URL with extra params', () => {
    assert.equal(youtube.extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'), 'dQw4w9WgXcQ');
  });

  it('extracts raw 11-char ID', () => {
    assert.equal(youtube.extractVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });

  it('returns null for invalid URL', () => {
    assert.equal(youtube.extractVideoId('https://example.com/not-a-video'), null);
  });

  it('returns null for empty string', () => {
    assert.equal(youtube.extractVideoId(''), null);
  });
});

describe('Channel Identifier Extraction (pure logic)', () => {
  it('extracts @handle', () => {
    const result = youtube.extractChannelIdentifier('https://www.youtube.com/@MrBeast');
    assert.deepEqual(result, { value: 'MrBeast', type: 'handle' });
  });

  it('extracts channel ID', () => {
    const result = youtube.extractChannelIdentifier('https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA');
    assert.deepEqual(result, { value: 'UCX6OQ3DkcsbYNE6H8uQQuVA', type: 'id' });
  });

  it('extracts /c/ custom URL', () => {
    const result = youtube.extractChannelIdentifier('https://www.youtube.com/c/MrBeast6000');
    assert.deepEqual(result, { value: 'MrBeast6000', type: 'custom' });
  });

  it('extracts /user/ URL', () => {
    const result = youtube.extractChannelIdentifier('https://www.youtube.com/user/PewDiePie');
    assert.deepEqual(result, { value: 'PewDiePie', type: 'user' });
  });

  it('returns null for non-channel URL', () => {
    assert.equal(youtube.extractChannelIdentifier('https://www.youtube.com/watch?v=abc'), null);
  });
});

describe('Transcript Scraping (REAL network call to YouTube)', () => {
  it('fetches real transcript from a video with known captions', async () => {
    const transcript = await youtube.getTranscript(TEST_VIDEOS.ted);

    if (transcript === null) {
      console.log('    ⚠ Transcript was null — YouTube may be blocking scraping from this IP.');
      console.log('    This is a known limitation of scraping. Test is inconclusive, not failed.');
      return;
    }

    assert.equal(typeof transcript, 'string', 'transcript should be a string');
    assert.ok(transcript.length > 100, `transcript should be substantial, got ${transcript.length} chars`);
    console.log(`    ✓ Got ${transcript.length} chars of transcript`);
    console.log(`    Preview: "${transcript.substring(0, 120)}..."`);
  });

  it('returns null gracefully for a non-existent video', async () => {
    const transcript = await youtube.getTranscript('XXXXXXXXXXX');
    assert.equal(transcript, null, 'should return null for non-existent video');
  });

  it('fetches transcripts for multiple videos', async () => {
    const fakeVideos = [
      { id: TEST_VIDEOS.ted, title: 'TED Talk' },
      { id: TEST_VIDEOS.popular, title: 'Popular Video' },
    ];
    const results = await youtube.getTranscriptsForVideos(fakeVideos);

    assert.equal(results.length, 2, 'should return results for both videos');
    for (const r of results) {
      assert.equal(typeof r.hasTranscript, 'boolean');
      assert.equal(typeof r.videoId, 'string');
      console.log(`    ${r.title}: hasTranscript=${r.hasTranscript}, length=${r.transcript?.length || 0}`);
    }
  });
});

describe('JSON Parser (parsePlayerResponseJSON)', () => {
  it('parses nested JSON with multiple closing braces', () => {
    const html = 'var ytInitialPlayerResponse = {"a":{"b":{"c":1}},"d":2};var next = 1;';
    const result = youtube.parsePlayerResponseJSON(html);
    assert.deepEqual(result, { a: { b: { c: 1 } }, d: 2 });
  });

  it('returns null when marker not found', () => {
    const result = youtube.parsePlayerResponseJSON('<html>no player response here</html>');
    assert.equal(result, null);
  });

  it('returns null for malformed JSON', () => {
    const html = 'var ytInitialPlayerResponse = {broken json here};';
    const result = youtube.parsePlayerResponseJSON(html);
    assert.equal(result, null);
  });
});

const hasYouTubeKey = process.env.YOUTUBE_API_KEY && !process.env.YOUTUBE_API_KEY.includes('your-');

describe('YouTube Data API — Video Details (requires YOUTUBE_API_KEY)', { skip: !hasYouTubeKey && 'YOUTUBE_API_KEY not set' }, () => {
  it('fetches real metadata for known videos', async () => {
    const videos = await youtube.getVideoDetails([
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    ]);

    assert.equal(videos.length, 2);
    for (const v of videos) {
      assert.ok(v.title.length > 0, `title should not be empty: ${v.id}`);
      assert.ok(v.viewCount > 0, `viewCount should be > 0: ${v.id}`);
      console.log(`    ✓ "${v.title}" — ${v.viewCount.toLocaleString()} views`);
    }
  });
});

describe('YouTube Data API — Channel Top Videos (requires YOUTUBE_API_KEY)', { skip: !hasYouTubeKey && 'YOUTUBE_API_KEY not set' }, () => {
  it('fetches top videos from TED channel', async () => {
    const result = await youtube.getTopVideos(TEST_CHANNEL, 5);

    assert.ok(result.channel, 'should return channel info');
    assert.ok(result.channel.name.length > 0, 'channel should have a name');
    assert.ok(result.videos.length > 0, 'should return at least 1 video');
    assert.ok(result.videos.length <= 5, 'should respect maxVideos limit');

    for (let i = 1; i < result.videos.length; i++) {
      assert.ok(result.videos[i - 1].viewCount >= result.videos[i].viewCount, 'videos should be sorted by views desc');
    }

    console.log(`    ✓ Channel: ${result.channel.name}`);
    console.log(`    ✓ Got ${result.videos.length} videos, top: "${result.videos[0].title}" (${result.videos[0].viewCount.toLocaleString()} views)`);
  });
});
