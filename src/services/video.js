const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const config = require('../config');

const execFileAsync = promisify(execFile);

class VideoAssemblyService {
  async checkFfmpeg() {
    try {
      await execFileAsync('ffmpeg', ['-version']);
      return true;
    } catch {
      return false;
    }
  }

  async getMediaDuration(filePath) {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath,
    ]);
    return parseFloat(stdout.trim());
  }

  async assembleVideo(outputDir, options = {}) {
    const available = await this.checkFfmpeg();
    if (!available) {
      throw new Error('FFmpeg is not installed. Run: brew install ffmpeg');
    }

    const voiceoverPath = path.join(outputDir, 'voiceover.mp3');
    if (!fs.existsSync(voiceoverPath)) {
      throw new Error('Voiceover file not found. Run Step 8 first.');
    }

    const audioDuration = await this.getMediaDuration(voiceoverPath);
    const outputPath = path.join(outputDir, 'final-video.mp4');

    const brollDir = path.join(outputDir, 'broll');
    const clips = fs.existsSync(brollDir)
      ? fs.readdirSync(brollDir).filter(f => f.endsWith('.mp4')).sort()
      : [];

    const framesDir = path.join(outputDir, 'frames');
    const frames = fs.existsSync(framesDir)
      ? fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg')).sort().map(f => path.join(framesDir, f))
      : [];

    if (clips.length > 0) {
      await this.assembleWithBroll(voiceoverPath, brollDir, clips, audioDuration, outputPath);
    } else if (frames.length > 0) {
      await this.assembleWithFrames(voiceoverPath, framesDir, frames, audioDuration, outputPath);
    } else {
      await this.assembleWithSolidBackground(voiceoverPath, audioDuration, outputPath, options);
    }

    const stats = fs.statSync(outputPath);
    return {
      path: outputPath,
      size: stats.size,
      duration: audioDuration,
      hasBroll: clips.length > 0,
      clipCount: clips.length,
    };
  }

  async assembleWithBroll(voiceoverPath, brollDir, clips, targetDuration, outputPath) {
    const { brollDurationBufferSec, fallbackClipDurationSec, outputWidth, outputHeight, preset, crf, audioBitrate, ffmpegTimeoutMs } = config.video;
    const concatFile = path.join(brollDir, 'concat.txt');
    let accumulatedDuration = 0;
    const concatEntries = [];

    while (accumulatedDuration < targetDuration + brollDurationBufferSec) {
      for (const clip of clips) {
        const clipPath = path.join(brollDir, clip);
        concatEntries.push(`file '${clipPath}'`);
        try {
          accumulatedDuration += await this.getMediaDuration(clipPath);
        } catch {
          accumulatedDuration += fallbackClipDurationSec;
        }
        if (accumulatedDuration >= targetDuration + brollDurationBufferSec) break;
      }
    }

    fs.writeFileSync(concatFile, concatEntries.join('\n'));

    await execFileAsync('ffmpeg', [
      '-y',
      '-f', 'concat', '-safe', '0', '-i', concatFile,
      '-i', voiceoverPath,
      '-c:v', 'libx264', '-preset', preset, '-crf', crf,
      '-c:a', 'aac', '-b:a', audioBitrate,
      '-vf', `scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2:black`,
      '-map', '0:v:0', '-map', '1:a:0',
      '-shortest',
      '-movflags', '+faststart',
      outputPath,
    ], { timeout: ffmpegTimeoutMs });

    fs.unlinkSync(concatFile);
  }

  async assembleWithFrames(voiceoverPath, framesDir, frames, audioDuration, outputPath) {
    const { outputWidth, outputHeight, preset, crf, audioBitrate, ffmpegTimeoutMs } = config.video;
    const { frameDurationSec, zoomFactor } = config.frames;

    const concatFile = path.join(framesDir, 'frames-concat.txt');
    const concatEntries = [];
    let totalDuration = 0;

    while (totalDuration < audioDuration + 2) {
      for (const frame of frames) {
        concatEntries.push(`file '${frame}'`);
        concatEntries.push(`duration ${frameDurationSec}`);
        totalDuration += frameDurationSec;
        if (totalDuration >= audioDuration + 2) break;
      }
    }
    concatEntries.push(`file '${frames[frames.length - 1]}'`);

    fs.writeFileSync(concatFile, concatEntries.join('\n'));

    const zf = zoomFactor;
    const zoomFilter = [
      `scale=${Math.round(outputWidth * zf)}:${Math.round(outputHeight * zf)}`,
      `zoompan=z='min(zoom+0.0005,${zf})':d=${frameDurationSec * 25}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${outputWidth}x${outputHeight}:fps=25`,
    ].join(',');

    try {
      await execFileAsync('ffmpeg', [
        '-y',
        '-f', 'concat', '-safe', '0', '-i', concatFile,
        '-i', voiceoverPath,
        '-vf', `scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`,
        '-c:v', 'libx264', '-preset', preset, '-crf', crf,
        '-c:a', 'aac', '-b:a', audioBitrate,
        '-map', '0:v:0', '-map', '1:a:0',
        '-shortest',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
        outputPath,
      ], { timeout: ffmpegTimeoutMs });
    } finally {
      if (fs.existsSync(concatFile)) fs.unlinkSync(concatFile);
    }
  }

  async assembleWithSolidBackground(voiceoverPath, duration, outputPath, options = {}) {
    const { outputWidth, outputHeight, frameRate, preset, crf, audioBitrate, ffmpegTimeoutMs } = config.video;
    const bgColor = options.bgColor || config.video.defaultBgColor;

    await execFileAsync('ffmpeg', [
      '-y',
      '-f', 'lavfi', '-i', `color=c=${bgColor}:s=${outputWidth}x${outputHeight}:d=${Math.ceil(duration)}:r=${frameRate}`,
      '-i', voiceoverPath,
      '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-tune', 'stillimage',
      '-c:a', 'aac', '-b:a', audioBitrate,
      '-shortest',
      '-movflags', '+faststart',
      outputPath,
    ], { timeout: ffmpegTimeoutMs });
  }

  async assembleReel(outputDir) {
    const available = await this.checkFfmpeg();
    if (!available) throw new Error('FFmpeg is not installed. Run: brew install ffmpeg');

    const voiceoverPath = path.join(outputDir, 'voiceover.mp3');
    if (!fs.existsSync(voiceoverPath)) throw new Error('Voiceover file not found. Run voiceover step first.');

    const audioDuration = await this.getMediaDuration(voiceoverPath);
    const outputPath = path.join(outputDir, 'final-reel.mp4');
    const { reelWidth, reelHeight, reelFrameRate } = config.instagram;
    const { preset, crf, audioBitrate, ffmpegTimeoutMs } = config.video;

    const framesDir = path.join(outputDir, 'frames');
    const frames = fs.existsSync(framesDir)
      ? fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg')).sort().map(f => path.join(framesDir, f))
      : [];

    if (frames.length > 0) {
      const { frameDurationSec } = config.frames;
      const concatFile = path.join(framesDir, 'reel-concat.txt');
      const entries = [];
      let total = 0;
      while (total < audioDuration + 2) {
        for (const frame of frames) {
          entries.push(`file '${frame}'`);
          entries.push(`duration ${frameDurationSec}`);
          total += frameDurationSec;
          if (total >= audioDuration + 2) break;
        }
      }
      entries.push(`file '${frames[frames.length - 1]}'`);
      fs.writeFileSync(concatFile, entries.join('\n'));

      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-f', 'concat', '-safe', '0', '-i', concatFile,
          '-i', voiceoverPath,
          '-vf', `scale=${reelWidth}:${reelHeight}:force_original_aspect_ratio=decrease,pad=${reelWidth}:${reelHeight}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`,
          '-c:v', 'libx264', '-preset', preset, '-crf', crf,
          '-c:a', 'aac', '-b:a', audioBitrate,
          '-r', String(reelFrameRate),
          '-map', '0:v:0', '-map', '1:a:0',
          '-shortest',
          '-movflags', '+faststart',
          '-pix_fmt', 'yuv420p',
          outputPath,
        ], { timeout: ffmpegTimeoutMs });
      } finally {
        if (fs.existsSync(concatFile)) fs.unlinkSync(concatFile);
      }
    } else {
      const bgColor = config.video.defaultBgColor;
      await execFileAsync('ffmpeg', [
        '-y',
        '-f', 'lavfi', '-i', `color=c=${bgColor}:s=${reelWidth}x${reelHeight}:d=${Math.ceil(audioDuration)}:r=${reelFrameRate}`,
        '-i', voiceoverPath,
        '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-tune', 'stillimage',
        '-c:a', 'aac', '-b:a', audioBitrate,
        '-shortest',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
        outputPath,
      ], { timeout: ffmpegTimeoutMs });
    }

    const stats = fs.statSync(outputPath);
    return {
      path: outputPath,
      filename: 'final-reel.mp4',
      size: stats.size,
      duration: audioDuration,
      dimensions: `${reelWidth}x${reelHeight}`,
      format: '9:16 vertical',
    };
  }
}

module.exports = new VideoAssemblyService();
