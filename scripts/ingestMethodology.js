// scripts/ingestMethodology.js
// Run once: node scripts/ingestMethodology.js
// Reads methodology files, chunks them, embeds via OpenAI, inserts into Supabase

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// --- Config ---
const CHUNK_SIZE = 500;       // tokens (approx 4 chars per token = 2000 chars)
const CHUNK_OVERLAP = 280;    // token overlap between chunks
const CHARS_PER_TOKEN = 4;
const CHUNK_CHARS = CHUNK_SIZE * CHARS_PER_TOKEN;
const OVERLAP_CHARS = CHUNK_OVERLAP * CHARS_PER_TOKEN;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 20;        // embed 20 chunks at a time to avoid rate limits

const METHODOLOGY_DIR = path.join(__dirname, '../methodology');
const FILES_TO_INGEST = [
  'methodology.md',
  'guide_voice_examples.md'
];

// --- Clients ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// --- Chunking ---
function chunkText(text, sourceFile) {
  const chunks = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_CHARS, text.length);
    const content = text.slice(start, end).trim();

    if (content.length > 50) { // skip tiny fragments
      chunks.push({
        content,
        source_file: sourceFile,
        chunk_index: chunkIndex
      });
      chunkIndex++;
    }

    if (end === text.length) break;
    start = end - OVERLAP_CHARS;
  }

  return chunks;
}

// --- OpenAI Embedding ---
async function embedBatch(texts) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data.map(item => item.embedding);
}

// --- Supabase Insert ---
async function insertChunks(chunks) {
  const { error } = await supabase
    .from('methodology_chunks')
    .insert(chunks);

  if (error) {
    throw new Error(`Supabase insert error: ${error.message}`);
  }
}

// --- Main ---
async function main() {
  console.log('🚀 Prep101 Methodology Ingestion Script');
  console.log('========================================');

  // Validate env
  if (!process.env.SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_KEY');
  if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

  // Clear existing chunks
  console.log('\n🗑️  Clearing existing chunks from Supabase...');
  const { error: deleteError } = await supabase
    .from('methodology_chunks')
    .delete()
    .neq('id', 0); // delete all rows

  if (deleteError) {
    console.warn('⚠️  Could not clear existing chunks:', deleteError.message);
  } else {
    console.log('✅ Cleared existing chunks');
  }

  let totalChunks = 0;

  for (const filename of FILES_TO_INGEST) {
    const filePath = path.join(METHODOLOGY_DIR, filename);

    if (!fs.existsSync(filePath)) {
      console.warn(`\n⚠️  File not found, skipping: ${filePath}`);
      continue;
    }

    console.log(`\n📄 Processing: ${filename}`);
    const text = fs.readFileSync(filePath, 'utf8');
    console.log(`   Size: ${(text.length / 1024).toFixed(1)} KB`);

    const chunks = chunkText(text, filename);
    console.log(`   Chunks: ${chunks.length}`);

    // Process in batches
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batch.map(c => c.content);

      process.stdout.write(`   Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);

      // Embed
      const embeddings = await embedBatch(batchTexts);

      // Attach embeddings to chunks
      const chunksWithEmbeddings = batch.map((chunk, idx) => ({
        ...chunk,
        embedding: embeddings[idx]
      }));

      // Insert into Supabase
      await insertChunks(chunksWithEmbeddings);

      process.stdout.write(` ✅\n`);

      // Small delay to respect rate limits
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    totalChunks += chunks.length;
    console.log(`   ✅ Done: ${chunks.length} chunks inserted`);
  }

  console.log('\n========================================');
  console.log(`✅ Ingestion complete!`);
  console.log(`   Total chunks inserted: ${totalChunks}`);
  console.log(`   Files processed: ${FILES_TO_INGEST.length}`);
  console.log('\nYou can now query methodology_chunks in Supabase.');
}

main().catch(err => {
  console.error('\n❌ Ingestion failed:', err.message);
  process.exit(1);
});
