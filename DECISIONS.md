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

## 2026-04-08
**Issue:** Reader101 was treating intimate material like standard reader coaching, which risks sanitizing the scene or pushing readers into the wrong kind of participation.
**Decision:** Added intimacy detection, an intimacy-only section, stricter consequence-based prompt rules, exact role-lock language, parent/minor professionalism guidance, and an intimacy-specific fallback path for partial text.
**Status:** Success

## 2026-04-08
**Issue:** Reader101 still needed stronger system-level handling for high-risk scenes involving shame, moral contradiction, and power imbalance, not just obvious intimacy keywords.
**Decision:** Added a high-risk scene classifier, injected system-level discomfort/playability language, forced emotional arc mapping, and required Foster-style Scene 3 adjustments for shame-heavy material.
**Status:** Success

## 2026-04-08
**Issue:** Guide generation could fail with "Upload session expired" in serverless cold starts because the upload response returned `text` while the generate flow expected `sceneText`, so the client fallback payload was often empty.
**Decision:** Normalized upload payloads on the client, returned `sceneText` from `/api/upload`, restored missing uploads from `scenePayloads` before throwing an expiry error, and cached the latest upload payload in `sessionStorage` for refresh recovery.
**Status:** Success

## 2026-04-08
**Issue:** Watermark-heavy PDFs were still slipping into generic fallback coaching, which created unacceptable UX and hid extraction failures behind "we'll build it from tone" messaging.
**Decision:** Strengthened watermark stripping heuristics, removed the generic fallback upload toast, and changed unreadable watermark/repetition cases to fail explicitly with an extraction error instead of generating fallback guides.
**Status:** Success

## 2026-04-08
**Issue:** Some watermarked PDFs are visually readable but break standard text extraction because the underlying text layer is garbage or unordered.
**Decision:** Added watermark-interference heuristics, escalated those files to OCR earlier in the upload pipeline, and surfaced an explicit image-based-reading recovery message when OCR is used successfully.
**Status:** Success
