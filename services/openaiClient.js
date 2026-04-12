const fetch = require("node-fetch");

function extractResponseText(payload = {}) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload.output)) {
    const chunks = [];
    for (const item of payload.output) {
      if (!item || !Array.isArray(item.content)) continue;
      for (const part of item.content) {
        if (!part) continue;
        if (typeof part.text === "string" && part.text.trim()) {
          chunks.push(part.text.trim());
        }
      }
    }
    if (chunks.length) return chunks.join("\n\n");
  }

  if (
    Array.isArray(payload.choices) &&
    payload.choices[0]?.message?.content &&
    typeof payload.choices[0].message.content === "string"
  ) {
    return payload.choices[0].message.content.trim();
  }

  return "";
}

async function sendOpenAIText({
  apiKey,
  model = "gpt-5.2",
  input,
  maxTokens = 6000,
  signal,
}) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const responsesRes = await fetch("https://api.openai.com/v1/responses", {
    signal,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input,
      max_output_tokens: maxTokens,
    }),
  });

  if (responsesRes.ok) {
    const payload = await responsesRes.json();
    const text = extractResponseText(payload);
    if (text) {
      return { text, provider: "openai", model, api: "responses" };
    }
    throw new Error("OpenAI responses API returned no text content.");
  }

  const responsesErrText = await responsesRes.text();
  console.warn(
    `[OpenAI] Responses API failed (${responsesRes.status}); trying chat completions fallback.`
  );

  const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
    signal,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: input }],
    }),
  });

  if (!chatRes.ok) {
    const chatErrText = await chatRes.text();
    throw new Error(
      `OpenAI fallback failed (responses ${responsesRes.status} + chat ${chatRes.status}): responses=${responsesErrText}; chat=${chatErrText}`
    );
  }

  const chatPayload = await chatRes.json();
  const chatText = extractResponseText(chatPayload);
  if (!chatText) {
    throw new Error("OpenAI chat completions returned no text content.");
  }

  return { text: chatText, provider: "openai", model, api: "chat_completions" };
}

module.exports = {
  sendOpenAIText,
};
