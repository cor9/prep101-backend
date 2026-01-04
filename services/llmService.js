const fetch = require('node-fetch');
const { DEFAULT_CLAUDE_MAX_TOKENS } = require('../config/models');

class LLMService {
  constructor() {
    this.anthropicKey = process.env.ANTHROPIC_API_KEY;
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.googleKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  }

  async generateCompletion({ provider, model, systemPrompt, userPrompt, maxTokens = 4000 }) {
    console.log(`🤖 LLM Request: Provider=${provider}, Model=${model}`);

    switch (provider.toLowerCase()) {
      case 'anthropic':
        return this.callAnthropic(model, systemPrompt, userPrompt, maxTokens);
      case 'openai':
        return this.callOpenAI(model, systemPrompt, userPrompt, maxTokens);
      case 'google':
        return this.callGoogle(model, systemPrompt, userPrompt, maxTokens);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async callAnthropic(model, systemPrompt, userPrompt, maxTokens) {
    if (!this.anthropicKey) throw new Error('ANTHROPIC_API_KEY is missing');

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.content[0].text;
  }

  async callOpenAI(model, systemPrompt, userPrompt, maxTokens) {
    if (!this.openaiKey) throw new Error('OPENAI_API_KEY is missing');

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.openaiKey}`,
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  }

  async callGoogle(model, systemPrompt, userPrompt, maxTokens) {
    if (!this.googleKey) throw new Error('GOOGLE_API_KEY is missing');

    // Gemini API format
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.googleKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          maxOutputTokens: maxTokens,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
        return result.candidates[0].content.parts[0].text;
    } else {
        throw new Error('Unexpected Google API response format');
    }
  }
}

module.exports = new LLMService();
