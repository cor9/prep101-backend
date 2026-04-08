## 2026-04-08
**Issue:** Sparse and image-heavy PDFs were still falling through to weak extraction results because OCR existed in code but was never called from the upload route.
**Decision:** Wired the upload pipeline to try `pdf-parse` first, then Adobe when enabled and sparse, then OCR when extraction is still sparse, empty, or repetitive. Added extraction attempt metadata to health diagnostics.
**Status:** Success

## 2026-04-08
**Issue:** Short but readable audition sides were being marked unusable and pushed into fallback mode too early.
**Decision:** Reclassified `too_short` extraction results as readable-but-limited instead of unusable corruption, so clean short sides can still drive line-based guidance.
**Status:** Success

## 2026-04-08
**Issue:** Repo context files were stale about current PDF extraction behavior and monitoring.
**Decision:** Updated project context and extraction summary docs to reflect the live pipeline, health diagnostics, and remaining OCR deployment caveat.
**Status:** Success
