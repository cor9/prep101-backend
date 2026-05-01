// services/ragRetrieval.js
// Retrieves relevant methodology chunks from Supabase for guide generation

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_MATCH_COUNT = 6;
const DEFAULT_MATCH_THRESHOLD = 0.65;

// --- Embed a query string via OpenAI ---
async function embedQuery(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// --- Build a focused query from guide metadata ---
function buildRetrievalQuery(metadata = {}, screenplayText = '') {
  const parts = [];

  if (metadata.characterName) parts.push(`character: ${metadata.characterName}`);
  if (metadata.productionType) parts.push(metadata.productionType);
  if (metadata.genre) parts.push(metadata.genre);
  if (metadata.characterBreakdown) parts.push(metadata.characterBreakdown.slice(0, 200));

  // Pull first 300 chars of screenplay for scene context
  if (screenplayText) {
    parts.push(screenplayText.slice(0, 300));
  }

  return parts.join('. ');
}

// --- Main retrieval function ---
async function retrieveMethodologyChunks({
  metadata = {},
  screenplayText = '',
  matchCount = DEFAULT_MATCH_COUNT,
  matchThreshold = DEFAULT_MATCH_THRESHOLD
}) {
  try {
    const query = buildRetrievalQuery(metadata, screenplayText);

    const queryEmbedding = await embedQuery(query);

    const { data, error } = await supabase.rpc('match_methodology_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: matchThreshold,
      match_count: matchCount
    });

    if (error) {
      console.error('[RAG] Supabase retrieval error:', error.message);
      return '';
    }

    if (!data || data.length === 0) {
      console.warn('[RAG] No chunks retrieved above threshold — lowering threshold and retrying');

      // Retry with lower threshold
      const { data: retryData, error: retryError } = await supabase.rpc('match_methodology_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.50,
        match_count: matchCount
      });

      if (retryError || !retryData || retryData.length === 0) {
        console.warn('[RAG] Retry also returned no chunks — proceeding without methodology context');
        return '';
      }

      console.log(`[RAG] Retry retrieved ${retryData.length} chunks`);
      return formatChunks(retryData);
    }

    console.log(`[RAG] Retrieved ${data.length} methodology chunks (threshold: ${matchThreshold})`);
    return formatChunks(data);

  } catch (error) {
    // Never let RAG failure break guide generation
    console.error('[RAG] Retrieval failed silently:', error.message);
    return '';
  }
}

function formatChunks(chunks) {
  return chunks
    .map((chunk, i) => `[METHODOLOGY ${i + 1} — ${chunk.source_file}]\n${chunk.content}`)
    .join('\n\n---\n\n');
}

module.exports = { retrieveMethodologyChunks };
