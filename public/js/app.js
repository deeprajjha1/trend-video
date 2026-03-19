const app = {
  sessionId: null,
  currentStep: 0,
  activeTab: 'trending',
  completedSteps: new Set(),
  isRunning: false,
  selectedColorScheme: 0,
  trendingVideos: [],
  selectedTrendingIds: new Set(),
  platform: 'youtube',

  async init() {
    this.bindEvents();
    this.loadProviderInfo();
    this.loadTrendingOptions();
    await this.restoreOrCreateSession();
  },

  async loadProviderInfo() {
    try {
      const res = await this.api('GET', '/api/provider');
      const badge = document.getElementById('providerBadge');
      badge.textContent = `${res.data.provider} · ${res.data.model}`;
      badge.className = `provider-badge ${res.data.provider}`;
    } catch { /* non-critical */ }
  },

  async loadTrendingOptions() {
    try {
      const res = await this.api('GET', '/api/regions');
      const regionSelect = document.getElementById('trendingRegion');
      regionSelect.innerHTML = res.data.map(r =>
        `<option value="${r.code}" ${r.code === 'US' ? 'selected' : ''}>${this.esc(r.name)}</option>`
      ).join('');
      await this.loadCategories();
    } catch { /* non-critical — regions will show default */ }
  },

  async loadCategories() {
    const catSelect = document.getElementById('trendingCategory');
    catSelect.innerHTML = '<option value="">Loading categories...</option>';
    catSelect.disabled = true;
    try {
      const region = document.getElementById('trendingRegion').value;
      const res = await this.api('GET', `/api/categories?region=${region}`);
      catSelect.innerHTML = '<option value="">All Categories</option>' +
        res.data.map(c => `<option value="${c.id}">${this.esc(c.title)}</option>`).join('');
    } catch (err) {
      catSelect.innerHTML = '<option value="">All Categories (API key needed for filter)</option>';
      if (err.message.includes('API key')) {
        this.toast('YouTube API key required for categories. Add YOUTUBE_API_KEY to .env and restart the server.', 'error');
      }
    } finally {
      catSelect.disabled = false;
    }
  },

  async fetchTrending() {
    const btn = document.getElementById('fetchTrendingBtn');
    this.setLoading(btn, true);
    try {
      const category = document.getElementById('trendingCategory').value;
      const region = document.getElementById('trendingRegion').value;
      const count = document.getElementById('trendingCount').value;

      let url = `/api/trending?region=${region}&maxResults=${count}`;
      if (category) url += `&categoryId=${category}`;

      const res = await this.api('GET', url);
      this.trendingVideos = res.data.videos;
      this.selectedTrendingIds.clear();
      this.renderTrendingGrid();

      document.getElementById('trendingResult').classList.remove('hidden');
      document.getElementById('trendingCount2').textContent = `${res.data.total} videos`;
      this.toast(`Found ${res.data.total} trending videos`, 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    } finally {
      this.setLoading(btn, false);
    }
  },

  renderTrendingGrid() {
    const grid = document.getElementById('trendingGrid');
    grid.innerHTML = this.trendingVideos.map(v => `
      <div class="trending-card ${this.selectedTrendingIds.has(v.id) ? 'selected' : ''}" data-video-id="${v.id}">
        <div class="trending-card-select">
          <span class="trending-checkbox">${this.selectedTrendingIds.has(v.id) ? '&#10003;' : ''}</span>
        </div>
        ${v.thumbnailUrl ? `<img src="${v.thumbnailUrl}" class="trending-thumb" alt="">` : ''}
        <div class="trending-card-body">
          <div class="trending-card-title">${this.esc(v.title)}</div>
          <div class="trending-card-channel">${this.esc(v.channelTitle || '')}</div>
          <div class="trending-card-stats">
            <span>${this.formatNum(v.viewCount)} views</span>
            <span>${this.formatNum(v.likeCount)} likes</span>
            ${v.publishedAt ? `<span>${this.timeAgo(v.publishedAt)}</span>` : ''}
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.trending-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.videoId;
        if (this.selectedTrendingIds.has(id)) {
          this.selectedTrendingIds.delete(id);
        } else {
          this.selectedTrendingIds.add(id);
        }
        this.renderTrendingGrid();
        this.updateTrendingButton();
      });
    });
  },

  updateTrendingButton() {
    const btn = document.getElementById('useTrendingBtn');
    const count = this.selectedTrendingIds.size;
    btn.querySelector('.btn-text').textContent = `Use Selected Videos (${count})`;
    btn.disabled = count === 0;

    const apBtn = document.getElementById('autopilotBtn');
    apBtn.querySelector('.btn-text').textContent = `Autopilot: Produce ${count} Video${count !== 1 ? 's' : ''}`;
    apBtn.disabled = count === 0;
  },

  toggleAllTrending(selectAll) {
    if (selectAll) {
      this.trendingVideos.forEach(v => this.selectedTrendingIds.add(v.id));
    } else {
      this.selectedTrendingIds.clear();
    }
    this.renderTrendingGrid();
    this.updateTrendingButton();
  },

  async useTrendingSelection() {
    if (!this.ensureSession()) return;
    if (this.selectedTrendingIds.size === 0) return;

    const btn = document.getElementById('useTrendingBtn');
    this.setLoading(btn, true);

    try {
      const selected = this.trendingVideos.filter(v => this.selectedTrendingIds.has(v.id));
      const res = await this.api('POST', '/api/fetch-videos', {
        sessionId: this.sessionId,
        trendingVideos: selected,
      });

      this.renderVideos(res.data);
      document.getElementById('videosResult').classList.remove('hidden');
      this.toast(`Loaded ${res.data.videos.length} trending videos`, 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    } finally {
      this.setLoading(btn, false);
    }
  },

  timeAgo(dateStr) {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString();
  },

  bindEvents() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    document.querySelectorAll('.step-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = parseInt(btn.dataset.step);
        if (target === 0 || this.canAccessStep(target)) {
          this.goToStep(target);
        } else {
          this.toast('Complete the required previous steps first.', 'error');
        }
      });
    });

    document.querySelectorAll('.next-btn').forEach(btn => {
      btn.addEventListener('click', () => this.goToStep(parseInt(btn.dataset.next)));
    });

    document.getElementById('fetchTrendingBtn').addEventListener('click', () => this.fetchTrending());
    document.getElementById('useTrendingBtn').addEventListener('click', () => this.useTrendingSelection());
    document.getElementById('selectAllTrending').addEventListener('click', () => this.toggleAllTrending(true));
    document.getElementById('deselectAllTrending').addEventListener('click', () => this.toggleAllTrending(false));
    document.getElementById('autopilotBtn').addEventListener('click', () => this.showAutopilotPanel());
    document.getElementById('startAutopilotBtn').addEventListener('click', () => this.startAutopilot());
    document.getElementById('validateIdeasBtn').addEventListener('click', () => this.validateIdeas());
    document.getElementById('igPublishBtn')?.addEventListener('click', () => this.publishToInstagram());

    document.querySelectorAll('.platform-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchPlatform(btn.dataset.platform));
    });
    document.getElementById('fetchVideosBtn').addEventListener('click', () => this.fetchVideos());
    document.getElementById('fetchManualBtn').addEventListener('click', () => this.fetchManualVideos());
    document.getElementById('fetchTranscriptsBtn').addEventListener('click', () => this.fetchTranscripts());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportPackage());

    document.getElementById('trendingRegion').addEventListener('change', () => this.loadCategories());

    for (let i = 1; i <= 11; i++) {
      const el = document.getElementById(`runStep${i}`);
      if (el) el.addEventListener('click', () => this.runStep(i));
    }

    document.querySelectorAll('.color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedColorScheme = parseInt(btn.dataset.scheme);
      });
    });
  },

  canAccessStep(step) {
    if (step === 0) return true;
    if (step === 1) return this.completedSteps.has(0);
    if (step === 2 || step === 3) return this.completedSteps.has(1);
    if (step === 4) return this.completedSteps.has(1);
    if (step === 5 || step === 7) return this.completedSteps.has(4);
    if (step === 6) return this.completedSteps.has(5);
    if (step === 8) return this.completedSteps.has(4);
    if (step === 9) return this.completedSteps.has(5);
    if (step === 10) return this.completedSteps.has(4);
    if (step === 11) return this.completedSteps.has(8);
    return false;
  },

  async restoreOrCreateSession() {
    const saved = localStorage.getItem('trendvideo_session');
    if (saved) {
      try {
        const res = await this.api('GET', `/api/session/${saved}`);
        this.sessionId = res.data.id;
        this.restoreUI(res.data);
        return;
      } catch {
        localStorage.removeItem('trendvideo_session');
      }
    }
    await this.createSession();
  },

  restoreUI(session) {
    if (session.input.videos.length > 0) {
      this.completedSteps.add(0);
      this.markStepComplete(0);
    }
    const stepKeys = ['analysis', 'channelNames', 'videoIdeas', 'script', 'titles', 'thumbnails', 'audioBrief'];
    stepKeys.forEach((key, idx) => {
      if (session.results[key]) {
        const step = idx + 1;
        this.completedSteps.add(step);
        this.markStepComplete(step);
        this.renderResult(step, session.results[key]);
        const nextBtn = document.querySelector(`[data-panel="${step}"] .next-btn`);
        if (nextBtn) nextBtn.classList.remove('hidden');
      }
    });

    const prodKeys = ['voiceover', 'thumbnail', 'broll', 'video'];
    prodKeys.forEach((key, idx) => {
      if (session.production && session.production[key]) {
        const step = idx + 8;
        this.completedSteps.add(step);
        this.markStepComplete(step);
        this.renderProductionResult(step, session.production[key]);
        const nextBtn = document.querySelector(`[data-panel="${step}"] .next-btn`);
        if (nextBtn) nextBtn.classList.remove('hidden');
      }
    });

    if (session.selectedVideoIdea) {
      document.getElementById('selectedIdea').value = session.selectedVideoIdea;
      document.getElementById('scriptVideoIdea').value = session.selectedVideoIdea;
    }

    if (this.completedSteps.size > 0) {
      document.getElementById('exportBtn').disabled = false;
    }
    if (this.completedSteps.has(7)) {
      document.getElementById('contentCompleteBanner').classList.remove('hidden');
    }
    if (this.completedSteps.has(11)) {
      document.getElementById('completionBanner').classList.remove('hidden');
    }
  },

  renderProductionResult(step, data) {
    const area = document.getElementById(`result${step}`);
    if (!area) return;
    area.classList.remove('hidden');

    if (step === 8 && data.path) {
      document.getElementById('voiceoverInfo').innerHTML =
        `<span>Voice: ${this.esc(data.voice)}</span><span>Size: ${(data.size / 1024).toFixed(0)} KB</span>`;
      document.getElementById('voiceoverPlayer').src = `/api/file/${this.sessionId}/voiceover.mp3`;
    }
    if (step === 9 && data.path) {
      document.getElementById('thumbnailInfo').innerHTML =
        `<span>Text: ${this.esc(data.text)}</span><span>${data.dimensions}</span>`;
      document.getElementById('thumbnailPreview').src = `/api/file/${this.sessionId}/thumbnail.png`;
    }
    if (step === 10 && data.clips) {
      const el = document.getElementById('brollPreview');
      el.innerHTML = `<div class="preview-info"><span>Downloaded ${data.totalClips} clips</span><span>Keywords: ${data.keywords.join(', ')}</span></div>` +
        (data.credits?.length ? `<div class="credits">Credits: ${data.credits.join(', ')}</div>` : '');
    }
    if (step === 11 && data.path) {
      const filename = data.filename || (this.platform === 'instagram' ? 'final-reel.mp4' : 'final-video.mp4');
      const dims = data.dimensions ? ` (${data.dimensions})` : '';
      document.getElementById('videoInfo').innerHTML =
        `<span>Duration: ${data.duration.toFixed(0)}s</span><span>Size: ${(data.size / (1024*1024)).toFixed(1)} MB${dims}</span>`;
      document.getElementById('videoPlayer').src = `/api/file/${this.sessionId}/${filename}`;

      const igPanel = document.getElementById('igPublishPanel');
      if (this.platform === 'instagram' && igPanel) {
        igPanel.classList.remove('hidden');
        this.loadInstagramStatus();
      }
    }
  },

  async createSession() {
    try {
      const res = await this.api('POST', '/api/session');
      this.sessionId = res.data.id;
      localStorage.setItem('trendvideo_session', this.sessionId);
    } catch (err) {
      this.toast('Failed to create session: ' + err.message, 'error');
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.dataset.tabContent === tab));
  },

  goToStep(step) {
    this.currentStep = step;
    document.querySelectorAll('.step-panel').forEach(p => p.classList.toggle('active', parseInt(p.dataset.panel) === step));
    document.querySelectorAll('.step-item').forEach(s => {
      const sStep = parseInt(s.dataset.step);
      s.classList.toggle('active', sStep === step);
    });

    if (step === 4) {
      const idea = document.getElementById('selectedIdea')?.value;
      if (idea) document.getElementById('scriptVideoIdea').value = idea;
    }
  },

  markStepComplete(step) {
    const item = document.querySelector(`.step-item[data-step="${step}"]`);
    if (item) item.classList.add('completed');
  },

  ensureSession() {
    if (!this.sessionId) {
      this.toast('No active session. Refreshing...', 'error');
      setTimeout(() => location.reload(), 1500);
      return false;
    }
    return true;
  },

  async fetchVideos() {
    if (!this.ensureSession()) return;
    const btn = document.getElementById('fetchVideosBtn');
    this.setLoading(btn, true);

    try {
      const url = document.getElementById('channelUrl').value.trim();
      if (!url) throw new Error('Please enter a channel URL');

      const res = await this.api('POST', '/api/fetch-videos', {
        sessionId: this.sessionId,
        channelUrl: url,
      });
      this.renderVideos(res.data);
      document.getElementById('videosResult').classList.remove('hidden');
      this.toast(`Fetched ${res.data.videos.length} videos`, 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    } finally {
      this.setLoading(btn, false);
    }
  },

  async fetchManualVideos() {
    if (!this.ensureSession()) return;
    const btn = document.getElementById('fetchManualBtn');
    this.setLoading(btn, true);

    try {
      const raw = document.getElementById('videoUrls').value.trim();
      if (!raw) throw new Error('Please enter at least one video URL');
      const videoUrls = raw.split('\n').map(u => u.trim()).filter(Boolean);

      const res = await this.api('POST', '/api/fetch-videos', {
        sessionId: this.sessionId,
        videoUrls,
      });
      this.renderVideos(res.data);
      document.getElementById('videosResult').classList.remove('hidden');
      this.toast(`Fetched ${res.data.videos.length} videos`, 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    } finally {
      this.setLoading(btn, false);
    }
  },

  renderVideos(data) {
    const grid = document.getElementById('videosList');
    const { videos, channelInfo } = data;

    let html = '';
    if (channelInfo) {
      html += `<div class="video-card" style="grid-column: 1/-1; background: var(--accent-soft); border-color: var(--accent);">
        <div class="video-card-title" style="font-size: 15px;">Channel: ${this.esc(channelInfo.name)}</div>
        <div class="video-card-stats"><span>${this.esc(channelInfo.description || '')}</span></div>
      </div>`;
    }

    videos.forEach(v => {
      html += `<div class="video-card">
        <div class="video-card-title">${this.esc(v.title || v.url)}</div>
        <div class="video-card-stats">
          ${v.viewCount ? `<span>${this.formatNum(v.viewCount)} views</span>` : ''}
          ${v.likeCount ? `<span>${this.formatNum(v.likeCount)} likes</span>` : ''}
        </div>
      </div>`;
    });

    grid.innerHTML = html;
  },

  async fetchTranscripts() {
    if (!this.ensureSession()) return;
    const btn = document.getElementById('fetchTranscriptsBtn');
    this.setLoading(btn, true);

    try {
      const res = await this.api('POST', '/api/fetch-transcripts', { sessionId: this.sessionId });
      const { stats } = res.data;

      const statsEl = document.getElementById('transcriptStats');
      statsEl.innerHTML = `
        <span>Total: ${stats.total}</span>
        <span>With transcript: ${stats.withTranscript}</span>
        <span>Without: ${stats.withoutTranscript}</span>
      `;
      statsEl.classList.remove('hidden');

      this.completedSteps.add(0);
      this.markStepComplete(0);
      document.getElementById('exportBtn').disabled = false;
      this.toast('Transcripts fetched! Ready to analyze.', 'success');

      setTimeout(() => this.goToStep(1), 800);
    } catch (err) {
      this.toast(err.message, 'error');
    } finally {
      this.setLoading(btn, false);
    }
  },

  async runStep(step) {
    if (!this.ensureSession()) return;
    if (this.isRunning) return;
    this.isRunning = true;

    const btn = document.getElementById(`runStep${step}`);
    this.setLoading(btn, true);

    try {
      const body = { sessionId: this.sessionId };

      if (step === 4) {
        const idea = document.getElementById('scriptVideoIdea').value || document.getElementById('selectedIdea')?.value;
        if (!idea?.trim()) throw new Error('Please select or type a video idea first');
        body.videoIdea = idea.trim();
        body.additionalInstructions = document.getElementById('scriptInstructions')?.value || '';
      }

      if (step === 8) {
        body.voice = document.getElementById('voiceSelect')?.value;
      }

      if (step === 9) {
        body.colorScheme = this.selectedColorScheme;
        const custom = document.getElementById('thumbnailText')?.value?.trim();
        if (custom) body.customText = custom;
      }

      const res = await this.api('POST', `/api/pipeline/${step}`, body);

      if (step <= 7) {
        this.renderResult(step, res.data.result);
      } else {
        this.renderProductionResult(step, res.data.result);
      }

      this.completedSteps.add(step);
      this.markStepComplete(step);

      const nextBtn = document.querySelector(`[data-panel="${step}"] .next-btn`);
      if (nextBtn) nextBtn.classList.remove('hidden');

      document.getElementById('exportBtn').disabled = false;

      if (step === 7) {
        document.getElementById('contentCompleteBanner').classList.remove('hidden');
      }
      if (step === 11) {
        document.getElementById('completionBanner').classList.remove('hidden');
      }

      this.toast(`Step ${step} complete!`, 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    } finally {
      this.setLoading(btn, false);
      this.isRunning = false;
    }
  },

  async regenerate(step) {
    await this.runStep(step);
  },

  renderResult(step, markdown) {
    const area = document.getElementById(`result${step}`);
    area.classList.remove('hidden');
    const content = area.querySelector('.result-content');
    content.innerHTML = marked.parse(markdown);
  },

  async exportPackage() {
    if (!this.ensureSession()) return;
    try {
      const response = await fetch(`/api/export/${this.sessionId}`);
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'trendvideo-content-package.md';
      a.click();
      URL.revokeObjectURL(url);

      this.toast('Content package downloaded!', 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  newSession() {
    localStorage.removeItem('trendvideo_session');
    location.reload();
  },

  setLoading(btn, loading) {
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  },

  async api(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(path, opts);
    const data = await res.json();

    if (!data.success) throw new Error(data.error || 'API request failed');
    return data;
  },

  toast(message, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className = `toast ${type}`;
    el.classList.remove('hidden');

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 4000);
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  switchPlatform(platform) {
    this.platform = platform;
    document.querySelectorAll('.platform-btn').forEach(b => b.classList.toggle('active', b.dataset.platform === platform));
    document.querySelector('.logo-sub').textContent = platform === 'instagram' ? 'Reels Pipeline' : 'Content Pipeline';

    const isIG = platform === 'instagram';
    document.querySelectorAll('[data-step="2"], [data-step="6"], [data-step="7"], [data-step="9"]').forEach(el => {
      el.style.display = isIG ? 'none' : '';
    });
    document.querySelector('[data-step="11"] .step-label').textContent = isIG ? 'Final Reel' : 'Final Video';
    document.querySelector('[data-step="4"] .step-label').textContent = isIG ? 'Reel Script' : 'Script Writer';

    if (this.sessionId) {
      this.api('POST', '/api/session/platform', { sessionId: this.sessionId, platform }).catch(() => {});
    }
    this.toast(`Switched to ${isIG ? 'Instagram Reels (9:16 vertical)' : 'YouTube (16:9 long-form)'}`, 'success');
  },

  async validateIdeas() {
    if (!this.ensureSession()) return;
    const btn = document.getElementById('validateIdeasBtn');
    this.setLoading(btn, true);
    try {
      const res = await this.api('POST', '/api/pipeline/research', {
        sessionId: this.sessionId,
        geo: document.getElementById('trendingRegion')?.value || 'US',
      });
      this.renderResearchResults(res.data.result);
      this.toast('Research validation complete!', 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    } finally {
      this.setLoading(btn, false);
    }
  },

  renderResearchResults(results) {
    const container = document.getElementById('researchResults');
    container.classList.remove('hidden');
    container.innerHTML = `
      <h3 class="research-title">Research Validation</h3>
      <p class="research-subtitle">Ideas scored by Google Trends + YouTube search data</p>
      <div class="research-cards">
        ${results.map(r => `
          <div class="research-card ${r.viable ? 'viable' : 'weak'}">
            <div class="research-card-header">
              <span class="research-score ${r.overallScore >= 60 ? 'high' : r.overallScore >= 40 ? 'mid' : 'low'}">${r.overallScore}</span>
              <span class="research-topic">${this.esc(r.topic.substring(0, 60))}</span>
            </div>
            <div class="research-card-body">
              <div class="research-metric">
                <span class="research-label">Trend</span>
                <span class="research-value ${r.trends.trend === 'rising' || r.trends.trend === 'surging' ? 'positive' : r.trends.trend === 'declining' ? 'negative' : ''}">${r.trends.trend || 'N/A'}${r.trends.momentum ? ` (${r.trends.momentum > 0 ? '+' : ''}${r.trends.momentum}%)` : ''}</span>
              </div>
              <div class="research-metric">
                <span class="research-label">Search Vol</span>
                <span class="research-value">${r.search.volume || 'N/A'}</span>
              </div>
              <div class="research-metric">
                <span class="research-label">Competition</span>
                <span class="research-value">${r.search.competition || 'N/A'}</span>
              </div>
            </div>
            <p class="research-rec">${this.esc(r.recommendation)}</p>
            <button class="btn btn-sm btn-primary" onclick="document.getElementById('selectedIdea').value='${this.esc(r.topic).replace(/'/g, "\\'")}'; app.toast('Idea selected!', 'success')">Use This Idea</button>
          </div>
        `).join('')}
      </div>
    `;
  },

  async loadInstagramStatus() {
    try {
      const res = await this.api('GET', '/api/instagram/status');
      const info = document.getElementById('igAccountInfo');
      if (res.data.configured && res.data.account) {
        info.textContent = `Connected: @${res.data.account.username} (${res.data.account.followers_count} followers)`;
      } else {
        info.innerHTML = 'Not connected. Set <code>INSTAGRAM_ACCESS_TOKEN</code> and <code>INSTAGRAM_ACCOUNT_ID</code> in .env';
      }
    } catch { /* non-critical */ }
  },

  async publishToInstagram() {
    if (!this.ensureSession()) return;
    const btn = document.getElementById('igPublishBtn');
    const caption = document.getElementById('igCaption').value;
    this.setLoading(btn, true);
    try {
      const res = await this.api('POST', '/api/instagram/publish', {
        sessionId: this.sessionId,
        caption,
      });
      const result = res.data;
      document.getElementById('igPublishResult').classList.remove('hidden');
      document.getElementById('igPublishResult').innerHTML = `
        <div class="ig-success">Published! <a href="${result.url}" target="_blank">View on Instagram</a></div>
      `;
      this.toast('Reel published to Instagram!', 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    } finally {
      this.setLoading(btn, false);
    }
  },

  showAutopilotPanel() {
    document.getElementById('autopilotPanel').classList.remove('hidden');
    document.getElementById('autopilotResults').classList.add('hidden');
    document.getElementById('autopilotProgress').classList.add('hidden');
    document.getElementById('autopilotPanel').scrollIntoView({ behavior: 'smooth' });
  },

  async startAutopilot() {
    const selected = this.trendingVideos.filter(v => this.selectedTrendingIds.has(v.id));
    if (selected.length === 0) { this.toast('Select at least one trending video', 'error'); return; }

    const btn = document.getElementById('startAutopilotBtn');
    this.setLoading(btn, true);

    const voice = document.getElementById('autopilotVoice').value;
    const colorScheme = parseInt(document.getElementById('autopilotColorScheme').value);

    document.getElementById('autopilotProgress').classList.remove('hidden');
    document.getElementById('autopilotResults').classList.add('hidden');
    const log = document.getElementById('autopilotLog');
    log.innerHTML = '';
    document.getElementById('autopilotStatusText').textContent = 'Starting autopilot...';
    document.getElementById('autopilotBar').style.width = '0%';

    try {
      const resp = await fetch('/api/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedVideos: selected,
          voice,
          colorScheme,
        }),
      });

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastJob = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const job = JSON.parse(part.slice(6));
            lastJob = job;
            this._updateAutopilotUI(job);
          } catch { /* partial chunk */ }
        }
      }

      if (lastJob) this._renderAutopilotResults(lastJob);

    } catch (err) {
      this.toast(`Autopilot failed: ${err.message}`, 'error');
      document.getElementById('autopilotStatusText').textContent = `Failed: ${err.message}`;
    } finally {
      this.setLoading(btn, false);
    }
  },

  _updateAutopilotUI(job) {
    const pct = job.totalVideos > 0 ? Math.round((job.completedVideos / job.totalVideos) * 100) : 0;
    document.getElementById('autopilotBar').style.width = pct + '%';
    document.getElementById('autopilotStatusText').textContent = job.currentStep || 'Processing...';
    document.getElementById('autopilotDetail').textContent =
      `${job.completedVideos || 0} / ${job.totalVideos || '?'} videos completed`;

    const icon = document.getElementById('autopilotIcon');
    icon.textContent = job.status === 'completed' ? '\u2714' : job.status === 'failed' ? '\u2718' : '\u2699';

    if (job.currentStep) {
      const log = document.getElementById('autopilotLog');
      const entry = document.createElement('div');
      entry.className = 'autopilot-log-entry';
      entry.textContent = job.currentStep;
      log.appendChild(entry);
      log.scrollTop = log.scrollHeight;
    }
  },

  _renderAutopilotResults(job) {
    document.getElementById('autopilotResults').classList.remove('hidden');
    const grid = document.getElementById('autopilotResultsGrid');

    if (job.results.length === 0) {
      grid.innerHTML = '<p style="opacity:0.6">No videos were produced. Check the log above for errors.</p>';
    } else {
      grid.innerHTML = job.results.map(r => `
        <div class="trending-card autopilot-result-card">
          <div class="trending-card-body">
            <div class="trending-card-title">${this.esc(r.sourceVideo.title)}</div>
            <div class="trending-card-stats">
              <span>${this.formatNum(r.sourceVideo.viewCount)} views (source)</span>
            </div>
            <div class="autopilot-result-links">
              <a href="${r.files.video}" target="_blank" class="btn btn-sm btn-primary">Download Video</a>
              <a href="${r.files.thumbnail}" target="_blank" class="btn btn-sm btn-ghost">Thumbnail</a>
              <a href="${r.files.voiceover}" target="_blank" class="btn btn-sm btn-ghost">Audio</a>
            </div>
          </div>
        </div>
      `).join('');
    }

    if (job.errors.length > 0) {
      const errDiv = document.getElementById('autopilotErrors');
      errDiv.classList.remove('hidden');
      errDiv.innerHTML = '<h4 style="color:var(--error)">Errors</h4>' +
        job.errors.map(e => `<p class="autopilot-error">${this.esc(e.video)}: ${this.esc(e.error)}</p>`).join('');
    }

    const statusText = job.results.length > 0
      ? `Done! ${job.results.length} video${job.results.length > 1 ? 's' : ''} produced.`
      : 'Completed with errors.';
    document.getElementById('autopilotStatusText').textContent = statusText;
    document.getElementById('autopilotBar').style.width = '100%';
    this.toast(statusText, job.results.length > 0 ? 'success' : 'error');
  },

  formatNum(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());
