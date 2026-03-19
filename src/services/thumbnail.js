const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class ThumbnailService {
  cleanMarkdown(text) {
    return text
      .replace(/\*+/g, '')
      .replace(/^(Title|Name)\s*:\s*/i, '')
      .replace(/["""]/g, '')
      .trim();
  }

  extractThumbnailText(titles) {
    const lines = titles.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const starMatch = line.match(/[⭐★]\s*(.+)$/);
      if (starMatch) {
        const cleaned = this.cleanMarkdown(starMatch[1]);
        if (cleaned.length > config.thumbnail.titleMinLength) return cleaned;
      }
    }
    for (const line of lines) {
      const numberedMatch = line.match(/^\d+[\.\)]\s*(.+)$/);
      if (numberedMatch) {
        const title = this.cleanMarkdown(numberedMatch[1]);
        if (title.length > config.thumbnail.titleMinLength && title.length < config.thumbnail.titleMaxLength) return title;
      }
    }
    return config.thumbnail.fallbackText;
  }

  splitTextForThumbnail(text, maxWords = config.thumbnail.maxWordsPerLine) {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return [text.toUpperCase()];

    const midpoint = Math.ceil(words.length / 2);
    return [
      words.slice(0, midpoint).join(' ').toUpperCase(),
      words.slice(midpoint).join(' ').toUpperCase(),
    ];
  }

  async generate(titles, outputDir, options = {}) {
    const { width, height, colorSchemes, fontFamily, fontWeight } = config.thumbnail;
    const schemeIdx = options.colorScheme || 0;
    const scheme = colorSchemes[schemeIdx % colorSchemes.length];

    const rawText = options.customText || this.extractThumbnailText(titles);
    const lines = this.splitTextForThumbnail(rawText);

    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, 'thumbnail.png');

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = scheme.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = scheme.accent;
    ctx.fillRect(0, height - 8, width, 8);

    ctx.beginPath();
    ctx.arc(width * 0.8, height * 0.4, 200, 0, Math.PI * 2);
    ctx.fillStyle = scheme.accent + '22';
    ctx.fill();

    ctx.fillStyle = scheme.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const fontSize = lines.length === 1
      ? Math.min(120, Math.floor(width / (rawText.length * 0.6)))
      : Math.min(100, Math.floor(width / (Math.max(...lines.map(l => l.length)) * 0.55)));

    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

    const lineHeight = fontSize * 1.2;
    const totalTextHeight = lines.length * lineHeight;
    const startY = (height / 2) - (totalTextHeight / 2) + (lineHeight / 2);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2 + 4, startY + i * lineHeight + 4, width - 100);
    });

    ctx.fillStyle = scheme.text;
    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, startY + i * lineHeight, width - 100);
    });

    const metrics = ctx.measureText(lines[0]);
    const underlineWidth = Math.min(metrics.width, width - 200);
    ctx.fillStyle = scheme.accent;
    ctx.fillRect((width - underlineWidth) / 2, startY + fontSize * 0.5, underlineWidth, 6);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    return {
      path: outputPath,
      size: buffer.length,
      text: rawText,
      colorScheme: scheme,
      dimensions: `${width}x${height}`,
    };
  }

  getColorSchemes() {
    return config.thumbnail.colorSchemes.map((scheme, index) => ({ index, ...scheme }));
  }
}

module.exports = new ThumbnailService();
