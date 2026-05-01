// Retrieves relevant methodology chunks from Supabase for guide generation.

const { createClient } = require("@supabase/supabase-js");

const EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_MATCH_COUNT = 6;
const DEFAULT_MATCH_THRESHOLD = 0.65;

let supabase = null;
let loggedSupabaseRagConfig = false;

function normalizeCredential(value = "") {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\$$/, "");
}

function getSupabaseCredentialCandidates() {
  const supabaseUrl = normalizeCredential(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  const seen = new Set();
  const candidates = [
    ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY],
    ["SUPABASE_SERVICE_KEY", process.env.SUPABASE_SERVICE_KEY],
    ["SUPABASE_ANON_KEY", process.env.SUPABASE_ANON_KEY],
  ]
    .map(([name, value]) => ({ name, value: normalizeCredential(value) }))
    .filter(({ value }) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });

  if (!supabaseUrl || candidates.length === 0) {
    throw new Error("Supabase RAG credentials are not configured");
  }

  return { supabaseUrl, candidates };
}

function describeCredential(candidate = {}) {
  const value = candidate.value || "";
  return `${candidate.name || "unknown"} length=${value.length} kind=${
    value.startsWith("eyJ") ? "jwt" : value.startsWith("sb_") ? "secret" : "unknown"
  }`;
}

function getSupabaseRef(supabaseUrl = "") {
  try {
    const hostname = new URL(supabaseUrl).hostname;
    return hostname.split(".")[0] || hostname;
  } catch (_error) {
    return "invalid-url";
  }
}

function getSupabaseClient(supabaseUrl, candidate) {
  const cacheKey = `${supabaseUrl}:${candidate.name}:${candidate.value.length}`;
  if (supabase?.cacheKey === cacheKey) return supabase.client;

  const client = createClient(supabaseUrl, candidate.value, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  supabase = { cacheKey, client };

  return client;
}

async function matchMethodologyChunksWithFallback(params) {
  const { supabaseUrl, candidates } = getSupabaseCredentialCandidates();
  let lastError = null;

  if (!loggedSupabaseRagConfig) {
    loggedSupabaseRagConfig = true;
    console.log("[RAG] Supabase config candidates:", {
      urlRef: getSupabaseRef(supabaseUrl),
      candidates: candidates.map(describeCredential),
    });
  }

  for (const candidate of candidates) {
    const client = getSupabaseClient(supabaseUrl, candidate);
    const { data, error } = await client.rpc("match_methodology_chunks", params);

    if (!error) {
      console.log(`[RAG] Supabase credential accepted: ${candidate.name}`);
      return { data, error: null };
    }

    lastError = error;
    if (/invalid api key/i.test(error.message || "")) {
      console.error(`[RAG] Supabase rejected ${describeCredential(candidate)}: ${error.message}`);
      continue;
    }

    return { data: null, error };
  }

  return { data: null, error: lastError || new Error("No Supabase credential candidates worked") };
}

async function embedQuery(text) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

function buildRetrievalQuery(metadata = {}, screenplayText = "") {
  const parts = [];

  if (metadata.characterName) parts.push(`character: ${metadata.characterName}`);
  if (metadata.productionType) parts.push(metadata.productionType);
  if (metadata.genre) parts.push(metadata.genre);
  if (metadata.characterBreakdown) parts.push(metadata.characterBreakdown.slice(0, 200));

  if (screenplayText) {
    parts.push(screenplayText.slice(0, 300));
  }

  return parts.join(". ");
}

async function retrieveMethodologyChunks({
  metadata = {},
  screenplayText = "",
  matchCount = DEFAULT_MATCH_COUNT,
  matchThreshold = DEFAULT_MATCH_THRESHOLD,
}) {
  try {
    const query = buildRetrievalQuery(metadata, screenplayText);
    const queryEmbedding = await embedQuery(query);
    const { data, error } = await matchMethodologyChunksWithFallback({
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount,
    });

    if (error) {
      console.error("[RAG] Supabase retrieval error:", error.message);
      return "";
    }

    if (!data || data.length === 0) {
      console.warn("[RAG] No chunks retrieved above threshold; lowering threshold and retrying");

      const { data: retryData, error: retryError } = await matchMethodologyChunksWithFallback({
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: matchCount,
      });

      if (retryError || !retryData || retryData.length === 0) {
        console.warn("[RAG] Retry also returned no chunks; proceeding without methodology context");
        return "";
      }

      console.log(`[RAG] Retry retrieved ${retryData.length} chunks`);
      return formatChunks(retryData);
    }

    console.log(`[RAG] Retrieved ${data.length} methodology chunks (threshold: ${matchThreshold})`);
    return formatChunks(data);
  } catch (error) {
    console.error("[RAG] Retrieval failed silently:", error.message);
    return "";
  }
}

function formatChunks(chunks) {
  return chunks
    .map((chunk, i) => `[METHODOLOGY ${i + 1} - ${chunk.source_file}]\n${chunk.content}`)
    .join("\n\n---\n\n");
}

module.exports = { retrieveMethodologyChunks };
