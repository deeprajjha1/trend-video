const { EdgeTTS } = require('edge-tts-universal');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class VoiceoverService {
  cleanScriptForNarration(script) {
    return script
      .replace(/^#{1,6}\s+.*$/gm, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^[-*]\s+/gm, '')
      .replace(/---+/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async generate(script, outputDir, options = {}) {
    const voiceId = config.voiceover.voices[options.voice] || options.voice || config.voiceover.defaultVoice;

    const cleanScript = this.cleanScriptForNarration(script);
    if (!cleanScript || cleanScript.length < config.voiceover.minScriptLength) {
      throw new Error('Script is too short or empty after cleaning');
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, 'voiceover.mp3');

    const tts = new EdgeTTS(cleanScript, voiceId, {
      rate: options.rate || config.voiceover.defaultRate,
      pitch: options.pitch || config.voiceover.defaultPitch,
    });

    const result = await tts.synthesize();
    const buffer = Buffer.from(await result.audio.arrayBuffer());

    if (buffer.length < config.voiceover.minAudioBytes) {
      throw new Error('Generated audio file is suspiciously small — TTS may have failed');
    }

    fs.writeFileSync(outputPath, buffer);

    return {
      path: outputPath,
      size: buffer.length,
      voice: voiceId,
      scriptLength: cleanScript.length,
    };
  }

  getAvailableVoices() {
    return Object.entries(config.voiceover.voices).map(([key, id]) => ({ key, id }));
  }
}

module.exports = new VoiceoverService();
