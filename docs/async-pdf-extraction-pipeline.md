# Async PDF Extraction Pipeline

This pipeline decouples upload from extraction and uses:

- **Node API**: upload + job orchestration
- **BullMQ + Redis**: background queue
- **Python FastAPI worker**: PDF raster + OpenCV purification
- **AI OCR providers**: Mistral OCR 3 first, LlamaParse premium fallback
- **Spatial mapper**: reconstruct screenplay semantics from bounding boxes

## API Endpoints

- `POST /api/extraction/jobs` (`multipart/form-data`, `file=PDF`)
  - Queues extraction job.
  - Returns `202` with `jobId`.
- `GET /api/extraction/jobs/:jobId`
  - Returns job state (`waiting|active|completed|failed`) and result when complete.

## Queue Worker

Start the worker in a separate process:

```bash
npm run worker:extract
```

The worker pipeline:

1. Purify PDF via `PDF_PURIFIER_URL/purify`.
2. Run OCR:
   - `mistral-ocr-2512` first.
   - fallback to LlamaParse premium with screenplay parsing instruction.
3. Run spatial mapping into structured screenplay sections + Fountain text.

## Python Service

See [python worker README](/Users/coreyralston/prep101-backend/python_worker/README.md).

## Required Environment Variables

- `REDIS_URL`
- `PDF_PURIFIER_URL`
- `MISTRAL_API_KEY`
- `LLAMA_CLOUD_API_KEY` (fallback path)

Optional tuning:

- `PDF_PURIFIER_DPI`
- `PDF_PURIFIER_MAX_PAGES`
- `EXTRACTION_WORKER_CONCURRENCY`
- `MISTRAL_OCR_URL`
- `LLAMA_PARSE_URL`
