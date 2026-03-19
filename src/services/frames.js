const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const config = require('../config');

const execFileAsync = promisify(execFile);

class FrameExtractorService {

  async extractFrames(videoUrl, outputDir) {
    const framesDir = path.join(outputDir, 'frames');
    fs.mkdirSync(framesDir, { recursive: true });

    const tempVideo = path.join(outputDir, 'source-temp.mp4');

    try {
      await this._downloadVideo(videoUrl, tempVideo);
      const duration = await this._getDuration(tempVideo);
      const frameCount = config.frames.maxFrames;
      const interval = Math.max(1, Math.floor(duration / (frameCount + 1)));

      await this._extractKeyFrames(tempVideo, framesDir, interval, frameCount);

      const frames = fs.readdirSync(framesDir)
        .filter(f => f.endsWith('.jpg'))
        .sort()
        .map(f => path.join(framesDir, f));

      return {
        framesDir,
        frames,
        count: frames.length,
        sourceDuration: duration,
      };
    } finally {
      if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
    }
  }

  async _downloadVideo(url, outputPath) {
    const args = [
      '-f', 'worst[ext=mp4]/worst',
      '--no-playlist',
      '-o', outputPath,
      '--socket-timeout', '30',
      '--retries', '2',
      '--no-check-certificates',
      '--geo-bypass',
      url,
    ];

    await execFileAsync('yt-dlp', args, { timeout: config.frames.downloadTimeoutMs });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Video download failed — file not created');
    }
  }

  async _getDuration(filePath) {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath,
    ]);
    return parseFloat(stdout.trim()) || 60;
  }

  async _extractKeyFrames(videoPath, framesDir, interval, maxFrames) {
    const outputPattern = path.join(framesDir, 'frame-%03d.jpg');

    await execFileAsync('ffmpeg', [
      '-y',
      '-i', videoPath,
      '-vf', `fps=1/${interval},scale=${config.frames.width}:${config.frames.height}:force_original_aspect_ratio=decrease,pad=${config.frames.width}:${config.frames.height}:(ow-iw)/2:(oh-ih)/2:black`,
      '-frames:v', String(maxFrames),
      '-q:v', '3',
      outputPattern,
    ], { timeout: config.frames.extractTimeoutMs });
  }
}

module.exports = new FrameExtractorService();
