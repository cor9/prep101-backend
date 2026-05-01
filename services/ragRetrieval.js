// Retrieves relevant methodology chunks from Supabase for guide generation.

const { createClient } = require("@supabase/supabase-js");

const EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_MATCH_COUNT = 6;
const DEFAULT_MATCH_THRESHOLD = 0.65;

let supabase = null;

function getSupabaseClient() {
  if (supabase) return supabase;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase RAG credentials are not configured");
  }

  supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabase;
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
    const client = getSupabaseClient();

    const { data, error } = await client.rpc("match_methodology_chunks", {
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

      const { data: retryData, error: retryError } = await client.rpc(
        "match_methodology_chunks",
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: matchCount,
        }
      );

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
