const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class AIService {
  constructor() {
    this.promptsDir = path.join(__dirname, '..', 'prompts');
    this.promptCache = new Map();
    this._client = null;
    this._provider = null;
  }

  get provider() {
    if (!this._provider) {
      const name = (process.env.AI_PROVIDER || 'openai').toLowerCase();
      const providerConfig = config.ai.providers[name];
      if (!providerConfig) {
        throw new Error(`Unknown AI_PROVIDER "${name}". Use: ${Object.keys(config.ai.providers).join(', ')}`);
      }
      this._provider = {
        name,
        baseURL: process.env.AI_BASE_URL || providerConfig.baseURL,
        model: process.env.AI_MODEL || providerConfig.defaultModel,
        apiKeyEnv: providerConfig.apiKeyEnv,
      };
    }
    return this._provider;
  }

  get client() {
    if (!this._client) {
      const p = this.provider;
      const apiKey = p.apiKeyEnv ? process.env[p.apiKeyEnv] : undefined;

      if (p.apiKeyEnv && !apiKey) {
        throw new Error(`${p.apiKeyEnv} is not set. Add it to your .env file.`);
      }

      this._client = new OpenAI({
        apiKey: apiKey || 'ollama',
        baseURL: p.baseURL,
      });
    }
    return this._client;
  }

  loadPrompt(name) {
    if (this.promptCache.has(name)) return this.promptCache.get(name);

    const filePath = path.join(this.promptsDir, `${name}.txt`);
    try {
      const template = fs.readFileSync(filePath, 'utf-8');
      this.promptCache.set(name, template);
      return template;
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`Prompt template "${name}" not found at ${filePath}`);
      }
      throw err;
    }
  }

  fillTemplate(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`{{${escaped}}}`, 'g'), value || '');
    }
    return result;
  }

  async generate(promptName, variables, options = {}) {
    const template = this.loadPrompt(promptName);
    const userPrompt = this.fillTemplate(template, variables);

    const messages = [
      { role: 'system', content: config.ai.systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.client.chat.completions.create({
      model: options.model || this.provider.model,
      messages,
      temperature: options.temperature || config.ai.defaultTemperature,
      max_tokens: options.maxTokens || config.ai.defaultMaxTokens,
    });

    return response.choices[0].message.content;
  }

  getProviderInfo() {
    const p = this.provider;
    return { provider: p.name, model: p.model, baseURL: p.baseURL };
  }
}

module.exports = new AIService();
